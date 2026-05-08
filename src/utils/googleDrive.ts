import { exportAllData, type BackupData } from './backup'

// Google OAuth2 配置
const GOOGLE_SCOPES = 'https://www.googleapis.com/auth/drive.file'

// 备份文件在 Google Drive 中的名称
const BACKUP_FILE_NAME = 'easy-chat-backup.json'
const BACKUP_MIME_TYPE = 'application/json'

// Google 登录状态
export interface GoogleAuthState {
  isSignedIn: boolean
  user: {
    id: string
    name: string
    email: string
    imageUrl: string
  } | null
  accessToken: string | null
}

// 状态管理
let authState: GoogleAuthState = {
  isSignedIn: false,
  user: null,
  accessToken: null
}

// 回调函数
let authChangeCallback: ((state: GoogleAuthState) => void) | null = null

/**
 * 设置认证状态变化回调
 */
export function onAuthStateChange(callback: (state: GoogleAuthState) => void) {
  authChangeCallback = callback
}

/**
 * 通知状态变化
 */
function notifyAuthStateChange() {
  if (authChangeCallback) {
    authChangeCallback({ ...authState })
  }
}

/**
 * 加载 Google API 脚本
 */
function loadGoogleScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.getElementById('google-api-script')) {
      resolve()
      return
    }

    const script = document.createElement('script')
    script.id = 'google-api-script'
    script.src = 'https://apis.google.com/js/api.js'
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Failed to load Google API'))
    document.head.appendChild(script)
  })
}

/**
 * 加载 Google Identity Services 脚本
 */
function loadGisScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.getElementById('google-gis-script')) {
      resolve()
      return
    }

    const script = document.createElement('script')
    script.id = 'google-gis-script'
    script.src = 'https://accounts.google.com/gsi/client'
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Failed to load Google Identity Services'))
    document.head.appendChild(script)
  })
}

/**
 * 初始化 Google API
 */
export async function initGoogleApi(): Promise<boolean> {
  try {
    await loadGoogleScript()
    await loadGisScript()

    // 检查本地存储的 token
    const savedToken = localStorage.getItem('easy-chat-google-token')
    const savedUser = localStorage.getItem('easy-chat-google-user')

    if (savedToken && savedUser) {
      authState = {
        isSignedIn: true,
        accessToken: savedToken,
        user: JSON.parse(savedUser)
      }
      notifyAuthStateChange()
    }

    return true
  } catch (error) {
    console.error('Failed to initialize Google API:', error)
    return false
  }
}

/**
 * 获取当前认证状态
 */
export function getAuthState(): GoogleAuthState {
  return { ...authState }
}

/**
 * 使用 Google Identity Services 登录
 */
export function signInWithGoogle(): Promise<GoogleAuthState> {
  return new Promise((resolve, reject) => {
    const clientId = localStorage.getItem('easy-chat-google-client-id')

    if (!clientId) {
      reject(new Error('请先配置 Google Client ID'))
      return
    }

    // @ts-ignore - Google Identity Services
    const tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: GOOGLE_SCOPES,
      callback: (tokenResponse: any) => {
        if (tokenResponse.error) {
          reject(new Error(tokenResponse.error))
          return
        }

        const accessToken = tokenResponse.access_token

        // 获取用户信息
        fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
          headers: {
            'Authorization': `Bearer ${accessToken}`
          }
        })
          .then(res => res.json())
          .then(userInfo => {
            authState = {
              isSignedIn: true,
              accessToken: accessToken,
              user: {
                id: userInfo.id,
                name: userInfo.name,
                email: userInfo.email,
                imageUrl: userInfo.picture
              }
            }

            // 保存到本地存储
            localStorage.setItem('easy-chat-google-token', accessToken)
            localStorage.setItem('easy-chat-google-user', JSON.stringify(authState.user))

            notifyAuthStateChange()
            resolve({ ...authState })
          })
          .catch(error => {
            reject(error)
          })
      },
      error_callback: (error: any) => {
        reject(new Error(error.message || '登录失败'))
      }
    })

    tokenClient.requestAccessToken()
  })
}

/**
 * 退出登录
 */
export function signOut(): void {
  authState = {
    isSignedIn: false,
    user: null,
    accessToken: null
  }

  localStorage.removeItem('easy-chat-google-token')
  localStorage.removeItem('easy-chat-google-user')

  notifyAuthStateChange()
}

/**
 * 设置 Google Client ID
 */
export function setGoogleClientId(clientId: string): void {
  localStorage.setItem('easy-chat-google-client-id', clientId)
}

/**
 * 获取 Google Client ID
 */
export function getGoogleClientId(): string {
  return localStorage.getItem('easy-chat-google-client-id') || ''
}

/**
 * 导出数据到 Google Drive
 */
export async function exportToGoogleDrive(): Promise<{ success: boolean; error?: string }> {
  if (!authState.isSignedIn || !authState.accessToken) {
    return { success: false, error: '请先登录 Google 账号' }
  }

  try {
    const backupData = exportAllData()
    const content = JSON.stringify(backupData, null, 2)

    // 先搜索是否已存在备份文件
    const searchResponse = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=name='${BACKUP_FILE_NAME}' and trashed=false&spaces=drive`,
      {
        headers: {
          'Authorization': `Bearer ${authState.accessToken}`
        }
      }
    )

    if (!searchResponse.ok) {
      throw new Error('搜索文件失败')
    }

    const searchResult = await searchResponse.json()
    const existingFile = searchResult.files?.[0]

    if (existingFile) {
      // 更新现有文件
      const updateResponse = await fetch(
        `https://www.googleapis.com/upload/drive/v3/files/${existingFile.id}?uploadType=media`,
        {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${authState.accessToken}`,
            'Content-Type': BACKUP_MIME_TYPE
          },
          body: content
        }
      )

      if (!updateResponse.ok) {
        throw new Error('更新文件失败')
      }
    } else {
      // 创建新文件
      const metadata = {
        name: BACKUP_FILE_NAME,
        mimeType: BACKUP_MIME_TYPE
      }

      const boundary = '-------314159265358979323846'
      const delimiter = "\r\n--" + boundary + "\r\n"
      const closeDelimiter = "\r\n--" + boundary + "--"

      const body =
        delimiter +
        'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
        JSON.stringify(metadata) +
        delimiter +
        'Content-Type: ' + BACKUP_MIME_TYPE + '\r\n\r\n' +
        content +
        closeDelimiter

      const createResponse = await fetch(
        'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${authState.accessToken}`,
            'Content-Type': 'multipart/related; boundary="' + boundary + '"'
          },
          body: body
        }
      )

      if (!createResponse.ok) {
        throw new Error('创建文件失败')
      }
    }

    return { success: true }
  } catch (error) {
    console.error('Export to Google Drive failed:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : '导出失败'
    }
  }
}

/**
 * 从 Google Drive 恢复数据
 */
export async function restoreFromGoogleDrive(): Promise<{
  success: boolean
  data?: BackupData
  error?: string
}> {
  if (!authState.isSignedIn || !authState.accessToken) {
    return { success: false, error: '请先登录 Google 账号' }
  }

  try {
    // 搜索备份文件
    const searchResponse = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=name='${BACKUP_FILE_NAME}' and trashed=false&spaces=drive`,
      {
        headers: {
          'Authorization': `Bearer ${authState.accessToken}`
        }
      }
    )

    if (!searchResponse.ok) {
      throw new Error('搜索文件失败')
    }

    const searchResult = await searchResponse.json()
    const existingFile = searchResult.files?.[0]

    if (!existingFile) {
      return { success: false, error: '未找到备份文件' }
    }

    // 下载文件内容
    const downloadResponse = await fetch(
      `https://www.googleapis.com/drive/v3/files/${existingFile.id}?alt=media`,
      {
        headers: {
          'Authorization': `Bearer ${authState.accessToken}`
        }
      }
    )

    if (!downloadResponse.ok) {
      throw new Error('下载文件失败')
    }

    const content = await downloadResponse.text()
    const data = JSON.parse(content) as BackupData

    return { success: true, data }
  } catch (error) {
    console.error('Restore from Google Drive failed:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : '恢复失败'
    }
  }
}

/**
 * 检查 Google Drive 中是否存在备份
 */
export async function checkBackupExists(): Promise<{
  exists: boolean
  modifiedTime?: string
  error?: string
}> {
  if (!authState.isSignedIn || !authState.accessToken) {
    return { exists: false, error: '未登录' }
  }

  try {
    const searchResponse = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=name='${BACKUP_FILE_NAME}' and trashed=false&spaces=drive&fields=files(id,modifiedTime)`,
      {
        headers: {
          'Authorization': `Bearer ${authState.accessToken}`
        }
      }
    )

    if (!searchResponse.ok) {
      throw new Error('搜索文件失败')
    }

    const searchResult = await searchResponse.json()
    const existingFile = searchResult.files?.[0]

    if (existingFile) {
      return {
        exists: true,
        modifiedTime: existingFile.modifiedTime
      }
    }

    return { exists: false }
  } catch (error) {
    return {
      exists: false,
      error: error instanceof Error ? error.message : '检查失败'
    }
  }
}
