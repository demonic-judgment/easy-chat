import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { FloatingImage } from '@/types'
import { db } from '@/db'

// 存储中的图片数据（用于序列化）
interface StoredImage {
  id: string
  url: string
  name: string
  x: number
  y: number
  width: number
  height: number
  naturalWidth: number
  naturalHeight: number
  aspectRatio: number
  zIndex: number
  isVisible: boolean
  thumbnailUrl?: string
}

// Debounce helper
function debounce<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => Promise<void> {
  let timer: ReturnType<typeof setTimeout> | null = null
  
  return (...args: Parameters<T>) => {
    return new Promise((resolve) => {
      if (timer) {
        clearTimeout(timer)
      }
      timer = setTimeout(async () => {
        timer = null
        await fn(...args)
        resolve()
      }, delay)
    })
  }
}

// Blob URL 管理
const blobUrlRegistry = new Map<string, string>() // id_type -> blobUrl

export const useFloatingImageStore = defineStore('floatingImage', () => {
  // State
  const images = ref<FloatingImage[]>([])
  const maxZIndex = ref(1000)

  // Getters
  const visibleImages = () => images.value.filter(img => img.isVisible)

  // 将存储数据转换为图片对象（重建 Blob URL）
  const fromStored = (stored: StoredImage): FloatingImage => {
    return {
      ...stored,
      // 保持原 URL（data: 或 blob: 都保留）
      url: stored.url,
      thumbnailUrl: stored.thumbnailUrl
    }
  }

  // 将图片对象转换为可存储的数据
  const toStored = (img: FloatingImage): StoredImage => {
    return {
      id: img.id,
      url: img.url,
      name: img.name,
      x: img.x,
      y: img.y,
      width: img.width,
      height: img.height,
      naturalWidth: img.naturalWidth,
      naturalHeight: img.naturalHeight,
      aspectRatio: img.aspectRatio,
      zIndex: img.zIndex,
      isVisible: img.isVisible,
      thumbnailUrl: img.thumbnailUrl
    }
  }

  // Actions
  const loadImages = async () => {
    const record = await db.floatingImages.get('app-floating-images')
    if (record) {
      images.value = (record.images || []).map(fromStored)
      maxZIndex.value = record.maxZIndex || 1000
    }
  }

  // 立即保存（用于重要操作如删除）
  const saveImagesImmediate = async () => {
    await db.floatingImages.put({
      id: 'app-floating-images',
      images: images.value.map(toStored),
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
    await saveImagesImmediate()
    return newImage
  }

  const removeImage = async (id: string) => {
    const index = images.value.findIndex(img => img.id === id)
    if (index > -1) {
      const img = images.value[index]!
      // 释放 Blob URL
      const urlKey = `${img.id}_url`
      const thumbKey = `${img.id}_thumb`
      if (blobUrlRegistry.has(urlKey)) {
        URL.revokeObjectURL(blobUrlRegistry.get(urlKey)!)
        blobUrlRegistry.delete(urlKey)
      }
      if (blobUrlRegistry.has(thumbKey)) {
        URL.revokeObjectURL(blobUrlRegistry.get(thumbKey)!)
        blobUrlRegistry.delete(thumbKey)
      }
      images.value.splice(index, 1)
      await saveImagesImmediate()
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
    // 释放所有 Blob URL
    images.value.forEach(img => {
      const urlKey = `${img.id}_url`
      const thumbKey = `${img.id}_thumb`
      if (blobUrlRegistry.has(urlKey)) {
        URL.revokeObjectURL(blobUrlRegistry.get(urlKey)!)
        blobUrlRegistry.delete(urlKey)
      }
      if (blobUrlRegistry.has(thumbKey)) {
        URL.revokeObjectURL(blobUrlRegistry.get(thumbKey)!)
        blobUrlRegistry.delete(thumbKey)
      }
    })
    images.value = []
    maxZIndex.value = 1000
    await saveImagesImmediate()
  }

  // 注册 Blob URL（用于从 Blob 创建）
  const registerBlobUrl = (id: string, type: 'url' | 'thumb', blob: Blob): string => {
    const key = `${id}_${type}`
    // 如果已存在，先释放
    if (blobUrlRegistry.has(key)) {
      URL.revokeObjectURL(blobUrlRegistry.get(key)!)
    }
    const blobUrl = URL.createObjectURL(blob)
    blobUrlRegistry.set(key, blobUrl)
    return blobUrl
  }

  // 初始化时加载数据
  loadImages()

  return {
    images,
    maxZIndex,
    visibleImages,
    loadImages,
    saveImages,
    saveImagesImmediate,
    addImage,
    removeImage,
    updateImage,
    batchUpdateImages,
    toggleVisibility,
    bringToFront,
    clearAll,
    registerBlobUrl
  }
})
