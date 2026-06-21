import Dexie, { type Table } from 'dexie'
import type {
  Agent,
  ChatHistory,
  Message,
  PromptTemplate,
  ModelConfig,
  AppSettings,
  FloatingImage
} from '@/types'
import type { ImageRecord } from '@/utils/imageStorage'
import { toStorable } from '@/utils/storable'

export interface SettingsRecord {
  id: string
  value: AppSettings
}

export interface FloatingImagesRecord {
  id: string
  images: FloatingImage[]
  maxZIndex: number
}

export class EasyChatDatabase extends Dexie {
  agents!: Table<Agent, string>
  chatHistories!: Table<ChatHistory, string>
  messages!: Table<Message, string>
  templates!: Table<PromptTemplate, string>
  models!: Table<ModelConfig, string>
  settings!: Table<SettingsRecord, string>
  floatingImages!: Table<FloatingImagesRecord, string>
  images!: Table<ImageRecord, string>

  constructor() {
    super('EasyChatDB')
    this.version(2).stores({
      agents: 'id, name, createdAt, updatedAt',
      chatHistories: 'id, agentId, title, createdAt, updatedAt',
      messages: 'id, chatHistoryId, role, createdAt',
      templates: 'id, name, createdAt, updatedAt',
      models: 'id, name, createdAt, updatedAt',
      settings: 'id',
      floatingImages: 'id',
      images: 'id, messageId, createdAt'
    })
  }
}

export const db = new EasyChatDatabase()

// 数据迁移：从 localStorage 迁移到 IndexedDB
export async function migrateFromLocalStorage(): Promise<void> {
  const hasMigrated = localStorage.getItem('easy-chat-migrated-to-indexeddb')
  if (hasMigrated === 'true') return

  try {
    // 迁移 agents
    const agentsData = localStorage.getItem('easy-chat-agents')
    if (agentsData) {
      const agents: Agent[] = JSON.parse(agentsData)
      await db.agents.bulkPut(agents)
    }

    // 迁移 chatHistories
    const historiesData = localStorage.getItem('easy-chat-histories')
    if (historiesData) {
      const histories: ChatHistory[] = JSON.parse(historiesData)
      await db.chatHistories.bulkPut(histories)
    }

    // 迁移 messages
    const messagesData = localStorage.getItem('easy-chat-messages')
    if (messagesData) {
      const messages: Message[] = JSON.parse(messagesData)
      await db.messages.bulkPut(messages)
    }

    // 迁移 templates
    const templatesData = localStorage.getItem('easy-chat-templates')
    if (templatesData) {
      const templates: PromptTemplate[] = JSON.parse(templatesData)
      await db.templates.bulkPut(templates)
    }

    // 迁移 models
    const modelsData = localStorage.getItem('easy-chat-models')
    if (modelsData) {
      const models: ModelConfig[] = JSON.parse(modelsData)
      await db.models.bulkPut(models)
    }

    // 迁移 settings
    const settingsData = localStorage.getItem('easy-chat-settings')
    if (settingsData) {
      const settings: AppSettings = JSON.parse(settingsData)
      await db.settings.put({ id: 'app-settings', value: toStorable(settings) })
    }

    // 迁移 floatingImages
    const floatingImagesData = localStorage.getItem('easy-chat-floating-images')
    if (floatingImagesData) {
      const parsed = JSON.parse(floatingImagesData)
      await db.floatingImages.put({
        id: 'app-floating-images',
        images: toStorable(parsed.images || []),
        maxZIndex: parsed.maxZIndex || 1000
      })
    }

    // 标记已迁移
    localStorage.setItem('easy-chat-migrated-to-indexeddb', 'true')
    console.log('Data migration from localStorage to IndexedDB completed')
  } catch (error) {
    console.error('Migration failed:', error)
    throw error
  }
}
