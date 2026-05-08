/**
 * Easy Chat Service Worker
 * 提供图片缓存和离线支持
 */

const CACHE_NAME = 'easy-chat-cache-v1'
const IMAGE_CACHE_NAME = 'easy-chat-images-v1'

// 需要预缓存的核心资源
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/assets/index.css',
  '/assets/index.js'
]

// 安装时预缓存核心资源
self.addEventListener('install', (event) => {
  console.log('[SW] Installing...')

  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[SW] Pre-caching assets')
        return cache.addAll(PRECACHE_ASSETS)
      })
      .then(() => {
        console.log('[SW] Install completed')
        return self.skipWaiting()
      })
      .catch((err) => {
        console.error('[SW] Pre-cache failed:', err)
      })
  )
})

// 激活时清理旧缓存
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating...')

  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME && cacheName !== IMAGE_CACHE_NAME) {
              console.log('[SW] Deleting old cache:', cacheName)
              return caches.delete(cacheName)
            }
          })
        )
      })
      .then(() => {
        console.log('[SW] Activate completed')
        return self.clients.claim()
      })
  )
})

// 判断请求是否为图片
const isImageRequest = (request) => {
  const url = new URL(request.url)
  // Blob URL 不需要缓存（已经是本地数据）
  if (url.protocol === 'blob:') return false
  // Data URL 不需要缓存
  if (url.protocol === 'data:') return false
  // 检查请求头或扩展名
  const accept = request.headers.get('accept') || ''
  return accept.includes('image/') ||
    /\.(jpg|jpeg|png|gif|webp|svg|ico|bmp)$/i.test(url.pathname)
}

// 判断是否为 API 请求
const isAPIRequest = (request) => {
  const url = new URL(request.url)
  return url.pathname.startsWith('/api/')
}

// 缓存策略：网络优先，失败时回退缓存
const networkFirstStrategy = async (request) => {
  try {
    const networkResponse = await fetch(request)
    if (networkResponse.ok) {
      const cache = await caches.open(CACHE_NAME)
      cache.put(request, networkResponse.clone())
    }
    return networkResponse
  } catch (error) {
    const cachedResponse = await caches.match(request)
    if (cachedResponse) {
      console.log('[SW] Serving from cache:', request.url)
      return cachedResponse
    }
    throw error
  }
}

// 缓存策略：缓存优先，过期后回退网络
const cacheFirstStrategy = async (request, cacheName) => {
  const cachedResponse = await caches.match(request)

  if (cachedResponse) {
    // 检查缓存是否过期（7天）
    const dateHeader = cachedResponse.headers.get('date')
    if (dateHeader) {
      const cachedTime = new Date(dateHeader).getTime()
      const now = Date.now()
      const maxAge = 7 * 24 * 60 * 60 * 1000 // 7天

      if (now - cachedTime < maxAge) {
        console.log('[SW] Serving image from cache:', request.url)
        return cachedResponse
      }
    } else {
      return cachedResponse
    }
  }

  // 缓存未命中或已过期，从网络获取
  try {
    const networkResponse = await fetch(request)
    if (networkResponse.ok) {
      const cache = await caches.open(cacheName)
      cache.put(request, networkResponse.clone())
    }
    return networkResponse
  } catch (error) {
    if (cachedResponse) {
      console.log('[SW] Network failed, serving stale cache:', request.url)
      return cachedResponse
    }
    throw error
  }
}

// 处理 fetch 事件
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // 跳过非 GET 请求
  if (request.method !== 'GET') return

  // 跳过浏览器扩展请求
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return

  // 图片请求使用缓存优先策略
  if (isImageRequest(request)) {
    event.respondWith(cacheFirstStrategy(request, IMAGE_CACHE_NAME))
    return
  }

  // API 请求使用网络优先策略
  if (isAPIRequest(request)) {
    event.respondWith(networkFirstStrategy(request))
    return
  }

  // 其他资源使用网络优先策略
  event.respondWith(networkFirstStrategy(request))
})

// 处理消息（来自主线程）
self.addEventListener('message', (event) => {
  const { type, payload } = event.data

  switch (type) {
    case 'SKIP_WAITING':
      self.skipWaiting()
      break

    case 'CLEAR_CACHE':
      event.waitUntil(
        caches.keys().then((cacheNames) => {
          return Promise.all(
            cacheNames.map((cacheName) => caches.delete(cacheName))
          )
        }).then(() => {
          event.ports[0]?.postMessage({ success: true })
        })
      )
      break

    case 'GET_CACHE_SIZE':
      event.waitUntil(
        caches.open(IMAGE_CACHE_NAME).then(async (cache) => {
          const requests = await cache.keys()
          let totalSize = 0
          for (const request of requests) {
            const response = await cache.match(request)
            if (response) {
              const blob = await response.blob()
              totalSize += blob.size
            }
          }
          event.ports[0]?.postMessage({
            success: true,
            count: requests.length,
            totalSize
          })
        })
      )
      break

    default:
      console.log('[SW] Unknown message type:', type)
  }
})

console.log('[SW] Service Worker loaded')
