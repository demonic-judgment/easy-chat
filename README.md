# Easy-Chat

一个基于 Vue 3 + TypeScript + Cloudflare Workers 构建的轻量级 AI 聊天应用，支持多智能体管理、提示词模板、图片对话等功能。

## 功能特性

### 核心特色
- **多智能体管理** - 创建多个 AI 智能体，每个智能体可配置独立的角色描述和首条消息
- **提示词模板** - 支持自定义提示词模板，可指定适用智能体，灵活组合对话上下文
- **图片对话** - 支持上传图片进行多模态对话
- **流式响应** - 支持 SSE 流式输出，实时显示 AI 回复
- **消息变体** - 支持重新生成消息并在不同变体间切换
- **无服务器** - 纯前端请求转发

### 数据管理
- **本地存储** - 使用 IndexedDB 存储所有数据（智能体、聊天记录、消息、图片等）

### 界面定制
- **自定义背景** - 支持纯色或图片背景，可调整透明度
- **悬浮图片** - 支持在聊天界面悬浮显示图片
- **主题色** - 粉色系主题（Element Plus 自定义主题）
- **响应式设计** - 适配移动端和桌面端

### 模型配置
- **多模型支持** - 可配置多个 AI 模型（OpenAI 兼容格式）
- **参数调节** - 支持 temperature、max_tokens 等参数配置
- **请求预览** - 发送前可预览完整的请求体

## 技术栈

### 前端
- **Vue 3** - 组合式 API + `<script setup>` 语法
- **TypeScript** - 类型安全
- **Pinia** - 状态管理
- **Vue Router** - 路由管理
- **数据导入/导出** - 支持完整数据的 JSON 导入导出
- **Google Drive 备份** - 支持将数据备份到 Google Drive
- **localStorage 迁移** - 自
- **Element Plus** - UI 组件库
- **Dexie.js** - IndexedDB 封装
- **Marked** - Markdown 渲染
- **Highlight.js** - 代码高亮
- **Vue Cropper** - 图片裁剪

### 后端
- **Cloudflare Workers** - Serverless 运行时
- **Wrangler** - 部署和管理工具

### 构建工具
- **Vite** - 构建工具
- **@cloudflare/vite-plugin** - Cloudflare 本地开发支持

## 项目结构

```
easy-chat/
├── public/                  # 静态资源
│   ├── favicon.ico
│   └── sw.js               # Service Worker
├── scripts/                 # 脚本
│   └── dev-with-port-kill.js
├── server/                  # Cloudflare Worker 后端
│   └── index.ts            # Worker 入口，处理 API 请求
├── src/
│   ├── assets/             # 样式和资源
│   │   ├── base.css
│   │   ├── main.css
│   │   └── logo.svg
│   ├── components/         # Vue 组件
│   │   ├── AgentSidebar.vue      # 智能体侧边栏
│   │   ├── ChatInput.vue         # 聊天输入框
│   │   ├── ChatMessage.vue       # 消息气泡
│   │   ├── DataManager.vue       # 数据管理面板
│   │   ├── FloatingImageViewer.vue # 悬浮图片查看器
│   │   ├── MarkdownRenderer.vue  # Markdown 渲染
│   │   └── SettingsPanel.vue     # 设置面板
│   ├── db/                 # 数据库
│   │   └── index.ts        # Dexie 数据库定义和迁移
│   ├── router/             # 路由
│   │   └── index.ts
│   ├── stores/             # Pinia 状态管理
│   │   ├── agent.ts        # 智能体状态
│   │   ├── chat.ts         # 聊天状态
│   │   ├── floatingImage.ts # 悬浮图片状态
│   │   ├── index.ts        # 统一导出
│   │   ├── message.ts      # 消息状态
│   │   ├── model.ts        # 模型配置状态
│   │   ├── prompt.ts       # 提示词模板状态
│   │   └── settings.ts     # 应用设置状态
│   ├── types/              # TypeScript 类型定义
│   │   └── index.ts
│   ├── utils/              # 工具函数
│   │   ├── backup.ts       # 数据备份
│   │   ├── googleDrive.ts  # Google Drive 集成
│   │   ├── id.ts           # ID 生成器
│   │   ├── imageStorage.ts # 图片存储管理
│   │   ├── serviceWorker.ts # Service Worker 注册
│   │   ├── storable.ts     # 数据序列化
│   │   ├── templateParser.ts # 模板解析器
│   │   └── thoughtChain.ts # 思维链处理
│   ├── views/              # 页面视图
│   │   └── ChatView.vue    # 主聊天页面
│   ├── App.vue             # 根组件
│   └── main.ts             # 入口文件
├── env.d.ts                # 环境类型声明
├── index.html
├── package.json
├── tsconfig.json           # TypeScript 配置
├── tsconfig.app.json
├── tsconfig.node.json
├── tsconfig.worker.json
├── vite.config.ts          # Vite 配置
└── wrangler.jsonc          # Wrangler 配置
```

## 快速开始

### 环境要求
- Node.js: `^20.19.0 || >=22.12.0`

### 安装依赖

```bash
npm install
```

### 开发模式

```bash
# 启动开发服务器（自动处理端口占用）
npm run dev

# 或使用安全模式（不自动处理端口）
npm run dev:safe
```

开发服务器默认运行在 `http://localhost:5173`

### 构建

```bash
# 类型检查 + 构建
npm run build

# 仅构建（跳过类型检查）
npm run build-only

# 类型检查
npm run type-check
```

### 预览

```bash
# 构建并使用 Wrangler 本地预览
npm run preview
```

### 部署

```bash
# 构建并部署到 Cloudflare Workers
npm run deploy
```

## 使用指南

### 1. 配置模型

1. 点击右上角设置按钮
2. 在"模型配置"标签页添加模型
3. 填写模型名称、API 地址和 API 密钥
4. 选择要使用的模型

支持的 API 格式：OpenAI 兼容格式

### 2. 创建智能体

1. 在左侧边栏点击"添加智能体"
2. 设置智能体名称、角色描述和首条消息
3. 可选：上传智能体头像

### 3. 创建提示词模板

1. 在设置面板切换到"提示词模板"标签页
2. 点击"添加模板"
3. 使用模板标签：`*role_description*`、`*chat_history*`、`*user_reply*`、`*自定义*`
4. 指定适用的智能体（留空表示通用）

### 4. 开始对话

1. 选择或创建一个智能体
2. 点击"开始对话"
3. 输入消息，支持上传图片（最多 9 张）
4. 点击发送或预览请求体

### 5. 数据管理

1. 在设置面板切换到"数据管理"标签页
2. 支持导出/导入 JSON 格式数据
3. 支持备份到 Google Drive

## 配置说明

### Wrangler 配置 (wrangler.jsonc)

```json
{
  "name": "easy-chat",
  "compatibility_date": "2026-05-02",
  "main": "server/index.ts",
  "assets": {
    "not_found_handling": "single-page-application"
  },
  "compatibility_flags": ["nodejs_compat"]
}
```

### Vite 配置 (vite.config.ts)

- 使用 `@cloudflare/vite-plugin` 支持本地 Worker 开发
- 配置路径别名 `@` 指向 `./src`
- 开发服务器端口固定为 5173

## 浏览器支持

- Chrome/Edge 88+
- Firefox 78+
- Safari 14+

需要支持：
- ES2020+
- IndexedDB
- Service Worker
- Fetch API

## 许可证

MIT License
