// 智能体
export interface Agent {
  id: string
  name: string
  roleDescription: string
  firstMessage: string
  avatar?: string
  createdAt: number
  updatedAt: number
}

// 聊天记录
export interface ChatHistory {
  id: string
  agentId: string
  title: string
  createdAt: number
  updatedAt: number
}

// 消息角色
export type MessageRole = 'system' | 'user' | 'assistant'

// 图片内容
export interface ImageContent {
  url: string
  name?: string
  type?: string
}

// 消息变体（用于重新生成功能）
export interface MessageVariant {
  id: string
  content: string
  images?: ImageContent[]
  meta?: Record<string, any>
  createdAt: number
}

// 消息
export interface Message {
  id: string
  chatHistoryId: string
  role: MessageRole
  content: string
  images?: ImageContent[] // 图片列表
  promptId?: string
  meta?: Record<string, any>
  createdAt: number
  // 重新生成相关字段
  variants?: MessageVariant[] // 所有变体
  currentVariantIndex?: number // 当前显示的变体索引
}

// 提示词项（在模板内部使用）
export interface PromptItem {
  id: string
  name: string // 如 "自定义1", "自定义2"
  content: string
  role: MessageRole
  createdAt: number
  updatedAt: number
}

// 提示词模板
export interface PromptTemplate {
  id: string
  name: string // 模板名称
  template: string // 模板内容，如 "*role_description*\n\n*自定义1*\n\n*自定义2*\n\n*user_reply*"
  agentIds: string[] // 适用智能体ID列表，空数组表示适用所有智能体
  prompts: PromptItem[] // 模板包含的提示词列表
  createdAt: number
  updatedAt: number
}

// 模板标签类型
export type TemplateTag = 'role_description' | 'chat_history' | 'user_reply' | 'custom' | string

// 解析后的模板片段
export interface TemplateSegment {
  type: 'text' | 'tag'
  content: string
  tag?: TemplateTag
  chatHistoryRange?: ChatHistoryRange
}

// 聊天记录范围
export interface ChatHistoryRange {
  start?: number
  end?: number
  isSingle: boolean
}

// 大模型配置
export interface ModelConfig {
  id: string
  name: string
  apiUrl: string
  apiKey: string
  params: string // JSON字符串，如 '{"temperature": 0.7, "max_tokens": 2000}'
  createdAt: number
  updatedAt: number
}

// 组装请求体
export interface AssembledRequest {
  id: string
  modelConfigId: string
  chatHistoryId: string
  messageIds: string[]
  createdAt: number
}

// API响应
export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
}

// 模型参数
export interface ModelParams {
  temperature?: number
  max_tokens?: number
  top_p?: number
  frequency_penalty?: number
  presence_penalty?: number
  [key: string]: any
}

// 背景设置
export interface BackgroundSettings {
  type: 'color' | 'image'
  value: string
  opacity: number
}

// 用户设置
export interface UserSettings {
  name: string
  avatar: string
}

// 应用设置
export interface AppSettings {
  background: BackgroundSettings
  chatOpacity: number
  avatarSize: number
  user: UserSettings
}

// 悬浮图片
export interface FloatingImage {
  id: string
  url: string
  name: string
  x: number
  y: number
  width: number
  height: number
  naturalWidth: number
  naturalHeight: number
  aspectRatio: number
  zIndex: number
  isVisible: boolean
}
