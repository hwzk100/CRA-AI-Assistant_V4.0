# CRA AI Assistant 开发者手册

## 目录

1. [项目概述](#项目概述)
2. [技术架构](#技术架构)
3. [开发环境搭建](#开发环境搭建)
4. [项目结构](#项目结构)
5. [核心概念](#核心概念)
6. [开发指南](#开发指南)
7. [测试指南](#测试指南)
8. [构建与打包](#构建与打包)
9. [贡献指南](#贡献指南)

---

## 项目概述

**CRA AI Assistant** 是一款基于 Electron 的桌面应用，用于辅助临床研究助理（CRA）从临床试验文档中提取和管理结构化数据。

### 技术栈

| 技术 | 版本 | 用途 |
|------|------|------|
| **Electron** | ^27.0.0 | 桌面应用框架 |
| **React** | ^18.2.0 | UI 框架 |
| **TypeScript** | ^5.2.0 | 类型系统 |
| **Webpack** | ^5.89.0 | 模块打包 |
| **Zustand** | ^4.4.0 | 状态管理 |
| **Tailwind CSS** | ^3.3.0 | 样式框架 |
| **ExcelJS** | ^4.4.0 | Excel 生成 |
| **pdf-parse** | ^1.1.1 | PDF 文本解析 |
| **node-poppler** | ^7.0.0 | PDF 转图片（扫描版处理，使用 poppler-utils） |
| **axios** | ^1.6.0 | HTTP 客户端 |

### AI 集成

- **服务商**：智谱 AI (Zhipu AI)
- **API 端点**：https://open.bigmodel.cn/api/paas/v4/chat/completions

#### GLM-4 模型版本

智谱 AI 提供多种 GLM 模型版本，本项目使用：

| 模型 | 类型 | 支持输入 | 使用场景 |
|------|------|----------|----------|
| **glm-4** | 文本模型 | 仅文本 | 文本数据提取、标准分析、文本理解 |
| **glm-4.6v-flash** | 视觉模型（免费） | 文本 + 图片 | 扫描版 PDF 处理、图片 OCR、视觉理解 |

**重要提示**：
- 本项目使用 **GLM-4.6V-Flash** 免费视觉模型处理图片
- 处理图片或扫描版 PDF 时，会自动使用 `glm-4.6v-flash` 模型
- GLM-4.6V-Flash 是智谱 AI 提供的免费视觉推理模型，无需额外权限

**免费视觉模型特性**：
- 视觉推理能力
- 支持工具调用
- 128K 上下文
- 32K 最大输出

**模型使用场景**：

| 场景 | 使用模型 | 说明 |
|------|----------|------|
| 入选/排除标准提取 | glm-4 | 从方案文本中提取标准 |
| 访视计划提取 | glm-4 | 从方案文本中提取访视安排 |
| 受试者信息提取（文本） | glm-4 | 从文本 PDF 中提取人口统计学信息 |
| 受试者信息提取（扫描版） | glm-4.6v-flash | 从图片中提取人口统计学信息 |
| 扫描版 PDF 处理 | glm-4.6v-flash | 从图片中提取文字（OCR） |
| 图片文字识别 | glm-4.6v-flash | 从医疗文档图片中提取文字 |
| 资格分析（文本） | glm-4 | 基于提取的文本分析是否符合标准 |
| 资格分析（图片） | glm-4.6v-flash | 直接从图片分析是否符合入选/排除标准 |

#### GLM-4V 图片格式要求

**重要**：调用 GLM-4V 视觉模型时，base64 编码的图片必须包含 **data URI 前缀**。

正确的格式（参考智谱 AI 官方 Python SDK）：
```typescript
// ✅ 正确：包含 data URI 前缀
const messages = [
  {
    role: 'user',
    content: [
      {
        type: 'image_url',
        image_url: {
          url: `data:image/png;base64,${base64Image}`
        }
      },
      {
        type: 'text',
        text: '请描述图片内容'
      }
    ]
  }
];

// ❌ 错误：缺少前缀会导致 API 错误 1210
const messages = [
  {
    role: 'user',
    content: [
      {
        type: 'image_url',
        image_url: {
          url: base64Image  // 缺少 data:image/xxx;base64, 前缀
        }
      }
    ]
  }
];
```

**支持的图片格式**：
- `data:image/png;base64,` - PNG 图片
- `data:image/jpeg;base64,` - JPEG 图片
- `data:image/jpg;base64,` - JPG 图片（同 JPEG）

**相关方法**（已正确实现）：
- `GLMService.extractFromImage()` - 通用图片提取
- `GLMService.extractSubjectDataFromImage()` - 受试者数据提取
- `GLMService.analyzeEligibilityFromImage()` - 资格分析

---

## 技术架构

### Electron 架构

应用采用 Electron 的多进程架构：

```
┌─────────────────────────────────────────────────────────┐
│                    Electron 应用                        │
├──────────────────────┬──────────────────────────────────┤
│   Main Process       │   Renderer Process                │
│   (Node.js 环境)     │   (浏览器环境)                    │
│                      │                                  │
│  - 应用生命周期       │  - React UI                      │
│  - 窗口管理           │  - 用户交互                      │
│  - IPC 服务器         │  - 状态管理 (Zustand)           │
│  - 文件系统访问       │  - IPC 客户端                    │
│  - AI 服务调用        │                                  │
├──────────────────────┼──────────────────────────────────┤
│         Preload Script (Context Bridge)                 │
│         安全暴露 API 给 Renderer                        │
└─────────────────────────────────────────────────────────┘
```

### IPC 通信模式

Renderer → Preload → Main:

```typescript
// Renderer (通过 window.electronAPI)
const result = await window.electronAPI.uploadFile(file);

// Preload (暴露 API)
contextBridge.exposeInMainWorld('electronAPI', {
  uploadFile: (file) => ipcRenderer.invoke('file:upload', file)
});

// Main (IPC Handler)
ipcMain.handle('file:upload', async (event, file) => {
  return fileHandler.upload(file);
});
```

### 状态管理

使用 Zustand 进行全局状态管理，配合持久化中间件：

```typescript
interface StoreState {
  // 文件管理
  protocolFiles: FileInfo[];
  subjectFiles: FileInfo[];

  // 工作表数据
  inclusionCriteria: InclusionCriteria[];
  exclusionCriteria: ExclusionCriteria[];

  // UI 状态
  activeWorksheet: WorksheetType;
  isProcessing: boolean;
}

const useStore = create<StoreState>()(
  persist(
    (set, get) => ({
      // 状态定义
    }),
    { name: 'cra-ai-storage' }
  )
);
```

---

## 开发环境搭建

### 前置要求

- **Node.js**：v18.0.0 或更高版本
- **npm**：v9.0.0 或更高版本
- **Git**：用于版本控制

### 安装步骤

1. **克隆仓库**

```bash
git clone https://github.com/your-org/cra-ai-assistant.git
cd cra-ai-assistant
```

2. **安装依赖**

```bash
npm install
```

3. **启动开发服务器**

```bash
npm run dev
```

这将：
- 构建预加载脚本
- 启动主进程监听模式
- 启动渲染器开发服务器
- 打开 Electron 窗口

### 可用脚本

| 命令 | 说明 |
|------|------|
| `npm run dev` | 完整开发环境（构建 preload + 启动监听 + 开发服务器） |
| `npm run dev:servers` | 仅启动开发服务器（不重新构建 preload） |
| `npm run dev:renderer` | 仅启动渲染器开发服务器 |
| `npm run build` | 生产构建（main + renderer + preload） |
| `npm run build:main` | 构建主进程 |
| `npm run build:renderer` | 构建渲染器 |
| `npm run build:preload` | 构建预加载脚本 |
| `npm run build:win` | 打包 Windows 安装包 |
| `npm run build:mac` | 打包 macOS 安装包 |
| `npm run build:linux` | 打包 Linux 安装包 |

---

## 项目结构

```
cra-ai-assistant/
├── src/
│   ├── main/                    # 主进程代码
│   │   ├── index.ts            # 应用入口
│   │   ├── preload.ts          # 预加载脚本（Context Bridge）
│   │   ├── ipc/                # IPC 通信层
│   │   │   └── handlers/       # IPC 处理器
│   │   │       ├── index.ts    # 处理器注册
│   │   │       ├── aiHandler.ts
│   │   │       ├── dialogHandler.ts
│   │   │       ├── fileHandler.ts
│   │   │       ├── settingsHandler.ts
│   │   │       ├── systemHandler.ts
│   │   │       └── excelHandler.ts
│   │   └── services/           # 业务服务
│   │       ├── AI/
│   │       │   ├── GLMService.ts      # GLM-4 API 客户端
│   │       │   ├── PromptEngine.ts    # Prompt 模板 + 文本分段
│   │       │   ├── BatchProcessor.ts  # 大文件分批处理
│   │       │   ├── ResultMerger.ts    # 多批次结果合并
│   │       │   └── types.ts           # AI 相关类型定义
│   │       ├── Storage/
│   │       │   └── FileStorage.ts     # 文件存储服务
│   │       ├── PDFService/
│   │       │   └── PDFProcessor.ts    # PDF 解析与转换（node-poppler）
│   │       └── ExcelService/
│   │           └── ExcelGenerator.ts  # Excel 生成
│   │
│   ├── renderer/               # 渲染器进程代码
│   │   ├── App.tsx            # 根组件
│   │   ├── main.tsx           # React 入口
│   │   ├── components/        # React 组件
│   │   │   ├── Layout/        # 布局组件
│   │   │   ├── FileUpload/    # 文件上传组件
│   │   │   ├── WorkSheet/     # 工作表组件
│   │   │   └── Settings/      # 设置组件
│   │   └── hooks/             # React Hooks
│   │       └── useStore.ts    # Zustand Store
│   │
│   └── shared/                 # 共享代码
│       ├── types/             # TypeScript 类型定义
│       │   ├── core.ts        # 核心类型
│       │   └── worksheet.ts   # 工作表类型
│       └── constants/         # 常量定义
│           └── app.ts
│
├── dist/                      # 构建输出目录
├── build/                     # 构建资源（图标等）
├── docs/                      # 文档
│   ├── USER_MANUAL.md
│   └── DEVELOPER_MANUAL.md
│
├── webpack.main.config.js     # 主进程 Webpack 配置
├── webpack.renderer.config.js # 渲染器 Webpack 配置
├── webpack.preload.config.js  # 预加载脚本 Webpack 配置
├── tsconfig.json              # TypeScript 配置
├── tailwind.config.js         # Tailwind CSS 配置
├── package.json
└── README.md
```

---

## 核心概念

### Result 类型

应用使用函数式的 Result 类型进行错误处理，而非异常抛出：

```typescript
type Result<T, E extends AppError = AppError> =
  | { success: true; data: T }
  | { success: false; error: E };

// 使用示例
const result = await uploadFile(file);
if (result.success) {
  console.log(result.data);
} else {
  console.error(result.error.message);
}
```

### 存储区域 (StorageZone)

文件按存储区域组织：

```typescript
enum StorageZone {
  PROTOCOL = 'protocol',  // 方案文件
  SUBJECT = 'subject'     // 受试者文件
}
```

### 工作表类型 (WorksheetType)

支持的工作表类型：

```typescript
type WorksheetType =
  | 'inclusionCriteria'   // 入选标准
  | 'exclusionCriteria'   // 排除标准
  | 'visitSchedule'       // 访视计划
  | 'subjectVisits'       // 受试者访视
  | 'medications';        // 用药记录
```

### 文件状态 (FileStatus)

```typescript
enum FileStatus {
  PENDING = 'pending',       // 待处理
  PROCESSING = 'processing', // 处理中
  COMPLETED = 'completed',   // 已完成
  FAILED = 'failed'          // 失败
}
```

### PDF 处理机制

应用支持两种类型的 PDF 文件，并自动根据文件大小选择单次处理或分批处理。

#### PDF 类型检测

使用 `pdf-parse` 提取文本，当文本少于 100 字符或有效字符占比低于 30% 时判定为扫描版 PDF：

```typescript
const textLength = data.text.trim().length;
const meaningfulChars = data.text.replace(/[\s\n\r\t]/g, '').length;
const isScanned = textLength < PDF_CONFIG.SCANNED_TEXT_THRESHOLD
  || meaningfulChars < textLength * PDF_CONFIG.MEANINGFUL_CHAR_RATIO;
```

#### 文本 PDF 处理

**小文件 (<16000 字符)**：一次性提取全文，并行调用 `extractCriteria` + `extractVisitSchedule`。

**大文件 (>16000 字符)**：自动分批处理：

```
PromptEngine.splitContent(content, chunkTokens=6000, overlapTokens=500)
  → 按 chunkTokens*2 字符分段
  → 分割点优先级：段落(\n\n) > 行(\n) > 句(。) > 任意
  → 段间重叠 overlapTokens*2 字符
  → 每段附加 [这是长文档的第X/Y段] 提示
  ↓
BatchProcessor.processTextInBatches → 串行处理每段
  ↓
ResultMerger 合并去重
```

#### 扫描版 PDF 处理

使用 `node-poppler`（而非 pdf-to-img）将 PDF 页面转换为 PNG 图片，再通过 GLM-4.6V-Flash 视觉模型处理。

**小文件 (≤10 页)**：转换全部页面，逐页 OCR 或逐页 VLM 分析。

**大文件 (>10 页)**：分批转换处理：

```
BatchProcessor.processScannedInBatches(filePath, pdfProcessor, processFn)
  → 每批转换 BATCH_IMAGES_PER_BATCH (5) 页为 PNG
  → 每批处理完毕后立即 cleanupImages() 删除临时图片
  → 串行处理避免内存溢出
  ↓
对于方案文件: OCR 每批 → 合并全文 → 再走文本分批提取
对于受试者文件: 逐页 VLM 分析 → ResultMerger 合并受试者数据
对于资格分析: 逐页 VLM 分析 → ResultMerger 合并资格结果
```

#### 分批处理配置

所有分批参数集中在 `PDF_CONFIG` 常量（`src/shared/constants/app.ts`）：

```typescript
export const PDF_CONFIG = {
  MAX_PAGES_FOR_CONVERSION: 10,      // 单次最大转换页数
  SCANNED_TEXT_THRESHOLD: 100,       // 扫描版文本阈值
  MEANINGFUL_CHAR_RATIO: 0.3,        // 有效字符占比阈值
  TEMP_DIR: 'cra-ai-pdf-cache',      // 临时目录
  IMAGE_SCALE: 2.0,                   // PDF转图片缩放
  BATCH_TEXT_CHUNK_TOKENS: 6000,      // 文本每批大小（tokens）
  BATCH_TEXT_OVERLAP_TOKENS: 500,     // 段间重叠（tokens）
  BATCH_IMAGES_PER_BATCH: 5,         // 扫描PDF每批图片数
  BATCH_AI_MAX_TOKENS: 8192,         // AI响应max_tokens
  BATCH_LARGE_FILE_THRESHOLD: 16000, // 启用分批的字符数阈值
} as const;
```

#### 结果合并策略

`ResultMerger` 提供四种合并策略：

| 数据类型 | 合并规则 |
|---------|---------|
| 入选/排除标准 | 按 description 文本相似度(>0.9)去重，保留更完整版本 |
| 访视计划 | 按 visitType 去重，同类型合并 items 数组 |
| 受试者数据 | 非 null 字段后批覆盖前批，数组按内容去重 |
| 资格分析 | 所有批次一致→取该结果；不一致→多数投票+标记"需人工审核" |

#### 进度反馈

大文件处理时，主进程通过 IPC 事件 `ai:progress` 推送进度到渲染进程：

```typescript
// 主进程发送进度
event.sender.send('ai:progress', { current: 2, total: 10, stage: '正在处理文本批次 2/10' });

// Preload 暴露监听接口
onProgress: (callback) => {
  const listener = (_event, progress) => callback(progress);
  ipcRenderer.on('ai:progress', listener);
  return () => ipcRenderer.removeListener('ai:progress', listener);
}

// FileZone 组件监听
useEffect(() => {
  const cleanup = window.electronAPI.onProgress((progress) => {
    const percent = Math.round((progress.current / progress.total) * 100);
    setProcessing(true, 'processing', percent);
  });
  return cleanup;
}, []);
```

#### GLMService max_tokens 配置

不同提取方法使用不同的 `max_tokens`：

| 方法 | max_tokens | 说明 |
|------|-----------|------|
| `extractCriteria` | 8192 | 标准提取可能返回大量条目 |
| `extractVisitSchedule` | 8192 | 访视计划数据量较大 |
| `analyzeEligibility` | 8192 | 资格分析结果较长 |
| `recognizeMedications` | 4096 | 用药记录适中 |
| `extractSubjectNumber` | 2048 | 仅提取基本信息，数据量小 |

#### PDF 处理缓存

```typescript
const pdfContentCache = new Map<string, PDFContentResult>();

async function readPDFContent(filePath: string): Promise<PDFContentResult> {
  if (pdfContentCache.has(filePath)) {
    return pdfContentCache.get(filePath)!;
  }
  // ... 处理逻辑 ...
  pdfContentCache.set(filePath, result.data);
  return result.data;
}
```

---

## 开发指南

### 添加新的 IPC 处理器

1. **定义 IPC 频道**（在 `src/shared/types/core.ts`）:

```typescript
export const IPC_CHANNELS = {
  // 现有频道...
  myNewFeature: 'myFeature:doSomething'
} as const;
```

2. **实现处理器**（在 `src/main/ipc/handlers/`）:

```typescript
// myHandler.ts
import { ipcMain } from 'electron';
import type { IPCChannels } from '@shared/types/core';

export const registerMyHandler = () => {
  ipcMain.handle(IPC_CHANNELS.myNewFeature, async (event, arg) => {
    try {
      // 处理逻辑
      const result = await doSomething(arg);
      return ok(result);
    } catch (error) {
      return err(createAppError(ErrorCode.UNKNOWN_ERROR, error.message));
    }
  });
};
```

3. **注册处理器**（在 `src/main/ipc/handlers/index.ts`）:

```typescript
import { registerMyHandler } from './myHandler';

export const registerHandlers = () => {
  // 现有注册...
  registerMyHandler();
};
```

4. **在 Preload 中暴露**（在 `src/main/preload.ts`）:

```typescript
contextBridge.exposeInMainWorld('electronAPI', {
  // 现有 API...
  myFeature: {
    doSomething: (arg) => ipcRenderer.invoke('myFeature:doSomething', arg)
  }
});
```

5. **在 Renderer 中使用**:

```typescript
const result = await window.electronAPI.myFeature.doSomething(arg);
```

### 添加新的工作表

1. **定义类型**（在 `src/shared/types/core.ts`）:

```typescript
export interface MyNewData {
  id: string;
  field1: string;
  field2: number;
}
```

2. **更新 Store**（在 `src/renderer/hooks/useStore.ts`）:

```typescript
interface StoreState {
  // 现有状态...
  myNewData: MyNewData[];
}
```

3. **创建组件**（在 `src/renderer/components/WorkSheet/`）:

```typescript
// MyNewWorksheet.tsx
export const MyNewWorksheet: React.FC = () => {
  const data = useMyNewData();
  // 组件实现
};
```

4. **注册到路由**（在 `src/renderer/App.tsx`）:

```typescript
const renderWorksheet = () => {
  switch (activeWorksheet) {
    // 现有 case...
    case 'myNewData':
      return <MyNewWorksheet />;
  }
};
```

### 添加新的 AI 提取功能

1. **定义 Prompt**（在 `src/main/services/AI/PromptEngine.ts`）:

```typescript
export const EXTRACTION_PROMPTS = {
  // 现有 prompts...
  myNewExtraction: (context: string) => `
你是一个专业的临床数据提取助手。请从以下文本中提取 XXX 信息：

${context}

请以 JSON 格式返回：
{
  "items": [...]
}
  `.trim(),
};
```

2. **实现提取方法**（在 `src/main/services/AI/GLMService.ts`）:

```typescript
async extractMyData(fileContent: string): Promise<Result<MyData[]>> {
  const prompt = EXTRACTION_PROMPTS.myNewExtraction(fileContent);
  const response = await this.callAI(prompt);
  // 处理响应...
}
```

3. **添加 IPC 处理器**（参考"添加新的 IPC 处理器"）

#### 处理大文件（分批处理）

如果新功能需要处理大型 PDF，使用 `BatchProcessor` 和 `ResultMerger`：

```typescript
// 在 aiHandler.ts 中
ipcMain.handle('ai:extractMyNewData', async (event, fileId: string, filePath: string) => {
  const settings = getSettings();
  const pdfResult = await readPDFContent(filePath);

  if (pdfResult.type === 'text') {
    if (BatchProcessor.shouldBatch(pdfResult.content)) {
      // 大文件分批处理
      const batches = await BatchProcessor.processTextInBatches(
        pdfResult.content,
        async (chunk, batchIdx, total) => {
          sendProgress(event, batchIdx + 1, total, `正在处理批次 ${batchIdx + 1}/${total}`);
          const service = getGLMService({ apiKey: settings.apiKey });
          const result = await service.extractMyData(chunk);
          return result.success ? result.data : [];
        }
      );
      // 合并结果
      return ok(ResultMerger.mergeCriteria(batches));
    }
    // 小文件单次调用
    const service = getGLMService({ apiKey: settings.apiKey });
    return await service.extractMyData(pdfResult.content);
  }
});
```

#### 处理扫描版文档

如果新功能需要处理扫描版 PDF，使用 `BatchProcessor.processScannedInBatches`：

```typescript
// 大型扫描 PDF 分批处理
const pdfProcessor = await getPDFProcessor();
const results = await BatchProcessor.processScannedInBatches(
  filePath,
  pdfProcessor,
  async (imagePaths, batchIdx, totalBatches) => {
    sendProgress(event, batchIdx + 1, totalBatches, `正在分析批次 ${batchIdx + 1}/${totalBatches}`);
    const service = getGLMService({ apiKey: settings.apiKey, modelName: 'glm-4.6v-flash' });
    const batchResults = [];
    for (const imagePath of imagePaths) {
      const result = await service.extractSubjectDataFromImage(imagePath);
      if (result.success) batchResults.push(result.data);
    }
    return batchResults;
  }
);
const merged = ResultMerger.mergeSubjectData(results.flat());
```

### 样式开发指南

使用 Tailwind CSS 工具类：

```tsx
// 布局
<div className="flex flex-col items-center justify-center">

// 间距
<div className="p-4 m-2">

// 颜色
<div className="bg-white text-gray-800">

// 响应式
<div className="w-full md:w-1/2">

// 状态
<div className={`${isActive ? 'bg-blue-500' : 'bg-gray-300'}">

// 条件渲染
<div className={cn(
  'base-class',
  condition && 'conditional-class',
  className
)}>
```

---

## 测试指南

### 运行测试

目前项目尚未配置测试框架。建议配置：

| 框架 | 用途 |
|------|------|
| **Jest** | 单元测试 |
| **React Testing Library** | React 组件测试 |
| **Playwright** | E2E 测试 |

### 手动测试清单

#### 文件上传测试
- [ ] 拖放上传单个文件
- [ ] 点击选择文件
- [ ] 批量上传多个文件
- [ ] 上传超大文件
- [ ] 上传不支持的文件类型
- [ ] 删除文件
- [ ] 清空文件列表

#### AI 解析测试
- [ ] PDF 文本提取
- [ ] 图片文字识别
- [ ] 入选标准提取
- [ ] 排除标准提取
- [ ] 访视计划提取
- [ ] 受试者信息提取
- [ ] 用药记录提取

#### Excel 导出测试
- [ ] 导出所有工作表
- [ ] 导出单个工作表
- [ ] 空数据导出
- [ ] 大数据量导出
- [ ] Excel 格式验证

---

## 构建与打包

### 开发构建

```bash
# 构建所有
npm run build

# 分别构建
npm run build:main      # 输出到 dist/main/
npm run build:renderer  # 输出到 dist/renderer/
npm run build:preload   # 输出到 dist/main/preload.js
```

### 生产打包

#### Windows

```bash
npm run build:win
```

生成文件：`release/CRA AI Assistant Setup.exe`

#### macOS

```bash
npm run build:mac
```

生成文件：`release/CRA AI Assistant.dmg`

#### Linux

```bash
npm run build:linux
```

生成文件：`release/CRA AI Assistant.AppImage`

### 打包配置

打包配置在 `package.json` 的 `build` 字段中：

```json
{
  "build": {
    "appId": "com.cra.aiassistant",
    "productName": "CRA AI Assistant",
    "directories": {
      "output": "release",
      "buildResources": "build"
    },
    "files": ["dist/**/*", "package.json"],
    "win": {
      "target": [{"target": "nsis", "arch": ["x64"]}],
      "icon": "build/icon.ico"
    }
  }
}
```

### 添加应用图标

1. **Windows**：放置 `build/icon.ico`
2. **macOS/Linux**：放置 `build/icon.png`（建议 512x512px）

---

## 贡献指南

### 代码风格

项目遵循以下代码风格：

- **TypeScript**：严格模式，所有函数和变量必须有类型注解
- **React**：函数组件，使用 Hooks
- **命名**：
  - 组件：PascalCase（如 `FileZone.tsx`）
  - 函数/变量：camelCase（如 `uploadFile`）
  - 常量：UPPER_SNAKE_CASE（如 `MAX_FILE_SIZE`）
  - 类型/接口：PascalCase（如 `FileInfo`）
- **导入顺序**：
  1. React/核心库
  2. 第三方库
  3. 内部模块（使用 @ 别名）

### 提交规范

使用语义化提交消息：

```
<type>(<scope>): <subject>

<body>

<footer>
```

**类型 (type)**：
- `feat`: 新功能
- `fix`: Bug 修复
- `docs`: 文档更新
- `style`: 代码格式（不影响功能）
- `refactor`: 重构
- `perf`: 性能优化
- `test`: 测试相关
- `chore`: 构建/工具相关

**示例**：

```
feat(ai): add medication extraction from PDF

- Implement medication recognition prompt
- Add IPC handler for medication extraction
- Update medications worksheet to display extracted data

Closes #123
```

### Pull Request 流程

1. Fork 项目
2. 创建功能分支：`git checkout -b feature/my-feature`
3. 提交更改：`git commit -m 'feat: add my feature'`
4. 推送分支：`git push origin feature/my-feature`
5. 创建 Pull Request

---

## 常见开发问题

### Q: 修改 preload.ts 后不生效？

**A**: 需要重新构建 preload 脚本：

```bash
npm run build:preload
```

然后重启应用。

### Q: TypeScript 类型错误？

**A**: 确保使用路径别名：

```typescript
// ✅ 正确
import { FileInfo } from '@shared/types/core';

// ❌ 错误
import { FileInfo } from '../../../shared/types/core';
```

### Q: 开发服务器热更新不工作？

**A**: 尝试重启开发服务器：

```bash
# 停止当前服务器（Ctrl+C）
npm run dev
```

### Q: AI 响应格式错误？

**A**: 检查 `GLMService.ts` 中的 JSON 解析逻辑，确保处理各种响应格式（纯 JSON、Markdown 代码块等）。

### Q: 扫描版 PDF 无法提取文字？

**A**: 确保以下几点：

1. **检查 API Key 配置**：确保 GLM-4.6V-Flash 模型的 API Key 已正确配置
2. **检查 PDF 转换**：查看控制台是否有 `[PDFProcessor] Detected scanned PDF` 日志
3. **检查 poppler**：确保 `resources/poppler/Library/bin/pdftoppm.exe` 存在
4. **检查临时文件**：确认系统临时目录可写（`os.tmpdir()/cra-ai-pdf-cache`）
5. **检查页面数量**：大文件自动分批处理，每批 5 页

### Q: PDF 内容提取为空？

**A**: 可能的原因：

1. **PDF 是图片格式**：检查日志中是否有 `PDF text length (without spaces): < 50`
2. **PDF 加密**：某些 PDF 有密码保护
3. **PDF 编码问题**：某些 PDF 使用特殊编码

解决方法：查看调试文件 `C:\Users\<用户名>\.claude\debug\pdf-content-debug.txt` 的内容。

### Q: GLM-4V 调用失败？

**A**: 确保以下几点：

1. **API Key 权限**：确认 API Key 支持 GLM-4.6V-Flash 模型
2. **模型名称**：使用 `glm-4.6v-flash`（免费视觉模型）
3. **图片格式**：确保图片是 JPEG 或 PNG 格式
4. **图片大小**：GLM-4V 对图片大小有限制，通常 10MB 以内

**常见错误**：

- **错误代码 1210**：`API 调用参数有误，请检查文档。`
  - 原因：使用 `glm-4` 模型处理图片输入
  - 解决：切换到 `glm-4v` 模型

### Q: API 返回错误代码 1210？

**A**: 错误代码 1210 表示"API 调用参数有误"，可能的原因有：

**原因 1：使用了错误的模型**
- **症状**：错误信息为 `API 调用参数有误，请检查文档。`
- **原因**：`glm-4` 模型仅支持文本输入，不支持图片
- **解决**：在图片相关操作中使用 `glm-4.6v-flash` 免费视觉模型

代码示例：
```typescript
// ✅ 正确：图片处理使用 GLM-4.6V-Flash（免费）
const result = await this.callAPI(messages, retries, 'glm-4.6v-flash');

// ❌ 错误：图片处理使用 glm-4 会报错
const result = await this.callAPI(messages, retries, 'glm-4');
```

**原因 2：base64 图片缺少 data URI 前缀**
- **症状**：即使使用视觉模型仍然返回错误 1210
- **原因**：base64 编码的图片必须包含 `data:image/xxx;base64,` 前缀
- **解决**：确保图片 URL 格式正确

代码示例：
```typescript
// ✅ 正确：包含 data URI 前缀
url: `data:image/png;base64,${base64Image}`

// ❌ 错误：缺少前缀
url: base64Image
```

**原因 3：API Key 权限不足**
- **症状**：所有格式都正确但仍然报错
- **原因**：API Key 可能没有视觉模型的访问权限
- **解决**：访问 https://open.bigmodel.cn/ 检查 API Key 权限

**注意**：GLM-4.6V-Flash 是智谱 AI 的免费视觉模型，应该可以直接使用，无需特殊权限。

**调试步骤**：
1. 确认使用 `glm-4.6v-flash` 模型（非 `glm-4`）
2. 确认图片 URL 包含 data URI 前缀
3. 检查 API Key 是否有效
4. 查看控制台日志中的完整错误信息

---

## 性能优化建议

1. **大文件处理**：已实现分批处理机制，文本按 6000 tokens 分段（500 tokens 重叠），扫描 PDF 每批 5 页图片
2. **内存管理**：每批扫描 PDF 处理后立即删除临时图片文件，避免内存堆积
3. **AI 调用**：分批串行调用避免并发过多；不同方法使用合适的 max_tokens（8192/4096/2048）
4. **缓存策略**：PDF 内容缓存避免重复读取；处理后清理缓存防止文件引用失效
5. **结果合并**：多批次结果自动去重合并，标准按相似度>0.9 去重，访视按类型合并
6. **进度反馈**：通过 IPC 事件推送实时进度，用户可感知处理进展

---

## 安全注意事项

1. **API Key**：不要硬编码到代码中，使用环境变量或用户设置
2. **文件路径**：验证用户输入的文件路径，防止路径遍历攻击
3. **IPC 通信**：使用 Context Bridge 隔离主进程和渲染器
4. **数据验证**：在主进程验证所有来自渲染器的数据
5. **依赖更新**：定期更新依赖包，修复安全漏洞

---

## 许可证

MIT License - 详见 LICENSE 文件

---

## 联系方式

- **项目主页**：https://github.com/your-org/cra-ai-assistant
- **问题反馈**：https://github.com/your-org/cra-ai-assistant/issues
- **开发者邮箱**：dev@cra-ai.com

---

*本文档最后更新：2026年3月30日*

## 更新日志

### v4.0.3 (2026-03-30)
- **重大更新**：支持大文件（500页 PDF）分批处理
  - 新增 `BatchProcessor` 服务：文本分段处理 + 扫描 PDF 分批转换
  - 新增 `ResultMerger` 服务：多批次结果智能合并（去重、投票）
  - 新增 `PromptEngine.splitContent()`：智能文本分段，支持段落/行/句优先分割
  - `PDFProcessor`：新增 `getPDFPageCount()`、`convertPDFToImagesBatch()`，支持分页范围转换
  - `GLMService`：新增 `maxTokensOverride` 参数，不同方法使用合适 token 限制
  - `aiHandler`：三个核心 handler 均支持分批处理，不再仅处理首页
  - 进度反馈：通过 `ai:progress` IPC 事件推送实时进度到渲染进程
- **修复**：扫描版 PDF 受试者文件仅分析第 1 页的问题
- **修复**：扫描版 PDF 资格分析仅使用第 1 页的问题
- **修复**：大文本 PDF 内容截断导致数据不完整的问题

### v4.0.2 (2026-03-23)
- **重大更新**：切换到智谱 AI 免费视觉模型 GLM-4.6V-Flash
  - 替换付费的 glm-4v 模型为免费的 glm-4.6v-flash
  - GLM-4.6V-Flash 支持视觉推理、工具调用、128K 上下文
  - 用户无需额外权限即可使用视觉功能
- **修复**：GLM-4V API 调用错误 1210
  - 修复 base64 图片缺少 data URI 前缀的问题
  - 根据智谱 AI 官方 Python SDK 确认正确格式
  - 更新 `extractFromImage`、`extractSubjectDataFromImage`、`analyzeEligibilityFromImage` 方法
- **文档**：添加 GLM-4.6V-Flash 免费视觉模型说明和格式要求

### v4.0.1 (2026-03-23)
- 添加扫描版 PDF 处理支持（GLM-4V）
- 添加受试者人口统计学信息提取功能
- 更新 PDF 读取逻辑以自动检测文本/扫描版

### v4.0.0 (2026-03-21)
- 添加扫描版 PDF 处理支持（GLM-4V）
- 添加受试者人口统计学信息提取功能
- 更新 PDF 读取逻辑以自动检测文本/扫描版
