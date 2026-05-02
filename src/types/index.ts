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

// 消息
export interface Message {
  id: string
  chatHistoryId: string
  role: MessageRole
  content: string
  promptId?: string
  meta?: Record<string, any>
  createdAt: number
}

// 自定义提示词
export interface CustomPrompt {
  id: string
  name: string
  content: string
  role: MessageRole
  template: string
  createdAt: number
  updatedAt: number
}

// 模板标签类型
export type TemplateTag = 'role_description' | 'chat_history' | 'user_reply' | 'custom'

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

// 应用设置
export interface AppSettings {
  background: BackgroundSettings
  chatOpacity: number
  avatarSize: number
}
