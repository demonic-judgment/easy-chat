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
        <span class="message-role">{{ roleLabel }}</span>
        <span class="message-time">{{ formatTime }}</span>
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
          </el-dropdown-menu>
        </template>
      </el-dropdown>
    </div>

    <!-- 元数据对话框 -->
    <el-dialog
      v-model="showMetaDialog"
      title="消息元数据"
      width="500px"
      destroy-on-close
    >
      <pre v-if="message.meta" class="meta-content">{{ JSON.stringify(message.meta, null, 2) }}</pre>
      <el-empty v-else description="该消息暂无元数据" />
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { User, ChatDotRound, MoreFilled, Edit, Delete, InfoFilled } from '@element-plus/icons-vue'
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
}>()

const emit = defineEmits<{
  delete: [messageId: string]
}>()

const messageStore = useMessageStore()

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

// 删除功能
const handleDelete = () => {
  emit('delete', props.message.id)
}

// 元数据对话框
const showMetaDialog = ref(false)
</script>

<style scoped>
.message-item {
  display: flex;
  gap: 12px;
  padding: 12px 16px;
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
  max-width: calc(100% - 100px);
}

.message-item.user-message .message-content-wrapper {
  text-align: right;
}

.message-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}

.message-item.user-message .message-header {
  justify-content: flex-end;
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

/* 操作按钮 */
.message-actions {
  opacity: 0;
  transition: opacity 0.2s ease;
  align-self: flex-start;
  margin-top: 24px;
}

.message-item:hover .message-actions {
  opacity: 1;
}

.action-btn {
  border: none;
  background: transparent;
  color: #999;
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
