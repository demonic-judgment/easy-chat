<template>
  <div class="chat-input-wrapper">
    <div class="chat-input-container">
      <el-input
        v-model="inputMessage"
        type="textarea"
        :rows="3"
        placeholder="输入消息... (Enter 换行，点击按钮发送)"
        resize="none"
        @keydown="handleKeydown"
      />
      <div class="input-actions">
        <el-button
          v-if="loading"
          type="danger"
          :icon="VideoPause"
          @click="handlePause"
          class="pause-btn"
        >
          暂停
        </el-button>
        <el-button
          v-else
          type="primary"
          :icon="Promotion"
          :disabled="!canSend"
          @click="sendMessage"
          class="send-btn"
        >
          发送
        </el-button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { Promotion, VideoPause } from '@element-plus/icons-vue'

const props = defineProps<{
  loading: boolean
}>()

const emit = defineEmits<{
  send: [message: string]
  pause: []
}>()

const inputMessage = ref('')

const canSend = computed(() => inputMessage.value.trim() && !props.loading)

const handleKeydown = (e: KeyboardEvent) => {
  // 默认行为：Enter 换行，只有点击发送按钮才发送
  if (e.key === 'Enter' && !e.shiftKey) {
    // 不做任何处理，让默认行为执行（换行）
  }
}

const sendMessage = () => {
  const message = inputMessage.value.trim()
  if (message && !props.loading) {
    emit('send', message)
    inputMessage.value = ''
  }
}

const handlePause = () => {
  emit('pause')
}
</script>

<style scoped>
.chat-input-wrapper {
  padding: 16px 20px;
  background: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(10px);
  border-top: 1px solid rgba(255, 133, 162, 0.2);
}

.chat-input-container {
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-width: 800px;
  margin: 0 auto;
}

:deep(.el-textarea__inner) {
  border-radius: 16px;
  border-color: rgba(255, 133, 162, 0.3);
  background: rgba(255, 255, 255, 0.8);
  padding: 12px 16px;
  font-size: 14px;
  transition: all 0.3s ease;
}

:deep(.el-textarea__inner:focus) {
  border-color: #ff85a2;
  box-shadow: 0 0 0 2px rgba(255, 133, 162, 0.1);
}

.input-actions {
  display: flex;
  justify-content: flex-end;
}

.send-btn {
  background: linear-gradient(135deg, #ff85a2, #ff6b9d);
  border: none;
  border-radius: 20px;
  padding: 10px 24px;
  font-weight: 500;
  transition: all 0.3s ease;
}

.send-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(255, 133, 162, 0.4);
}

.send-btn:disabled {
  background: #ccc;
  transform: none;
  box-shadow: none;
}

.pause-btn {
  background: linear-gradient(135deg, #f56c6c, #e6a23c);
  border: none;
  border-radius: 20px;
  padding: 10px 24px;
  font-weight: 500;
  transition: all 0.3s ease;
}

.pause-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(245, 108, 108, 0.4);
}

/* 移动端适配 */
@media screen and (max-width: 768px) {
  .chat-input-wrapper {
    padding: 12px 16px;
  }

  .chat-input-container {
    max-width: 100%;
  }

  :deep(.el-textarea__inner) {
    font-size: 16px; /* 防止 iOS 缩放 */
  }

  .send-btn,
  .pause-btn {
    padding: 8px 20px;
    font-size: 14px;
  }
}
</style>
