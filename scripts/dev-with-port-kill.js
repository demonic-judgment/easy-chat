#!/usr/bin/env node
import { execSync, spawn } from 'child_process'
import process from 'process'

const PORT = 5173

function killPort(port) {
  try {
    // 查找占用端口的进程
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
      // 等待一下确保端口释放
      execSync('sleep 0.5')
      return true
    }
  } catch (e) {
    // 忽略错误
  }
  return false
}

// 尝试释放端口
killPort(PORT)

// 启动 Vite
console.log(`启动 Vite 开发服务器 (端口: ${PORT})...`)
const vite = spawn('vite', ['--port', String(PORT), '--strictPort'], {
  stdio: 'inherit',
  shell: true
})

vite.on('close', (code) => {
  process.exit(code)
})
