import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { PromptTemplate, PromptItem } from '@/types'
import { generateId } from '@/utils/id'

export const usePromptStore = defineStore('prompt', () => {
  // State - 存储模板列表
  const templates = ref<PromptTemplate[]>([])

  // Getters
  const getTemplateById = (id: string) => {
    return templates.value.find(t => t.id === id)
  }

  // Actions
  const loadTemplates = () => {
    const stored = localStorage.getItem('easy-chat-templates')
    if (stored) {
      templates.value = JSON.parse(stored)
    }
  }

  const saveTemplates = () => {
    localStorage.setItem('easy-chat-templates', JSON.stringify(templates.value))
  }

  // 创建模板
  const createTemplate = (data: Omit<PromptTemplate, 'id' | 'createdAt' | 'updatedAt'>): PromptTemplate => {
    const now = Date.now()
    const template: PromptTemplate = {
      id: generateId(),
      name: data.name,
      template: data.template,
      agentIds: data.agentIds ?? [],
      prompts: data.prompts ?? [],
      createdAt: now,
      updatedAt: now
    }
    templates.value.push(template)
    saveTemplates()
    return template
  }

  // 更新模板
  const updateTemplate = (id: string, data: Partial<Omit<PromptTemplate, 'id' | 'createdAt' | 'updatedAt'>>) => {
    const existing = templates.value.find(t => t.id === id)
    if (existing) {
      const updated: PromptTemplate = {
        id: existing.id,
        name: data.name ?? existing.name,
        template: data.template ?? existing.template,
        agentIds: data.agentIds ?? existing.agentIds,
        prompts: data.prompts ?? existing.prompts,
        createdAt: existing.createdAt,
        updatedAt: Date.now()
      }
      const index = templates.value.findIndex(t => t.id === id)
      if (index !== -1) {
        templates.value[index] = updated
        saveTemplates()
        return true
      }
    }
    return false
  }

  // 删除模板
  const deleteTemplate = (id: string) => {
    const index = templates.value.findIndex(t => t.id === id)
    if (index !== -1) {
      templates.value.splice(index, 1)
      saveTemplates()
      return true
    }
    return false
  }

  // 在模板中添加提示词
  const addPromptToTemplate = (templateId: string, data: Omit<PromptItem, 'id' | 'createdAt' | 'updatedAt'>): PromptItem | null => {
    const template = getTemplateById(templateId)
    if (!template) return null

    const now = Date.now()
    const prompt: PromptItem = {
      id: generateId(),
      name: data.name,
      content: data.content,
      role: data.role,
      createdAt: now,
      updatedAt: now
    }

    template.prompts.push(prompt)
    template.updatedAt = now
    saveTemplates()
    return prompt
  }

  // 更新模板中的提示词
  const updatePromptInTemplate = (
    templateId: string,
    promptId: string,
    data: Partial<Omit<PromptItem, 'id' | 'createdAt' | 'updatedAt'>>
  ): boolean => {
    const template = getTemplateById(templateId)
    if (!template) return false

    const promptIndex = template.prompts.findIndex(p => p.id === promptId)
    if (promptIndex === -1) return false

    const existing = template.prompts[promptIndex]!
    template.prompts[promptIndex] = {
      id: existing.id,
      name: data.name ?? existing.name,
      content: data.content ?? existing.content,
      role: data.role ?? existing.role,
      createdAt: existing.createdAt,
      updatedAt: Date.now()
    }
    template.updatedAt = Date.now()
    saveTemplates()
    return true
  }

  // 删除模板中的提示词
  const deletePromptFromTemplate = (templateId: string, promptId: string): boolean => {
    const template = getTemplateById(templateId)
    if (!template) return false

    const promptIndex = template.prompts.findIndex(p => p.id === promptId)
    if (promptIndex === -1) return false

    template.prompts.splice(promptIndex, 1)
    template.updatedAt = Date.now()
    saveTemplates()
    return true
  }

  // 初始化时加载数据
  loadTemplates()

  return {
    templates,
    getTemplateById,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    addPromptToTemplate,
    updatePromptInTemplate,
    deletePromptFromTemplate,
    loadTemplates,
    saveTemplates
  }
})
