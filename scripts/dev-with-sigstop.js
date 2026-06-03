#!/usr/bin/env node
import { execSync, spawn } from 'child_process'
import process from 'process'

const PORT = 5173
let viteProcess = null

function killPort(port) {
  try {
    const result = execSync(`lsof -ti:${port} 2>/dev/null || echo ""`, { encoding: 'utf-8' })
    const pids = result.trim().split('\n').filter(Boolean)

    if (pids.length > 0) {
      console.log(`端口 ${port} 被进程 ${pids.join(', ')} 占用，正在终止...`)
      pids.forEach(pid => {
        try {
          execSync(`kill -9 ${pid} 2>/dev/null`)
          console.log(`已终止进程 ${pid}`)
        } catch (e) {
          // 忽略错误
        }
      })
      execSync('sleep 0.3')
      return true
    }
  } catch (e) {
    // 忽略错误
  }
  return false
}

// 处理 SIGTSTP (ctrl+z) 信号
process.on('SIGTSTP', (signal) => {
  console.log('\n收到 SIGTSTP (Ctrl+Z) 信号，正在关闭服务器并释放端口...')

  if (viteProcess) {
    viteProcess.kill('SIGTERM')
  }

  // 等待一下让进程退出
  setTimeout(() => {
    killPort(PORT)
    console.log('端口已释放，可以重新启动服务器')
    process.exit(0)
  }, 500)
})

// 处理 SIGINT (ctrl+c) 信号
process.on('SIGINT', (signal) => {
  console.log('\n收到 SIGINT (Ctrl+C) 信号，正在关闭服务器...')

  if (viteProcess) {
    viteProcess.kill('SIGTERM')
  }

  setTimeout(() => {
    killPort(PORT)
    process.exit(0)
  }, 500)
})

// 启动前先尝试释放端口
killPort(PORT)

// 启动 Vite
console.log(`启动 Vite 开发服务器 (端口: ${PORT})...`)
console.log(`按 Ctrl+Z 可停止服务器并自动释放端口`)

viteProcess = spawn('vite', ['--port', String(PORT), '--strictPort'], {
  stdio: 'inherit',
  shell: true,
  detached: false
})

viteProcess.on('close', (code) => {
  if (code !== null) {
    killPort(PORT)
    process.exit(code)
  }
})

viteProcess.on('error', (err) => {
  console.error('Vite 进程出错:', err)
  killPort(PORT)
  process.exit(1)
})
