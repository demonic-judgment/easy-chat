import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { PromptTemplate, PromptItem } from '@/types'
import { generateId } from '@/utils/id'
import { toStorable } from '@/utils/storable'
import { db } from '@/db'

export const usePromptStore = defineStore('prompt', () => {
  // State - 存储模板列表
  const templates = ref<PromptTemplate[]>([])

  // Getters
  const getTemplateById = (id: string) => {
    return templates.value.find(t => t.id === id)
  }

  // Actions
  const loadTemplates = async () => {
    templates.value = await db.templates.toArray()
  }

  // 创建模板
  const createTemplate = async (data: Omit<PromptTemplate, 'id' | 'createdAt' | 'updatedAt'>): Promise<PromptTemplate> => {
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
    await db.templates.put(toStorable(template))
    templates.value.push(template)
    return template
  }

  // 更新模板
  const updateTemplate = async (id: string, data: Partial<Omit<PromptTemplate, 'id' | 'createdAt' | 'updatedAt'>>) => {
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
      await db.templates.put(toStorable(updated))
      const index = templates.value.findIndex(t => t.id === id)
      if (index !== -1) {
        templates.value.splice(index, 1, updated)
        return true
      }
    }
    return false
  }

  // 删除模板
  const deleteTemplate = async (id: string) => {
    await db.templates.delete(id)
    const index = templates.value.findIndex(t => t.id === id)
    if (index !== -1) {
      templates.value.splice(index, 1)
      return true
    }
    return false
  }

  // 在模板中添加提示词
  const addPromptToTemplate = async (templateId: string, data: Omit<PromptItem, 'id' | 'createdAt' | 'updatedAt'>): Promise<PromptItem | null> => {
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
    await db.templates.put(toStorable(template))
    return prompt
  }

  // 更新模板中的提示词
  const updatePromptInTemplate = async (
    templateId: string,
    promptId: string,
    data: Partial<Omit<PromptItem, 'id' | 'createdAt' | 'updatedAt'>>
  ): Promise<boolean> => {
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
    await db.templates.put(toStorable(template))
    return true
  }

  // 删除模板中的提示词
  const deletePromptFromTemplate = async (templateId: string, promptId: string): Promise<boolean> => {
    const template = getTemplateById(templateId)
    if (!template) return false

    const promptIndex = template.prompts.findIndex(p => p.id === promptId)
    if (promptIndex === -1) return false

    template.prompts.splice(promptIndex, 1)
    template.updatedAt = Date.now()
    await db.templates.put(toStorable(template))
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
    loadTemplates
  }
})
