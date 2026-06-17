import { db } from '@/db'

/**
 * 图片存储记录
 * 将图片二进制数据与消息分离存储，避免 Base64 编码的 33% 体积开销
 */
export interface ImageRecord {
  id: string
  messageId: string
  blob: Blob
  name: string
  type: string
  size: number
  createdAt: number
}

/**
 * 图片引用（存储在消息中）
 * 使用 imageId 引用实际的图片数据
 */
export interface ImageReference {
  imageId: string
  name?: string
  type?: string
  size?: number
}

// 内存中的 Blob URL 缓存
const blobUrlCache = new Map<string, string>()
// Data URL 缓存（用于发送到 AI）
const dataUrlCache = new Map<string, string>()

/**
 * 生成图片唯一 ID
 */
function generateImageId(): string {
  return `img_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

/**
 * 存储图片到 IndexedDB
 * @param file 图片文件
 * @param messageId 关联的消息 ID
 * @returns 图片引用信息
 */
export async function storeImage(
  file: File | Blob,
  messageId: string,
  name?: string
): Promise<ImageReference> {
  const imageId = generateImageId()
  const record: ImageRecord = {
    id: imageId,
    messageId,
    blob: file,
    name: name || 'image',
    type: file.type || 'image/png',
    size: file.size,
    createdAt: Date.now()
  }

  await db.images.put(record)

  return {
    imageId,
    name: record.name,
    type: record.type,
    size: record.size
  }
}

/**
 * 批量存储图片（并行处理优化）
 * @param files 图片文件列表
 * @param messageId 关联的消息 ID
 * @returns 图片引用列表
 */
export async function storeImages(
  files: (File | Blob)[],
  messageId: string,
  names?: string[]
): Promise<ImageReference[]> {
  // 并行处理所有图片存储
  const promises = files
    .map((file, i) => file ? storeImage(file, messageId, names?.[i]) : null)
    .filter((p): p is Promise<ImageReference> => p !== null)

  return Promise.all(promises)
}

/**
 * 获取图片 Blob URL（带缓存）
 * @param imageId 图片 ID
 * @returns Blob URL
 */
export async function getImageUrl(imageId: string): Promise<string | null> {
  // 检查内存缓存
  if (blobUrlCache.has(imageId)) {
    return blobUrlCache.get(imageId)!
  }

  // 从 IndexedDB 读取
  const record = await db.images.get(imageId)
  if (!record) {
    return null
  }

  // 创建 Blob URL 并缓存
  const url = URL.createObjectURL(record.blob)
  blobUrlCache.set(imageId, url)

  return url
}

/**
 * 批量获取图片 URL（并行处理优化）
 * @param imageIds 图片 ID 列表
 * @returns URL 映射表
 */
export async function getImageUrls(imageIds: string[]): Promise<Map<string, string>> {
  const result = new Map<string, string>()

  // 并行获取所有图片 URL
  const urls = await Promise.all(
    imageIds.map(id => getImageUrl(id))
  )

  imageIds.forEach((id, index) => {
    const url = urls[index]
    if (url) {
      result.set(id, url)
    }
  })

  return result
}

/**
 * 获取图片原始数据（用于发送到 AI）
 * @param imageId 图片 ID
 * @returns Base64 Data URL（AI API 需要）
 */
export async function getImageDataUrl(imageId: string): Promise<string | null> {
  // 检查缓存
  if (dataUrlCache.has(imageId)) {
    return dataUrlCache.get(imageId)!
  }

  const record = await db.images.get(imageId)
  if (!record) {
    return null
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = reader.result as string
      // 缓存 Data URL
      dataUrlCache.set(imageId, dataUrl)
      resolve(dataUrl)
    }
    reader.onerror = reject
    reader.readAsDataURL(record.blob)
  })
}

/**
 * 批量获取图片 Data URL（用于发送到 AI）
 * @param refs 图片引用列表
 * @returns ImageContent 列表（包含 Data URL）
 */
export async function getImageContentsForAI(
  refs: ImageReference[]
): Promise<{ url: string; name?: string; type?: string }[]> {
  // 并行处理所有图片转换
  const results = await Promise.all(
    refs.map(async (ref) => {
      const dataUrl = await getImageDataUrl(ref.imageId)
      return dataUrl ? {
        url: dataUrl,
        name: ref.name,
        type: ref.type
      } : null
    })
  )

  return results.filter((item): item is NonNullable<typeof item> => item !== null)
}

/**
 * 删除单张图片
 * @param imageId 图片 ID
 */
export async function deleteImage(imageId: string): Promise<void> {
  // 释放 Blob URL
  revokeImageUrl(imageId)
  // 删除数据库记录
  await db.images.delete(imageId)
}

/**
 * 删除消息关联的所有图片
 * @param messageId 消息 ID
 */
export async function deleteImagesByMessageId(messageId: string): Promise<void> {
  const records = await db.images.where('messageId').equals(messageId).toArray()

  for (const record of records) {
    revokeImageUrl(record.id)
  }

  await db.images.where('messageId').equals(messageId).delete()
}

/**
 * 批量删除图片
 * @param messageIds 消息 ID 列表
 */
export async function deleteImagesByMessageIds(messageIds: string[]): Promise<void> {
  for (const messageId of messageIds) {
    await deleteImagesByMessageId(messageId)
  }
}

/**
 * 释放 Blob URL（内存管理）
 * @param imageId 图片 ID
 */
export function revokeImageUrl(imageId: string): void {
  const url = blobUrlCache.get(imageId)
  if (url) {
    URL.revokeObjectURL(url)
    blobUrlCache.delete(imageId)
  }
  // 同时清理 Data URL 缓存
  dataUrlCache.delete(imageId)
}

/**
 * 预加载图片到内存缓存
 * @param imageIds 图片 ID 列表
 */
export async function preloadImages(imageIds: string[]): Promise<void> {
  await Promise.all(imageIds.map(id => getImageUrl(id)))
}

/**
 * 清理所有未使用的 Blob URL
 * 建议在页面卸载或长时间闲置时调用
 */
export function revokeAllImageUrls(): void {
  for (const [id, url] of blobUrlCache) {
    URL.revokeObjectURL(url)
  }
  blobUrlCache.clear()
}

/**
 * 获取图片统计信息
 */
export async function getImageStats(): Promise<{
  count: number
  totalSize: number
  oldestImage: number | null
}> {
  const records = await db.images.toArray()
  const totalSize = records.reduce((sum, r) => sum + r.size, 0)
  const oldestImage = records.length > 0
    ? Math.min(...records.map(r => r.createdAt))
    : null

  return {
    count: records.length,
    totalSize,
    oldestImage
  }
}

/**
 * 清理旧图片（按时间）
 * @param beforeTimestamp 删除此时间之前的图片
 */
export async function cleanupOldImages(beforeTimestamp: number): Promise<number> {
  const oldRecords = await db.images
    .where('createdAt')
    .below(beforeTimestamp)
    .toArray()

  for (const record of oldRecords) {
    revokeImageUrl(record.id)
    await db.images.delete(record.id)
  }

  return oldRecords.length
}
