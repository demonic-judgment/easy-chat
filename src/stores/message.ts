import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { Message, MessageRole, MessageVariant, ImageContent } from '@/types'
import { generateId } from '@/utils/id'

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
  const loadMessages = () => {
    const stored = localStorage.getItem('easy-chat-messages')
    if (stored) {
      messages.value = JSON.parse(stored)
    }
  }

  const saveMessages = () => {
    localStorage.setItem('easy-chat-messages', JSON.stringify(messages.value))
  }

  const createMessage = (
    chatHistoryId: string,
    role: MessageRole,
    content: string,
    images?: ImageContent[],
    promptId?: string,
    meta?: Record<string, any>
  ): Message => {
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
    messages.value.push(message)
    saveMessages()
    return message
  }

  const updateMessage = (id: string, data: Partial<Omit<Message, 'id' | 'createdAt'>>): boolean => {
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
      const index = messages.value.findIndex(m => m.id === id)
      if (index !== -1) {
        messages.value[index] = updated
        saveMessages()
        return true
      }
    }
    return false
  }

  const deleteMessage = (id: string) => {
    const index = messages.value.findIndex(m => m.id === id)
    if (index !== -1) {
      messages.value.splice(index, 1)
      saveMessages()
      return true
    }
    return false
  }

  const deleteMessagesByChatId = (chatId: string) => {
    messages.value = messages.value.filter(m => m.chatHistoryId !== chatId)
    saveMessages()
  }

  // 删除消息及之后的所有消息
  const deleteMessageAndAfter = (chatId: string, messageId: string) => {
    const chatMessages = getMessagesByChatId(chatId)
    const targetIndex = chatMessages.findIndex(m => m.id === messageId)
    if (targetIndex === -1) return false

    const messagesToDelete = chatMessages.slice(targetIndex)
    const idsToDelete = new Set(messagesToDelete.map(m => m.id))

    messages.value = messages.value.filter(m => !idsToDelete.has(m.id))
    saveMessages()
    return true
  }

  // 添加消息变体（用于重新生成功能）
  const addMessageVariant = (messageId: string, content: string, meta?: Record<string, any>): boolean => {
    const existing = messages.value.find(m => m.id === messageId)
    if (!existing || existing.role !== 'assistant') return false

    // 如果是第一次添加变体，先将当前内容保存为第一个变体
    let variants = existing.variants || []
    if (variants.length === 0) {
      const originalVariant: MessageVariant = {
        id: generateId(),
        content: existing.content,
        meta: existing.meta,
        createdAt: existing.createdAt
      }
      variants = [originalVariant]
    }

    const variant: MessageVariant = {
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

    const index = messages.value.findIndex(m => m.id === messageId)
    if (index !== -1) {
      messages.value[index] = updated
      saveMessages()
      return true
    }
    return false
  }

  // 创建新的空白变体用于重新生成（将当前内容保存为变体，切换到新的空白变体）
  const createEmptyVariant = (messageId: string): boolean => {
    const existing = messages.value.find(m => m.id === messageId)
    if (!existing || existing.role !== 'assistant') return false

    // 如果是第一次添加变体，先将当前内容保存为第一个变体
    let variants = existing.variants || []
    if (variants.length === 0) {
      const originalVariant: MessageVariant = {
        id: generateId(),
        content: existing.content,
        meta: existing.meta,
        createdAt: existing.createdAt
      }
      variants = [originalVariant]
    }

    // 创建新的空白变体
    const emptyVariant: MessageVariant = {
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

    const index = messages.value.findIndex(m => m.id === messageId)
    if (index !== -1) {
      messages.value[index] = updated
      saveMessages()
      return true
    }
    return false
  }

  // 更新当前变体的内容（用于流式更新）
  const updateCurrentVariant = (messageId: string, content: string, meta?: Record<string, any>): boolean => {
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

    const index = messages.value.findIndex(m => m.id === messageId)
    if (index !== -1) {
      messages.value[index] = updated
      saveMessages()
      return true
    }
    return false
  }

  // 切换消息变体
  const switchVariant = (messageId: string, variantIndex: number): boolean => {
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

    const index = messages.value.findIndex(m => m.id === messageId)
    if (index !== -1) {
      messages.value[index] = updated
      saveMessages()
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
    loadMessages,
    saveMessages
  }
})
