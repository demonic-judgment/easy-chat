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

    <!-- 恢复结果对话框 -->
    <el-dialog
      v-model="showRestoreResult"
      title="恢复完成"
      width="400px"
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
      </div>
      <template #footer>
        <el-button type="primary" @click="handleRestoreComplete">确定</el-button>
      </template>
    </el-dialog>

    <!-- 清空确认对话框 -->
    <el-dialog
      v-model="showClearConfirm"
      title="确认清空数据"
      width="400px"
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
import { ref, onMounted } from 'vue'
import { Download, Upload, Delete, Warning } from '@element-plus/icons-vue'
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

const overview = ref({
  agents: 0,
  chatHistories: 0,
  messages: 0,
  templates: 0,
  models: 0
})

const selectedFile = ref<File | null>(null)
const restoreMode = ref<'replace' | 'merge'>('replace')
const restoring = ref(false)
const showRestoreResult = ref(false)
const restoreStats = ref<RestoreStats | null>(null)
const showClearConfirm = ref(false)
const clearing = ref(false)
const uploadRef = ref()

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
