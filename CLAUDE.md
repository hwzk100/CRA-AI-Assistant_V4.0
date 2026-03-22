# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

```bash
# Development mode (builds preload, watches main process, starts dev server for renderer)
npm run dev

# Start dev servers only (without preload build, for faster iteration)
npm run dev:servers

# Renderer dev server only (runs on http://localhost:8080)
npm run dev:renderer

# Build individual processes
npm run build:main      # Main process (use -- --watch for development)
npm run build:renderer  # Renderer process
npm run build:preload   # Preload script (must rebuild when preload.ts changes)

# Production build
npm run build

# Platform-specific packaging
npm run build:win    # Windows
npm run build:mac    # macOS
npm run build:linux  # Linux

# Linting
npm run lint
```

**Note**: ESLint config is not present in the repository (package.json includes the script but no `.eslintrc` exists).

**Build Output**: All builds output to `dist/`:
- `dist/main/index.js` - Main process
- `dist/main/preload.js` - Preload script
- `dist/renderer/` - React UI bundle

## Architecture Overview

This is an Electron application for Clinical Research Associates (CRA) that extracts clinical trial data from PDFs and images using GLM-4 AI.

### Tech Stack
- **Desktop Framework**: Electron with main/renderer process separation
- **Frontend**: React 18 + TypeScript
- **Build System**: Webpack 5 with separate configs for main/renderer
- **Styling**: Tailwind CSS
- **State Management**: Zustand with persistence middleware
- **AI Integration**: Zhipu GLM-4 / GLM-4V API via axios
- **Document Processing**: pdf-parse (text PDFs), node-poppler (scanned PDFs to images), ExcelJS (Excel generation)

### Project Structure

```
src/
├── main/               # Electron main process (Node.js context)
│   ├── index.ts        # Main entry, creates window
│   ├── preload.ts      # Context bridge exposing safe APIs to renderer
│   ├── ipc/
│   │   └── handlers/   # IPC handlers (fileHandler, aiHandler, excelHandler, etc.)
│   └── services/
│       ├── AI/
│       │   ├── GLMService.ts      # GLM-4 API client
│       │   └── PromptEngine.ts    # Centralized prompt templates
│       ├── Storage/
│       │   └── FileStorage.ts     # In-memory file storage service
│       ├── PDFService/
│       │   ├── PDFProcessor.ts    # PDF processing with node-poppler (current)
│       │   └── pdf_converter.py   # Legacy Python script (deprecated, not used)
│       └── ExcelService/
│           └── ExcelGenerator.ts  # Excel export logic
├── renderer/           # React UI (browser context)
│   ├── App.tsx         # Root component
│   ├── hooks/
│   │   └── useStore.ts # Zustand store with persistence
│   └── components/     # React components
└── shared/             # Shared TypeScript code
    ├── types/
    │   ├── core.ts     # Core types: Result<T,E>, ErrorCode, FileInfo, etc.
    │   └── worksheet.ts# Worksheet-specific types
    └── constants/
        └── app.ts      # App constants
```

### IPC Communication Pattern

The app uses Electron's IPC (Inter-Process Communication) for main-renderer communication:

1. **Renderer** calls exposed API via `window.electronAPI.xxx()` (defined in `preload.ts`)
2. **ipcRenderer.invoke** sends request to main process
3. **Main process** handler in `src/main/ipc/handlers/` processes the request
4. **Result<T>** type is returned: `{ success: true; data: T } | { success: false; error: AppError }`

All IPC handlers are registered in `src/main/ipc/handlers/index.ts`.

Available IPC channels (defined in `src/shared/types/core.ts`):
- **File**: `file:upload`, `file:delete`, `file:getAll`, `file:getById`
- **AI**: `ai:testConnection`, `ai:processProtocolFile`, `ai:processSubjectFile`, `ai:analyzeEligibility`
  - `ai:analyzeEligibility` accepts an array of subject file paths and returns results for all files
- **Excel**: `excel:exportTracker`
- **Settings**: `settings:get`, `settings:set`, `settings:reset`
- **System**: `system:getVersion`, `system:openExternal`

### Error Handling Pattern

The codebase uses a functional Result type for error handling:

```typescript
type Result<T, E extends AppError = AppError> =
  | { success: true; data: T }
  | { success: false; error: E };
```

Prefer this pattern over throwing exceptions:
- Use `ok(data)` for success cases
- Use `err(createAppError(ErrorCode.X, 'message'))` for failures
- Check `result.success` before accessing `result.data`

### Type System Conventions

- **Path aliases** configured in tsconfig.json:
  - `@/*` → src/*
  - `@main/*` → src/main/*
  - `@renderer/*` → src/renderer/*
  - `@shared/*` → src/shared/*

- **Enums** are used for fixed values:
  - `StorageZone`: PROTOCOL, SUBJECT
  - `FileStatus`: PENDING, PROCESSING, COMPLETED, FAILED
  - `FileType`: PDF, IMAGE, WORD, EXCEL
  - `WorksheetType`: inclusionCriteria, exclusionCriteria, etc.

- **Criteria Types** support both single-file and multi-file results:
  - `InclusionCriteria.eligible` / `reason` - Single-file result (backward compatibility)
  - `InclusionCriteria.fileResults` - Multi-file results array (`InclusionFileResult[]`)
  - `ExclusionCriteria` has the same structure
  - `InclusionFileResult` / `ExclusionFileResult` contain: `fileId`, `fileName`, `eligible`, `reason`

### State Management (Zustand)

The app uses Zustand with persistence. The store (`src/renderer/hooks/useStore.ts`) includes:
- File management (protocolFiles, subjectFiles)
- Worksheet data (inclusionCriteria, exclusionCriteria, visitSchedule, etc.)
- UI state (activeWorksheet, isProcessing, processingStage, processingProgress)
- Settings (persisted to localStorage)

**Processing Stages**: The `isProcessing` flag combined with `processingStage` tracks async operations:
- `uploading` - File upload in progress
- `processing` - AI extraction/processing
- `generating` - Excel generation

**Eligibility Actions**:
- `updateInclusionEligibility(id, eligible, reason)` - Update single-file result
- `updateInclusionFileResults(criteriaId, fileResults)` - Update multi-file results
- `updateExclusionEligibility(id, eligible, reason)` - Update single-file result
- `updateExclusionFileResults(criteriaId, fileResults)` - Update multi-file results
- `clearInclusionEligibility`, `clearExclusionEligibility`, `clearAllEligibility` - Clear results

Use the exported hooks for selective subscriptions:
```typescript
const activeWorksheet = useActiveWorksheet();
const inclusionCriteria = useInclusionCriteria();
```

### AI Integration

AI operations use the GLMService singleton with retry logic:
- Prompts are centralized in `PromptEngine.ts` with system prompts for each extraction type
- Supports text extraction from PDFs and images using **GLM-4.6V-Flash** (free vision model)
- Returns `Result<T>` with typed responses
- JSON parsing handles markdown code blocks and malformed responses

**GLM-4.6V-Flash Image Format Requirement**: When using the vision model (`glm-4.6v-flash`), base64-encoded images MUST include the data URI prefix:
```typescript
url: `data:image/png;base64,${base64Image}`
```
Missing this prefix causes API error 1210. This is confirmed by Zhipu AI's official Python SDK examples.

**Note**: GLM-4.6V-Flash is a free vision model provided by Zhipu AI, no special permissions required.

Key AI operations:
- `extractCriteria` - Inclusion/exclusion criteria from protocol
- `extractVisitSchedule` - Visit schedule from protocol
- `recognizeMedications` - Medication information from documents
- `extractSubjectNumber` - Subject ID from subject files
- `extractSubjectVisitDates` - Visit dates for subject visits
- `extractSubjectVisitItems` - Visit items/checks for subject visits
- `extractFromImage` - Data extraction from images
- `extractSubjectDataFromImage` - Direct VLM analysis for scanned PDFs (extracts demographics)
- `analyzeEligibilityFromImage` - Direct VLM eligibility analysis for scanned PDFs
- `analyzeEligibility` - Evaluates subject eligibility against inclusion/exclusion criteria

### Multi-File Eligibility Analysis

The eligibility analysis feature supports analyzing multiple subject files at once:

1. **Multi-file API**: `ai:analyzeEligibility` accepts an array of file paths instead of a single path
2. **Batch Processing**: The handler iterates through all files, processing each one sequentially
3. **Results Structure**: Returns `{ results: [{ filePath, fileName, inclusion: [], exclusion: [] }] }`
4. **Error Handling**: Continues processing remaining files even if one fails
5. **Merged Results Display**: Each criterion shows one merged conclusion instead of a per-file matrix

**Type Extensions**:
- `InclusionFileResult` and `ExclusionFileResult` interfaces define per-file results
- `InclusionCriteria.fileResults` and `ExclusionCriteria.fileResults` store analysis results for multiple files
- Store actions `updateInclusionFileResults` and `updateExclusionFileResults` update multi-file results

**Result Merging Logic** (in `InclusionCriteriaWorksheet` and `ExclusionCriteriaWorksheet`):
- **Single file**: Direct display of that file's result
- **All files consistent**: "所有文件均符合/不符合"
- **Files inconsistent**: Majority voting - "多数符合/不符合 (X/Y 个文件)"

**UI Components**:
- `InclusionCriteriaWorksheet` and `ExclusionCriteriaWorksheet` display merged results
- No matrix view - each criterion shows one merged conclusion
- Backward compatible with single-file `eligible`/`reason` fields

### Scanned PDF Processing Flow

For image-based/scanned PDFs, the application uses a direct VLM (Vision Language Model) approach:

1. **PDF Type Detection**: `PDFProcessor.isScannedPDF()` checks if PDF has extractable text
2. **Image Conversion**: `node-poppler` converts PDF pages to PNG images using `pdfToPpm()`
3. **Direct VLM Analysis**: Images are sent directly to GLM-4.6V-Flash for analysis
4. **No OCR Step**: Unlike text PDFs, scanned PDFs bypass text extraction and use visual analysis

This approach is used in:
- `ai:processSubjectFile` - Extracts subject data via `extractSubjectDataFromImage()`
- `ai:analyzeEligibility` - Evaluates eligibility via `analyzeEligibilityFromImage()`

**Note**: For image-based PDFs, images are converted to PNG and sent to GLM-4.6V-Flash (free vision model) with the `data:image/png;base64,` prefix.

## PDF Processing

The application processes two types of PDFs:
- **Text-based PDFs**: Extracted directly using `pdf-parse`
- **Scanned/Image-based PDFs**: Converted to images using `node-poppler`, then analyzed with GLM-4.6V-Flash

### PDF Service Architecture

**PDFProcessor** (`src/main/services/PDFService/PDFProcessor.ts`):
- Uses `node-poppler` (Node.js wrapper around poppler binaries)
- Auto-detects PDF type (text vs scanned) based on text content
- For scanned PDFs, converts pages to PNG images in temp directory
- Automatic cleanup of temporary files (handles ENOENT gracefully)

**Legacy Files** (not used, kept for reference):
- `pdf_converter.py` - Old Python script approach (deprecated)
- `pdfConverter.mjs`, `pdfConverter.cjs` - Old JavaScript converters (deprecated)

### Poppler Integration

The application uses **poppler** (PDF rendering library) for converting scanned PDFs to images:

**Development Mode**:
- Poppler binaries are loaded from `resources/poppler/Library/bin`
- `PDFProcessor` creates `Poppler` instance with custom path

**Production Mode**:
- Poppler binaries are packaged with the application via `electron-builder` extraResources
- Located in `app.getPath('resources')/poppler/Library/bin`
- No user installation required

**Key Files**:
- `resources/poppler/` - Poppler Windows binaries (v24.08.0)
- `package.json` - `extraResources` config for packaging
- `src/main/services/PDFService/PDFProcessor.ts` - PDF processing logic with `node-poppler`

### Poppler API Usage

The PDFProcessor uses node-poppler's `pdfToPpm()` method with options:
```typescript
const options = {
  pngFile: true,              // Use PNG format instead of PPM
  resolutionXYAxis: 200,      // 200 DPI for better quality
  firstPageToConvert: 1,      // First page to convert
  lastPageToConvert: maxPages // Last page to convert
};
await poppler.pdfToPpm(filePath, outputPathPrefix, options);
```

Generated files follow pattern: `{prefix}-{page}.png`

### Updating Poppler

To update poppler to a newer version:

1. Download the latest release from https://github.com/oschwartz10612/poppler-windows/releases/
2. Extract and replace contents of `resources/poppler/`
3. Test PDF conversion functionality
4. Rebuild and redistribute the application

## Storage Zones

Files are organized into two storage zones:
- **PROTOCOL** - Clinical trial protocol documents (PDF/images)
- **SUBJECT** - Subject-specific documents

Each zone uses `FileStorageService` with in-memory Map storage (optional file persistence).

## Webpack Configuration

Separate webpack configs for each Electron process:
- `webpack.main.config.js` - Compiles main process (Node.js target)
- `webpack.renderer.config.js` - Compiles React UI with dev server
- `webpack.preload.config.js` - Compiles preload script (context bridge)

**Important**: When modifying `src/main/preload.ts`, you must run `npm run build:preload` for changes to take effect.

All configs output to `dist/` directory.

## API Key Configuration

The app requires a Zhipu AI API key for GLM-4. Users must:
1. Obtain API key from https://open.bigmodel.cn/
2. Configure in app settings (stored in Zustand persist storage)
3. Test connection before using AI features

Default API endpoint: `https://open.bigmodel.cn/api/paas/v4/chat/completions`
Default model: `glm-4` (use `glm-4.6v-flash` for image processing - free vision model)

**Security Note**: `src/shared/types/core.ts` contains `DEFAULT_SETTINGS` with a hardcoded development API key. This key should be removed before production deployment as it may be rate-limited or revoked. Users must provide their own key for production use.

## Building and Distribution

### Development Build

```bash
npm run build          # Build all processes
npm run build:main     # Build main process only
npm run build:renderer # Build renderer process only
npm run build:preload  # Build preload script only
```

### Production Build

The application uses **electron-builder** for packaging:

```bash
npm run build:win      # Build Windows installer (NSIS)
npm run build:mac      # Build macOS DMG
npm run build:linux    # Build Linux AppImage
```

**Build Output**: `release/` directory
- Windows: `CRA AI Assistant Setup x.x.x.exe`
- macOS: `CRA AI Assistant x.x.x.dmg`
- Linux: `CRA AI Assistant x.x.x.AppImage`

### Packaged Dependencies

The application includes all necessary dependencies in the installer:

**Included**:
- Node.js runtime (bundled by Electron)
- PDF processing libraries (pdf-parse, node-poppler)
- Poppler binaries (via `extraResources`)
- All npm dependencies

**Not Included** (users must provide):
- Zhipu AI API key (entered in app settings)

### Distribution Checklist

Before releasing a new version:

1. **Update version** in `package.json`
2. **Test all features**:
   - PDF upload and processing (both text and scanned)
   - AI extraction with different file types
   - Excel export
   - Settings persistence
3. **Remove development API key** from `src/shared/types/core.ts`
4. **Build installers** for target platforms
5. **Test installer** on clean system
6. **Create release notes** documenting changes

### User Installation Requirements

**End users need to install**:
- Nothing! All dependencies are packaged

**Users need to provide**:
- Zhipu AI API key (from https://open.bigmodel.cn/)

**System Requirements**:
- Windows 10+ / macOS 10.15+ / Linux (AppImage)
- 4GB RAM minimum
- 500MB disk space

## Troubleshooting

### AI API Error 1210

**Problem**: `API 调用参数有误 (错误代码: 1210)`

**Common Causes**:

1. **Wrong model for images**: Using `glm-4` instead of `glm-4.6v-flash`
   ```typescript
   // ✅ Correct: Use GLM-4.6V-Flash (free vision model)
   await this.callAPI(messages, retries, 'glm-4.6v-flash');

   // ❌ Wrong: glm-4 doesn't support images
   await this.callAPI(messages, retries, 'glm-4');
   ```

2. **Missing data URI prefix**: Base64 images must include `data:image/xxx;base64,` prefix
   ```typescript
   // ✅ Correct: With data URI prefix
   url: `data:image/png;base64,${base64Image}`

   // ❌ Wrong: Missing prefix (causes error 1210)
   url: base64Image
   ```

3. **API Key permissions**: API key may not have vision model access
   - GLM-4.6V-Flash is a free model and should work with any valid API key
   - Check at https://open.bigmodel.cn/ if issues persist

**Related Methods** (already correctly implemented):
- `GLMService.extractFromImage()`
- `GLMService.extractSubjectDataFromImage()`
- `GLMService.analyzeEligibilityFromImage()`

### PDF Conversion Issues

**Problem**: "找不到 poppler" error

**Development**: Ensure `resources/poppler/Library/bin/pdftoppm.exe` exists and path is correct

**Production**: Verify `extraResources` build configuration is correct and poppler files are included

**Solution**: Re-download poppler from official releases and replace in `resources/poppler/`

### Build Issues

**Problem**: electron-builder fails to package

**Common causes**:
1. Missing icon files in `build/` directory
2. Invalid `extraResources` path
3. Insufficient disk space

**Solution**: Check `release/builder-effective-config.yaml` for actual configuration

### AI Connection Issues

**Problem**: AI requests fail with authentication error

**Solution**: User must configure valid API key in app settings

### Cleanup Warnings

**Problem**: ENOENT errors when cleaning up temp images

**Note**: These are silently handled in the latest code. If you see them, ensure `PDFProcessor.cleanupImages()` properly ignores ENOENT errors.
