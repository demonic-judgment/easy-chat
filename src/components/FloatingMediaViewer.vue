<template>
  <div class="floating-media-viewer">
    <!-- 悬浮媒体窗口列表 -->
    <TransitionGroup name="media-window">
      <div
        v-for="(item, index) in visibleMedia"
        :key="item.id"
        class="media-window"
        :class="{ 'is-dragging': dragState.mediaId === item.id, 'is-active': activeMediaId === item.id }"
        :style="getWindowStyle(item)"
        @mousedown="handleWindowMouseDown($event, item)"
        @touchstart="handleWindowTouchStart($event, item)"
        @click="setActiveMedia(item.id)"
      >
        <!-- 悬浮关闭按钮 -->
        <div
          class="floating-close-btn"
          @click.stop="toggleMediaVisibility(item.id)"
        >
          <el-icon><Close /></el-icon>
        </div>

        <!-- 媒体类型标签 -->
        <div class="media-type-badge">
          <el-icon v-if="item.type === 'image'"><Picture /></el-icon>
          <el-icon v-else><VideoPlay /></el-icon>
        </div>

        <!-- 内容区域（同时作为拖拽区域） -->
        <div
          class="window-content"
          :style="getContentStyle(item)"
          @mousedown="startDrag($event, item)"
          @touchstart="startDragTouch($event, item)"
        >
          <!-- 图片 -->
          <template v-if="item.type === 'image'">
            <img
              :src="item.url"
              :alt="item.name"
              draggable="false"
              @load="handleImageLoad($event, item)"
            />
          </template>

          <!-- 视频 -->
          <template v-else-if="item.type === 'video'">
            <video
              :src="item.url"
              :poster="item.videoPoster"
              controls
              preload="metadata"
              @loadedmetadata="handleVideoLoad($event, item)"
            />
          </template>
        </div>

        <!-- 调整大小手柄 -->
        <div
          class="resize-handle resize-se"
          @mousedown="startResize($event, item, 'se')"
          @touchstart="startResizeTouch($event, item, 'se')"
        />
        <div
          class="resize-handle resize-sw"
          @mousedown="startResize($event, item, 'sw')"
          @touchstart="startResizeTouch($event, item, 'sw')"
        />
        <div
          class="resize-handle resize-ne"
          @mousedown="startResize($event, item, 'ne')"
          @touchstart="startResizeTouch($event, item, 'ne')"
        />
        <div
          class="resize-handle resize-nw"
          @mousedown="startResize($event, item, 'nw')"
          @touchstart="startResizeTouch($event, item, 'nw')"
        />
      </div>
    </TransitionGroup>
  </div>

  <!-- 添加媒体对话框 -->
  <el-dialog
    v-model="showAddDialog"
    title="添加媒体"
    width="500px"
    destroy-on-close
    :teleported="true"
    :append-to-body="true"
  >
    <!-- 类型选择 Tab -->
    <el-tabs v-model="activeTab">
      <el-tab-pane label="图片" name="image">
        <el-upload
          class="media-uploader"
          drag
          action="#"
          :auto-upload="false"
          :on-change="handleImageFileChange"
          :show-file-list="false"
          accept="image/*"
          multiple
          v-model:file-list="uploadFileList"
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
      </el-tab-pane>

      <el-tab-pane label="视频" name="video">
        <div class="video-input-section">
          <el-input
            v-model="videoUrl"
            placeholder="输入视频链接（支持 MP4、WebM 等格式）"
            clearable
          >
            <template #prefix>
              <el-icon><Link /></el-icon>
            </template>
          </el-input>
          <el-button
            type="primary"
            :disabled="!videoUrl.trim()"
            @click="addVideoFromUrl"
          >
            添加视频
          </el-button>
        </div>
        <div class="video-tip">
          支持直接视频链接（.mp4、.webm、.ogg 等格式）
        </div>
      </el-tab-pane>
    </el-tabs>

    <!-- 已添加媒体列表 -->
    <div v-if="floatingMedia.length > 0" class="uploaded-media">
      <h4>已添加</h4>
      <div class="media-list">
        <div
          v-for="item in lazyLoadMedia"
          :key="item.id"
          v-memo="[item.isVisible, item.thumbnailUrl]"
          class="media-item"
          :class="{ 'is-hidden': !item.isVisible }"
        >
          <img
            v-if="item.type === 'image'"
            :src="item.thumbnailUrl || item.url"
            :alt="item.name"
            loading="lazy"
            @error="handleImageError($event, item)"
          />
          <div v-else class="video-thumbnail">
            <el-icon><VideoPlay /></el-icon>
            <span class="video-name">{{ item.name }}</span>
          </div>
          <div class="media-controls">
            <el-switch
              :model-value="item.isVisible"
              size="small"
              @update:model-value="toggleMediaVisibility(item.id)"
            />
            <el-button
              class="delete-btn"
              :icon="Delete"
              circle
              size="small"
              type="danger"
              @click="closeMedia(item.id)"
            />
          </div>
        </div>
      </div>
    </div>

    <template #footer>
      <el-button @click="showAddDialog = false">关闭</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, onUnmounted, watch } from 'vue'
import {
  Picture,
  VideoPlay,
  Close,
  Upload,
  Delete,
  Link
} from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import type { UploadFile } from 'element-plus'
import { useFloatingMediaStore } from '@/stores/floatingMedia'
import type { FloatingMedia } from '@/types'

interface DragState {
  isDragging: boolean
  mediaId: string | null
  startX: number
  startY: number
  initialX: number
  initialY: number
}

interface ResizeState {
  isResizing: boolean
  mediaId: string | null
  direction: string
  startX: number
  startY: number
  initialWidth: number
  initialHeight: number
  initialX: number
  initialY: number
  aspectRatio: number
}

const floatingMediaStore = useFloatingMediaStore()
const showAddDialog = ref(false)
const activeMediaId = ref<string | null>(null)
const uploadFileList = ref<UploadFile[]>([])
const activeTab = ref('image')
const videoUrl = ref('')

// 计算属性：只显示可见的媒体
const visibleMedia = computed(() => floatingMediaStore.visibleMedia())
const floatingMedia = computed(() => floatingMediaStore.media)

// 懒加载媒体列表
const lazyLoadMedia = computed(() => {
  return floatingMedia.value
})

// 图片加载错误处理
const handleImageError = (e: Event, media: FloatingMedia) => {
  const img = e.target as HTMLImageElement
  if (img.src !== media.url) {
    img.src = media.url
  }
}

const dragState = reactive<DragState>({
  isDragging: false,
  mediaId: null,
  startX: 0,
  startY: 0,
  initialX: 0,
  initialY: 0
})

const resizeState = reactive<ResizeState>({
  isResizing: false,
  mediaId: null,
  direction: '',
  startX: 0,
  startY: 0,
  initialWidth: 0,
  initialHeight: 0,
  initialX: 0,
  initialY: 0,
  aspectRatio: 1
})

// 将 File 转换为 Base64 Data URL
const fileToDataURL = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      resolve(reader.result as string)
    }
    reader.onerror = () => {
      reject(new Error('文件读取失败'))
    }
    reader.readAsDataURL(file)
  })
}

// 生成缩略图
const generateThumbnail = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)

    img.onload = () => {
      URL.revokeObjectURL(url)

      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        reject(new Error('无法创建 Canvas 上下文'))
        return
      }

      const maxSize = 256
      let { width, height } = img

      if (width > height) {
        if (width > maxSize) {
          height = Math.round((height * maxSize) / width)
          width = maxSize
        }
      } else {
        if (height > maxSize) {
          width = Math.round((width * maxSize) / height)
          height = maxSize
        }
      }

      canvas.width = width
      canvas.height = height
      ctx.drawImage(img, 0, 0, width, height)

      resolve(canvas.toDataURL('image/jpeg', 0.8))
    }

    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('图片加载失败'))
    }

    img.src = url
  })
}

// requestIdleCallback fallback
const scheduleIdleTask = (callback: () => void, options?: { timeout?: number }) => {
  if ('requestIdleCallback' in window) {
    requestIdleCallback(callback, options)
  } else {
    setTimeout(callback, options?.timeout || 0)
  }
}

// 处理图片文件上传
const handleImageFileChange = async (uploadFile: UploadFile) => {
  const file = uploadFile.raw
  if (!file) return

  if (!file.type.startsWith('image/')) {
    ElMessage.error(`跳过非图片文件: ${file.name}`)
    return
  }

  try {
    const originalDataURL = await fileToDataURL(file)
    const newImage = await addImage(originalDataURL, file.name)

    scheduleIdleTask(() => {
      generateThumbnail(file).then(thumbnailDataURL => {
        floatingMediaStore.updateMedia(newImage.id, { thumbnailUrl: thumbnailDataURL })
      }).catch(() => {
        // 缩略图生成失败，忽略
      })
    }, { timeout: 1000 })
  } catch (error) {
    ElMessage.error(`处理文件失败: ${file.name}`)
  }
}

// 添加图片
const addImage = async (url: string, name: string, thumbnailUrl?: string) => {
  const offset = floatingMedia.value.length * 30

  return await floatingMediaStore.addImage({
    url,
    name,
    x: 100 + offset,
    y: 100 + offset,
    width: 300,
    height: 200,
    naturalWidth: 0,
    naturalHeight: 0,
    aspectRatio: 1,
    isVisible: true,
    thumbnailUrl
  })
}

// 从 URL 添加视频
const addVideoFromUrl = async () => {
  const url = videoUrl.value.trim()
  if (!url) return

  // 简单的 URL 验证
  if (!url.match(/^https?:\/\/.+\.(mp4|webm|ogg|mov)(\?.*)?$/i) && !url.match(/^https?:\/\/.+/i)) {
    ElMessage.warning('请输入有效的视频链接')
    return
  }

  try {
    const offset = floatingMedia.value.length * 30
    const name = url.split('/').pop() || '视频'

    await floatingMediaStore.addVideo({
      url,
      name,
      x: 100 + offset,
      y: 100 + offset,
      width: 400,
      height: 225,
      isVisible: true
    })

    ElMessage.success('视频已添加')
    videoUrl.value = ''
  } catch (error) {
    ElMessage.error('添加视频失败')
  }
}

// 关闭媒体（彻底删除）
const closeMedia = async (id: string) => {
  await floatingMediaStore.removeMedia(id)
}

// 监听对话框关闭，清空上传文件列表
watch(showAddDialog, (newVal) => {
  if (!newVal) {
    uploadFileList.value = []
    videoUrl.value = ''
    activeTab.value = 'image'
  }
})

// 切换媒体显示/隐藏
const toggleMediaVisibility = async (id: string) => {
  await floatingMediaStore.toggleVisibility(id)
}

// 设置激活的媒体
let activeMediaTimer: ReturnType<typeof setTimeout> | null = null
const setActiveMedia = (id: string | null) => {
  if (activeMediaTimer) {
    clearTimeout(activeMediaTimer)
    activeMediaTimer = null
  }
  activeMediaId.value = id
  if (id) {
    activeMediaTimer = setTimeout(() => {
      activeMediaId.value = null
      activeMediaTimer = null
    }, 3000)
  }
}

// 将窗口置于最前
const bringToFront = async (media: FloatingMedia) => {
  await floatingMediaStore.bringToFront(media.id)
}

// 处理窗口鼠标按下
const handleWindowMouseDown = (e: MouseEvent, media: FloatingMedia) => {
  bringToFront(media)
}

// 处理窗口触摸开始
const handleWindowTouchStart = (e: TouchEvent, media: FloatingMedia) => {
  bringToFront(media)
  setActiveMedia(media.id)
}

// 开始拖拽
const startDrag = (e: MouseEvent, media: FloatingMedia) => {
  e.preventDefault()
  e.stopPropagation()

  dragState.isDragging = true
  dragState.mediaId = media.id
  dragState.startX = e.clientX
  dragState.startY = e.clientY
  dragState.initialX = media.x
  dragState.initialY = media.y

  bringToFront(media)
}

// 触摸开始拖拽
const startDragTouch = (e: TouchEvent, media: FloatingMedia) => {
  if (e.touches.length !== 1) return
  e.preventDefault()
  e.stopPropagation()

  const touch = e.touches[0]!
  dragState.isDragging = true
  dragState.mediaId = media.id
  dragState.startX = touch.clientX
  dragState.startY = touch.clientY
  dragState.initialX = media.x
  dragState.initialY = media.y

  bringToFront(media)
  setActiveMedia(media.id)
}

// 处理拖拽移动
const handleDragMove = (e: MouseEvent) => {
  if (dragState.isDragging && dragState.mediaId) {
    const media = floatingMedia.value.find(m => m.id === dragState.mediaId)
    if (media) {
      const deltaX = e.clientX - dragState.startX
      const deltaY = e.clientY - dragState.startY
      media.x = Math.max(0, dragState.initialX + deltaX)
      media.y = Math.max(0, dragState.initialY + deltaY)
    }
  }
}

// 处理触摸拖拽移动
const handleDragMoveTouch = (e: TouchEvent) => {
  if (dragState.isDragging && dragState.mediaId && e.touches.length === 1) {
    const touch = e.touches[0]!
    const media = floatingMedia.value.find(m => m.id === dragState.mediaId)
    if (media) {
      const deltaX = touch.clientX - dragState.startX
      const deltaY = touch.clientY - dragState.startY
      media.x = Math.max(0, dragState.initialX + deltaX)
      media.y = Math.max(0, dragState.initialY + deltaY)
    }
  }
}

// 结束拖拽
const endDrag = async () => {
  if (dragState.isDragging && dragState.mediaId) {
    const media = floatingMedia.value.find(m => m.id === dragState.mediaId)
    if (media) {
      await floatingMediaStore.updateMedia(dragState.mediaId, {
        x: media.x,
        y: media.y
      })
    }
  }
  dragState.isDragging = false
  dragState.mediaId = null
}

// 开始调整大小
const startResize = (e: MouseEvent, media: FloatingMedia, direction: string) => {
  e.preventDefault()
  e.stopPropagation()

  resizeState.isResizing = true
  resizeState.mediaId = media.id
  resizeState.direction = direction
  resizeState.startX = e.clientX
  resizeState.startY = e.clientY
  resizeState.initialWidth = media.width
  resizeState.initialHeight = media.height
  resizeState.initialX = media.x
  resizeState.initialY = media.y
  resizeState.aspectRatio = media.aspectRatio || (media.width / media.height)

  bringToFront(media)
}

// 触摸开始调整大小
const startResizeTouch = (e: TouchEvent, media: FloatingMedia, direction: string) => {
  if (e.touches.length !== 1) return
  e.preventDefault()
  e.stopPropagation()

  const touch = e.touches[0]!
  resizeState.isResizing = true
  resizeState.mediaId = media.id
  resizeState.direction = direction
  resizeState.startX = touch.clientX
  resizeState.startY = touch.clientY
  resizeState.initialWidth = media.width
  resizeState.initialHeight = media.height
  resizeState.initialX = media.x
  resizeState.initialY = media.y
  resizeState.aspectRatio = media.aspectRatio || (media.width / media.height)

  bringToFront(media)
  setActiveMedia(media.id)
}

// 处理调整大小移动
const handleResizeMove = (e: MouseEvent) => {
  if (resizeState.isResizing && resizeState.mediaId) {
    const media = floatingMedia.value.find(m => m.id === resizeState.mediaId)
    if (!media) return

    const deltaX = e.clientX - resizeState.startX
    const deltaY = e.clientY - resizeState.startY

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

    media.width = newWidth
    media.height = newHeight
    media.x = newX
    media.y = newY
  }
}

// 处理触摸调整大小移动
const handleResizeMoveTouch = (e: TouchEvent) => {
  if (resizeState.isResizing && resizeState.mediaId && e.touches.length === 1) {
    const touch = e.touches[0]!
    const media = floatingMedia.value.find(m => m.id === resizeState.mediaId)
    if (!media) return

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

    media.width = newWidth
    media.height = newHeight
    media.x = newX
    media.y = newY
  }
}

// 结束调整大小
const endResize = () => {
  if (resizeState.isResizing && resizeState.mediaId) {
    const media = floatingMedia.value.find(m => m.id === resizeState.mediaId)
    if (media) {
      floatingMediaStore.updateMedia(resizeState.mediaId, {
        x: media.x,
        y: media.y,
        width: media.width,
        height: media.height
      })
    }
  }
  resizeState.isResizing = false
  resizeState.mediaId = null
  resizeState.direction = ''
}

// 处理图片加载
const handleImageLoad = async (e: Event, media: FloatingMedia) => {
  const img = e.target as HTMLImageElement
  const naturalWidth = img.naturalWidth
  const naturalHeight = img.naturalHeight
  const aspectRatio = img.naturalWidth / img.naturalHeight

  const newHeight = media.width / aspectRatio

  await floatingMediaStore.updateMedia(media.id, {
    naturalWidth,
    naturalHeight,
    aspectRatio,
    height: newHeight
  })
}

// 处理视频加载
const handleVideoLoad = async (e: Event, media: FloatingMedia) => {
  const video = e.target as HTMLVideoElement
  const naturalWidth = video.videoWidth
  const naturalHeight = video.videoHeight
  const aspectRatio = video.videoWidth / video.videoHeight
  const duration = video.duration

  const newHeight = media.width / aspectRatio

  await floatingMediaStore.updateMedia(media.id, {
    naturalWidth,
    naturalHeight,
    aspectRatio,
    height: newHeight,
    videoDuration: duration
  })
}

// 获取窗口样式
const getWindowStyle = (media: FloatingMedia) => {
  return {
    left: `${media.x}px`,
    top: `${media.y}px`,
    width: `${media.width}px`,
    zIndex: media.zIndex
  }
}

// 获取内容区域样式
const getContentStyle = (media: FloatingMedia) => {
  return {
    height: `${media.height}px`
  }
}

// 点击空白处隐藏手脚架
const handleClickOutside = (e: MouseEvent) => {
  const target = e.target as HTMLElement
  if (!target.closest('.media-window')) {
    setActiveMedia(null)
  }
}

// 触摸结束时的焦点释放处理
const handleTouchEndOutside = (e: TouchEvent) => {
  if (dragState.isDragging || resizeState.isResizing) {
    return
  }

  if (e.changedTouches.length > 0) {
    const touch = e.changedTouches[0]!
    const target = document.elementFromPoint(touch.clientX, touch.clientY)
    if (target && !target.closest('.media-window')) {
      setActiveMedia(null)
    }
  }
}

// 暴露打开对话框的方法
const openDialog = () => {
  showAddDialog.value = true
}

defineExpose({
  openDialog
})

// 全局鼠标事件监听
onMounted(() => {
  document.addEventListener('mousemove', handleDragMove)
  document.addEventListener('mousemove', handleResizeMove)
  document.addEventListener('mouseup', endDrag)
  document.addEventListener('mouseup', endResize)
  document.addEventListener('click', handleClickOutside)
  // 触摸事件监听
  document.addEventListener('touchmove', handleDragMoveTouch, { passive: false })
  document.addEventListener('touchmove', handleResizeMoveTouch, { passive: false })
  document.addEventListener('touchend', endDrag)
  document.addEventListener('touchend', endResize)
  document.addEventListener('touchend', handleTouchEndOutside)
})

onUnmounted(() => {
  document.removeEventListener('mousemove', handleDragMove)
  document.removeEventListener('mousemove', handleResizeMove)
  document.removeEventListener('mouseup', endDrag)
  document.removeEventListener('mouseup', endResize)
  document.removeEventListener('click', handleClickOutside)
  // 触摸事件移除
  document.removeEventListener('touchmove', handleDragMoveTouch)
  document.removeEventListener('touchmove', handleResizeMoveTouch)
  document.removeEventListener('touchend', endDrag)
  document.removeEventListener('touchend', endResize)
  document.removeEventListener('touchend', handleTouchEndOutside)
})
</script>

<style scoped>
.floating-media-viewer {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 9999;
}

/* 悬浮媒体窗口 */
.media-window {
  position: absolute;
  background: white;
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
  overflow: visible;
  pointer-events: auto;
  user-select: none;
  transition: box-shadow 0.3s ease;
  touch-action: none;
}

.media-window:hover,
.media-window.is-active {
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.25);
}

.media-window.is-dragging {
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

.floating-close-btn:hover {
  transform: scale(1.1);
  box-shadow: 0 4px 12px rgba(255, 107, 107, 0.6);
}

/* 媒体类型标签 */
.media-type-badge {
  position: absolute;
  top: 8px;
  left: 8px;
  width: 24px;
  height: 24px;
  background: rgba(0, 0, 0, 0.5);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 12px;
  z-index: 15;
  opacity: 0;
  transition: all 0.2s ease;
}

.media-window.is-active .media-type-badge {
  opacity: 1;
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

.window-content video {
  width: 100%;
  height: 100%;
  object-fit: contain;
  display: block;
  border-radius: 12px;
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
  opacity: 0;
  transform: scale(0.8);
  transition: all 0.2s ease;
}

.media-window.is-active .floating-close-btn,
.media-window.is-active .resize-handle {
  opacity: 1;
  transform: scale(1);
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

/* 动画 */
.media-window-enter-active,
.media-window-leave-active {
  transition: all 0.3s ease;
}

.media-window-enter-from {
  opacity: 0;
  transform: scale(0.8) translateY(20px);
}

.media-window-leave-to {
  opacity: 0;
  transform: scale(0.8);
}

/* 上传对话框样式 */
.media-uploader {
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

/* 视频输入区域 */
.video-input-section {
  display: flex;
  gap: 12px;
  margin-bottom: 12px;
}

.video-input-section .el-input {
  flex: 1;
}

.video-tip {
  font-size: 12px;
  color: #999;
}

/* 已添加媒体列表 */
.uploaded-media {
  margin-top: 24px;
  padding-top: 24px;
  border-top: 1px solid #eee;
}

.uploaded-media h4 {
  margin: 0 0 16px;
  font-size: 14px;
  color: #333;
}

.media-list {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.media-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.media-item img {
  width: 100px;
  height: 100px;
  object-fit: cover;
  border-radius: 8px;
  border: 2px solid #eee;
  transition: all 0.3s ease;
}

.media-item.is-hidden img {
  border-color: #ccc;
  opacity: 0.5;
}

/* 视频缩略图 */
.video-thumbnail {
  width: 100px;
  height: 100px;
  background: #333;
  border-radius: 8px;
  border: 2px solid #eee;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  color: white;
  font-size: 24px;
}

.video-thumbnail .video-name {
  font-size: 11px;
  max-width: 80px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.media-item.is-hidden .video-thumbnail {
  border-color: #ccc;
  opacity: 0.5;
}

.media-item .media-controls {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: center;
  gap: 12px;
}

.media-controls .delete-btn {
  width: 28px;
  height: 28px;
  padding: 0;
}

/* 移动端适配 */
@media (max-width: 768px) {
  .media-window {
    border-radius: 8px;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
  }

  .media-window.is-active .floating-close-btn {
    width: 36px;
    height: 36px;
    font-size: 18px;
    top: -18px;
    right: -18px;
    opacity: 1;
    transform: scale(1);
  }

  .media-window.is-active .resize-handle {
    width: 20px;
    height: 20px;
    opacity: 1;
    transform: scale(1);
  }

  .media-window.is-active .resize-se {
    right: -10px;
    bottom: -10px;
  }

  .media-window.is-active .resize-sw {
    left: -10px;
    bottom: -10px;
  }

  .media-window.is-active .resize-ne {
    right: -10px;
    top: -10px;
  }

  .media-window.is-active .resize-nw {
    left: -10px;
    top: -10px;
  }

  .window-content {
    border-radius: 8px;
  }

  .upload-icon {
    font-size: 36px;
  }

  .upload-text {
    font-size: 13px;
  }

  .upload-tip {
    font-size: 11px;
  }

  .media-item img,
  .video-thumbnail {
    width: 80px;
    height: 80px;
  }

  .media-controls .delete-btn {
    width: 32px;
    height: 32px;
  }

  .video-input-section {
    flex-direction: column;
  }
}

/* 触摸设备优化 */
@media (pointer: coarse) {
  .media-window.is-active .floating-close-btn {
    opacity: 1;
    transform: scale(1);
  }

  .media-window.is-active .resize-handle {
    opacity: 1;
    transform: scale(1);
  }

  .floating-close-btn:hover {
    transform: scale(1);
    box-shadow: 0 2px 8px rgba(255, 107, 107, 0.4);
  }

  .resize-handle:hover {
    transform: scale(1);
  }

  .floating-close-btn:active {
    transform: scale(1.1);
    box-shadow: 0 4px 12px rgba(255, 107, 107, 0.6);
  }

  .resize-handle:active {
    background: #ff6b9d;
    transform: scale(1.2);
  }
}
</style>