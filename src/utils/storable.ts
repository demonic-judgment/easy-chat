import { toRaw } from 'vue'

/**
 * 深度移除 Vue 响应式包装
 * 递归处理对象和数组，将所有响应式对象转换为普通对象
 */
export const deepToRaw = (obj: any): any => {
  if (obj === null || typeof obj !== 'object') {
    return obj
  }

  if (Array.isArray(obj)) {
    return obj.map(item => deepToRaw(item))
  }

  const raw = toRaw(obj)
  const result: any = {}
  for (const key in raw) {
    if (Object.prototype.hasOwnProperty.call(raw, key)) {
      result[key] = deepToRaw(raw[key])
    }
  }
  return result
}

/**
 * 将对象转换为可存储的纯对象
 * 使用 JSON 序列化/反序列化移除 Vue 响应式包装和不可克隆数据
 * 
 * 性能说明：
 * - JSON.stringify/parse 本身会移除所有 Proxy 和不可克隆数据
 * - 不需要额外的 deepToRaw，因为 JSON 序列化过程已经处理了嵌套对象
 * - 时间复杂度：O(n)，n 为对象大小
 */
export const toStorable = <T>(obj: T): T => {
  try {
    return JSON.parse(JSON.stringify(obj))
  } catch (e) {
    console.error('Failed to serialize object:', obj, e)
    throw e
  }
}
