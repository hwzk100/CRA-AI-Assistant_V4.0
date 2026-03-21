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
- **Document Processing**: pdf-parse for PDFs, ExcelJS for Excel generation

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
- **AI**: `ai:testConnection`, `ai:extractCriteria`, `ai:extractVisitSchedule`, `ai:recognizeMedications`, `ai:extractSubjectNumber`, `ai:extractSubjectVisitDates`, `ai:extractSubjectVisitItems`, `ai:extractFromImage`
- **Excel**: `excel:exportTracker`
- **Settings**: `settings:get`, `settings:set`, `settings:reset`
- **System**: `system:getVersion`, `system:openExternal`
- **Dialog**: `dialog:openFile`, `dialog:saveFile` (handler registration commented out in `src/main/ipc/handlers/index.ts`)

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

Use the exported hooks for selective subscriptions:
```typescript
const activeWorksheet = useActiveWorksheet();
const inclusionCriteria = useInclusionCriteria();
```

### AI Integration

AI operations use the GLMService singleton with retry logic:
- Prompts are centralized in `PromptEngine.ts` with system prompts for each extraction type
- Supports text extraction from PDFs and images (GLM-4V)
- Returns `Result<T>` with typed responses
- JSON parsing handles markdown code blocks and malformed responses

Key AI operations:
- `extractCriteria` - Inclusion/exclusion criteria from protocol
- `extractVisitSchedule` - Visit schedule from protocol
- `recognizeMedications` - Medication information from documents
- `extractSubjectNumber` - Subject ID from subject files
- `extractSubjectVisitDates` - Visit dates for subject visits
- `extractSubjectVisitItems` - Visit items/checks for subject visits
- `extractFromImage` - Data extraction from images

### Storage Zones

Files are organized into two storage zones:
- **PROTOCOL** - Clinical trial protocol documents (PDF/images)
- **SUBJECT** - Subject-specific documents

Each zone uses `FileStorageService` with in-memory Map storage (optional file persistence).

### Webpack Configuration

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
Default model: `glm-4` (use `glm-4v` for image processing)

**Security Note**: `src/shared/types/core.ts` contains `DEFAULT_SETTINGS` with a hardcoded development API key. This key should be removed before production deployment as it may be rate-limited or revoked. Users must provide their own key for production use.
