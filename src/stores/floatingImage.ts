import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { FloatingImage } from '@/types'
import { toStorable } from '@/utils/storable'
import { db } from '@/db'

// Debounce helper
function debounce<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timer: ReturnType<typeof setTimeout> | null = null
  let pendingArgs: Parameters<T> | null = null
  
  return (...args: Parameters<T>) => {
    pendingArgs = args
    if (timer) {
      clearTimeout(timer)
    }
    timer = setTimeout(() => {
      timer = null
      if (pendingArgs) {
        fn(...pendingArgs)
        pendingArgs = null
      }
    }, delay)
  }
}

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

  // 立即保存（用于重要操作如删除）
  const saveImagesImmediate = async () => {
    await db.floatingImages.put({
      id: 'app-floating-images',
      images: toStorable(images.value),
      maxZIndex: maxZIndex.value
    })
  }

  // Debounced 保存（用于频繁操作如拖拽、切换可见性）
  const saveImages = debounce(saveImagesImmediate, 300)

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
      if (img.thumbnailUrl?.startsWith('blob:')) {
        URL.revokeObjectURL(img.thumbnailUrl)
      }
      images.value.splice(index, 1)
      await saveImagesImmediate()  // 删除操作立即保存
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
      if (img.thumbnailUrl?.startsWith('blob:')) {
        URL.revokeObjectURL(img.thumbnailUrl)
      }
    })
    images.value = []
    maxZIndex.value = 1000
    await saveImagesImmediate()  // 清空操作立即保存
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
