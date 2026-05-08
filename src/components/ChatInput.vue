<template>
  <div class="chat-input-wrapper">
    <div class="chat-input-container">
      <!-- 已选图片预览 -->
      <div v-if="pendingImages.length > 0" class="image-preview-list">
        <div
          v-for="(image, index) in pendingImages"
          :key="index"
          class="image-preview-item"
        >
          <img :src="image.previewUrl" :alt="image.name" />
          <div class="image-preview-overlay">
            <span class="image-name">{{ image.name }}</span>
            <el-button
              class="remove-image-btn"
              :icon="Close"
              circle
              size="small"
              @click="removeImage(index)"
            />
          </div>
        </div>
        <el-button
          v-if="pendingImages.length < 9"
          class="add-image-btn"
          :icon="Plus"
          @click="triggerImageUpload"
        >
          添加图片
        </el-button>
      </div>

      <el-input
        v-model="inputMessage"
        type="textarea"
        :autosize="{ minRows: 3, maxRows: 15 }"
        placeholder="输入消息... (Enter 换行，点击按钮发送)"
        resize="none"
        @keydown="handleKeydown"
      />
      <div class="input-actions">
        <div class="action-left">
          <el-button
            v-if="pendingImages.length === 0"
            :icon="Picture"
            @click="triggerImageUpload"
            class="image-btn"
          >
            图片
          </el-button>
          <input
            ref="imageInputRef"
            type="file"
            accept="image/*"
            multiple
            style="display: none"
            @change="handleImageSelect"
          />
        </div>
        <div class="action-right">
          <template v-if="!loading">
            <el-button
              :icon="View"
              :disabled="!canSend"
              @click="handlePreview"
              class="preview-btn"
            >
              预览请求体
            </el-button>
            <el-button
              type="primary"
              :icon="Promotion"
              :disabled="!canSend"
              @click="sendMessage"
              class="send-btn"
            >
              发送
            </el-button>
          </template>
          <el-button
            v-else
            type="danger"
            :icon="VideoPause"
            @click="handlePause"
            class="pause-btn"
          >
            暂停
          </el-button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { Promotion, VideoPause, View, Picture, Plus, Close } from '@element-plus/icons-vue'
import type { ImageReference } from '@/types'

interface PendingImage {
  file: File
  previewUrl: string
  name: string
  type: string
}

const props = defineProps<{
  loading: boolean
}>()

const emit = defineEmits<{
  send: [message: string, images?: PendingImage[]]
  pause: []
  preview: [message: string, images?: PendingImage[]]
}>()

const inputMessage = ref('')
const pendingImages = ref<PendingImage[]>([])
const imageInputRef = ref<HTMLInputElement>()

const canSend = computed(() => (inputMessage.value.trim() || pendingImages.value.length > 0) && !props.loading)

const handleKeydown = (e: KeyboardEvent) => {
  // 默认行为：Enter 换行，只有点击发送按钮才发送
  if (e.key === 'Enter' && !e.shiftKey) {
    // 不做任何处理，让默认行为执行（换行）
  }
}

const triggerImageUpload = () => {
  imageInputRef.value?.click()
}

const handleImageSelect = (e: Event) => {
  const target = e.target as HTMLInputElement
  const files = target.files
  if (!files) return

  const remainingSlots = 9 - pendingImages.value.length
  const filesToProcess = Math.min(files.length, remainingSlots)

  for (let i = 0; i < filesToProcess; i++) {
    const file = files[i]
    if (!file || !file.type.startsWith('image/')) continue

    // 创建临时预览 URL
    const previewUrl = URL.createObjectURL(file)
    pendingImages.value.push({
      file,
      previewUrl,
      name: file.name,
      type: file.type
    })
  }

  // 清空 input 以便可以重复选择相同文件
  target.value = ''
}

const removeImage = (index: number) => {
  const image = pendingImages.value[index]
  if (image) {
    URL.revokeObjectURL(image.previewUrl)
    pendingImages.value.splice(index, 1)
  }
}

const clearImages = () => {
  // 清理所有预览 URL
  for (const image of pendingImages.value) {
    URL.revokeObjectURL(image.previewUrl)
  }
  pendingImages.value = []
}

const sendMessage = () => {
  const message = inputMessage.value.trim()
  if ((!message && pendingImages.value.length === 0) || props.loading) return

  emit('send', message, pendingImages.value.length > 0 ? pendingImages.value : undefined)
  inputMessage.value = ''
  clearImages()
}

const handlePause = () => {
  emit('pause')
}

const handlePreview = () => {
  const message = inputMessage.value.trim()
  if (message || pendingImages.value.length > 0) {
    emit('preview', message, pendingImages.value.length > 0 ? pendingImages.value : undefined)
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

/* 图片预览列表 */
.image-preview-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 8px;
  background: rgba(255, 133, 162, 0.05);
  border-radius: 12px;
  border: 1px dashed rgba(255, 133, 162, 0.3);
}

.image-preview-item {
  position: relative;
  width: 80px;
  height: 80px;
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid rgba(255, 133, 162, 0.2);
}

.image-preview-item img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.image-preview-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  opacity: 0;
  transition: opacity 0.2s;
}

.image-preview-item:hover .image-preview-overlay {
  opacity: 1;
}

.image-name {
  color: white;
  font-size: 10px;
  text-align: center;
  padding: 0 4px;
  word-break: break-all;
  max-height: 30px;
  overflow: hidden;
}

.remove-image-btn {
  margin-top: 4px;
  background: rgba(255, 255, 255, 0.9);
  border: none;
}

.add-image-btn {
  width: 80px;
  height: 80px;
  border: 1px dashed rgba(255, 133, 162, 0.5);
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: 4px;
  color: #ff85a2;
  font-size: 12px;
}

.add-image-btn:hover {
  border-color: #ff85a2;
  background: rgba(255, 133, 162, 0.05);
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
  justify-content: space-between;
  align-items: center;
}

.action-left {
  display: flex;
  gap: 8px;
}

.action-right {
  display: flex;
  gap: 8px;
}

.image-btn {
  border-radius: 20px;
  padding: 10px 20px;
  font-weight: 500;
  transition: all 0.3s ease;
  color: #ff85a2;
  border-color: rgba(255, 133, 162, 0.3);
}

.image-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(255, 133, 162, 0.2);
  border-color: #ff85a2;
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

.preview-btn {
  border-radius: 20px;
  padding: 10px 20px;
  font-weight: 500;
  transition: all 0.3s ease;
}

.preview-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(64, 158, 255, 0.4);
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
  .pause-btn,
  .preview-btn,
  .image-btn {
    padding: 8px 16px;
    font-size: 14px;
  }

  .image-preview-item,
  .add-image-btn {
    width: 60px;
    height: 60px;
  }
}
</style>
