# CRA AI Assistant

临床试验研究助理 (Clinical Research Assistant) - 基于 GLM-4 AI 的智能文档处理和数据提取工具。

## 功能特性

- 📋 **方案文档处理**: 从临床试验方案 PDF 中自动提取入选标准、排除标准和访视计划
- 👤 **受试者数据管理**: 自动识别受试者编号、访视日期和检查项目
- 👥 **人口统计学信息**: 提取受试者年龄、性别、身高、体重等信息
- 💊 **用药记录识别**: 从文档中智能识别用药信息
- 📄 **扫描版 PDF 支持**: 使用 GLM-4V 视觉模型处理扫描版 PDF
- 📊 **Excel 追踪表生成**: 一键生成完整的临床试验追踪表
- 🤖 **AI 驱动**: 使用智谱 GLM-4/GLM-4V 大语言模型进行数据提取

## 技术栈

- **桌面框架**: Electron
- **前端框架**: React 18 + TypeScript
- **构建工具**: Webpack 5
- **样式方案**: Tailwind CSS
- **状态管理**: Zustand
- **AI 模型**: 智谱 GLM-4 / GLM-4V
- **Excel 处理**: ExcelJS
- **PDF 处理**: pdf-parse (文本 PDF) + pdf-to-img (扫描版 PDF)

## 开发指南

### 安装依赖

```bash
npm install
```

### 开发模式

```bash
npm run dev
```

### 构建应用

```bash
npm run build
```

### 打包发布

```bash
# Windows
npm run build:win

# macOS
npm run build:mac

# Linux
npm run build:linux
```

## 配置说明

### API Key 配置

首次使用需要在应用设置中配置智谱 AI 的 API Key：

1. 打开应用
2. 点击设置
3. 输入您的智谱 AI API Key
4. 点击"测试连接"验证配置

获取 API Key: https://open.bigmodel.cn/

### 应用图标

将应用图标放置在 `build/` 目录：
- `icon.ico` - Windows 图标
- `icon.png` - macOS/Linux 图标

## 项目结构

```
src/
├── main/           # 主进程代码
│   ├── index.ts    # 主进程入口
│   ├── preload.ts  # 预加载脚本
│   ├── ipc/        # IPC 通信处理
│   └── services/   # 后端服务
├── renderer/       # 渲染进程代码
│   ├── App.tsx     # 根组件
│   ├── hooks/      # React Hooks
│   └── components/ # UI 组件
└── shared/         # 共享代码
    ├── types/      # TypeScript 类型定义
    └── constants/  # 常量定义
```

## 许可证

MIT License

## 更新日志

### v4.0.2 (2026-03-22)
- ✨ 新增多受试者文件资格分析功能（支持同时分析多个文件）
- ✨ 新增矩阵视图展示资格分析结果（文件为列，标准为行）
- 🎨 优化入选/排除标准工作表界面，支持列表/矩阵视图切换
- 📝 更新开发者文档

### v4.0.1 (2026-03-21)
- ✨ 新增扫描版 PDF 处理支持（使用 GLM-4V 视觉模型）
- ✨ 新增受试者人口统计学信息提取（年龄、性别、身高、体重等）
- 🐛 修复 PDF 文本提取为空的问题
- 📝 更新开发者文档，添加 PDF 处理机制说明

## 联系方式

如有问题或建议，请提交 Issue。
