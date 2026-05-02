import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { CustomPrompt } from '@/types'
import { generateId } from '@/utils/id'

export const usePromptStore = defineStore('prompt', () => {
  // State
  const prompts = ref<CustomPrompt[]>([])

  // Getters
  const getPromptById = (id: string) => {
    return prompts.value.find(p => p.id === id)
  }

  // Actions
  const loadPrompts = () => {
    const stored = localStorage.getItem('easy-chat-prompts')
    if (stored) {
      prompts.value = JSON.parse(stored)
    }
  }

  const savePrompts = () => {
    localStorage.setItem('easy-chat-prompts', JSON.stringify(prompts.value))
  }

  const createPrompt = (data: Omit<CustomPrompt, 'id' | 'createdAt' | 'updatedAt'>): CustomPrompt => {
    const now = Date.now()
    const prompt: CustomPrompt = {
      id: generateId(),
      name: data.name,
      content: data.content,
      role: data.role,
      template: data.template,
      createdAt: now,
      updatedAt: now
    }
    prompts.value.push(prompt)
    savePrompts()
    return prompt
  }

  const updatePrompt = (id: string, data: Partial<Omit<CustomPrompt, 'id' | 'createdAt' | 'updatedAt'>>) => {
    const existing = prompts.value.find(p => p.id === id)
    if (existing) {
      const updated: CustomPrompt = {
        id: existing.id,
        name: data.name ?? existing.name,
        content: data.content ?? existing.content,
        role: data.role ?? existing.role,
        template: data.template ?? existing.template,
        createdAt: existing.createdAt,
        updatedAt: Date.now()
      }
      const index = prompts.value.findIndex(p => p.id === id)
      if (index !== -1) {
        prompts.value[index] = updated
        savePrompts()
        return true
      }
    }
    return false
  }

  const deletePrompt = (id: string) => {
    const index = prompts.value.findIndex(p => p.id === id)
    if (index !== -1) {
      prompts.value.splice(index, 1)
      savePrompts()
      return true
    }
    return false
  }

  // 初始化时加载数据
  loadPrompts()

  return {
    prompts,
    getPromptById,
    createPrompt,
    updatePrompt,
    deletePrompt,
    loadPrompts,
    savePrompts
  }
})
