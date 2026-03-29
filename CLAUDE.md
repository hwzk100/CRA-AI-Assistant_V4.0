# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

```bash
npm run dev              # Build preload, watch main process, start dev server + Electron
npm run dev:servers      # Watch main + renderer dev server only (skip preload build)
npm run dev:renderer     # Renderer dev server only (http://localhost:8080)

npm run build:main       # Build main process (add -- --watch for watch mode)
npm run build:renderer   # Build renderer process
npm run build:preload    # Build preload script (MUST rebuild when preload.ts changes)
npm run build            # Build all processes

npm run build:win        # Production: Windows installer (NSIS) → release/
npm run build:mac        # Production: macOS DMG → release/
npm run build:linux      # Production: Linux AppImage → release/

npm run lint             # ESLint (note: no .eslintrc exists in repo)
```

Build output goes to `dist/`: `dist/main/index.js`, `dist/main/preload.js`, `dist/renderer/`.

## Architecture Overview

Electron desktop app for Clinical Research Associates (CRA) that extracts clinical trial data from PDFs/images using Zhipu GLM-4 AI. The UI language is Chinese.

### Tech Stack
- **Electron** with main/renderer process separation, context isolation enabled
- **React 18 + TypeScript**, styled with **Tailwind CSS**
- **Webpack 5** with separate configs per process (`webpack.{main,renderer,preload}.config.js`)
- **Zustand** with persistence middleware for state
- **Zhipu GLM-4** (text) / **GLM-4.6V-Flash** (vision, free) via axios
- **pdf-parse** (text PDFs), **node-poppler** (scanned PDFs → PNG images), **ExcelJS** (export)

### Project Structure

```
src/
├── main/                    # Electron main process (Node.js)
│   ├── index.ts             # App entry, window creation, CSP headers
│   ├── preload.ts           # contextBridge → window.electronAPI
│   ├── ipc/handlers/        # IPC handlers registered via registerIPCHandlers()
│   │   ├── index.ts         # Central registration (calls all register* functions)
│   │   ├── aiHandler.ts     # AI operations with PDF content caching
│   │   ├── dialogHandler.ts # Native file open/save dialogs
│   │   ├── fileHandler.ts, excelHandler.ts, settingsHandler.ts, systemHandler.ts
│   └── services/
│       ├── AI/
│       │   ├── GLMService.ts      # Singleton API client with retry logic
│       │   ├── PromptEngine.ts    # Centralized prompt templates + JSON parser
│       │   └── types.ts           # AI-related type definitions
│       ├── Storage/FileStorage.ts # In-memory Map storage by zone (PROTOCOL|SUBJECT)
│       ├── PDFService/PDFProcessor.ts  # PDF type detection + node-poppler conversion
│       └── ExcelService/ExcelGenerator.ts + styles.ts
├── renderer/                # React UI (browser context)
│   ├── App.tsx, index.tsx
│   ├── hooks/useStore.ts    # Zustand store + selective subscription hooks
│   └── components/          # Layout/, FileUpload/, WorkSheet/, Settings/
└── shared/
    ├── types/core.ts        # Result<T>, ErrorCode, FileInfo, IPCChannel, AppSettings, criteria types
    ├── types/worksheet.ts   # Worksheet-specific types + helpers (generateId, cloneItem)
    └── constants/app.ts     # DEFAULT_SETTINGS, WORKSHEET_CONFIG
```

### Path Aliases (tsconfig.json)
`@/*` → `src/*`, `@main/*` → `src/main/*`, `@renderer/*` → `src/renderer/*`, `@shared/*` → `src/shared/*`

## IPC Communication Pattern

1. **Renderer** calls `window.electronAPI.xxx()` (mapped in `preload.ts`)
2. `ipcRenderer.invoke` sends to main process handler in `src/main/ipc/handlers/`
3. Handler returns `Result<T>`: `{ success: true; data: T } | { success: false; error: AppError }`

All handlers are registered in `src/main/ipc/handlers/index.ts` via `registerIPCHandlers()`.

### Registered IPC Channels

| Channel | Purpose |
|---------|---------|
| `file:upload`, `file:delete`, `file:getAll`, `file:getById` | File CRUD by zone |
| `ai:testConnection`, `ai:testGLM4V` | Test API connectivity (text / vision model) |
| `ai:extractCriteria`, `ai:extractVisitSchedule`, `ai:recognizeMedications` | Protocol extraction |
| `ai:extractSubjectNumber`, `ai:extractSubjectVisitDates`, `ai:extractSubjectVisitItems` | Subject data extraction |
| `ai:extractFromImage` | Image OCR via VLM |
| `ai:processProtocolFile` | Combined: read PDF → extract criteria + visit schedule |
| `ai:processSubjectFile` | Combined: read PDF/image → extract subject data, visits, medications |
| `ai:analyzeEligibility` | Multi-file eligibility analysis (accepts `string[]` of file paths) |
| `excel:exportTracker` | Excel export |
| `settings:get`, `settings:set`, `settings:reset` | Settings CRUD |
| `system:getVersion`, `system:openExternal` | System utilities |
| `dialog:openFile`, `dialog:saveFile` | Native file dialogs |

## Error Handling Pattern

```typescript
type Result<T, E extends AppError = AppError> =
  | { success: true; data: T }
  | { success: false; error: E };
```

Use `ok(data)` and `err(createAppError(ErrorCode.X, 'message'))`. Check `result.success` before accessing `result.data`. Prefer this over throwing exceptions.

## State Management (Zustand)

Store at `src/renderer/hooks/useStore.ts` manages: files (protocolFiles, subjectFiles), worksheet data (inclusionCriteria, exclusionCriteria, visitSchedule, subjectVisits, medications, subjectDemographics), UI state (activeWorksheet, isProcessing, processingStage), and settings (persisted to localStorage).

**Processing stages**: `uploading` → `processing` → `generating`

**Eligibility actions**: `updateInclusionEligibility`, `updateInclusionFileResults`, `updateExclusionEligibility`, `updateExclusionFileResults`, `clearInclusionEligibility`, `clearExclusionEligibility`, `clearAllEligibility`

Use selective subscription hooks: `useActiveWorksheet()`, `useInclusionCriteria()`, `useExclusionCriteria()`, `useSubjectFiles()`.

### Multi-File Eligibility & Result Merging

Criteria types support both single-file (`eligible`/`reason`) and multi-file (`fileResults: InclusionFileResult[] | ExclusionFileResult[]`) results. Merging logic in worksheet components:
- Single file → direct display
- All files consistent → "所有文件均符合/不符合"
- Files disagree → majority voting, "多数符合/不符合 (X/Y 个文件)"

## AI Integration (GLMService)

Singleton (`getGLMService(config)`) with retry logic and centralized prompts in `PromptEngine.ts`.

**Two models**: `glm-4` for text, `glm-4.6v-flash` (free vision model) for images/scanned PDFs.

**Critical**: When using the vision model, base64 images MUST include the data URI prefix:
```typescript
url: `data:image/png;base64,${base64Image}`
```
Missing this prefix causes API error 1210. The `callAPI` method accepts a `modelOverride` parameter to switch models.

## PDF Processing

Two flows based on PDF type detection (`PDFProcessor.isScannedPDF()`):
- **Text PDFs**: `pdf-parse` extracts text → sent to GLM-4 as text
- **Scanned PDFs**: `node-poppler` converts pages to PNG → sent directly to GLM-4.6V-Flash (no OCR step)

Poppler binaries are at `resources/poppler/Library/bin` (dev) or `app.getPath('resources')/poppler` (production, via `extraResources`).

## Key Types

- **Enums**: `StorageZone` (PROTOCOL, SUBJECT), `FileStatus` (PENDING, PROCESSING, COMPLETED, FAILED), `FileType` (PDF, IMAGE, WORD, EXCEL, UNKNOWN), `WorksheetType` (inclusionCriteria, exclusionCriteria, visitSchedule, subjectVisits, medications, subjectDemographics)
- **Criteria types**: `InclusionCriteria`, `ExclusionCriteria` with optional `fileResults` arrays for multi-file analysis
- `SubjectDemographics`: subjectNumber, screeningNumber, randomizationNumber, age, gender, height, weight, etc.

## API Configuration

Users must configure a Zhipu AI API key (from https://open.bigmodel.cn/) in app settings. Default endpoint: `https://open.bigmodel.cn/api/paas/v4/chat/completions`.

**Security Note**: `DEFAULT_SETTINGS` in `src/shared/types/core.ts` contains a hardcoded development API key — remove before production deployment.

## Common Pitfalls

- **API error 1210**: Wrong model for images (use `glm-4.6v-flash`), missing data URI prefix on base64 images, or API key lacks vision model access
- **Preload changes**: Must run `npm run build:preload` after modifying `preload.ts`
- **Poppler not found**: Ensure `resources/poppler/Library/bin/pdftoppm.exe` exists
- **GPU errors**: Hardware acceleration is disabled (`app.disableHardwareAcceleration()`) to fix Windows GPU issues
- **AI handler uses lazy-loaded PDFProcessor**: imported via dynamic `import()` to avoid pdfjs-dist loading during startup
