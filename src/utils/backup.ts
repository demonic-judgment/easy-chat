import type { Agent, ChatHistory, Message, PromptTemplate, ModelConfig, AppSettings, FloatingImage } from '@/types'
import { toStorable } from '@/utils/storable'
import { db } from '@/db'

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
    floatingImages: FloatingImage[]
  }
}

const BACKUP_VERSION = '1.0.0'

/**
 * 导出所有数据
 */
export async function exportAllData(): Promise<BackupData> {
  const [agents, chatHistories, messages, templates, models, settingsRecord, floatingImagesRecord] = await Promise.all([
    db.agents.toArray(),
    db.chatHistories.toArray(),
    db.messages.toArray(),
    db.templates.toArray(),
    db.models.toArray(),
    db.settings.get('app-settings'),
    db.floatingImages.get('app-floating-images')
  ])

  const defaultSettings: AppSettings = {
    background: { type: 'color', value: '#ffeef5', opacity: 1 },
    chatOpacity: 0.95
  }

  return {
    version: BACKUP_VERSION,
    exportedAt: Date.now(),
    data: {
      agents,
      chatHistories,
      messages,
      templates,
      models,
      settings: settingsRecord?.value || defaultSettings,
      floatingImages: floatingImagesRecord?.images || []
    }
  }
}

/**
 * 导出数据为 JSON 文件
 */
export async function exportDataToFile(): Promise<void> {
  const backupData = await exportAllData()
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
  const requiredFields = ['agents', 'chatHistories', 'messages', 'templates', 'models', 'settings', 'floatingImages']

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

// 恢复统计信息
export interface RestoreStats {
  agents: { imported: number; skipped: number }
  chatHistories: { imported: number; skipped: number }
  messages: { imported: number; skipped: number }
  templates: { imported: number; skipped: number }
  models: { imported: number; skipped: number }
  settings: { imported: boolean }
  floatingImages: { imported: number; skipped: number }
}

/**
 * 恢复数据
 * @param backupData 备份数据
 * @param options 恢复选项
 */
export async function restoreData(
  backupData: BackupData,
  options: {
    merge?: boolean
    keepExisting?: boolean
  } = {}
): Promise<{ success: boolean; error?: string; stats?: RestoreStats }> {
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
      settings: { imported: false },
      floatingImages: { imported: 0, skipped: 0 }
    }

    // 获取现有数据
    const [existingAgents, existingHistories, existingMessages, existingTemplates, existingModels, existingFloatingImages] = await Promise.all([
      db.agents.toArray(),
      db.chatHistories.toArray(),
      db.messages.toArray(),
      db.templates.toArray(),
      db.models.toArray(),
      db.floatingImages.get('app-floating-images').then(r => r?.images || [])
    ])

    // 合并或替换数据
    const processData = <T extends { id: string }>(
      newData: T[],
      existingData: T[],
      key: 'agents' | 'chatHistories' | 'messages' | 'templates' | 'models' | 'floatingImages'
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
    const agents = processData(backupData.data.agents, existingAgents, 'agents')
    await db.agents.clear()
    await db.agents.bulkPut(agents)

    const chatHistories = processData(backupData.data.chatHistories, existingHistories, 'chatHistories')
    await db.chatHistories.clear()
    await db.chatHistories.bulkPut(chatHistories)

    const messages = processData(backupData.data.messages, existingMessages, 'messages')
    await db.messages.clear()
    await db.messages.bulkPut(messages)

    const templates = processData(backupData.data.templates, existingTemplates, 'templates')
    await db.templates.clear()
    await db.templates.bulkPut(templates)

    const models = processData(backupData.data.models, existingModels, 'models')
    await db.models.clear()
    await db.models.bulkPut(models)

    // 恢复设置
    const existingSettings = await db.settings.get('app-settings')
    if (!keepExisting || !existingSettings) {
      // 清理旧版本备份中的 user 和 avatarSize 字段
      const settings = { ...backupData.data.settings }
      delete (settings as Record<string, unknown>).user
      delete (settings as Record<string, unknown>).avatarSize
      await db.settings.put({ id: 'app-settings', value: toStorable(settings) })
      stats.settings.imported = true
    }

    // 恢复悬浮图片
    const floatingImages = processData(
      backupData.data.floatingImages || [],
      existingFloatingImages,
      'floatingImages'
    )
    const maxZIndex = floatingImages.length > 0
      ? Math.max(...floatingImages.map((img: FloatingImage) => img.zIndex), 1000)
      : 1000
    await db.floatingImages.put({
      id: 'app-floating-images',
      images: toStorable(floatingImages),
      maxZIndex
    })

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

/**
 * 获取数据概览
 */
export async function getDataOverview(): Promise<{
  agents: number
  chatHistories: number
  messages: number
  templates: number
  models: number
  floatingImages: number
}> {
  const [agents, chatHistories, messages, templates, models, floatingImagesRecord] = await Promise.all([
    db.agents.count(),
    db.chatHistories.count(),
    db.messages.count(),
    db.templates.count(),
    db.models.count(),
    db.floatingImages.get('app-floating-images')
  ])

  return {
    agents,
    chatHistories,
    messages,
    templates,
    models,
    floatingImages: floatingImagesRecord?.images?.length || 0
  }
}

/**
 * 清空所有数据
 */
export async function clearAllData(): Promise<void> {
  await Promise.all([
    db.agents.clear(),
    db.chatHistories.clear(),
    db.messages.clear(),
    db.templates.clear(),
    db.models.clear(),
    db.settings.delete('app-settings'),
    db.floatingImages.delete('app-floating-images')
  ])
}
