import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { FloatingImage } from '@/types'
import { toStorable } from '@/utils/storable'
import { db } from '@/db'

export const useFloatingImageStore = defineStore('floatingImage', () => {
  // State
  const images = ref<FloatingImage[]>([])
  const maxZIndex = ref(1000)

  // Getters
  const visibleImages = () => images.value.filter(img => img.isVisible)

  // Actions
  const loadImages = async () => {
    const record = await db.floatingImages.get('app-floating-images')
    if (record) {
      images.value = record.images || []
      maxZIndex.value = record.maxZIndex || 1000
    }
  }

  const saveImages = async () => {
    await db.floatingImages.put({
      id: 'app-floating-images',
      images: toStorable(images.value),
      maxZIndex: maxZIndex.value
    })
  }

  const addImage = async (image: Omit<FloatingImage, 'id' | 'zIndex'>) => {
    const newImage: FloatingImage = {
      ...image,
      id: `img_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      zIndex: ++maxZIndex.value
    }
    images.value.push(newImage)
    await saveImages()
    return newImage
  }

  const removeImage = async (id: string) => {
    const index = images.value.findIndex(img => img.id === id)
    if (index > -1) {
      const img = images.value[index]!
      if (img.url.startsWith('blob:')) {
        URL.revokeObjectURL(img.url)
      }
      images.value.splice(index, 1)
      await saveImages()
    }
  }

  const updateImage = async (id: string, updates: Partial<FloatingImage>) => {
    const image = images.value.find(img => img.id === id)
    if (image) {
      Object.assign(image, updates)
      await saveImages()
    }
  }

  // 批量更新图片（用于拖拽/调整大小结束后的保存）
  const batchUpdateImages = async (updates: Array<{ id: string; data: Partial<FloatingImage> }>) => {
    updates.forEach(({ id, data }) => {
      const image = images.value.find(img => img.id === id)
      if (image) {
        Object.assign(image, data)
      }
    })
    await saveImages()
  }

  const toggleVisibility = async (id: string) => {
    const image = images.value.find(img => img.id === id)
    if (image) {
      image.isVisible = !image.isVisible
      await saveImages()
    }
  }

  const bringToFront = async (id: string) => {
    const image = images.value.find(img => img.id === id)
    if (image) {
      image.zIndex = ++maxZIndex.value
      await saveImages()
    }
  }

  const clearAll = async () => {
    images.value.forEach(img => {
      if (img.url.startsWith('blob:')) {
        URL.revokeObjectURL(img.url)
      }
    })
    images.value = []
    maxZIndex.value = 1000
    await saveImages()
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
