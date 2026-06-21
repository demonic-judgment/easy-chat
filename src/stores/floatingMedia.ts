import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { FloatingMedia, MediaType } from '@/types'
import { db } from '@/db'

// 存储中的媒体数据（用于序列化）
interface StoredMedia {
  id: string
  type: MediaType
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
  const mediaList = ref<FloatingMedia[]>([])
  const maxZIndex = ref(1000)

  // Getters
  const visibleMedia = () => mediaList.value.filter(m => m.isVisible)

  // 将存储数据转换为媒体对象
  const fromStored = (stored: StoredMedia): FloatingMedia => {
    return {
      ...stored,
      url: stored.url,
      thumbnailUrl: stored.thumbnailUrl,
      videoPoster: stored.videoPoster,
      isPlaying: false
    }
  }

  // 将媒体对象转换为可存储的数据
  const toStored = (media: FloatingMedia): StoredMedia => {
    return {
      id: media.id,
      type: media.type,
      url: media.url,
      name: media.name,
      x: media.x,
      y: media.y,
      width: media.width,
      height: media.height,
      naturalWidth: media.naturalWidth,
      naturalHeight: media.naturalHeight,
      aspectRatio: media.aspectRatio,
      zIndex: media.zIndex,
      isVisible: media.isVisible,
      thumbnailUrl: media.thumbnailUrl,
      videoPoster: media.videoPoster,
      videoDuration: media.videoDuration
    }
  }

  // Actions
  const loadMedia = async () => {
    // 兼容旧数据：先尝试读取旧 key
    const oldRecord = await db.floatingImages?.get('app-floating-images')
    const newRecord = await db.floatingMedia?.get('app-floating-media')

    if (newRecord) {
      mediaList.value = (newRecord.media || []).map(fromStored)
      maxZIndex.value = newRecord.maxZIndex || 1000
    } else if (oldRecord) {
      // 迁移旧数据
      const oldImages = (oldRecord.images || []).map((img: any) => ({
        ...img,
        type: 'image' as MediaType
      }))
      mediaList.value = oldImages.map(fromStored)
      maxZIndex.value = oldRecord.maxZIndex || 1000
      // 保存到新表
      await saveMediaImmediate()
    }
  }

  // 立即保存
  const saveMediaImmediate = async () => {
    await db.floatingMedia.put({
      id: 'app-floating-media',
      media: mediaList.value.map(toStored),
      maxZIndex: maxZIndex.value
    })
  }

  // Debounced 保存
  const saveMedia = debounce(saveMediaImmediate, 300)

  const addMedia = async (media: Omit<FloatingMedia, 'id' | 'zIndex'>) => {
    const newMedia: FloatingMedia = {
      ...media,
      id: `media_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      zIndex: ++maxZIndex.value
    }
    mediaList.value.push(newMedia)
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
    const index = mediaList.value.findIndex(m => m.id === id)
    if (index > -1) {
      const media = mediaList.value[index]!
      // 释放 Blob URL
      const urlKey = `${media.id}_url`
      const thumbKey = `${media.id}_thumb`
      if (blobUrlRegistry.has(urlKey)) {
        URL.revokeObjectURL(blobUrlRegistry.get(urlKey)!)
        blobUrlRegistry.delete(urlKey)
      }
      if (blobUrlRegistry.has(thumbKey)) {
        URL.revokeObjectURL(blobUrlRegistry.get(thumbKey)!)
        blobUrlRegistry.delete(thumbKey)
      }
      mediaList.value.splice(index, 1)
      await saveMediaImmediate()
    }
  }

  const updateMedia = async (id: string, updates: Partial<FloatingMedia>) => {
    const media = mediaList.value.find(m => m.id === id)
    if (media) {
      Object.assign(media, updates)
      await saveMedia()
    }
  }

  // 批量更新
  const batchUpdateMedia = async (updates: Array<{ id: string; data: Partial<FloatingMedia> }>) => {
    updates.forEach(({ id, data }) => {
      const media = mediaList.value.find(m => m.id === id)
      if (media) {
        Object.assign(media, data)
      }
    })
    await saveMedia()
  }

  const toggleVisibility = async (id: string) => {
    const media = mediaList.value.find(m => m.id === id)
    if (media) {
      media.isVisible = !media.isVisible
      await saveMedia()
    }
  }

  const bringToFront = async (id: string) => {
    const media = mediaList.value.find(m => m.id === id)
    if (media) {
      media.zIndex = ++maxZIndex.value
      await saveMedia()
    }
  }

  const clearAll = async () => {
    // 释放所有 Blob URL
    mediaList.value.forEach(media => {
      const urlKey = `${media.id}_url`
      const thumbKey = `${media.id}_thumb`
      if (blobUrlRegistry.has(urlKey)) {
        URL.revokeObjectURL(blobUrlRegistry.get(urlKey)!)
        blobUrlRegistry.delete(urlKey)
      }
      if (blobUrlRegistry.has(thumbKey)) {
        URL.revokeObjectURL(blobUrlRegistry.get(thumbKey)!)
        blobUrlRegistry.delete(thumbKey)
      }
    })
    mediaList.value = []
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
    mediaList,
    maxZIndex,
    visibleMedia,
    loadMedia,
    saveMedia,
    saveMediaImmediate,
    addMedia,
    addImage,
    addVideo,
    removeMedia,
    updateMedia,
    batchUpdateMedia,
    toggleVisibility,
    bringToFront,
    clearAll,
    registerBlobUrl
  }
})
