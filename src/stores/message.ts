import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { Message, MessageRole } from '@/types'
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
    promptId?: string,
    meta?: Record<string, any>
  ): Message => {
    const message: Message = {
      id: generateId(),
      chatHistoryId,
      role,
      content,
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
        createdAt: existing.createdAt
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
    loadMessages,
    saveMessages
  }
})
