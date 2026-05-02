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
          type="primary"
          :icon="Promotion"
          :loading="loading"
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
import { Promotion } from '@element-plus/icons-vue'

const props = defineProps<{
  loading: boolean
}>()

const emit = defineEmits<{
  send: [message: string]
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
</style>
