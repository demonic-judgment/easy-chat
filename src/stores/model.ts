import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { ModelConfig, ModelParams } from '@/types'
import { generateId } from '@/utils/id'

export const useModelStore = defineStore('model', () => {
  // State
  const models = ref<ModelConfig[]>([])
  const currentModelId = ref<string | null>(null)

  // Getters
  const currentModel = computed(() => {
    return models.value.find(m => m.id === currentModelId.value) || null
  })

  const getModelById = (id: string) => {
    return models.value.find(m => m.id === id)
  }

  const getParsedParams = (modelId: string): ModelParams => {
    const model = getModelById(modelId)
    if (!model || !model.params) return {}
    try {
      return JSON.parse(model.params)
    } catch {
      return {}
    }
  }

  // Actions
  const loadModels = () => {
    const stored = localStorage.getItem('easy-chat-models')
    if (stored) {
      models.value = JSON.parse(stored)
    }
    // 加载上次使用的模型ID
    const storedCurrentModelId = localStorage.getItem('easy-chat-current-model-id')
    if (storedCurrentModelId) {
      currentModelId.value = storedCurrentModelId
    }
  }

  const saveModels = () => {
    localStorage.setItem('easy-chat-models', JSON.stringify(models.value))
  }

  const createModel = (data: Omit<ModelConfig, 'id' | 'createdAt' | 'updatedAt'>): ModelConfig => {
    const now = Date.now()
    const model: ModelConfig = {
      id: generateId(),
      name: data.name,
      apiUrl: data.apiUrl,
      apiKey: data.apiKey,
      params: data.params,
      createdAt: now,
      updatedAt: now
    }
    models.value.push(model)
    saveModels()
    return model
  }

  const updateModel = (id: string, data: Partial<Omit<ModelConfig, 'id' | 'createdAt' | 'updatedAt'>>) => {
    const existing = models.value.find(m => m.id === id)
    if (existing) {
      const updated: ModelConfig = {
        id: existing.id,
        name: data.name ?? existing.name,
        apiUrl: data.apiUrl ?? existing.apiUrl,
        apiKey: data.apiKey ?? existing.apiKey,
        params: data.params ?? existing.params,
        createdAt: existing.createdAt,
        updatedAt: Date.now()
      }
      const index = models.value.findIndex(m => m.id === id)
      if (index !== -1) {
        models.value[index] = updated
        saveModels()
        return true
      }
    }
    return false
  }

  const deleteModel = (id: string) => {
    const index = models.value.findIndex(m => m.id === id)
    if (index !== -1) {
      models.value.splice(index, 1)
      saveModels()
      if (currentModelId.value === id) {
        currentModelId.value = null
      }
      return true
    }
    return false
  }

  const setCurrentModel = (id: string | null) => {
    currentModelId.value = id
    // 保存到 localStorage
    if (id) {
      localStorage.setItem('easy-chat-current-model-id', id)
    } else {
      localStorage.removeItem('easy-chat-current-model-id')
    }
  }

  // 初始化时加载数据
  loadModels()

  // 如果没有模型配置，创建一个默认的
  if (models.value.length === 0) {
    const defaultModel = createModel({
      name: '默认模型',
      apiUrl: 'https://api.openai.com/v1/chat/completions',
      apiKey: '',
      params: JSON.stringify({
        temperature: 0.7,
        max_tokens: 2000,
        model: 'gpt-3.5-turbo'
      }, null, 2)
    })
    // 默认选中第一个模型
    setCurrentModel(defaultModel.id)
  } else if (!currentModelId.value || !getModelById(currentModelId.value)) {
    // 如果没有选中的模型，或者选中的模型已不存在，默认使用第一个
    if (models.value.length > 0) {
      setCurrentModel(models.value[0]!.id)
    }
  }

  return {
    models,
    currentModelId,
    currentModel,
    getModelById,
    getParsedParams,
    createModel,
    updateModel,
    deleteModel,
    setCurrentModel,
    loadModels,
    saveModels
  }
})
