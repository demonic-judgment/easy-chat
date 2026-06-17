/**
 * 节流函数
 * @param fn 要节流的函数
 * @param wait 等待时间（毫秒）
 * @returns 节流后的函数
 */
export function throttle<T extends (...args: any[]) => any>(
  fn: T,
  wait: number
): (...args: Parameters<T>) => void {
  let lastTime = 0
  let timeoutId: ReturnType<typeof setTimeout> | null = null

  return function (...args: Parameters<T>) {
    const now = Date.now()

    // 清除之前的定时器
    if (timeoutId) {
      clearTimeout(timeoutId)
      timeoutId = null
    }

    // 如果已经过了等待时间，立即执行
    if (now - lastTime >= wait) {
      lastTime = now
      fn(...args)
    } else {
      // 否则，在剩余时间后执行
      timeoutId = setTimeout(() => {
        lastTime = Date.now()
        fn(...args)
      }, wait - (now - lastTime))
    }
  }
}

/**
 * 使用 requestAnimationFrame 的节流函数
 * 适用于 UI 更新场景
 * @param fn 要节流的函数
 * @returns 节流后的函数
 */
export function rafThrottle<T extends (...args: any[]) => any>(
  fn: T
): (...args: Parameters<T>) => void {
  let rafId: number | null = null

  return function (...args: Parameters<T>) {
    if (rafId !== null) {
      cancelAnimationFrame(rafId)
    }

    rafId = requestAnimationFrame(() => {
      rafId = null
      fn(...args)
    })
  }
}

/**
 * 带延迟执行的防抖函数
 * @param fn 要防抖的函数
 * @param wait 等待时间（毫秒）
 * @returns 防抖后的函数
 */
export function debounce<T extends (...args: any[]) => any>(
  fn: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout> | null = null

  return function (...args: Parameters<T>) {
    if (timeoutId) {
      clearTimeout(timeoutId)
    }

    timeoutId = setTimeout(() => {
      fn(...args)
    }, wait)
  }
}
