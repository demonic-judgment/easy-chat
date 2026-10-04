#!/usr/bin/env node
import { execSync, spawn } from 'child_process'
import process from 'process'

const PORT = 5173
const isWindows = process.platform === 'win32'
let viteProcess = null

// 执行命令并忽略错误，返回标准输出（失败时返回空串）
function execSafe(command) {
  try {
    return execSync(command, { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] })
  } catch {
    return ''
  }
}

// 同步等待，跨平台，无需依赖系统的 sleep / timeout 命令
function sleepSync(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms)
}

// 查找占用指定端口、处于监听状态的进程 PID
function findPidsByPort(port) {
  if (isWindows) {
    const output = execSafe(`netstat -ano | findstr :${port}`)
    const pids = output
      .split(/\r?\n/)
      .map((line) => line.trim().split(/\s+/))
      .filter((parts) => parts.length >= 5 && /LISTENING/i.test(parts[parts.length - 2]))
      .map((parts) => parts[parts.length - 1])
    return [...new Set(pids.filter((pid) => pid && pid !== '0'))]
  }

  const output = execSafe(`lsof -ti:${port}`)
  return [...new Set(output.split(/\s+/).filter(Boolean))]
}

// 终止单个进程（Windows 下连同子进程树一起终止）
function killPid(pid) {
  if (isWindows) {
    execSafe(`taskkill /PID ${pid} /T /F`)
  } else {
    execSafe(`kill -9 ${pid}`)
  }
}

function killPort(port) {
  const pids = findPidsByPort(port)
  if (pids.length === 0) return false

  console.log(`端口 ${port} 被进程 ${pids.join(', ')} 占用，正在终止...`)
  pids.forEach((pid) => {
    killPid(pid)
    console.log(`已终止进程 ${pid}`)
  })
  sleepSync(300)
  return true
}

// 关闭 Vite 进程（Windows 下需终止整棵进程树，否则 shell 子进程会残留）
function stopVite() {
  if (!viteProcess || !viteProcess.pid) return
  if (isWindows) {
    execSafe(`taskkill /PID ${viteProcess.pid} /T /F`)
  } else {
    viteProcess.kill('SIGTERM')
  }
}

function shutdown(message) {
  console.log(message)
  stopVite()
  setTimeout(() => {
    killPort(PORT)
    console.log('端口已释放，可以重新启动服务器')
    process.exit(0)
  }, 500)
}

// Windows 不支持 SIGTSTP，仅在类 Unix 平台注册 Ctrl+Z 处理
if (!isWindows) {
  process.on('SIGTSTP', () => {
    shutdown('\n收到 SIGTSTP (Ctrl+Z) 信号，正在关闭服务器并释放端口...')
  })
}

// SIGINT (Ctrl+C) 各平台通用
process.on('SIGINT', () => {
  shutdown('\n收到 SIGINT (Ctrl+C) 信号，正在关闭服务器...')
})

// 启动前先尝试释放端口
killPort(PORT)

// 启动 Vite
console.log(`启动 Vite 开发服务器 (端口: ${PORT})...`)
if (!isWindows) {
  console.log('按 Ctrl+Z 可停止服务器并自动释放端口')
}

// 以单条命令字符串 + shell 方式启动，兼容 Windows(cmd) 与类 Unix(sh)，
// 同时避免向 shell 传参数数组触发的 Node 弃用警告
viteProcess = spawn(`vite --port ${PORT} --strictPort`, {
  stdio: 'inherit',
  shell: true
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
