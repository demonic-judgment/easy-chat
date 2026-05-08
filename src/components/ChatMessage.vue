<template>
  <div class="message-item" :class="{ 'user-message': isUser, 'assistant-message': !isUser }">
    <div class="message-content-wrapper">
      <div class="message-header">
        <span class="message-time">{{ formatTime }}</span>
      </div>
      <div class="message-body">
        <div class="message-content" :class="{ 'error-content': isErrorMessage }">
        <!-- 编辑模式 -->
        <template v-if="isEditing">
          <el-input
            v-model="editContent"
            type="textarea"
            :rows="8"
            resize="vertical"
          />
          <div class="edit-actions">
            <el-button size="small" @click="cancelEdit">取消</el-button>
            <el-button size="small" type="primary" @click="saveEdit">保存</el-button>
          </div>
        </template>
        <!-- 错误消息显示 -->
        <template v-else-if="isErrorMessage && errorInfo">
          <div class="error-message-container">
            <div class="error-header">
              <el-icon class="error-icon" :style="{ color: errorInfo.color }">
                <component :is="errorInfo.icon" />
              </el-icon>
              <span class="error-title" :style="{ color: errorInfo.color }">
                {{ errorInfo.title }}
              </span>
            </div>
            <div class="error-description">
              {{ errorInfo.message }}
            </div>
            <div class="error-actions">
              <el-button 
                size="small" 
                type="primary" 
                :icon="RefreshRight"
                @click="handleRegenerate"
              >
                重试
              </el-button>
              <el-button 
                size="small" 
                @click="showErrorDetails = true"
              >
                查看详情
              </el-button>
            </div>
          </div>
        </template>
        <!-- 正常消息显示 -->
        <template v-else>
          <!-- 思维链展示 -->
          <div v-if="thoughtChainData.hasReasoning" class="thought-chain-container">
            <div class="thought-chain-header" @click="toggleThoughtChain">
              <el-icon class="thought-icon"><Loading /></el-icon>
              <span class="thought-label">思考过程</span>
              <el-icon class="toggle-icon" :class="{ expanded: isThoughtChainExpanded }">
                <ArrowDown />
              </el-icon>
            </div>
            <div v-show="isThoughtChainExpanded" class="thought-chain-content">
              <MarkdownRenderer :content="thoughtChainData.reasoning" />
            </div>
          </div>
          <MarkdownRenderer :content="thoughtChainData.hasReasoning ? thoughtChainData.content : message.content" />
          <!-- 消息图片列表 -->
          <div v-if="message.images && message.images.length > 0" class="message-images">
            <div
              v-for="(image, index) in message.images"
              :key="index"
              class="message-image-item"
              @click="previewImage(image)"
            >
              <img
                :src="getImageDisplayUrl(image)"
                :alt="image.name || '图片'"
                @error="handleImageError(image.imageId)"
              />
              <div v-if="!getImageDisplayUrl(image)" class="image-loading">
                <el-icon><Loading /></el-icon>
              </div>
            </div>
          </div>
          <!-- AI消息操作区：重新生成按钮和变体切换器 -->
          <div v-if="!isUser && (showRegenerateButton || showVariantSwitcher)" class="ai-actions-container">
            <div class="ai-actions-divider"></div>
            <div class="ai-actions-content">
              <!-- 变体切换器（仅在重新生成后显示） -->
              <div v-if="showVariantSwitcher" class="variant-switcher">
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
              </div>

              <!-- 重新生成按钮（仅在最新AI消息显示） -->
              <div v-if="showRegenerateButton" class="regenerate-container">
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
          </div>
        </template>
      </div>
        <!-- 消息操作按钮 -->
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

    <!-- 错误详情对话框 -->
    <el-dialog
      v-model="showErrorDetails"
      title="错误详情"
      :width="isMobile ? '90%' : '500px'"
      destroy-on-close
    >
      <div v-if="errorInfo" class="error-details">
        <div class="error-detail-item">
          <span class="error-detail-label">错误类型:</span>
          <el-tag :type="errorInfo.type === 'network' || errorInfo.type === 'timeout' || errorInfo.type === 'rate_limit' ? 'warning' : 'danger'" size="small">
            {{ errorInfo.type === 'network' ? '网络错误' :
               errorInfo.type === 'auth' ? '认证错误' :
               errorInfo.type === 'timeout' ? '超时错误' :
               errorInfo.type === 'rate_limit' ? '限流错误' :
               errorInfo.type === 'server' ? '服务器错误' :
               errorInfo.type === 'api' ? 'API错误' : '未知错误' }}
          </el-tag>
        </div>
        <div class="error-detail-item">
          <span class="error-detail-label">原始错误信息:</span>
          <pre class="error-original">{{ message.content.replace(/^抱歉，发生了错误:\s*/, '') }}</pre>
        </div>
      </div>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import {
  MoreFilled,
  Edit,
  Delete,
  DeleteFilled,
  InfoFilled,
  ArrowLeft,
  ArrowRight,
  RefreshRight,
  CopyDocument,
  WarningFilled,
  CircleCloseFilled,
  Connection,
  Lock,
  Timer,
  Cpu,
  Loading,
  ArrowDown
} from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import type { Message, ImageContent } from '@/types'
import MarkdownRenderer from './MarkdownRenderer.vue'
import { useMessageStore } from '@/stores'
import { parseThoughtChain } from '@/utils/thoughtChain'
import { getImageUrl, revokeImageUrl } from '@/utils/imageStorage'

// 错误类型定义
interface ErrorInfo {
  type: 'network' | 'api' | 'auth' | 'timeout' | 'rate_limit' | 'server' | 'unknown'
  title: string
  message: string
  icon: any
  color: string
}

// 错误识别函数
function parseError(errorMessage: string): ErrorInfo {
  const msg = errorMessage.toLowerCase()
  
  // 网络错误
  if (msg.includes('network') || msg.includes('fetch') || msg.includes('failed to fetch') || 
      msg.includes('net::') || msg.includes('无法连接') || msg.includes('网络') ||
      msg.includes('abort') || msg.includes('aborterror')) {
    return {
      type: 'network',
      title: '网络连接错误',
      message: '无法连接到服务器，请检查网络连接后重试',
      icon: Connection,
      color: '#e6a23c'
    }
  }
  
  // 认证错误
  if (msg.includes('401') || msg.includes('403') || msg.includes('unauthorized') || 
      msg.includes('forbidden') || msg.includes('api key') || msg.includes('密钥') ||
      msg.includes('认证') || msg.includes('鉴权') || msg.includes('auth')) {
    return {
      type: 'auth',
      title: '认证失败',
      message: 'API 密钥无效或已过期，请检查密钥配置',
      icon: Lock,
      color: '#f56c6c'
    }
  }
  
  // 限流错误
  if (msg.includes('429') || msg.includes('rate limit') || msg.includes('too many requests') ||
      msg.includes('限流') || msg.includes('请求过于频繁')) {
    return {
      type: 'rate_limit',
      title: '请求过于频繁',
      message: '已达到 API 速率限制，请稍后再试',
      icon: Timer,
      color: '#e6a23c'
    }
  }
  
  // 超时错误
  if (msg.includes('timeout') || msg.includes('timed out') || msg.includes('超时')) {
    return {
      type: 'timeout',
      title: '请求超时',
      message: '服务器响应时间过长，请稍后重试',
      icon: Timer,
      color: '#e6a23c'
    }
  }
  
  // 服务器错误
  if (msg.includes('500') || msg.includes('502') || msg.includes('503') || msg.includes('504') ||
      msg.includes('internal server error') || msg.includes('bad gateway') || 
      msg.includes('service unavailable') || msg.includes('服务器错误') || msg.includes('服务不可用')) {
    return {
      type: 'server',
      title: '服务器错误',
      message: '服务器暂时不可用，请稍后再试',
      icon: Cpu,
      color: '#f56c6c'
    }
  }
  
  // API 错误
  if (msg.includes('api') || msg.includes('模型') || msg.includes('model') ||
      msg.includes('请求失败') || msg.includes('error')) {
    return {
      type: 'api',
      title: 'API 错误',
      message: errorMessage || '调用 API 时发生错误',
      icon: WarningFilled,
      color: '#f56c6c'
    }
  }
  
  // 未知错误
  return {
    type: 'unknown',
    title: '发生错误',
    message: errorMessage || '发生未知错误，请稍后重试',
    icon: CircleCloseFilled,
    color: '#909399'
  }
}

const props = defineProps<{
  message: Message
  agentName?: string
  agentAvatar?: string
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
  // 清理 Blob URL
  for (const url of Object.values(imageUrlMap.value)) {
    if (url && !url.startsWith('data:')) {
      URL.revokeObjectURL(url)
    }
  }
})

const isUser = computed(() => props.message.role === 'user')

// 图片 URL 映射（imageId -> Blob URL）
const imageUrlMap = ref<Record<string, string>>({})
const isLoadingImages = ref(false)

// 加载图片 URL
const loadImageUrls = async () => {
  if (!props.message.images || props.message.images.length === 0) return

  isLoadingImages.value = true
  try {
    for (const imageRef of props.message.images) {
      if (imageRef.imageId && !imageUrlMap.value[imageRef.imageId]) {
        const url = await getImageUrl(imageRef.imageId)
        if (url) {
          imageUrlMap.value[imageRef.imageId] = url
        }
      }
    }
  } finally {
    isLoadingImages.value = false
  }
}

// 获取图片显示 URL
const getImageDisplayUrl = (imageRef: { imageId?: string }): string => {
  if (!imageRef.imageId) return ''
  return imageUrlMap.value[imageRef.imageId] || ''
}

// 组件挂载时加载图片
onMounted(() => {
  loadImageUrls()
})

// 监听消息变化，重新加载图片
watch(() => props.message.images, (newImages, oldImages) => {
  if (newImages !== oldImages) {
    loadImageUrls()
  }
}, { deep: true })

// 检查消息是否为错误消息
const isErrorMessage = computed(() => {
  if (isUser.value) return false
  const content = props.message.content
  return content && (
    content.startsWith('抱歉，发生了错误:') ||
    content.startsWith('网络连接错误') ||
    content.startsWith('认证失败') ||
    content.startsWith('请求过于频繁') ||
    content.startsWith('请求超时') ||
    content.startsWith('服务器错误') ||
    content.startsWith('API 错误')
  )
})

// 解析错误信息
const errorInfo = computed<ErrorInfo | null>(() => {
  if (!isErrorMessage.value) return null
  const content = props.message.content
  const errorMsg = content.replace(/^抱歉，发生了错误:\s*/, '')
  return parseError(errorMsg)
})

// 思维链相关
const thoughtChainData = computed(() => {
  if (isUser.value || isErrorMessage.value) {
    return { reasoning: '', content: '', hasReasoning: false }
  }
  return parseThoughtChain(props.message.content)
})

const isThoughtChainExpanded = ref(true)

const toggleThoughtChain = () => {
  isThoughtChainExpanded.value = !isThoughtChainExpanded.value
}

const formatTime = computed(() => {
  const date = new Date(props.message.createdAt)
  return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
})

// 编辑功能
const isEditing = ref(false)
const editContent = ref('')

// 错误详情对话框
const showErrorDetails = ref(false)

const startEdit = () => {
  editContent.value = props.message.content
  isEditing.value = true
}

const cancelEdit = () => {
  isEditing.value = false
  editContent.value = ''
}

const saveEdit = async () => {
  if (editContent.value.trim()) {
    await messageStore.updateMessage(props.message.id, { content: editContent.value.trim() })
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

// 图片加载错误处理
const handleImageError = async (imageId?: string) => {
  if (!imageId) return
  // 尝试重新加载图片
  const url = await getImageUrl(imageId)
  if (url) {
    imageUrlMap.value[imageId] = url
  }
}

// 图片预览
const previewImage = (image: { imageId?: string; name?: string }) => {
  if (!image.imageId) return

  const imageUrl = imageUrlMap.value[image.imageId]
  if (!imageUrl) return

  // 使用 Element Plus 的图片预览功能
  const img = new Image()
  img.src = imageUrl
  img.style.maxWidth = '90vw'
  img.style.maxHeight = '90vh'
  img.style.objectFit = 'contain'

  // 创建预览容器
  const previewContainer = document.createElement('div')
  previewContainer.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.8);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 9999;
    cursor: zoom-out;
  `
  previewContainer.appendChild(img)

  // 点击关闭
  previewContainer.addEventListener('click', () => {
    document.body.removeChild(previewContainer)
  })

  document.body.appendChild(previewContainer)
}

// 变体切换功能（仅AI消息）
const isRegenerating = ref(false)

// 显示重新生成按钮（仅在最新AI消息显示）
const showRegenerateButton = computed(() => {
  return props.isLatestAssistantMessage && !isUser.value
})

// 显示变体切换器（仅在有变体时显示）
const showVariantSwitcher = computed(() => {
  return !isUser.value && totalVariants.value > 0
})

const totalVariants = computed(() => {
  return props.message.variants?.length || 0
})

const currentVariantIndex = computed(() => {
  return props.message.currentVariantIndex ?? (totalVariants.value > 0 ? totalVariants.value - 1 : 0)
})

const handlePrevVariant = async () => {
  if (currentVariantIndex.value > 0) {
    await messageStore.switchVariant(props.message.id, currentVariantIndex.value - 1)
  }
}

const handleNextVariant = async () => {
  if (currentVariantIndex.value < totalVariants.value - 1) {
    await messageStore.switchVariant(props.message.id, currentVariantIndex.value + 1)
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

.message-content-wrapper {
  flex: 1;
  max-width: 100%;
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

.message-item.user-message .message-header {
  flex-direction: row-reverse;
}

.message-body {
  display: flex;
  align-items: flex-start;
  gap: 8px;
}

.message-item.user-message .message-body {
  justify-content: flex-end;
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
  background: #f5f5f5;
  color: #333;
  border: 2px solid #ff85a2;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
  position: relative;
}

.message-item.assistant-message .message-content {
  background: transparent;
  color: #333;
  box-shadow: none;
  padding: 0;
}

.message-item.user-message .message-content :deep(.markdown-body) {
  color: #333;
}

.message-item.user-message .message-content :deep(code) {
  background-color: rgba(255, 133, 162, 0.15);
  color: #ff6b9d;
}

.message-item.user-message .message-content :deep(pre) {
  background-color: rgba(255, 133, 162, 0.1);
}

.message-item.user-message .message-content :deep(pre code) {
  background-color: transparent;
  color: #333;
}

/* 重新生成按钮容器 */
.regenerate-container {
  display: flex;
  align-items: center;
}

/* 变体切换器 */
.variant-switcher {
  display: flex;
  align-items: center;
  gap: 8px;
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
  border-radius: 16px;
}

.regenerate-btn:hover {
  background: rgba(255, 133, 162, 0.1);
}

/* AI消息操作区（在气泡内） */
.ai-actions-container {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid #e0e0e0;
}

.ai-actions-content {
  display: flex;
  align-items: center;
  gap: 12px;
  justify-content: flex-start;
}

/* 操作按钮 */
.message-actions {
  opacity: 1;
  flex-shrink: 0;
  margin-top: 4px;
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
.message-content:has(.el-textarea) {
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;
}

:deep(.el-textarea) {
  width: 100%;
  max-width: 100%;
}

:deep(.el-textarea__inner) {
  min-width: unset;
  max-width: 100%;
  width: 100%;
  box-sizing: border-box;
}

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

/* 错误消息样式 */
.message-content.error-content {
  background: #fef0f0;
  border: 1px solid #fde2e2;
  min-width: 280px;
}

.error-message-container {
  padding: 8px 4px;
}

.error-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.error-icon {
  font-size: 20px;
}

.error-title {
  font-size: 15px;
  font-weight: 600;
}

.error-description {
  font-size: 13px;
  color: #666;
  margin-bottom: 12px;
  line-height: 1.5;
}

.error-actions {
  display: flex;
  gap: 8px;
}

/* 错误详情对话框样式 */
.error-details {
  width: 100%;
}

.error-detail-item {
  margin-bottom: 16px;
}

.error-detail-item:last-child {
  margin-bottom: 0;
}

.error-detail-label {
  display: block;
  font-size: 13px;
  color: #666;
  margin-bottom: 8px;
  font-weight: 500;
}

.error-original {
  background: #f5f5f5;
  padding: 12px;
  border-radius: 6px;
  font-size: 12px;
  color: #333;
  overflow-x: auto;
  white-space: pre-wrap;
  word-break: break-all;
  margin: 0;
  max-height: 200px;
  overflow-y: auto;
}

/* 消息图片样式 */
.message-images {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 12px;
}

.message-image-item {
  width: 120px;
  height: 120px;
  border-radius: 8px;
  overflow: hidden;
  cursor: pointer;
  border: 1px solid rgba(255, 133, 162, 0.2);
  transition: transform 0.2s, box-shadow 0.2s;
}

.message-image-item:hover {
  transform: scale(1.02);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.message-image-item img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

/* 图片加载状态 */
.image-loading {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.05);
  color: #999;
  font-size: 24px;
}

/* 用户消息的图片样式 */
.message-item.user-message .message-image-item {
  border-color: rgba(255, 255, 255, 0.3);
}

/* 移动端适配 */
@media screen and (max-width: 768px) {
  .message-image-item {
    width: 80px;
    height: 80px;
  }
}

/* 思维链样式 */
.thought-chain-container {
  margin-bottom: 12px;
  border: 1px solid #e8e8e8;
  border-radius: 8px;
  overflow: hidden;
  background: #fafafa;
}

.thought-chain-header {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  cursor: pointer;
  user-select: none;
  transition: background-color 0.2s;
}

.thought-chain-header:hover {
  background-color: #f0f0f0;
}

.thought-icon {
  color: #909399;
  font-size: 14px;
  animation: rotate 1s linear infinite;
  animation-play-state: paused;
}

.thought-chain-container:not(.collapsed) .thought-icon {
  animation-play-state: running;
}

@keyframes rotate {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.thought-label {
  font-size: 12px;
  color: #666;
  flex: 1;
}

.toggle-icon {
  font-size: 12px;
  color: #999;
  transition: transform 0.2s;
}

.toggle-icon.expanded {
  transform: rotate(180deg);
}

.thought-chain-content {
  padding: 0 12px 12px;
  font-size: 13px;
  color: #666;
  border-top: 1px dashed #e8e8e8;
  margin-top: 0;
  padding-top: 12px;
}

.thought-chain-content :deep(.markdown-body) {
  color: #666;
}

.thought-chain-content :deep(p) {
  margin-bottom: 8px;
}

.thought-chain-content :deep(p:last-child) {
  margin-bottom: 0;
}
</style>
