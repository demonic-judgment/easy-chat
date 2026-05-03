# Easy Chat

一个基于cloudflare免费计划，实现跨平台去中心化的大模型 API 配置聊天程序，支持多智能体管理、自定义提示词模板和流式对话。

## 功能特性

- 多智能体管理 - 创建和管理多个 AI 智能体，每个智能体可配置独立的角色描述和开场白
- 聊天记录管理 - 为每个智能体维护多个独立的对话记录
- 自定义提示词模板 - 支持灵活的模板系统，可插入角色描述、聊天记录、自定义提示词等
- 大模型配置 - 支持配置多个大模型 API（API 地址、密钥、参数）
- 流式响应 - 支持 SSE 流式输出，实时显示 AI 回复
- Markdown 渲染 - 消息内容支持 Markdown 格式化和代码高亮
- 个性化设置 - 可更换全局背景（图片/颜色）、调整聊天界面透明度、自定义头像大小
- 数据备份 - 支持导出/导入所有数据

## 技术栈

**前端**
- Vue 3 + TypeScript
- Element Plus UI 组件库
- Pinia 状态管理
- Vue Router 路由管理
- Marked + Highlight.js Markdown 渲染

**后端**
- Cloudflare Workers + TypeScript
- 支持流式 (SSE) 和非流式 API 请求

**部署**
- Vite 构建工具
- Cloudflare Workers 部署

## 项目结构

```
easy-chat/
├── src/
│   ├── components/          # Vue 组件
│   │   ├── AgentSidebar.vue     # 智能体侧边栏
│   │   ├── ChatInput.vue        # 聊天输入框
│   │   ├── ChatMessage.vue      # 消息气泡组件
│   │   ├── DataManager.vue      # 数据管理组件
│   │   ├── MarkdownRenderer.vue # Markdown 渲染组件
│   │   └── SettingsPanel.vue    # 设置面板
│   ├── stores/              # Pinia 状态管理
│   │   ├── agent.ts         # 智能体状态
│   │   ├── chat.ts          # 聊天记录状态
│   │   ├── message.ts       # 消息状态
│   │   ├── model.ts         # 大模型配置状态
│   │   ├── prompt.ts        # 提示词模板状态
│   │   └── settings.ts      # 应用设置状态
│   ├── utils/               # 工具函数
│   │   ├── backup.ts        # 数据备份工具
│   │   ├── id.ts            # ID 生成器
│   │   └── templateParser.ts # 模板解析器
│   ├── views/               # 页面视图
│   │   └── ChatView.vue     # 主聊天界面
│   ├── types/               # TypeScript 类型定义
│   │   └── index.ts
│   ├── App.vue              # 根组件
│   └── main.ts              # 入口文件
├── server/
│   └── index.ts             # Cloudflare Worker 后端
├── docs/
│   └── 开发文档.md          # 开发文档
├── package.json
├── vite.config.ts
├── wrangler.jsonc           # Cloudflare Workers 配置
└── tsconfig.json
```

## 核心实体

- **智能体 (Agent)** - AI 角色配置，包含名称、角色描述、开场白
- **聊天记录 (ChatHistory)** - 与特定智能体的对话记录
- **消息 (Message)** - 单条聊天消息，支持系统/用户/助手三种角色
- **提示词模板 (PromptTemplate)** - 可复用的提示词模板，支持标签插入
- **大模型配置 (ModelConfig)** - API 地址、密钥、模型参数配置

## 快速开始

### 环境要求

- Node.js ^20.19.0 || >=22.12.0

### 安装依赖

```bash
npm install
```

### 开发模式

```bash
npm run dev
```

### 本地预览（含 Cloudflare Workers）

```bash
npm run preview
```

### 构建

```bash
npm run build
```

### 部署到 Cloudflare Workers

```bash
npm run deploy
```

## 界面布局

- **左侧边栏** - 可折叠的智能体列表，选中智能体后展开显示聊天记录列表
- **中间区域** - 聊天界面，显示消息历史和输入框
- **设置面板** - 包含大模型配置、自定义提示词、智能体设置等

## 主题风格

- 采用粉色 (#ff85a2) 作为主色调
- 圆角设计风格
- 支持自定义背景图片或颜色
- 聊天界面透明度可调

## 许可证

MIT
