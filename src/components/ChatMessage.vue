<template>
  <div class="message-item" :class="{ 'user-message': isUser, 'assistant-message': !isUser }">
    <div class="message-avatar">
      <el-avatar
        :size="avatarSize"
        :icon="isUser ? (userAvatar ? undefined : User) : (agentAvatar ? undefined : ChatDotRound)"
        :src="isUser ? userAvatar : agentAvatar"
        :class="avatarClass"
      >
        {{ isUser 
          ? (userAvatar ? undefined : (userName?.charAt(0) || '用').toUpperCase())
          : (agentAvatar ? undefined : (agentName?.charAt(0) || 'A').toUpperCase()) 
        }}
      </el-avatar>
    </div>
    <div class="message-content-wrapper">
      <div class="message-header">
        <div class="header-left">
          <span class="message-role">{{ roleLabel }}</span>
          <span class="message-time">{{ formatTime }}</span>
        </div>
        <!-- 操作按钮 -->
        <div class="message-actions">
          <el-dropdown trigger="click" :teleported="false">
            <el-button
              class="action-btn"
              :icon="MoreFilled"
              circle
              size="small"
            />
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item @click="handleCopy">
                  <el-icon><CopyDocument /></el-icon>
                  <span>复制</span>
                </el-dropdown-item>
                <el-dropdown-item @click="startEdit">
                  <el-icon><Edit /></el-icon>
                  <span>编辑</span>
                </el-dropdown-item>
                <el-dropdown-item @click="showMetaDialog = true">
                  <el-icon><InfoFilled /></el-icon>
                  <span>查看元数据</span>
                </el-dropdown-item>
                <el-dropdown-item divided @click="handleDelete" class="delete-item">
                  <el-icon><Delete /></el-icon>
                  <span>删除</span>
                </el-dropdown-item>
                <el-dropdown-item @click="handleDeleteWithBelow" class="delete-item">
                  <el-icon><DeleteFilled /></el-icon>
                  <span>删除本条及以下</span>
                </el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </div>
      <div class="message-content">
        <!-- 编辑模式 -->
        <template v-if="isEditing">
          <el-input
            v-model="editContent"
            type="textarea"
            :rows="3"
            resize="none"
          />
          <div class="edit-actions">
            <el-button size="small" @click="cancelEdit">取消</el-button>
            <el-button size="small" type="primary" @click="saveEdit">保存</el-button>
          </div>
        </template>
        <!-- 显示模式 -->
        <template v-else>
          <MarkdownRenderer :content="message.content" />
        </template>
      </div>

      <!-- AI消息变体切换器（仅在最新AI消息显示） -->
      <div v-if="!isUser && showVariantSwitcher" class="variant-switcher">
        <el-button
          class="variant-btn"
          :disabled="currentVariantIndex <= 0"
          @click="handlePrevVariant"
        >
          <el-icon><ArrowLeft /></el-icon>
        </el-button>
        <span class="variant-info">{{ currentVariantIndex + 1 }} / {{ totalVariants }}</span>
        <el-button
          class="variant-btn"
          :disabled="currentVariantIndex >= totalVariants - 1"
          @click="handleNextVariant"
        >
          <el-icon><ArrowRight /></el-icon>
        </el-button>
        <el-button
          class="regenerate-btn"
          :icon="RefreshRight"
          :loading="isRegenerating"
          size="small"
          @click="handleRegenerate"
        >
          重新生成
        </el-button>
      </div>
    </div>

    <!-- 删除确认对话框 -->
    <el-dialog
      v-model="showDeleteDialog"
      title="确认删除"
      :width="isMobile ? '90%' : '400px'"
      destroy-on-close
    >
      <p>{{ deleteDialogMessage }}</p>
      <template #footer>
        <el-button @click="showDeleteDialog = false">取消</el-button>
        <el-button type="danger" @click="confirmDelete">确认删除</el-button>
      </template>
    </el-dialog>

    <!-- 元数据对话框 -->
    <el-dialog
      v-model="showMetaDialog"
      title="消息元数据"
      :width="isMobile ? '90%' : '500px'"
      destroy-on-close
    >
      <pre v-if="message.meta" class="meta-content">{{ JSON.stringify(message.meta, null, 2) }}</pre>
      <el-empty v-else description="该消息暂无元数据" />
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { 
  User, 
  ChatDotRound, 
  MoreFilled, 
  Edit, 
  Delete, 
  DeleteFilled,
  InfoFilled,
  ArrowLeft,
  ArrowRight,
  RefreshRight,
  CopyDocument
} from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import type { Message } from '@/types'
import MarkdownRenderer from './MarkdownRenderer.vue'
import { useMessageStore } from '@/stores'

const props = defineProps<{
  message: Message
  agentName?: string
  agentAvatar?: string
  userName?: string
  userAvatar?: string
  avatarSize?: number
  isLatestAssistantMessage?: boolean
}>()

const emit = defineEmits<{
  delete: [messageId: string]
  deleteWithBelow: [messageId: string]
  regenerate: [messageId: string]
}>()

const messageStore = useMessageStore()

// 移动端检测
const isMobile = ref(false)
const checkMobile = () => {
  isMobile.value = window.innerWidth <= 768
}

onMounted(() => {
  checkMobile()
  window.addEventListener('resize', checkMobile)
})

onUnmounted(() => {
  window.removeEventListener('resize', checkMobile)
})

const isUser = computed(() => props.message.role === 'user')

const roleLabel = computed(() => {
  switch (props.message.role) {
    case 'user':
      return props.userName || '用户'
    case 'assistant':
      return props.agentName || 'AI助手'
    case 'system':
      return '系统'
    default:
      return '未知'
  }
})

const avatarClass = computed(() => ({
  'user-avatar': isUser.value,
  'assistant-avatar': !isUser.value
}))

const formatTime = computed(() => {
  const date = new Date(props.message.createdAt)
  return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
})

// 编辑功能
const isEditing = ref(false)
const editContent = ref('')

const startEdit = () => {
  editContent.value = props.message.content
  isEditing.value = true
}

const cancelEdit = () => {
  isEditing.value = false
  editContent.value = ''
}

const saveEdit = () => {
  if (editContent.value.trim()) {
    messageStore.updateMessage(props.message.id, { content: editContent.value.trim() })
  }
  isEditing.value = false
}

// 复制功能
const handleCopy = async () => {
  try {
    await navigator.clipboard.writeText(props.message.content)
    ElMessage.success('已复制到剪贴板')
  } catch (err) {
    // 降级方案
    const textarea = document.createElement('textarea')
    textarea.value = props.message.content
    textarea.style.position = 'fixed'
    textarea.style.opacity = '0'
    document.body.appendChild(textarea)
    textarea.select()
    try {
      document.execCommand('copy')
      ElMessage.success('已复制到剪贴板')
    } catch {
      ElMessage.error('复制失败')
    }
    document.body.removeChild(textarea)
  }
}

// 删除功能
const showDeleteDialog = ref(false)
const deleteDialogMessage = ref('')
const deleteMode = ref<'single' | 'withBelow'>('single')

const handleDelete = () => {
  deleteMode.value = 'single'
  deleteDialogMessage.value = '确定要删除这条消息吗？'
  showDeleteDialog.value = true
}

const handleDeleteWithBelow = () => {
  deleteMode.value = 'withBelow'
  deleteDialogMessage.value = '确定要删除本条消息及以下的所有消息吗？此操作不可恢复。'
  showDeleteDialog.value = true
}

const confirmDelete = () => {
  if (deleteMode.value === 'single') {
    emit('delete', props.message.id)
  } else {
    emit('deleteWithBelow', props.message.id)
  }
  showDeleteDialog.value = false
}

// 元数据对话框
const showMetaDialog = ref(false)

// 变体切换功能（仅AI消息）
const isRegenerating = ref(false)

const showVariantSwitcher = computed(() => {
  return props.isLatestAssistantMessage && !isUser.value
})

const totalVariants = computed(() => {
  return props.message.variants?.length || 0
})

const currentVariantIndex = computed(() => {
  return props.message.currentVariantIndex ?? (totalVariants.value > 0 ? totalVariants.value - 1 : 0)
})

const handlePrevVariant = () => {
  if (currentVariantIndex.value > 0) {
    messageStore.switchVariant(props.message.id, currentVariantIndex.value - 1)
  }
}

const handleNextVariant = () => {
  if (currentVariantIndex.value < totalVariants.value - 1) {
    messageStore.switchVariant(props.message.id, currentVariantIndex.value + 1)
  }
}

const handleRegenerate = () => {
  isRegenerating.value = true
  emit('regenerate', props.message.id)
  // 3秒后重置加载状态（实际应在父组件完成后再重置）
  setTimeout(() => {
    isRegenerating.value = false
  }, 3000)
}

// 暴露方法给父组件
defineExpose({
  setRegenerating: (value: boolean) => {
    isRegenerating.value = value
  }
})
</script>

<style scoped>
.message-item {
  display: flex;
  gap: 8px;
  padding: 12px 8px;
  animation: fadeIn 0.3s ease;
  position: relative;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.message-item.user-message {
  flex-direction: row-reverse;
}

.message-avatar {
  flex-shrink: 0;
}

.user-avatar {
  background: linear-gradient(135deg, #ff85a2, #ff6b9d);
}

.assistant-avatar {
  background: linear-gradient(135deg, #a8d8ea, #7fcdbb);
}

.message-content-wrapper {
  flex: 1;
  max-width: calc(100% - 50px);
}

.message-item.user-message .message-content-wrapper {
  text-align: right;
}

.message-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 4px;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.message-item.user-message .message-header {
  flex-direction: row-reverse;
}

.message-item.user-message .header-left {
  flex-direction: row-reverse;
}

.message-role {
  font-size: 13px;
  font-weight: 500;
  color: #666;
}

.message-time {
  font-size: 11px;
  color: #999;
}

.message-content {
  background: #fff;
  padding: 12px 16px;
  border-radius: 16px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
  text-align: left;
  display: inline-block;
  max-width: 100%;
}

.message-item.user-message .message-content {
  background: linear-gradient(135deg, #ff85a2, #ff6b9d);
  color: white;
}

.message-item.assistant-message .message-content {
  background: #fff;
  color: #333;
}

.message-item.user-message .message-content :deep(.markdown-body) {
  color: white;
}

.message-item.user-message .message-content :deep(code) {
  background-color: rgba(255, 255, 255, 0.2);
  color: white;
}

.message-item.user-message .message-content :deep(pre) {
  background-color: rgba(255, 255, 255, 0.15);
}

.message-item.user-message .message-content :deep(pre code) {
  background-color: transparent;
}

/* 变体切换器 */
.variant-switcher {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
  padding: 4px 8px;
  background: rgba(255, 133, 162, 0.1);
  border-radius: 20px;
  width: fit-content;
}

.message-item.user-message .variant-switcher {
  margin-left: auto;
}

.variant-btn {
  padding: 4px 8px;
  border: none;
  background: transparent;
  color: #ff85a2;
}

.variant-btn:hover:not(:disabled) {
  background: rgba(255, 133, 162, 0.2);
}

.variant-btn:disabled {
  color: #ccc;
}

.variant-info {
  font-size: 12px;
  color: #666;
  min-width: 40px;
  text-align: center;
}

.regenerate-btn {
  margin-left: 8px;
  border-color: #ff85a2;
  color: #ff85a2;
}

.regenerate-btn:hover {
  background: rgba(255, 133, 162, 0.1);
}

/* 操作按钮 */
.message-actions {
  opacity: 1;
}

.action-btn {
  border: none;
  background: transparent;
  color: #999;
  padding: 2px;
  height: 20px;
  width: 20px;
}

.action-btn:hover {
  color: #ff85a2;
  background: rgba(255, 133, 162, 0.1);
}

/* 编辑模式样式 */
.edit-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 8px;
}

/* 元数据内容 */
.meta-content {
  background: #f5f5f5;
  padding: 16px;
  border-radius: 8px;
  overflow-x: auto;
  font-size: 12px;
  line-height: 1.6;
  margin: 0;
  text-align: left;
}

/* 元数据弹窗内容居中 */
:deep(.el-dialog__body) {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 100px;
}

:deep(.el-dialog__body .meta-content) {
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;
}

:deep(.el-dialog__body .el-empty) {
  margin: 20px 0;
}

/* 下拉菜单样式 */
:deep(.delete-item) {
  color: #f56c6c;
}

:deep(.delete-item:hover) {
  color: #f56c6c;
  background-color: #fef0f0;
}
</style>
