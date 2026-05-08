import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { Message, MessageRole, ImageContent } from '@/types'
import { generateId } from '@/utils/id'
import { toStorable } from '@/utils/storable'
import { db } from '@/db'

export const useMessageStore = defineStore('message', () => {
  // State
  const messages = ref<Message[]>([])

  // Getters
  const getMessagesByChatId = (chatId: string) => {
    return messages.value
      .filter(m => m.chatHistoryId === chatId)
      .sort((a, b) => a.createdAt - b.createdAt)
  }

  const getMessageById = (id: string) => {
    return messages.value.find(m => m.id === id)
  }

  // Actions
  const loadMessages = async () => {
    messages.value = await db.messages.toArray()
  }

  const createMessage = async (
    chatHistoryId: string,
    role: MessageRole,
    content: string,
    images?: ImageContent[],
    promptId?: string,
    meta?: Record<string, any>
  ): Promise<Message> => {
    const message: Message = {
      id: generateId(),
      chatHistoryId,
      role,
      content,
      images,
      promptId,
      meta,
      createdAt: Date.now()
    }
    await db.messages.put(toStorable(message))
    messages.value.push(message)
    return message
  }

  const updateMessage = async (id: string, data: Partial<Omit<Message, 'id' | 'createdAt'>>, skipPersist = false): Promise<boolean> => {
    const existing = messages.value.find(m => m.id === id)
    if (existing) {
      const updated: Message = {
        id: existing.id,
        chatHistoryId: data.chatHistoryId ?? existing.chatHistoryId,
        role: data.role ?? existing.role,
        content: data.content ?? existing.content,
        promptId: data.promptId ?? existing.promptId,
        meta: data.meta ?? existing.meta,
        createdAt: existing.createdAt,
        variants: data.variants ?? existing.variants,
        currentVariantIndex: data.currentVariantIndex ?? existing.currentVariantIndex
      }
      // skipPersist 为 true 时跳过 IndexedDB 存储（用于流式更新优化性能）
      if (!skipPersist) {
        await db.messages.put(toStorable(updated))
      }
      const index = messages.value.findIndex(m => m.id === id)
      if (index !== -1) {
        messages.value.splice(index, 1, updated)
        return true
      }
    }
    return false
  }

  const deleteMessage = async (id: string) => {
    await db.messages.delete(id)
    const index = messages.value.findIndex(m => m.id === id)
    if (index !== -1) {
      messages.value.splice(index, 1)
      return true
    }
    return false
  }

  const deleteMessagesByChatId = async (chatId: string) => {
    const messagesToDelete = messages.value.filter(m => m.chatHistoryId === chatId)
    await db.messages.bulkDelete(messagesToDelete.map(m => m.id))
    messages.value = messages.value.filter(m => m.chatHistoryId !== chatId)
  }

  // 删除消息及之后的所有消息
  const deleteMessageAndAfter = async (chatId: string, messageId: string) => {
    const chatMessages = getMessagesByChatId(chatId)
    const targetIndex = chatMessages.findIndex(m => m.id === messageId)
    if (targetIndex === -1) return false

    const messagesToDelete = chatMessages.slice(targetIndex)
    const idsToDelete = messagesToDelete.map(m => m.id)

    await db.messages.bulkDelete(idsToDelete)
    messages.value = messages.value.filter(m => !idsToDelete.includes(m.id))
    return true
  }

  // 添加消息变体（用于重新生成功能）
  const addMessageVariant = async (messageId: string, content: string, meta?: Record<string, any>): Promise<boolean> => {
    const existing = messages.value.find(m => m.id === messageId)
    if (!existing || existing.role !== 'assistant') return false

    // 如果是第一次添加变体，先将当前内容保存为第一个变体
    let variants = existing.variants || []
    if (variants.length === 0) {
      const originalVariant = {
        id: generateId(),
        content: existing.content,
        meta: existing.meta,
        createdAt: existing.createdAt
      }
      variants = [originalVariant]
    }

    const variant = {
      id: generateId(),
      content,
      meta,
      createdAt: Date.now()
    }

    variants.push(variant)

    const updated: Message = {
      ...existing,
      variants,
      currentVariantIndex: variants.length - 1
    }

    await db.messages.put(toStorable(updated))
    const index = messages.value.findIndex(m => m.id === messageId)
    if (index !== -1) {
      messages.value.splice(index, 1, updated)
      return true
    }
    return false
  }

  // 创建新的空白变体用于重新生成（将当前内容保存为变体，切换到新的空白变体）
  const createEmptyVariant = async (messageId: string): Promise<boolean> => {
    const existing = messages.value.find(m => m.id === messageId)
    if (!existing || existing.role !== 'assistant') return false

    // 如果是第一次添加变体，先将当前内容保存为第一个变体
    let variants = existing.variants || []
    if (variants.length === 0) {
      const originalVariant = {
        id: generateId(),
        content: existing.content,
        meta: existing.meta,
        createdAt: existing.createdAt
      }
      variants = [originalVariant]
    }

    // 创建新的空白变体
    const emptyVariant = {
      id: generateId(),
      content: '',
      meta: undefined,
      createdAt: Date.now()
    }

    variants.push(emptyVariant)

    const updated: Message = {
      ...existing,
      content: '', // 清空当前显示内容
      meta: undefined,
      variants,
      currentVariantIndex: variants.length - 1
    }

    await db.messages.put(toStorable(updated))
    const index = messages.value.findIndex(m => m.id === messageId)
    if (index !== -1) {
      messages.value.splice(index, 1, updated)
      return true
    }
    return false
  }

  // 更新当前变体的内容（用于流式更新）
  const updateCurrentVariant = async (messageId: string, content: string, meta?: Record<string, any>): Promise<boolean> => {
    const existing = messages.value.find(m => m.id === messageId)
    if (!existing || existing.role !== 'assistant' || !existing.variants) return false

    const currentIndex = existing.currentVariantIndex ?? 0
    if (currentIndex < 0 || currentIndex >= existing.variants.length) return false

    // 更新变体内容
    const currentVariant = existing.variants[currentIndex]
    if (!currentVariant) return false
    
    existing.variants[currentIndex] = {
      id: currentVariant.id,
      content,
      meta,
      createdAt: currentVariant.createdAt
    }

    // 同时更新消息的当前显示内容
    const updated: Message = {
      ...existing,
      content,
      meta
    }

    await db.messages.put(toStorable(updated))
    const index = messages.value.findIndex(m => m.id === messageId)
    if (index !== -1) {
      messages.value.splice(index, 1, updated)
      return true
    }
    return false
  }

  // 切换消息变体
  const switchVariant = async (messageId: string, variantIndex: number): Promise<boolean> => {
    const existing = messages.value.find(m => m.id === messageId)
    if (!existing || !existing.variants || variantIndex < 0 || variantIndex >= existing.variants.length) {
      return false
    }

    const variant = existing.variants[variantIndex]
    if (!variant) return false

    const updated: Message = {
      ...existing,
      content: variant.content,
      meta: variant.meta,
      currentVariantIndex: variantIndex
    }

    await db.messages.put(toStorable(updated))
    const index = messages.value.findIndex(m => m.id === messageId)
    if (index !== -1) {
      messages.value.splice(index, 1, updated)
      return true
    }
    return false
  }

  // 初始化时加载数据
  loadMessages()

  return {
    messages,
    getMessagesByChatId,
    getMessageById,
    createMessage,
    updateMessage,
    deleteMessage,
    deleteMessagesByChatId,
    deleteMessageAndAfter,
    addMessageVariant,
    createEmptyVariant,
    updateCurrentVariant,
    switchVariant,
    loadMessages
  }
})
