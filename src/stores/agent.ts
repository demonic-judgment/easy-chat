import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Agent } from '@/types'
import { generateId } from '@/utils/id'

export const useAgentStore = defineStore('agent', () => {
  // State
  const agents = ref<Agent[]>([])
  const currentAgentId = ref<string | null>(null)
  const agentUpdateTimestamp = ref<number>(0)

  // Getters
  const currentAgent = computed(() => {
    return agents.value.find(a => a.id === currentAgentId.value) || null
  })

  const getAgentById = (id: string) => {
    return agents.value.find(a => a.id === id)
  }

  // Actions
  const loadAgents = () => {
    const stored = localStorage.getItem('easy-chat-agents')
    if (stored) {
      agents.value = JSON.parse(stored)
    }
  }

  const saveAgents = () => {
    localStorage.setItem('easy-chat-agents', JSON.stringify(agents.value))
  }

  const createAgent = (data: Omit<Agent, 'id' | 'createdAt' | 'updatedAt'>): Agent => {
    const now = Date.now()
    const agent: Agent = {
      id: generateId(),
      name: data.name,
      roleDescription: data.roleDescription,
      firstMessage: data.firstMessage,
      avatar: data.avatar,
      createdAt: now,
      updatedAt: now
    }
    agents.value.push(agent)
    saveAgents()
    return agent
  }

  const updateAgent = (id: string, data: Partial<Omit<Agent, 'id' | 'createdAt' | 'updatedAt'>>) => {
    const existing = agents.value.find(a => a.id === id)
    if (existing) {
      const updated: Agent = {
        id: existing.id,
        name: data.name ?? existing.name,
        roleDescription: data.roleDescription ?? existing.roleDescription,
        firstMessage: data.firstMessage ?? existing.firstMessage,
        avatar: data.avatar !== undefined ? data.avatar : existing.avatar,
        createdAt: existing.createdAt,
        updatedAt: Date.now()
      }
      const index = agents.value.findIndex(a => a.id === id)
      if (index !== -1) {
        agents.value[index] = updated
        agentUpdateTimestamp.value = Date.now()
        saveAgents()
        return true
      }
    }
    return false
  }

  const deleteAgent = (id: string) => {
    const index = agents.value.findIndex(a => a.id === id)
    if (index !== -1) {
      agents.value.splice(index, 1)
      saveAgents()
      if (currentAgentId.value === id) {
        currentAgentId.value = null
      }
      return true
    }
    return false
  }

  const setCurrentAgent = (id: string | null) => {
    currentAgentId.value = id
  }

  // 初始化时加载数据
  loadAgents()

  // 如果没有智能体，创建一个默认的
  if (agents.value.length === 0) {
    createAgent({
      name: '默认助手',
      roleDescription: '你是一个 helpful 的 AI 助手。',
      firstMessage: '你好！我是你的 AI 助手，有什么可以帮助你的吗？'
    })
  }

  return {
    agents,
    currentAgentId,
    currentAgent,
    agentUpdateTimestamp,
    getAgentById,
    createAgent,
    updateAgent,
    deleteAgent,
    setCurrentAgent,
    loadAgents,
    saveAgents
  }
})
