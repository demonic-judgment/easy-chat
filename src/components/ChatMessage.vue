<template>
  <div class="message-item" :class="{ 'user-message': isUser, 'assistant-message': !isUser }">
    <div class="message-avatar">
      <el-avatar :size="36" :icon="isUser ? User : ChatDotRound" :class="avatarClass" />
    </div>
    <div class="message-content-wrapper">
      <div class="message-header">
        <span class="message-role">{{ roleLabel }}</span>
        <span class="message-time">{{ formatTime }}</span>
      </div>
      <div class="message-content">
        <MarkdownRenderer :content="message.content" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { User, ChatDotRound } from '@element-plus/icons-vue'
import type { Message } from '@/types'
import MarkdownRenderer from './MarkdownRenderer.vue'

const props = defineProps<{
  message: Message
}>()

const isUser = computed(() => props.message.role === 'user')

const roleLabel = computed(() => {
  switch (props.message.role) {
    case 'user':
      return '用户'
    case 'assistant':
      return 'AI助手'
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
</script>

<style scoped>
.message-item {
  display: flex;
  gap: 12px;
  padding: 12px 16px;
  animation: fadeIn 0.3s ease;
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
  max-width: calc(100% - 60px);
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
</style>
