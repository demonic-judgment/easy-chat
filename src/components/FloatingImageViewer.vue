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
          @touchstart.prevent="startDragTouch($event, image)"
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
          @touchstart.prevent="startResizeTouch($event, image, 'se')"
        />
        <div
          class="resize-handle resize-sw"
          @mousedown="startResize($event, image, 'sw')"
          @touchstart.prevent="startResizeTouch($event, image, 'sw')"
        />
        <div
          class="resize-handle resize-ne"
          @mousedown="startResize($event, image, 'ne')"
          @touchstart.prevent="startResizeTouch($event, image, 'ne')"
        />
        <div
          class="resize-handle resize-nw"
          @mousedown="startResize($event, image, 'nw')"
          @touchstart.prevent="startResizeTouch($event, image, 'nw')"
        />
      </div>
    </TransitionGroup>

    <!-- 触发按钮 -->
    <el-button
      v-if="floatingImages.length === 0"
      class="viewer-trigger"
      :class="{ 'is-dragging': buttonDragState.isDragging }"
      :icon="Picture"
      circle
      size="large"
      :style="getButtonStyle()"
      @mousedown="startButtonDrag"
      @touchstart.prevent="handleButtonTouchStart"
      @touchmove.prevent="handleButtonTouchMove"
      @touchend.prevent="handleButtonTouchEnd"
      @click="handleButtonClick"
    />

    <el-button
      v-else
      class="viewer-trigger has-images"
      :class="{ 'is-dragging': buttonDragState.isDragging }"
      :icon="PictureFilled"
      circle
      size="large"
      :style="getButtonStyle()"
      @mousedown="startButtonDrag"
      @touchstart.prevent="handleButtonTouchStart"
      @touchmove.prevent="handleButtonTouchMove"
      @touchend.prevent="handleButtonTouchEnd"
      @click="handleButtonClick"
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
            <div class="image-controls">
              <el-switch
                :model-value="image.isVisible"
                size="small"
                @update:model-value="toggleImageVisibility(image.id)"
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
import { useFloatingImageStore } from '@/stores'
import type { FloatingImage } from '@/types'

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

interface ButtonDragState {
  isDragging: boolean
  hasMoved: boolean
  startX: number
  startY: number
  initialX: number
  initialY: number
}

const floatingImageStore = useFloatingImageStore()
const showUploadDialog = ref(false)

// 按钮位置（使用 ref 以便响应式更新）
const buttonPosition = ref({ x: 0, y: 50 }) // x: 0 表示右侧，y: 50 表示垂直居中百分比
const isDraggingButton = ref(false)
const buttonDragState = reactive<ButtonDragState>({
  isDragging: false,
  hasMoved: false,
  startX: 0,
  startY: 0,
  initialX: 0,
  initialY: 0
})

// 计算属性：只显示可见的图片
const visibleImages = computed(() => floatingImageStore.visibleImages())
const floatingImages = computed(() => floatingImageStore.images)

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

// 检测是否为移动端
const isMobile = () => window.innerWidth <= 768

// 添加图片
const addImage = (url: string, name: string) => {
  // 计算初始位置（错开显示）
  const offset = floatingImages.value.length * 30

  // 移动端使用更小的初始尺寸和更合适的位置
  const mobile = isMobile()
  const initialX = mobile ? 20 + offset : 100 + offset
  const initialY = mobile ? 100 + offset : 100 + offset
  const initialWidth = mobile ? Math.min(250, window.innerWidth - 40) : 300
  const initialHeight = mobile ? 180 : 200

  floatingImageStore.addImage({
    url,
    name,
    x: initialX,
    y: initialY,
    width: initialWidth,
    height: initialHeight,
    naturalWidth: 0,
    naturalHeight: 0,
    aspectRatio: 1,
    isVisible: true
  })
}

// 关闭图片（彻底删除）
const closeImage = (id: string) => {
  floatingImageStore.removeImage(id)
}

// 切换图片显示/隐藏
const toggleImageVisibility = (id: string) => {
  floatingImageStore.toggleVisibility(id)
}

// 将窗口置于最前
const bringToFront = (image: FloatingImage) => {
  floatingImageStore.bringToFront(image.id)
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
  if (dragState.isDragging && dragState.imageId) {
    const image = floatingImages.value.find(img => img.id === dragState.imageId)
    if (image) {
      floatingImageStore.updateImage(dragState.imageId, {
        x: image.x,
        y: image.y
      })
    }
  }
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
    switch (resizeState.direction) {
      case 'se': // 东南角
        newWidth = Math.max(1, resizeState.initialWidth + deltaX)
        newHeight = newWidth / resizeState.aspectRatio
        break
      case 'sw': // 西南角
        newWidth = Math.max(1, resizeState.initialWidth - deltaX)
        newHeight = newWidth / resizeState.aspectRatio
        newX = resizeState.initialX + (resizeState.initialWidth - newWidth)
        break
      case 'ne': // 东北角
        newWidth = Math.max(1, resizeState.initialWidth + deltaX)
        newHeight = newWidth / resizeState.aspectRatio
        newY = resizeState.initialY + (resizeState.initialHeight - newHeight)
        break
      case 'nw': // 西北角
        newWidth = Math.max(1, resizeState.initialWidth - deltaX)
        newHeight = newWidth / resizeState.aspectRatio
        newX = resizeState.initialX + (resizeState.initialWidth - newWidth)
        newY = resizeState.initialY + (resizeState.initialHeight - newHeight)
        break
    }

    image.width = newWidth
    image.height = newHeight
    image.x = newX
    image.y = newY
  }
}

// 结束调整大小
const endResize = () => {
  if (resizeState.isResizing && resizeState.imageId) {
    const image = floatingImages.value.find(img => img.id === resizeState.imageId)
    if (image) {
      floatingImageStore.updateImage(resizeState.imageId, {
        x: image.x,
        y: image.y,
        width: image.width,
        height: image.height
      })
    }
  }
  resizeState.isResizing = false
  resizeState.imageId = null
  resizeState.direction = ''
}

// 处理图片加载
const handleImageLoad = (e: Event, image: FloatingImage) => {
  const img = e.target as HTMLImageElement
  const naturalWidth = img.naturalWidth
  const naturalHeight = img.naturalHeight
  const aspectRatio = img.naturalWidth / img.naturalHeight

  // 根据图片比例调整初始高度
  const newHeight = image.width / aspectRatio

  floatingImageStore.updateImage(image.id, {
    naturalWidth,
    naturalHeight,
    aspectRatio,
    height: newHeight
  })
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

// 获取按钮样式
const getButtonStyle = () => {
  // 如果正在拖拽，使用固定定位
  if (buttonPosition.value.x !== 0 || buttonPosition.value.y !== 50) {
    return {
      position: 'fixed',
      left: `${buttonPosition.value.x}px`,
      top: `${buttonPosition.value.y}px`,
      right: 'auto',
      transform: 'none'
    }
  }
  // 默认样式：右侧居中
  return {
    position: 'fixed',
    right: '24px',
    top: '50%',
    transform: 'translateY(-50%)'
  }
}

// 开始拖拽按钮
const startButtonDrag = (e: MouseEvent) => {
  // 只有左键才能拖拽
  if (e.button !== 0) return

  buttonDragState.isDragging = true
  buttonDragState.hasMoved = false
  buttonDragState.startX = e.clientX
  buttonDragState.startY = e.clientY

  // 如果按钮还在默认位置，先转换为像素位置
  if (buttonPosition.value.x === 0 && buttonPosition.value.y === 50) {
    const buttonEl = e.currentTarget as HTMLElement
    const rect = buttonEl.getBoundingClientRect()
    buttonPosition.value.x = rect.left
    buttonPosition.value.y = rect.top
  }

  buttonDragState.initialX = buttonPosition.value.x
  buttonDragState.initialY = buttonPosition.value.y
}

// 处理按钮拖拽移动
const handleButtonDragMove = (e: MouseEvent) => {
  if (buttonDragState.isDragging) {
    const deltaX = e.clientX - buttonDragState.startX
    const deltaY = e.clientY - buttonDragState.startY

    // 如果移动距离超过阈值，标记为已移动
    const moveThreshold = 5
    if (Math.abs(deltaX) > moveThreshold || Math.abs(deltaY) > moveThreshold) {
      buttonDragState.hasMoved = true
    }

    buttonPosition.value.x = buttonDragState.initialX + deltaX
    buttonPosition.value.y = buttonDragState.initialY + deltaY

    // 限制在视窗内
    const buttonSize = 56
    buttonPosition.value.x = Math.max(0, Math.min(window.innerWidth - buttonSize, buttonPosition.value.x))
    buttonPosition.value.y = Math.max(0, Math.min(window.innerHeight - buttonSize, buttonPosition.value.y))
  }
}

// 结束按钮拖拽
const endButtonDrag = () => {
  buttonDragState.isDragging = false
}

// 处理按钮点击
const handleButtonClick = (e: MouseEvent) => {
  // 如果移动过，不触发点击
  if (buttonDragState.hasMoved) {
    e.stopPropagation()
    return
  }
  showUploadDialog.value = true
}

// 处理触摸开始
const handleButtonTouchStart = (e: TouchEvent) => {
  const touch = e.touches[0]
  if (!touch) return

  buttonDragState.isDragging = true
  buttonDragState.hasMoved = false
  buttonDragState.startX = touch.clientX
  buttonDragState.startY = touch.clientY

  // 如果按钮还在默认位置，先转换为像素位置
  if (buttonPosition.value.x === 0 && buttonPosition.value.y === 50) {
    const buttonEl = e.currentTarget as HTMLElement
    const rect = buttonEl.getBoundingClientRect()
    buttonPosition.value.x = rect.left
    buttonPosition.value.y = rect.top
  }

  buttonDragState.initialX = buttonPosition.value.x
  buttonDragState.initialY = buttonPosition.value.y
}

// 处理触摸移动
const handleButtonTouchMove = (e: TouchEvent) => {
  if (buttonDragState.isDragging) {
    const touch = e.touches[0]
    if (!touch) return

    const deltaX = touch.clientX - buttonDragState.startX
    const deltaY = touch.clientY - buttonDragState.startY

    // 如果移动距离超过阈值，标记为已移动
    const moveThreshold = 5
    if (Math.abs(deltaX) > moveThreshold || Math.abs(deltaY) > moveThreshold) {
      buttonDragState.hasMoved = true
    }

    buttonPosition.value.x = buttonDragState.initialX + deltaX
    buttonPosition.value.y = buttonDragState.initialY + deltaY

    // 限制在视窗内
    const buttonSize = 56
    buttonPosition.value.x = Math.max(0, Math.min(window.innerWidth - buttonSize, buttonPosition.value.x))
    buttonPosition.value.y = Math.max(0, Math.min(window.innerHeight - buttonSize, buttonPosition.value.y))
  }
}

// 处理触摸结束
const handleButtonTouchEnd = () => {
  const wasDragging = buttonDragState.isDragging
  const hadMoved = buttonDragState.hasMoved
  buttonDragState.isDragging = false

  // 如果没有移动过，说明是点击，手动触发打开对话框
  if (wasDragging && !hadMoved) {
    showUploadDialog.value = true
  }
}

// 触摸事件处理 - 拖拽
const startDragTouch = (e: TouchEvent, image: FloatingImage) => {
  const touch = e.touches[0]
  if (!touch) return

  dragState.isDragging = true
  dragState.imageId = image.id
  dragState.startX = touch.clientX
  dragState.startY = touch.clientY
  dragState.initialX = image.x
  dragState.initialY = image.y

  bringToFront(image)
}

// 触摸事件处理 - 调整大小
const startResizeTouch = (e: TouchEvent, image: FloatingImage, direction: string) => {
  const touch = e.touches[0]
  if (!touch) return

  resizeState.isResizing = true
  resizeState.imageId = image.id
  resizeState.direction = direction
  resizeState.startX = touch.clientX
  resizeState.startY = touch.clientY
  resizeState.initialWidth = image.width
  resizeState.initialHeight = image.height
  resizeState.initialX = image.x
  resizeState.initialY = image.y
  resizeState.aspectRatio = image.aspectRatio

  bringToFront(image)
}

// 处理触摸移动 - 拖拽
const handleDragMoveTouch = (e: TouchEvent) => {
  if (dragState.isDragging && dragState.imageId) {
    const touch = e.touches[0]
    if (!touch) return

    const image = floatingImages.value.find(img => img.id === dragState.imageId)
    if (image) {
      const deltaX = touch.clientX - dragState.startX
      const deltaY = touch.clientY - dragState.startY
      image.x = Math.max(0, dragState.initialX + deltaX)
      image.y = Math.max(0, dragState.initialY + deltaY)
    }
  }
}

// 处理触摸移动 - 调整大小
const handleResizeMoveTouch = (e: TouchEvent) => {
  if (resizeState.isResizing && resizeState.imageId) {
    const touch = e.touches[0]
    if (!touch) return

    const image = floatingImages.value.find(img => img.id === resizeState.imageId)
    if (!image) return

    const deltaX = touch.clientX - resizeState.startX
    const deltaY = touch.clientY - resizeState.startY

    let newWidth = resizeState.initialWidth
    let newHeight = resizeState.initialHeight
    let newX = resizeState.initialX
    let newY = resizeState.initialY

    switch (resizeState.direction) {
      case 'se':
        newWidth = Math.max(1, resizeState.initialWidth + deltaX)
        newHeight = newWidth / resizeState.aspectRatio
        break
      case 'sw':
        newWidth = Math.max(1, resizeState.initialWidth - deltaX)
        newHeight = newWidth / resizeState.aspectRatio
        newX = resizeState.initialX + (resizeState.initialWidth - newWidth)
        break
      case 'ne':
        newWidth = Math.max(1, resizeState.initialWidth + deltaX)
        newHeight = newWidth / resizeState.aspectRatio
        newY = resizeState.initialY + (resizeState.initialHeight - newHeight)
        break
      case 'nw':
        newWidth = Math.max(1, resizeState.initialWidth - deltaX)
        newHeight = newWidth / resizeState.aspectRatio
        newX = resizeState.initialX + (resizeState.initialWidth - newWidth)
        newY = resizeState.initialY + (resizeState.initialHeight - newHeight)
        break
    }

    image.width = newWidth
    image.height = newHeight
    image.x = newX
    image.y = newY
  }
}

// 结束触摸拖拽
const endDragTouch = () => {
  if (dragState.isDragging && dragState.imageId) {
    const image = floatingImages.value.find(img => img.id === dragState.imageId)
    if (image) {
      floatingImageStore.updateImage(dragState.imageId, {
        x: image.x,
        y: image.y
      })
    }
  }
  dragState.isDragging = false
  dragState.imageId = null
}

// 结束触摸调整大小
const endResizeTouch = () => {
  if (resizeState.isResizing && resizeState.imageId) {
    const image = floatingImages.value.find(img => img.id === resizeState.imageId)
    if (image) {
      floatingImageStore.updateImage(resizeState.imageId, {
        x: image.x,
        y: image.y,
        width: image.width,
        height: image.height
      })
    }
  }
  resizeState.isResizing = false
  resizeState.imageId = null
  resizeState.direction = ''
}

// 全局鼠标事件监听
onMounted(() => {
  document.addEventListener('mousemove', handleDragMove)
  document.addEventListener('mousemove', handleResizeMove)
  document.addEventListener('mousemove', handleButtonDragMove)
  document.addEventListener('mouseup', endDrag)
  document.addEventListener('mouseup', endResize)
  document.addEventListener('mouseup', endButtonDrag)
  // 触摸事件
  document.addEventListener('touchmove', handleDragMoveTouch, { passive: false })
  document.addEventListener('touchmove', handleResizeMoveTouch, { passive: false })
  document.addEventListener('touchend', endDragTouch)
  document.addEventListener('touchend', endResizeTouch)
})

onUnmounted(() => {
  document.removeEventListener('mousemove', handleDragMove)
  document.removeEventListener('mousemove', handleResizeMove)
  document.removeEventListener('mousemove', handleButtonDragMove)
  document.removeEventListener('mouseup', endDrag)
  document.removeEventListener('mouseup', endResize)
  document.removeEventListener('mouseup', endButtonDrag)
  // 触摸事件
  document.removeEventListener('touchmove', handleDragMoveTouch)
  document.removeEventListener('touchmove', handleResizeMoveTouch)
  document.removeEventListener('touchend', endDragTouch)
  document.removeEventListener('touchend', endResizeTouch)
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
  top: 50%;
  transform: translateY(-50%);
  width: 56px;
  height: 56px;
  background: linear-gradient(135deg, #ff85a2, #ff6b9d);
  border: none;
  color: white;
  font-size: 24px;
  box-shadow: 0 4px 16px rgba(255, 133, 162, 0.4);
  pointer-events: auto;
  transition: all 0.3s ease;
  cursor: grab;
  user-select: none;
}

.viewer-trigger:hover {
  transform: translateY(-50%) scale(1.1);
  box-shadow: 0 6px 20px rgba(255, 133, 162, 0.5);
}

.viewer-trigger.is-dragging {
  cursor: grabbing;
  transform: scale(1.1);
  box-shadow: 0 8px 24px rgba(255, 133, 162, 0.6);
  transition: none;
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
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.image-item img {
  width: 100px;
  height: 100px;
  object-fit: cover;
  border-radius: 8px;
  border: 2px solid #eee;
  transition: all 0.3s ease;
}

.image-item.is-hidden img {
  border-color: #ccc;
  opacity: 0.5;
}

.image-item .image-controls {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: center;
  gap: 12px;
}

.image-controls .delete-btn {
  width: 28px;
  height: 28px;
  padding: 0;
}

/* 移动端适配 */
@media screen and (max-width: 768px) {
  .viewer-trigger {
    right: 16px;
    width: 48px;
    height: 48px;
  }

  .image-window {
    max-width: 85vw;
  }

  /* 增大移动端关闭按钮 */
  .floating-close-btn {
    opacity: 1;
    transform: scale(1);
    width: 32px;
    height: 32px;
    top: -10px;
    right: -10px;
  }

  /* 增大移动端调整大小手柄 */
  .resize-handle {
    width: 20px;
    height: 20px;
    border-width: 3px;
  }

  .resize-se {
    right: -10px;
    bottom: -10px;
  }

  .resize-sw {
    left: -10px;
    bottom: -10px;
  }

  .resize-ne {
    right: -10px;
    top: -10px;
  }

  .resize-nw {
    left: -10px;
    top: -10px;
  }

  .image-item img {
    width: 80px;
    height: 80px;
  }
}
</style>
