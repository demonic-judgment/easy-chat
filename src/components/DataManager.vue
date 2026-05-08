<template>
  <div class="data-manager">
    <!-- 数据概览 -->
    <div class="data-overview">
      <h4>数据概览</h4>
      <div class="overview-grid">
        <div class="overview-item">
          <span class="overview-label">智能体</span>
          <span class="overview-value">{{ overview.agents }}</span>
        </div>
        <div class="overview-item">
          <span class="overview-label">聊天记录</span>
          <span class="overview-value">{{ overview.chatHistories }}</span>
        </div>
        <div class="overview-item">
          <span class="overview-label">消息</span>
          <span class="overview-value">{{ overview.messages }}</span>
        </div>
        <div class="overview-item">
          <span class="overview-label">提示词模板</span>
          <span class="overview-value">{{ overview.templates }}</span>
        </div>
        <div class="overview-item">
          <span class="overview-label">模型配置</span>
          <span class="overview-value">{{ overview.models }}</span>
        </div>
        <div class="overview-item">
          <span class="overview-label">悬浮图片</span>
          <span class="overview-value">{{ overview.floatingImages }}</span>
        </div>
      </div>
    </div>

    <el-divider />

    <!-- Google Drive 云端备份 -->
    <div class="data-section">
      <h4>Google Drive 云端备份</h4>
      <p class="section-desc">将数据备份到 Google Drive，实现跨设备同步</p>

      <!-- 未登录状态 -->
      <div v-if="!googleAuthState.isSignedIn" class="google-login-section">
        <div class="google-login-info">
          <el-icon :size="48" color="#4285f4"><Cloudy /></el-icon>
          <p>登录 Google 账号，开启云端备份功能</p>
        </div>
        <el-button
          type="primary"
          :icon="User"
          @click="handleGoogleLogin"
          :loading="googleLoading"
        >
          登录 Google 账号
        </el-button>
        <el-button
          link
          type="info"
          @click="showClientIdDialog = true"
        >
          配置 Client ID
        </el-button>
      </div>

      <!-- 已登录状态 -->
      <div v-else class="google-authed-section">
        <div class="google-user-info">
          <img
            v-if="googleAuthState.user?.imageUrl"
            :src="googleAuthState.user.imageUrl"
            class="user-avatar"
            alt="avatar"
          />
          <div class="user-details">
            <span class="user-name">{{ googleAuthState.user?.name }}</span>
            <span class="user-email">{{ googleAuthState.user?.email }}</span>
          </div>
          <el-button
            link
            type="danger"
            size="small"
            @click="handleGoogleLogout"
          >
            退出登录
          </el-button>
        </div>

        <div class="google-drive-actions">
          <div class="backup-status">
            <el-icon v-if="backupStatus.exists" :size="20" color="#67c23a"><CircleCheck /></el-icon>
            <el-icon v-else :size="20" color="#909399"><InfoFilled /></el-icon>
            <span>{{ backupStatusText }}</span>
          </div>

          <div class="action-buttons">
            <el-button
              type="primary"
              :icon="Upload"
              @click="handleExportToGoogleDrive"
              :loading="exportingToDrive"
            >
              备份到云端
            </el-button>
            <el-button
              type="success"
              :icon="Download"
              @click="handleRestoreFromGoogleDrive"
              :loading="restoringFromDrive"
              :disabled="!backupStatus.exists"
            >
              从云端恢复
            </el-button>
          </div>
        </div>
      </div>
    </div>

    <el-divider />

    <!-- 导出数据 -->
    <div class="data-section">
      <h4>导出数据</h4>
      <p class="section-desc">将所有数据导出为 JSON 文件，可用于备份或迁移</p>
      <el-button type="primary" :icon="Download" @click="handleExport">
        导出数据
      </el-button>
    </div>

    <el-divider />

    <!-- 恢复数据 -->
    <div class="data-section">
      <h4>恢复数据</h4>
      <p class="section-desc">从备份文件恢复数据</p>

      <el-upload
        ref="uploadRef"
        class="upload-area"
        accept=".json"
        :auto-upload="false"
        :on-change="handleFileChange"
        :show-file-list="false"
      >
        <el-button type="primary" :icon="Upload">
          选择备份文件
        </el-button>
      </el-upload>

      <!-- 恢复选项 -->
      <div v-if="selectedFile" class="restore-options">
        <el-radio-group v-model="restoreMode">
          <el-radio label="replace">完全替换现有数据</el-radio>
          <el-radio label="merge">合并数据（跳过重复项）</el-radio>
        </el-radio-group>

        <div class="restore-actions">
          <el-button type="success" @click="handleRestore" :loading="restoring">
            确认恢复
          </el-button>
          <el-button @click="cancelRestore">取消</el-button>
        </div>
      </div>
    </div>

    <el-divider />

    <!-- 清空数据 -->
    <div class="data-section danger-zone">
      <h4>危险区域</h4>
      <p class="section-desc">清空所有数据，此操作不可恢复</p>
      <el-button type="danger" :icon="Delete" @click="showClearConfirm = true">
        清空所有数据
      </el-button>
    </div>

    <!-- Client ID 配置对话框 -->
    <el-dialog
      v-model="showClientIdDialog"
      title="配置 Google Client ID"
      :width="isMobile ? '90%' : '500px'"
    >
      <div class="client-id-help">
        <p>要使用 Google Drive 备份功能，您需要：</p>
        <ol>
          <li>访问 <a href="https://console.cloud.google.com/" target="_blank">Google Cloud Console</a></li>
          <li>创建一个新项目或选择现有项目</li>
          <li>启用 Google Drive API</li>
          <li>创建 OAuth 2.0 客户端 ID（Web 应用类型）</li>
          <li>将授权来源添加为 <code>http://localhost</code> 和 <code>http://localhost:5173</code></li>
          <li>复制客户端 ID 并粘贴到下方</li>
        </ol>
      </div>
      <el-form label-width="100px">
        <el-form-item label="Client ID">
          <el-input
            v-model="clientIdInput"
            placeholder="例如: 123456789-abc123.apps.googleusercontent.com"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showClientIdDialog = false">取消</el-button>
        <el-button type="primary" @click="saveClientId">保存</el-button>
      </template>
    </el-dialog>

    <!-- Google Drive 恢复选项对话框 -->
    <el-dialog
      v-model="showDriveRestoreOptions"
      title="云端恢复选项"
      :width="isMobile ? '90%' : '400px'"
    >
      <p>请选择恢复方式：</p>
      <el-radio-group v-model="driveRestoreMode" class="drive-restore-options">
        <el-radio label="replace">完全替换现有数据</el-radio>
        <el-radio label="merge">合并数据（跳过重复项）</el-radio>
      </el-radio-group>
      <template #footer>
        <el-button @click="showDriveRestoreOptions = false">取消</el-button>
        <el-button type="primary" @click="confirmRestoreFromDrive" :loading="restoringFromDrive">
          确认恢复
        </el-button>
      </template>
    </el-dialog>

    <!-- 恢复结果对话框 -->
    <el-dialog
      v-model="showRestoreResult"
      title="恢复完成"
      :width="isMobile ? '90%' : '400px'"
    >
      <div v-if="restoreStats" class="restore-stats">
        <div class="stats-item">
          <span class="stats-label">智能体</span>
          <span class="stats-value success">+{{ restoreStats.agents.imported }}</span>
          <span v-if="restoreStats.agents.skipped > 0" class="stats-value skip">
            (跳过 {{ restoreStats.agents.skipped }})
          </span>
        </div>
        <div class="stats-item">
          <span class="stats-label">聊天记录</span>
          <span class="stats-value success">+{{ restoreStats.chatHistories.imported }}</span>
          <span v-if="restoreStats.chatHistories.skipped > 0" class="stats-value skip">
            (跳过 {{ restoreStats.chatHistories.skipped }})
          </span>
        </div>
        <div class="stats-item">
          <span class="stats-label">消息</span>
          <span class="stats-value success">+{{ restoreStats.messages.imported }}</span>
          <span v-if="restoreStats.messages.skipped > 0" class="stats-value skip">
            (跳过 {{ restoreStats.messages.skipped }})
          </span>
        </div>
        <div class="stats-item">
          <span class="stats-label">提示词模板</span>
          <span class="stats-value success">+{{ restoreStats.templates.imported }}</span>
          <span v-if="restoreStats.templates.skipped > 0" class="stats-value skip">
            (跳过 {{ restoreStats.templates.skipped }})
          </span>
        </div>
        <div class="stats-item">
          <span class="stats-label">模型配置</span>
          <span class="stats-value success">+{{ restoreStats.models.imported }}</span>
          <span v-if="restoreStats.models.skipped > 0" class="stats-value skip">
            (跳过 {{ restoreStats.models.skipped }})
          </span>
        </div>
        <div class="stats-item">
          <span class="stats-label">设置</span>
          <span class="stats-value" :class="restoreStats.settings.imported ? 'success' : 'skip'">
            {{ restoreStats.settings.imported ? '已恢复' : '未恢复' }}
          </span>
        </div>
        <div class="stats-item">
          <span class="stats-label">悬浮图片</span>
          <span class="stats-value success">+{{ restoreStats.floatingImages.imported }}</span>
          <span v-if="restoreStats.floatingImages.skipped > 0" class="stats-value skip">
            (跳过 {{ restoreStats.floatingImages.skipped }})
          </span>
        </div>
      </div>
      <template #footer>
        <el-button type="primary" @click="handleRestoreComplete">确定</el-button>
      </template>
    </el-dialog>

    <!-- 清空确认对话框 -->
    <el-dialog
      v-model="showClearConfirm"
      title="确认清空数据"
      :width="isMobile ? '90%' : '400px'"
    >
      <div class="clear-warning">
        <el-icon class="warning-icon" :size="48" color="#f56c6c"><Warning /></el-icon>
        <p>确定要清空所有数据吗？此操作不可恢复！</p>
        <p class="warning-tip">建议先导出数据进行备份</p>
      </div>
      <template #footer>
        <el-button @click="showClearConfirm = false">取消</el-button>
        <el-button type="danger" @click="handleClearData" :loading="clearing">
          确认清空
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { Download, Upload, Delete, Warning, Cloudy, User, CircleCheck, InfoFilled } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { UploadFile } from 'element-plus'
import {
  exportDataToFile,
  readBackupFromFile,
  restoreData,
  clearAllData,
  getDataOverview,
  type RestoreStats
} from '@/utils/backup'
import {
  initGoogleApi,
  signInWithGoogle,
  signOut,
  getAuthState,
  onAuthStateChange,
  exportToGoogleDrive,
  restoreFromGoogleDrive,
  checkBackupExists,
  setGoogleClientId,
  getGoogleClientId,
  type GoogleAuthState
} from '@/utils/googleDrive'

// 移动端检测
const isMobile = ref(false)
const checkMobile = () => {
  isMobile.value = window.innerWidth <= 768
}

onMounted(() => {
  checkMobile()
  window.addEventListener('resize', checkMobile)
  initGoogleDrive()
})

onUnmounted(() => {
  window.removeEventListener('resize', checkMobile)
})

const overview = ref({
  agents: 0,
  chatHistories: 0,
  messages: 0,
  templates: 0,
  models: 0,
  floatingImages: 0
})

const selectedFile = ref<File | null>(null)
const restoreMode = ref<'replace' | 'merge'>('replace')
const restoring = ref(false)
const showRestoreResult = ref(false)
const restoreStats = ref<RestoreStats | null>(null)
const showClearConfirm = ref(false)
const clearing = ref(false)
const uploadRef = ref()

// Google Drive 相关状态
const googleAuthState = ref<GoogleAuthState>({
  isSignedIn: false,
  user: null,
  accessToken: null
})
const googleLoading = ref(false)
const exportingToDrive = ref(false)
const restoringFromDrive = ref(false)
const backupStatus = ref({ exists: false, modifiedTime: '' })
const showClientIdDialog = ref(false)
const clientIdInput = ref('')
const showDriveRestoreOptions = ref(false)
const driveRestoreMode = ref<'replace' | 'merge'>('replace')
const driveBackupData = ref<any>(null)

// 备份状态文本
const backupStatusText = computed(() => {
  if (backupStatus.value.exists) {
    const date = new Date(backupStatus.value.modifiedTime)
    return `云端已有备份 (${date.toLocaleString('zh-CN')})`
  }
  return '云端暂无备份'
})

// 初始化 Google Drive
const initGoogleDrive = async () => {
  // 设置状态监听
  onAuthStateChange((state) => {
    googleAuthState.value = state
    if (state.isSignedIn) {
      checkDriveBackupStatus()
    }
  })

  // 初始化 API
  await initGoogleApi()

  // 获取初始状态
  googleAuthState.value = getAuthState()

  // 如果已登录，检查备份状态
  if (googleAuthState.value.isSignedIn) {
    checkDriveBackupStatus()
  }

  // 加载保存的 Client ID
  clientIdInput.value = getGoogleClientId()
}

// 检查云端备份状态
const checkDriveBackupStatus = async () => {
  const result = await checkBackupExists()
  if (result.exists) {
    backupStatus.value = {
      exists: true,
      modifiedTime: result.modifiedTime || ''
    }
  } else {
    backupStatus.value = { exists: false, modifiedTime: '' }
  }
}

// Google 登录
const handleGoogleLogin = async () => {
  const clientId = getGoogleClientId()
  if (!clientId) {
    showClientIdDialog.value = true
    ElMessage.warning('请先配置 Google Client ID')
    return
  }

  googleLoading.value = true
  try {
    await signInWithGoogle()
    ElMessage.success('登录成功')
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '登录失败')
  } finally {
    googleLoading.value = false
  }
}

// Google 退出
const handleGoogleLogout = () => {
  signOut()
  backupStatus.value = { exists: false, modifiedTime: '' }
  ElMessage.success('已退出登录')
}

// 保存 Client ID
const saveClientId = () => {
  if (!clientIdInput.value.trim()) {
    ElMessage.warning('请输入 Client ID')
    return
  }
  setGoogleClientId(clientIdInput.value.trim())
  showClientIdDialog.value = false
  ElMessage.success('Client ID 已保存')
}

// 导出到 Google Drive
const handleExportToGoogleDrive = async () => {
  exportingToDrive.value = true
  try {
    const result = await exportToGoogleDrive()
    if (result.success) {
      ElMessage.success('备份成功')
      checkDriveBackupStatus()
    } else {
      ElMessage.error(result.error || '备份失败')
    }
  } catch (error) {
    ElMessage.error('备份失败')
  } finally {
    exportingToDrive.value = false
  }
}

// 从 Google Drive 恢复
const handleRestoreFromGoogleDrive = async () => {
  restoringFromDrive.value = true
  try {
    const result = await restoreFromGoogleDrive()
    if (result.success && result.data) {
      driveBackupData.value = result.data
      showDriveRestoreOptions.value = true
    } else {
      ElMessage.error(result.error || '获取备份失败')
    }
  } catch (error) {
    ElMessage.error('获取备份失败')
  } finally {
    restoringFromDrive.value = false
  }
}

// 确认从云端恢复
const confirmRestoreFromDrive = async () => {
  if (!driveBackupData.value) return

  restoringFromDrive.value = true
  try {
    const confirmText = driveRestoreMode.value === 'replace'
      ? '恢复操作将替换所有现有数据，是否继续？'
      : '恢复操作将合并数据，重复项将被跳过，是否继续？'

    await ElMessageBox.confirm(confirmText, '确认恢复', {
      confirmButtonText: '确认',
      cancelButtonText: '取消',
      type: 'warning'
    })

    const restoreResult = restoreData(driveBackupData.value, {
      merge: driveRestoreMode.value === 'merge',
      keepExisting: false
    })

    if (restoreResult.success) {
      restoreStats.value = restoreResult.stats || null
      showRestoreResult.value = true
      showDriveRestoreOptions.value = false
      driveBackupData.value = null
    } else {
      ElMessage.error(restoreResult.error || '恢复失败')
    }
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('恢复失败')
    }
  } finally {
    restoringFromDrive.value = false
  }
}

// 刷新数据概览
const refreshOverview = () => {
  overview.value = getDataOverview()
}

onMounted(() => {
  refreshOverview()
})

// 导出数据
const handleExport = () => {
  try {
    exportDataToFile()
    ElMessage.success('数据导出成功')
  } catch (error) {
    ElMessage.error('数据导出失败')
  }
}

// 文件选择变化
const handleFileChange = (uploadFile: UploadFile) => {
  if (uploadFile.raw) {
    selectedFile.value = uploadFile.raw
  }
}

// 取消恢复
const cancelRestore = () => {
  selectedFile.value = null
  restoreMode.value = 'replace'
  if (uploadRef.value) {
    uploadRef.value.clearFiles()
  }
}

// 恢复数据
const handleRestore = async () => {
  if (!selectedFile.value) {
    ElMessage.warning('请选择备份文件')
    return
  }

  restoring.value = true

  try {
    const result = await readBackupFromFile(selectedFile.value)

    if (!result.success || !result.data) {
      ElMessage.error(result.error || '读取备份文件失败')
      return
    }

    // 确认恢复
    const confirmText = restoreMode.value === 'replace'
      ? '恢复操作将替换所有现有数据，是否继续？'
      : '恢复操作将合并数据，重复项将被跳过，是否继续？'

    await ElMessageBox.confirm(confirmText, '确认恢复', {
      confirmButtonText: '确认',
      cancelButtonText: '取消',
      type: 'warning'
    })

    // 执行恢复
    const restoreResult = restoreData(result.data, {
      merge: restoreMode.value === 'merge',
      keepExisting: false
    })

    if (restoreResult.success) {
      restoreStats.value = restoreResult.stats || null
      showRestoreResult.value = true
      cancelRestore()
    } else {
      ElMessage.error(restoreResult.error || '恢复失败')
    }
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('恢复失败')
    }
  } finally {
    restoring.value = false
  }
}

// 恢复完成
const handleRestoreComplete = () => {
  showRestoreResult.value = false
  refreshOverview()
  // 提示用户刷新页面
  ElMessageBox.confirm('数据已恢复，是否刷新页面以应用更改？', '提示', {
    confirmButtonText: '刷新页面',
    cancelButtonText: '稍后手动刷新',
    type: 'info'
  }).then(() => {
    window.location.reload()
  }).catch(() => {
    // 用户选择不刷新
  })
}

// 清空数据
const handleClearData = async () => {
  clearing.value = true

  try {
    await ElMessageBox.confirm('确定要清空所有数据吗？此操作不可恢复！', '最后确认', {
      confirmButtonText: '确认清空',
      cancelButtonText: '取消',
      type: 'error'
    })

    clearAllData()
    ElMessage.success('数据已清空')
    showClearConfirm.value = false
    refreshOverview()

    // 提示用户刷新页面
    ElMessageBox.confirm('数据已清空，是否刷新页面以应用更改？', '提示', {
      confirmButtonText: '刷新页面',
      cancelButtonText: '稍后手动刷新',
      type: 'info'
    }).then(() => {
      window.location.reload()
    }).catch(() => {
      // 用户选择不刷新
    })
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('操作失败')
    }
  } finally {
    clearing.value = false
  }
}
</script>

<style scoped>
.data-manager {
  padding: 16px 16px 80px 16px;
}

.data-overview {
  margin-bottom: 24px;
}

.data-overview h4 {
  margin: 0 0 16px 0;
  font-size: 16px;
  color: #333;
}

.overview-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 12px;
}

.overview-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 12px;
  background: #f5f7fa;
  border-radius: 8px;
}

.overview-label {
  font-size: 12px;
  color: #909399;
  margin-bottom: 4px;
}

.overview-value {
  font-size: 24px;
  font-weight: 600;
  color: #409eff;
}

.data-section {
  margin-bottom: 24px;
}

.data-section h4 {
  margin: 0 0 8px 0;
  font-size: 16px;
  color: #333;
}

.section-desc {
  margin: 0 0 16px 0;
  font-size: 14px;
  color: #909399;
}

/* Google Drive 相关样式 */
.google-login-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  padding: 32px;
  background: #f5f7fa;
  border-radius: 12px;
  text-align: center;
}

.google-login-info {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

.google-login-info p {
  margin: 0;
  color: #606266;
  font-size: 14px;
}

.google-authed-section {
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding: 20px;
  background: #f5f7fa;
  border-radius: 12px;
}

.google-user-info {
  display: flex;
  align-items: center;
  gap: 12px;
  padding-bottom: 16px;
  border-bottom: 1px solid #e4e7ed;
}

.user-avatar {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  object-fit: cover;
}

.user-details {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.user-name {
  font-size: 16px;
  font-weight: 500;
  color: #303133;
}

.user-email {
  font-size: 13px;
  color: #909399;
}

.google-drive-actions {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.backup-status {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  color: #606266;
}

.action-buttons {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.client-id-help {
  margin-bottom: 20px;
  font-size: 14px;
  line-height: 1.8;
}

.client-id-help ol {
  margin: 12px 0;
  padding-left: 20px;
}

.client-id-help li {
  margin: 8px 0;
}

.client-id-help code {
  background: #f5f7fa;
  padding: 2px 6px;
  border-radius: 4px;
  font-family: monospace;
  font-size: 13px;
}

.client-id-help a {
  color: #409eff;
  text-decoration: none;
}

.client-id-help a:hover {
  text-decoration: underline;
}

.drive-restore-options {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: 16px;
}

.upload-area {
  margin-bottom: 16px;
}

.restore-options {
  margin-top: 16px;
  padding: 16px;
  background: #f5f7fa;
  border-radius: 8px;
}

.restore-options .el-radio-group {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.restore-actions {
  margin-top: 16px;
  display: flex;
  gap: 12px;
}

.danger-zone h4 {
  color: #f56c6c;
}

.restore-stats {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.stats-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 0;
  border-bottom: 1px solid #ebeef5;
}

.stats-item:last-child {
  border-bottom: none;
}

.stats-label {
  flex: 1;
  font-size: 14px;
  color: #606266;
}

.stats-value {
  font-size: 14px;
  font-weight: 500;
}

.stats-value.success {
  color: #67c23a;
}

.stats-value.skip {
  color: #909399;
  font-size: 12px;
}

.clear-warning {
  text-align: center;
  padding: 20px;
}

.warning-icon {
  margin-bottom: 16px;
}

.clear-warning p {
  margin: 8px 0;
  font-size: 14px;
  color: #606266;
}

.warning-tip {
  color: #e6a23c;
  font-size: 12px;
}
</style>
