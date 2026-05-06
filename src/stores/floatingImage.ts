import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { FloatingImage } from '@/types'

const STORAGE_KEY = 'easy-chat-floating-images'

export const useFloatingImageStore = defineStore('floatingImage', () => {
  // State
  const images = ref<FloatingImage[]>([])
  const maxZIndex = ref(1000)

  // Getters
  const visibleImages = () => images.value.filter(img => img.isVisible)

  // Actions
  const loadImages = () => {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      try {
        const parsed = JSON.parse(stored)
        images.value = parsed.images || []
        maxZIndex.value = parsed.maxZIndex || 1000
      } catch {
        images.value = []
        maxZIndex.value = 1000
      }
    }
  }

  const saveImages = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      images: images.value,
      maxZIndex: maxZIndex.value
    }))
  }

  const addImage = (image: Omit<FloatingImage, 'id' | 'zIndex'>) => {
    const newImage: FloatingImage = {
      ...image,
      id: `img_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      zIndex: ++maxZIndex.value
    }
    images.value.push(newImage)
    saveImages()
    return newImage
  }

  const removeImage = (id: string) => {
    const index = images.value.findIndex(img => img.id === id)
    if (index > -1) {
      const img = images.value[index]!
      if (img.url.startsWith('blob:')) {
        URL.revokeObjectURL(img.url)
      }
      images.value.splice(index, 1)
      saveImages()
    }
  }

  const updateImage = (id: string, updates: Partial<FloatingImage>) => {
    const image = images.value.find(img => img.id === id)
    if (image) {
      Object.assign(image, updates)
      saveImages()
    }
  }

  // 批量更新图片（用于拖拽/调整大小结束后的保存）
  const batchUpdateImages = (updates: Array<{ id: string; data: Partial<FloatingImage> }>) => {
    updates.forEach(({ id, data }) => {
      const image = images.value.find(img => img.id === id)
      if (image) {
        Object.assign(image, data)
      }
    })
    saveImages()
  }

  const toggleVisibility = (id: string) => {
    const image = images.value.find(img => img.id === id)
    if (image) {
      image.isVisible = !image.isVisible
      saveImages()
    }
  }

  const bringToFront = (id: string) => {
    const image = images.value.find(img => img.id === id)
    if (image) {
      image.zIndex = ++maxZIndex.value
      saveImages()
    }
  }

  const clearAll = () => {
    images.value.forEach(img => {
      if (img.url.startsWith('blob:')) {
        URL.revokeObjectURL(img.url)
      }
    })
    images.value = []
    maxZIndex.value = 1000
    saveImages()
  }

  // 初始化时加载数据
  loadImages()

  return {
    images,
    maxZIndex,
    visibleImages,
    loadImages,
    saveImages,
    addImage,
    removeImage,
    updateImage,
    batchUpdateImages,
    toggleVisibility,
    bringToFront,
    clearAll
  }
})
