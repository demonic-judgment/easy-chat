<template>
  <div class="floating-image-viewer">
    <!-- 悬浮图片框列表 -->
    <TransitionGroup name="image-window">
      <div
        v-for="(image, index) in visibleImages"
        :key="image.id"
        class="image-window"
        :class="{ 'is-dragging': dragState.imageId === image.id }"
        :style="getWindowStyle(image)"
        @mousedown="handleWindowMouseDown($event, image)"
      >
        <!-- 悬浮关闭按钮 -->
        <div
          class="floating-close-btn"
          @click.stop="toggleImageVisibility(image.id)"
        >
          <el-icon><Close /></el-icon>
        </div>

        <!-- 图片内容区域（同时作为拖拽区域） -->
        <div
          class="window-content"
          :style="getContentStyle(image)"
          @mousedown="startDrag($event, image)"
        >
          <img
            :src="image.url"
            :alt="image.name"
            draggable="false"
            @load="handleImageLoad($event, image)"
          />
        </div>

        <!-- 调整大小手柄 -->
        <div
          class="resize-handle resize-se"
          @mousedown="startResize($event, image, 'se')"
        />
        <div
          class="resize-handle resize-sw"
          @mousedown="startResize($event, image, 'sw')"
        />
        <div
          class="resize-handle resize-ne"
          @mousedown="startResize($event, image, 'ne')"
        />
        <div
          class="resize-handle resize-nw"
          @mousedown="startResize($event, image, 'nw')"
        />
      </div>
    </TransitionGroup>

    <!-- 触发按钮 -->
    <el-button
      v-if="floatingImages.length === 0"
      class="viewer-trigger"
      :icon="Picture"
      circle
      size="large"
      @click="showUploadDialog = true"
    />

    <el-button
      v-else
      class="viewer-trigger has-images"
      :icon="PictureFilled"
      circle
      size="large"
      @click="showUploadDialog = true"
    >
      <span class="image-count">{{ floatingImages.length }}</span>
    </el-button>

    <!-- 上传对话框 -->
    <el-dialog
      v-model="showUploadDialog"
      title="上传图片"
      width="500px"
      destroy-on-close
      :teleported="true"
      :append-to-body="true"
    >
      <el-upload
        class="image-uploader"
        drag
        action="#"
        :auto-upload="false"
        :on-change="handleFileChange"
        :show-file-list="false"
        accept="image/*"
        multiple
      >
        <el-icon class="upload-icon"><Upload /></el-icon>
        <div class="upload-text">
          拖拽图片到此处，或 <em>点击上传</em>
        </div>
        <template #tip>
          <div class="upload-tip">
            支持 JPG、PNG、GIF、WebP 等格式，可上传多张图片
          </div>
        </template>
      </el-upload>

      <!-- 已上传图片预览 -->
      <div v-if="floatingImages.length > 0" class="uploaded-images">
        <h4>已上传</h4>
        <div class="image-list">
          <div
            v-for="image in floatingImages"
            :key="image.id"
            class="image-item"
            :class="{ 'is-hidden': !image.isVisible }"
          >
            <img :src="image.url" :alt="image.name" />
            <div class="image-overlay">
              <el-switch
                v-model="image.isVisible"
                size="small"
                active-text="显示"
                inactive-text="隐藏"
              />
              <el-button
                class="delete-btn"
                :icon="Delete"
                circle
                size="small"
                type="danger"
                @click="closeImage(image.id)"
              />
            </div>
          </div>
        </div>
      </div>

      <template #footer>
        <el-button @click="showUploadDialog = false">关闭</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, onUnmounted } from 'vue'
import {
  Picture,
  PictureFilled,
  Close,
  Upload,
  Delete
} from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import type { UploadFile } from 'element-plus'

interface FloatingImage {
  id: string
  url: string
  name: string
  x: number
  y: number
  width: number
  height: number
  naturalWidth: number
  naturalHeight: number
  aspectRatio: number
  zIndex: number
  isVisible: boolean
}

interface DragState {
  isDragging: boolean
  imageId: string | null
  startX: number
  startY: number
  initialX: number
  initialY: number
}

interface ResizeState {
  isResizing: boolean
  imageId: string | null
  direction: string
  startX: number
  startY: number
  initialWidth: number
  initialHeight: number
  initialX: number
  initialY: number
  aspectRatio: number
}

const floatingImages = ref<FloatingImage[]>([])
const showUploadDialog = ref(false)
const maxZIndex = ref(1000)

// 计算属性：只显示可见的图片
const visibleImages = computed(() => {
  return floatingImages.value.filter(img => img.isVisible)
})

const dragState = reactive<DragState>({
  isDragging: false,
  imageId: null,
  startX: 0,
  startY: 0,
  initialX: 0,
  initialY: 0
})

const resizeState = reactive<ResizeState>({
  isResizing: false,
  imageId: null,
  direction: '',
  startX: 0,
  startY: 0,
  initialWidth: 0,
  initialHeight: 0,
  initialX: 0,
  initialY: 0,
  aspectRatio: 1
})

// 生成唯一ID
const generateId = () => `img_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

// 处理文件上传
const handleFileChange = (uploadFile: UploadFile) => {
  const file = uploadFile.raw
  if (!file) return

  if (!file.type.startsWith('image/')) {
    ElMessage.error('请上传图片文件')
    return
  }

  const reader = new FileReader()
  reader.onload = (e) => {
    const url = e.target?.result as string
    addImage(url, file.name)
  }
  reader.readAsDataURL(file)
}

// 添加图片
const addImage = (url: string, name: string) => {
  // 计算初始位置（错开显示）
  const offset = floatingImages.value.length * 30
  const initialX = 100 + offset
  const initialY = 100 + offset

  const image: FloatingImage = {
    id: generateId(),
    url,
    name,
    x: initialX,
    y: initialY,
    width: 300,
    height: 200,
    naturalWidth: 0,
    naturalHeight: 0,
    aspectRatio: 1,
    zIndex: ++maxZIndex.value,
    isVisible: true
  }

  floatingImages.value.push(image)
}

// 关闭图片（彻底删除）
const closeImage = (id: string) => {
  const index = floatingImages.value.findIndex(img => img.id === id)
  if (index > -1) {
    // 释放 URL 对象
    const img = floatingImages.value[index]!
    if (img.url.startsWith('blob:')) {
      URL.revokeObjectURL(img.url)
    }
    floatingImages.value.splice(index, 1)
  }
}

// 切换图片显示/隐藏
const toggleImageVisibility = (id: string) => {
  const image = floatingImages.value.find(img => img.id === id)
  if (image) {
    image.isVisible = !image.isVisible
  }
}

// 将窗口置于最前
const bringToFront = (image: FloatingImage) => {
  image.zIndex = ++maxZIndex.value
}

// 处理窗口鼠标按下
const handleWindowMouseDown = (e: MouseEvent, image: FloatingImage) => {
  bringToFront(image)
}

// 开始拖拽
const startDrag = (e: MouseEvent, image: FloatingImage) => {
  e.preventDefault()
  e.stopPropagation()

  dragState.isDragging = true
  dragState.imageId = image.id
  dragState.startX = e.clientX
  dragState.startY = e.clientY
  dragState.initialX = image.x
  dragState.initialY = image.y

  bringToFront(image)
}

// 处理拖拽移动
const handleDragMove = (e: MouseEvent) => {
  if (dragState.isDragging && dragState.imageId) {
    const image = floatingImages.value.find(img => img.id === dragState.imageId)
    if (image) {
      const deltaX = e.clientX - dragState.startX
      const deltaY = e.clientY - dragState.startY
      image.x = Math.max(0, dragState.initialX + deltaX)
      image.y = Math.max(0, dragState.initialY + deltaY)
    }
  }
}

// 结束拖拽
const endDrag = () => {
  dragState.isDragging = false
  dragState.imageId = null
}

// 开始调整大小
const startResize = (e: MouseEvent, image: FloatingImage, direction: string) => {
  e.preventDefault()
  e.stopPropagation()

  resizeState.isResizing = true
  resizeState.imageId = image.id
  resizeState.direction = direction
  resizeState.startX = e.clientX
  resizeState.startY = e.clientY
  resizeState.initialWidth = image.width
  resizeState.initialHeight = image.height
  resizeState.initialX = image.x
  resizeState.initialY = image.y
  resizeState.aspectRatio = image.aspectRatio

  bringToFront(image)
}

// 处理调整大小移动
const handleResizeMove = (e: MouseEvent) => {
  if (resizeState.isResizing && resizeState.imageId) {
    const image = floatingImages.value.find(img => img.id === resizeState.imageId)
    if (!image) return

    const deltaX = e.clientX - resizeState.startX
    const deltaY = e.clientY - resizeState.startY

    let newWidth = resizeState.initialWidth
    let newHeight = resizeState.initialHeight
    let newX = resizeState.initialX
    let newY = resizeState.initialY

    // 根据方向计算新尺寸（保持宽高比）
    const minSize = 100

    switch (resizeState.direction) {
      case 'se': // 东南角
        newWidth = Math.max(minSize, resizeState.initialWidth + deltaX)
        newHeight = newWidth / resizeState.aspectRatio
        break
      case 'sw': // 西南角
        newWidth = Math.max(minSize, resizeState.initialWidth - deltaX)
        newHeight = newWidth / resizeState.aspectRatio
        newX = resizeState.initialX + (resizeState.initialWidth - newWidth)
        break
      case 'ne': // 东北角
        newWidth = Math.max(minSize, resizeState.initialWidth + deltaX)
        newHeight = newWidth / resizeState.aspectRatio
        newY = resizeState.initialY + (resizeState.initialHeight - newHeight)
        break
      case 'nw': // 西北角
        newWidth = Math.max(minSize, resizeState.initialWidth - deltaX)
        newHeight = newWidth / resizeState.aspectRatio
        newX = resizeState.initialX + (resizeState.initialWidth - newWidth)
        newY = resizeState.initialY + (resizeState.initialHeight - newHeight)
        break
    }

    // 确保不小于最小尺寸
    if (newWidth >= minSize && newHeight >= minSize) {
      image.width = newWidth
      image.height = newHeight
      image.x = newX
      image.y = newY
    }
  }
}

// 结束调整大小
const endResize = () => {
  resizeState.isResizing = false
  resizeState.imageId = null
  resizeState.direction = ''
}

// 处理图片加载
const handleImageLoad = (e: Event, image: FloatingImage) => {
  const img = e.target as HTMLImageElement
  image.naturalWidth = img.naturalWidth
  image.naturalHeight = img.naturalHeight
  image.aspectRatio = img.naturalWidth / img.naturalHeight

  // 根据图片比例调整初始高度
  image.height = image.width / image.aspectRatio
}

// 获取窗口样式
const getWindowStyle = (image: FloatingImage) => {
  return {
    left: `${image.x}px`,
    top: `${image.y}px`,
    width: `${image.width}px`,
    zIndex: image.zIndex
  }
}

// 获取内容区域样式
const getContentStyle = (image: FloatingImage) => {
  return {
    height: `${image.height}px`
  }
}

// 全局鼠标事件监听
onMounted(() => {
  document.addEventListener('mousemove', handleDragMove)
  document.addEventListener('mousemove', handleResizeMove)
  document.addEventListener('mouseup', endDrag)
  document.addEventListener('mouseup', endResize)
})

onUnmounted(() => {
  document.removeEventListener('mousemove', handleDragMove)
  document.removeEventListener('mousemove', handleResizeMove)
  document.removeEventListener('mouseup', endDrag)
  document.removeEventListener('mouseup', endResize)

  // 清理所有图片 URL
  floatingImages.value.forEach(image => {
    if (image.url.startsWith('blob:')) {
      URL.revokeObjectURL(image.url)
    }
  })
})
</script>

<style scoped>
.floating-image-viewer {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 9999;
}

/* 悬浮图片窗口 */
.image-window {
  position: absolute;
  background: white;
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
  overflow: visible;
  pointer-events: auto;
  user-select: none;
  transition: box-shadow 0.3s ease;
}

.image-window:hover {
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.25);
}

.image-window.is-dragging {
  cursor: grabbing;
}

/* 悬浮关闭按钮 */
.floating-close-btn {
  position: absolute;
  top: -12px;
  right: -12px;
  width: 28px;
  height: 28px;
  background: linear-gradient(135deg, #ff6b6b, #ff8585);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: white;
  font-size: 14px;
  box-shadow: 0 2px 8px rgba(255, 107, 107, 0.4);
  opacity: 0;
  transform: scale(0.8);
  transition: all 0.2s ease;
  z-index: 20;
}

.image-window:hover .floating-close-btn {
  opacity: 1;
  transform: scale(1);
}

.floating-close-btn:hover {
  transform: scale(1.1) !important;
  box-shadow: 0 4px 12px rgba(255, 107, 107, 0.6);
}

/* 窗口内容 */
.window-content {
  overflow: hidden;
  background: #f5f5f5;
  border-radius: 12px;
  cursor: grab;
}

.window-content:active {
  cursor: grabbing;
}

.window-content img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  display: block;
  pointer-events: none;
}

/* 调整大小手柄 */
.resize-handle {
  position: absolute;
  width: 12px;
  height: 12px;
  background: #ff85a2;
  border: 2px solid white;
  border-radius: 50%;
  cursor: pointer;
  z-index: 10;
}

.resize-handle:hover {
  background: #ff6b9d;
  transform: scale(1.2);
}

.resize-se {
  right: -6px;
  bottom: -6px;
  cursor: se-resize;
}

.resize-sw {
  left: -6px;
  bottom: -6px;
  cursor: sw-resize;
}

.resize-ne {
  right: -6px;
  top: -6px;
  cursor: ne-resize;
}

.resize-nw {
  left: -6px;
  top: -6px;
  cursor: nw-resize;
}

/* 触发按钮 */
.viewer-trigger {
  position: fixed;
  right: 24px;
  bottom: 100px;
  width: 56px;
  height: 56px;
  background: linear-gradient(135deg, #ff85a2, #ff6b9d);
  border: none;
  color: white;
  font-size: 24px;
  box-shadow: 0 4px 16px rgba(255, 133, 162, 0.4);
  pointer-events: auto;
  transition: all 0.3s ease;
}

.viewer-trigger:hover {
  transform: scale(1.1);
  box-shadow: 0 6px 20px rgba(255, 133, 162, 0.5);
}

.viewer-trigger.has-images {
  background: linear-gradient(135deg, #67c23a, #85ce61);
  box-shadow: 0 4px 16px rgba(103, 194, 58, 0.4);
}

.image-count {
  position: absolute;
  top: -4px;
  right: -4px;
  background: #ff6b6b;
  color: white;
  font-size: 12px;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* 动画 */
.image-window-enter-active,
.image-window-leave-active {
  transition: all 0.3s ease;
}

.image-window-enter-from {
  opacity: 0;
  transform: scale(0.8) translateY(20px);
}

.image-window-leave-to {
  opacity: 0;
  transform: scale(0.8);
}

/* 上传对话框样式 */
.image-uploader {
  text-align: center;
}

.upload-icon {
  font-size: 48px;
  color: #ff85a2;
  margin-bottom: 16px;
}

.upload-text {
  color: #666;
  font-size: 14px;
}

.upload-text em {
  color: #ff85a2;
  font-style: normal;
}

.upload-tip {
  margin-top: 12px;
  font-size: 12px;
  color: #999;
}

/* 已上传图片列表 */
.uploaded-images {
  margin-top: 24px;
  padding-top: 24px;
  border-top: 1px solid #eee;
}

.uploaded-images h4 {
  margin: 0 0 16px;
  font-size: 14px;
  color: #333;
}

.image-list {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.image-item {
  position: relative;
  width: 100px;
  height: 100px;
  border-radius: 8px;
  overflow: hidden;
  border: 2px solid #eee;
  transition: all 0.3s ease;
}

.image-item.is-hidden {
  opacity: 0.5;
  border-color: #ccc;
}

.image-item img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.image-item .image-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  opacity: 0;
  transition: opacity 0.2s;
}

.image-item:hover .image-overlay {
  opacity: 1;
}

.image-overlay .delete-btn {
  width: 28px;
  height: 28px;
  padding: 0;
}

/* 移动端适配 */
@media screen and (max-width: 768px) {
  .viewer-trigger {
    right: 16px;
    bottom: 80px;
    width: 48px;
    height: 48px;
  }

  .image-window {
    max-width: 90vw;
  }

  .image-item {
    width: 80px;
    height: 80px;
  }
}
</style>
