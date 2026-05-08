/**
 * Service Worker 管理工具
 * 提供注册、更新、缓存管理等功能
 */

interface ServiceWorkerState {
  isRegistered: boolean
  isUpdateAvailable: boolean
  registration: ServiceWorkerRegistration | null
}

const state: ServiceWorkerState = {
  isRegistered: false,
  isUpdateAvailable: false,
  registration: null
}

/**
 * 注册 Service Worker
 */
export async function registerServiceWorker(): Promise<boolean> {
  if (!('serviceWorker' in navigator)) {
    console.log('[SW] Service Worker not supported')
    return false
  }

  try {
    const registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/'
    })

    state.registration = registration
    state.isRegistered = true

    console.log('[SW] Registered successfully:', registration.scope)

    // 监听更新
    registration.addEventListener('updatefound', () => {
      const newWorker = registration.installing
      if (newWorker) {
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            // 有新版本可用
            state.isUpdateAvailable = true
            console.log('[SW] New version available')
            // 可以在这里触发提示用户刷新
          }
        })
      }
    })

    // 检查更新
    await registration.update()

    return true
  } catch (error) {
    console.error('[SW] Registration failed:', error)
    return false
  }
}

/**
 * 注销 Service Worker
 */
export async function unregisterServiceWorker(): Promise<boolean> {
  if (!state.registration) return false

  try {
    const result = await state.registration.unregister()
    state.isRegistered = !result
    state.registration = null
    console.log('[SW] Unregistered:', result)
    return result
  } catch (error) {
    console.error('[SW] Unregister failed:', error)
    return false
  }
}

/**
 * 跳过等待，激活新版本
 */
export async function skipWaiting(): Promise<void> {
  if (!state.registration?.waiting) return

  state.registration.waiting.postMessage({ type: 'SKIP_WAITING' })
}

/**
 * 刷新页面以使用新版本
 */
export function refreshPage(): void {
  window.location.reload()
}

/**
 * 清除所有缓存
 */
export async function clearAllCaches(): Promise<boolean> {
  if (!('serviceWorker' in navigator) || !state.registration) {
    // 如果没有 SW，直接清除 caches
    if ('caches' in window) {
      const cacheNames = await caches.keys()
      await Promise.all(cacheNames.map(name => caches.delete(name)))
      return true
    }
    return false
  }

  return new Promise((resolve) => {
    const channel = new MessageChannel()
    channel.port1.onmessage = (event) => {
      resolve(event.data?.success || false)
    }

    state.registration?.active?.postMessage(
      { type: 'CLEAR_CACHE' },
      [channel.port2]
    )
  })
}

/**
 * 获取缓存大小信息
 */
export async function getCacheSize(): Promise<{ count: number; totalSize: number } | null> {
  if (!('serviceWorker' in navigator) || !state.registration?.active) {
    return null
  }

  return new Promise((resolve) => {
    const channel = new MessageChannel()
    channel.port1.onmessage = (event) => {
      if (event.data?.success) {
        resolve({
          count: event.data.count,
          totalSize: event.data.totalSize
        })
      } else {
        resolve(null)
      }
    }

    state.registration?.active?.postMessage(
      { type: 'GET_CACHE_SIZE' },
      [channel.port2]
    )

    // 超时处理
    setTimeout(() => resolve(null), 5000)
  })
}

/**
 * 检查是否有更新可用
 */
export function isUpdateAvailable(): boolean {
  return state.isUpdateAvailable
}

/**
 * 检查是否已注册
 */
export function isRegistered(): boolean {
  return state.isRegistered
}

/**
 * 获取注册信息
 */
export function getRegistration(): ServiceWorkerRegistration | null {
  return state.registration
}

/**
 * 预缓存指定 URL
 */
export async function precacheUrls(urls: string[]): Promise<boolean> {
  if (!('caches' in window)) return false

  try {
    const cache = await caches.open('easy-chat-user-cache-v1')
    await cache.addAll(urls)
    return true
  } catch (error) {
    console.error('[SW] Precache failed:', error)
    return false
  }
}

/**
 * 从缓存中获取响应
 */
export async function getFromCache(url: string): Promise<Response | null> {
  if (!('caches' in window)) return null

  const cache = await caches.open('easy-chat-user-cache-v1')
  const response = await cache.match(url)
  return response ?? null
}
