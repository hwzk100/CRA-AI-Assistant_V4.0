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
| **pdf-parse** | ^1.1.1 | PDF 解析 |
| **axios** | ^1.6.0 | HTTP 客户端 |

### AI 集成

- **服务商**：智谱 AI (Zhipu AI)
- **模型**：GLM-4 / GLM-4V
- **API 端点**：https://open.bigmodel.cn/api/paas/v4/chat/completions

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
│   │   │       ├── fileHandler.ts
│   │   │       ├── settingsHandler.ts
│   │   │       └── excelHandler.ts
│   │   └── services/           # 业务服务
│   │       ├── AI/
│   │       │   ├── GLMService.ts      # GLM-4 API 客户端
│   │       │   └── PromptEngine.ts    # Prompt 模板
│   │       ├── Storage/
│   │       │   └── FileStorage.ts     # 文件存储服务
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

---

## 性能优化建议

1. **文件上传**：使用分块上传处理大文件
2. **AI 调用**：实现请求队列，避免并发过多
3. **渲染性能**：使用虚拟列表处理大量数据
4. **内存管理**：及时清理不需要的数据和监听器
5. **缓存策略**：缓存 AI 解析结果，避免重复调用

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

*本文档最后更新：2026年3月21日*
