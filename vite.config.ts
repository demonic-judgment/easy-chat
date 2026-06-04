import { fileURLToPath, URL } from 'node:url'
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'

import { cloudflare } from "@cloudflare/vite-plugin"

// 生成构建版本号（时间戳 + git commit 前7位）
function generateBuildVersion(): string {
  const timestamp = Date.now()
  let gitHash = 'dev'
  try {
    // 尝试读取 git commit hash
    const { execSync } = require('child_process')
    gitHash = execSync('git rev-parse --short HEAD').toString().trim()
  } catch {
    // 没有 git 时使用随机字符串
    gitHash = Math.random().toString(36).substring(2, 9)
  }
  return `${timestamp}-${gitHash}`
}

// 插件：更新 Service Worker 版本号
function updateServiceWorkerVersion(): import('vite').Plugin {
  return {
    name: 'update-sw-version',
    writeBundle() {
      const swPath = resolve('public/sw.js')
      try {
        let content = readFileSync(swPath, 'utf-8')
        const newVersion = generateBuildVersion()
        // 替换 CACHE_VERSION
        content = content.replace(
          /const CACHE_VERSION = .+/,
          `const CACHE_VERSION = '${newVersion}'`
        )
        // 同时更新 public 目录下的 sw.js（用于开发）
        writeFileSync(swPath, content)
        // 也更新 dist 目录下的 sw.js
        const distSwPath = resolve('dist/sw.js')
        writeFileSync(distSwPath, content)
        console.log(`[SW] Version updated to: ${newVersion}`)
      } catch (err) {
        console.error('[SW] Failed to update version:', err)
      }
    }
  }
}

// https://vite.dev/config/
export default defineConfig({
	plugins: [
		vue(),
		vueDevTools(),
		cloudflare(),
		updateServiceWorkerVersion()
	],
	resolve: {
		alias: {
			'@': fileURLToPath(new URL('./src', import.meta.url))
		},
	},
	server: {
		port: 5173,
		strictPort: true
	}
})
