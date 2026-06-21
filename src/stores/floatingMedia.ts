import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { FloatingMedia } from '@/types'
import { db } from '@/db'

// 存储中的媒体数据（用于序列化）
interface StoredMedia {
  id: string
  type: 'image' | 'video'
  url: string
  name: string
  x: number
  y: number
  width: number
  height: number
  naturalWidth?: number
  naturalHeight?: number
  aspectRatio?: number
  zIndex: number
  isVisible: boolean
  thumbnailUrl?: string
  videoPoster?: string
  videoDuration?: number
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

export const useFloatingMediaStore = defineStore('floatingMedia', () => {
  // State
  const media = ref<FloatingMedia[]>([])
  const maxZIndex = ref(1000)

  // Getters
  const visibleMedia = () => media.value.filter(m => m.isVisible)

  // 将存储数据转换为媒体对象
  const fromStored = (stored: any): FloatingMedia => {
    return {
      ...stored,
      type: stored.type || 'image',
      url: stored.url,
      thumbnailUrl: stored.thumbnailUrl
    }
  }

  // 将媒体对象转换为可存储的数据
  const toStored = (m: FloatingMedia): any => {
    return {
      id: m.id,
      type: m.type,
      url: m.url,
      name: m.name,
      x: m.x,
      y: m.y,
      width: m.width,
      height: m.height,
      naturalWidth: m.naturalWidth,
      naturalHeight: m.naturalHeight,
      aspectRatio: m.aspectRatio,
      zIndex: m.zIndex,
      isVisible: m.isVisible,
      thumbnailUrl: m.thumbnailUrl,
      videoPoster: m.videoPoster,
      videoDuration: m.videoDuration
    }
  }

  // Actions
  const loadMedia = async () => {
    const record = await db.floatingImages.get('app-floating-images')
    if (record) {
      // 向后兼容：旧数据没有 type 字段，默认为 image
      media.value = (record.images || []).map((item: any) => {
        if (!item.type) {
          item.type = 'image'
        }
        return fromStored(item)
      })
      maxZIndex.value = record.maxZIndex || 1000
    }
  }

  // 立即保存
  const saveMediaImmediate = async () => {
    await db.floatingImages.put({
      id: 'app-floating-images',
      images: media.value.map(toStored),
      maxZIndex: maxZIndex.value
    })
  }

  // Debounced 保存
  const saveMedia = debounce(saveMediaImmediate, 300)

  const addMedia = async (item: Omit<FloatingMedia, 'id' | 'zIndex'>) => {
    const newMedia: FloatingMedia = {
      ...item,
      id: `media_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      zIndex: ++maxZIndex.value
    }
    media.value.push(newMedia)
    await saveMediaImmediate()
    return newMedia
  }

  const addImage = async (image: Omit<FloatingMedia, 'id' | 'zIndex' | 'type'>) => {
    return addMedia({ ...image, type: 'image' })
  }

  const addVideo = async (video: Omit<FloatingMedia, 'id' | 'zIndex' | 'type'>) => {
    return addMedia({ ...video, type: 'video' })
  }

  const removeMedia = async (id: string) => {
    const index = media.value.findIndex(m => m.id === id)
    if (index > -1) {
      const item = media.value[index]!
      // 释放 Blob URL
      const urlKey = `${item.id}_url`
      const thumbKey = `${item.id}_thumb`
      if (blobUrlRegistry.has(urlKey)) {
        URL.revokeObjectURL(blobUrlRegistry.get(urlKey)!)
        blobUrlRegistry.delete(urlKey)
      }
      if (blobUrlRegistry.has(thumbKey)) {
        URL.revokeObjectURL(blobUrlRegistry.get(thumbKey)!)
        blobUrlRegistry.delete(thumbKey)
      }
      media.value.splice(index, 1)
      await saveMediaImmediate()
    }
  }

  const updateMedia = async (id: string, updates: Partial<FloatingMedia>) => {
    const item = media.value.find(m => m.id === id)
    if (item) {
      Object.assign(item, updates)
      await saveMedia()
    }
  }

  // 批量更新
  const batchUpdateMedia = async (updates: Array<{ id: string; data: Partial<FloatingMedia> }>) => {
    updates.forEach(({ id, data }) => {
      const item = media.value.find(m => m.id === id)
      if (item) {
        Object.assign(item, data)
      }
    })
    await saveMedia()
  }

  const toggleVisibility = async (id: string) => {
    const item = media.value.find(m => m.id === id)
    if (item) {
      item.isVisible = !item.isVisible
      await saveMedia()
    }
  }

  const bringToFront = async (id: string) => {
    const item = media.value.find(m => m.id === id)
    if (item) {
      item.zIndex = ++maxZIndex.value
      await saveMedia()
    }
  }

  const clearAll = async () => {
    // 释放所有 Blob URL
    media.value.forEach(item => {
      const urlKey = `${item.id}_url`
      const thumbKey = `${item.id}_thumb`
      if (blobUrlRegistry.has(urlKey)) {
        URL.revokeObjectURL(blobUrlRegistry.get(urlKey)!)
        blobUrlRegistry.delete(urlKey)
      }
      if (blobUrlRegistry.has(thumbKey)) {
        URL.revokeObjectURL(blobUrlRegistry.get(thumbKey)!)
        blobUrlRegistry.delete(thumbKey)
      }
    })
    media.value = []
    maxZIndex.value = 1000
    await saveMediaImmediate()
  }

  // 注册 Blob URL
  const registerBlobUrl = (id: string, type: 'url' | 'thumb', blob: Blob): string => {
    const key = `${id}_${type}`
    if (blobUrlRegistry.has(key)) {
      URL.revokeObjectURL(blobUrlRegistry.get(key)!)
    }
    const blobUrl = URL.createObjectURL(blob)
    blobUrlRegistry.set(key, blobUrl)
    return blobUrl
  }

  // 初始化时加载数据
  loadMedia()

  return {
    media,
    images: media, // 向后兼容
    maxZIndex,
    visibleMedia,
    visibleImages: visibleMedia, // 向后兼容
    loadMedia,
    saveMedia,
    saveMediaImmediate,
    addMedia,
    addImage,
    addVideo,
    removeMedia,
    removeImage: removeMedia, // 向后兼容
    updateMedia,
    updateImage: updateMedia, // 向后兼容
    batchUpdateMedia,
    batchUpdateImages: batchUpdateMedia, // 向后兼容
    toggleVisibility,
    bringToFront,
    clearAll,
    registerBlobUrl
  }
})