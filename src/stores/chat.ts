import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { ChatHistory } from '@/types'
import { generateId } from '@/utils/id'

export const useChatStore = defineStore('chat', () => {
  // State
  const chatHistories = ref<ChatHistory[]>([])
  const currentChatId = ref<string | null>(null)

  // Getters
  const currentChat = computed(() => {
    return chatHistories.value.find(c => c.id === currentChatId.value) || null
  })

  const getChatsByAgentId = (agentId: string) => {
    return chatHistories.value
      .filter(c => c.agentId === agentId)
      .sort((a, b) => b.updatedAt - a.updatedAt)
  }

  const getChatById = (id: string) => {
    return chatHistories.value.find(c => c.id === id)
  }

  // Actions
  const loadChatHistories = () => {
    const stored = localStorage.getItem('easy-chat-histories')
    if (stored) {
      chatHistories.value = JSON.parse(stored)
    }
  }

  const saveChatHistories = () => {
    localStorage.setItem('easy-chat-histories', JSON.stringify(chatHistories.value))
  }

  const createChat = (agentId: string, title: string = '新对话'): ChatHistory => {
    const now = Date.now()
    const chat: ChatHistory = {
      id: generateId(),
      agentId,
      title,
      createdAt: now,
      updatedAt: now
    }
    chatHistories.value.push(chat)
    saveChatHistories()
    return chat
  }

  const updateChat = (id: string, data: Partial<Omit<ChatHistory, 'id' | 'createdAt' | 'updatedAt'>>) => {
    const existing = chatHistories.value.find(c => c.id === id)
    if (existing) {
      const updated: ChatHistory = {
        id: existing.id,
        agentId: data.agentId ?? existing.agentId,
        title: data.title ?? existing.title,
        createdAt: existing.createdAt,
        updatedAt: Date.now()
      }
      const index = chatHistories.value.findIndex(c => c.id === id)
      if (index !== -1) {
        chatHistories.value[index] = updated
        saveChatHistories()
        return true
      }
    }
    return false
  }

  const deleteChat = (id: string) => {
    const index = chatHistories.value.findIndex(c => c.id === id)
    if (index !== -1) {
      chatHistories.value.splice(index, 1)
      saveChatHistories()
      if (currentChatId.value === id) {
        currentChatId.value = null
      }
      return true
    }
    return false
  }

  const setCurrentChat = (id: string | null) => {
    currentChatId.value = id
  }

  // 初始化时加载数据
  loadChatHistories()

  return {
    chatHistories,
    currentChatId,
    currentChat,
    getChatsByAgentId,
    getChatById,
    createChat,
    updateChat,
    deleteChat,
    setCurrentChat,
    loadChatHistories,
    saveChatHistories
  }
})
