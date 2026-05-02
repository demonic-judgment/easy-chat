import type { Agent, ChatHistory, Message, PromptTemplate, ModelConfig, AppSettings } from '@/types'

// 数据备份结构
export interface BackupData {
  version: string
  exportedAt: number
  data: {
    agents: Agent[]
    chatHistories: ChatHistory[]
    messages: Message[]
    templates: PromptTemplate[]
    models: ModelConfig[]
    settings: AppSettings
  }
}

// 本地存储键名映射
const STORAGE_KEYS = {
  agents: 'easy-chat-agents',
  chatHistories: 'easy-chat-histories',
  messages: 'easy-chat-messages',
  templates: 'easy-chat-templates',
  models: 'easy-chat-models',
  settings: 'easy-chat-settings'
}

const BACKUP_VERSION = '1.0.0'

/**
 * 导出所有数据
 */
export function exportAllData(): BackupData {
  const getItem = (key: string) => {
    const stored = localStorage.getItem(key)
    return stored ? JSON.parse(stored) : null
  }

  const settings = getItem(STORAGE_KEYS.settings) || {}

  return {
    version: BACKUP_VERSION,
    exportedAt: Date.now(),
    data: {
      agents: getItem(STORAGE_KEYS.agents) || [],
      chatHistories: getItem(STORAGE_KEYS.chatHistories) || [],
      messages: getItem(STORAGE_KEYS.messages) || [],
      templates: getItem(STORAGE_KEYS.templates) || [],
      models: getItem(STORAGE_KEYS.models) || [],
      settings
    }
  }
}

/**
 * 导出数据为 JSON 文件
 */
export function exportDataToFile(): void {
  const backupData = exportAllData()
  const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)

  const date = new Date().toISOString().split('T')[0]
  const filename = `easy-chat-backup-${date}.json`

  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/**
 * 验证备份数据格式
 */
export function validateBackupData(data: unknown): { valid: boolean; error?: string } {
  if (!data || typeof data !== 'object') {
    return { valid: false, error: '无效的备份文件格式' }
  }

  const backup = data as Partial<BackupData>

  if (!backup.version) {
    return { valid: false, error: '备份文件缺少版本信息' }
  }

  if (!backup.data || typeof backup.data !== 'object') {
    return { valid: false, error: '备份文件缺少数据内容' }
  }

  // 验证必要的数据字段
  const requiredFields = ['agents', 'chatHistories', 'messages', 'templates', 'models', 'settings']

  for (const field of requiredFields) {
    if (!(field in backup.data)) {
      return { valid: false, error: `备份文件缺少 ${field} 数据` }
    }
    if (!Array.isArray((backup.data as Record<string, unknown>)[field]) && field !== 'settings') {
      return { valid: false, error: `${field} 数据格式不正确` }
    }
  }

  return { valid: true }
}

/**
 * 恢复数据
 * @param backupData 备份数据
 * @param options 恢复选项
 */
export function restoreData(
  backupData: BackupData,
  options: {
    merge?: boolean
    keepExisting?: boolean
  } = {}
): { success: boolean; error?: string; stats?: RestoreStats } {
  const { merge = false, keepExisting = false } = options

  try {
    const validation = validateBackupData(backupData)
    if (!validation.valid) {
      return { success: false, error: validation.error }
    }

    const stats: RestoreStats = {
      agents: { imported: 0, skipped: 0 },
      chatHistories: { imported: 0, skipped: 0 },
      messages: { imported: 0, skipped: 0 },
      templates: { imported: 0, skipped: 0 },
      models: { imported: 0, skipped: 0 },
      settings: { imported: false }
    }

    // 获取现有数据
    const getExisting = (key: string) => {
      const stored = localStorage.getItem(key)
      return stored ? JSON.parse(stored) : []
    }

    // 合并或替换数据
    const processData = <T extends { id: string }>(
      newData: T[],
      existingData: T[],
      key: 'agents' | 'chatHistories' | 'messages' | 'templates' | 'models'
    ): T[] => {
      if (!keepExisting) {
        stats[key].imported = newData.length
        return newData
      }

      if (merge) {
        const existingIds = new Set(existingData.map(item => item.id))
        const merged = [...existingData]

        for (const item of newData) {
          if (!existingIds.has(item.id)) {
            merged.push(item)
            stats[key].imported++
          } else {
            stats[key].skipped++
          }
        }
        return merged
      }

      stats[key].imported = newData.length
      return newData
    }

    // 恢复各项数据
    const existingAgents = getExisting(STORAGE_KEYS.agents)
    const agents = processData(backupData.data.agents, existingAgents, 'agents')
    localStorage.setItem(STORAGE_KEYS.agents, JSON.stringify(agents))

    const existingHistories = getExisting(STORAGE_KEYS.chatHistories)
    const chatHistories = processData(backupData.data.chatHistories, existingHistories, 'chatHistories')
    localStorage.setItem(STORAGE_KEYS.chatHistories, JSON.stringify(chatHistories))

    const existingMessages = getExisting(STORAGE_KEYS.messages)
    const messages = processData(backupData.data.messages, existingMessages, 'messages')
    localStorage.setItem(STORAGE_KEYS.messages, JSON.stringify(messages))

    const existingTemplates = getExisting(STORAGE_KEYS.templates)
    const templates = processData(backupData.data.templates, existingTemplates, 'templates')
    localStorage.setItem(STORAGE_KEYS.templates, JSON.stringify(templates))

    const existingModels = getExisting(STORAGE_KEYS.models)
    const models = processData(backupData.data.models, existingModels, 'models')
    localStorage.setItem(STORAGE_KEYS.models, JSON.stringify(models))

    // 恢复设置
    if (!keepExisting || !localStorage.getItem(STORAGE_KEYS.settings)) {
      localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify(backupData.data.settings))
      stats.settings.imported = true
    }

    return { success: true, stats }
  } catch (error) {
    return { success: false, error: `恢复失败: ${error instanceof Error ? error.message : '未知错误'}` }
  }
}

/**
 * 从文件读取备份数据
 */
export function readBackupFromFile(file: File): Promise<{ success: boolean; data?: BackupData; error?: string }> {
  return new Promise((resolve) => {
    const reader = new FileReader()

    reader.onload = (e) => {
      try {
        const content = e.target?.result as string
        const data = JSON.parse(content) as BackupData
        const validation = validateBackupData(data)

        if (!validation.valid) {
          resolve({ success: false, error: validation.error })
          return
        }

        resolve({ success: true, data })
      } catch (error) {
        resolve({ success: false, error: '无法解析备份文件，请检查文件格式' })
      }
    }

    reader.onerror = () => {
      resolve({ success: false, error: '读取文件失败' })
    }

    reader.readAsText(file)
  })
}

// 恢复统计信息
export interface RestoreStats {
  agents: { imported: number; skipped: number }
  chatHistories: { imported: number; skipped: number }
  messages: { imported: number; skipped: number }
  templates: { imported: number; skipped: number }
  models: { imported: number; skipped: number }
  settings: { imported: boolean }
}

/**
 * 获取数据概览
 */
export function getDataOverview(): {
  agents: number
  chatHistories: number
  messages: number
  templates: number
  models: number
} {
  const getCount = (key: string) => {
    const stored = localStorage.getItem(key)
    if (!stored) return 0
    try {
      const data = JSON.parse(stored)
      return Array.isArray(data) ? data.length : 0
    } catch {
      return 0
    }
  }

  return {
    agents: getCount(STORAGE_KEYS.agents),
    chatHistories: getCount(STORAGE_KEYS.chatHistories),
    messages: getCount(STORAGE_KEYS.messages),
    templates: getCount(STORAGE_KEYS.templates),
    models: getCount(STORAGE_KEYS.models)
  }
}

/**
 * 清空所有数据
 */
export function clearAllData(): void {
  Object.values(STORAGE_KEYS).forEach(key => {
    localStorage.removeItem(key)
  })
}
