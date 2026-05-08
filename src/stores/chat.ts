import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { ChatHistory } from '@/types'
import { generateId } from '@/utils/id'
import { toStorable } from '@/utils/storable'
import { db } from '@/db'

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
  const loadChatHistories = async () => {
    chatHistories.value = await db.chatHistories.toArray()
  }

  const createChat = async (agentId: string, title: string = '新对话'): Promise<ChatHistory> => {
    const now = Date.now()
    const chat: ChatHistory = {
      id: generateId(),
      agentId,
      title,
      createdAt: now,
      updatedAt: now
    }
    await db.chatHistories.put(toStorable(chat))
    chatHistories.value.push(chat)
    return chat
  }

  const updateChat = async (id: string, data: Partial<Omit<ChatHistory, 'id' | 'createdAt' | 'updatedAt'>>) => {
    const existing = chatHistories.value.find(c => c.id === id)
    if (existing) {
      const updated: ChatHistory = {
        id: existing.id,
        agentId: data.agentId ?? existing.agentId,
        title: data.title ?? existing.title,
        createdAt: existing.createdAt,
        updatedAt: Date.now()
      }
      await db.chatHistories.put(toStorable(updated))
      const index = chatHistories.value.findIndex(c => c.id === id)
      if (index !== -1) {
        chatHistories.value.splice(index, 1, updated)
        return true
      }
    }
    return false
  }

  const deleteChat = async (id: string) => {
    await db.chatHistories.delete(id)
    const index = chatHistories.value.findIndex(c => c.id === id)
    if (index !== -1) {
      chatHistories.value.splice(index, 1)
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
    loadChatHistories
  }
})
