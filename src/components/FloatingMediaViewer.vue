<template>
  <div class="floating-media-viewer">
    <!-- 悬浮媒体窗口列表 -->
    <TransitionGroup name="media-window">
      <div
        v-for="(media, index) in visibleMedia"
        :key="media.id"
        class="media-window"
        :class="{ 'is-dragging': dragState.mediaId === media.id, 'is-active': activeMediaId === media.id }"
        :style="getWindowStyle(media)"
        @mousedown="handleWindowMouseDown($event, media)"
        @touchstart="handleWindowTouchStart($event, media)"
        @click="setActiveMedia(media.id)"
      >
        <!-- 悬浮关闭按钮 -->
        <div
          class="floating-close-btn"
          @click.stop="toggleMediaVisibility(media.id)"
        >
          <el-icon><Close /></el-icon>
        </div>

        <!-- 媒体内容区域（同时作为拖拽区域） -->
        <div
          class="window-content"
          :style="getContentStyle(media)"
          @mousedown="startDrag($event, media)"
          @touchstart="startDragTouch($event, media)"
        >
          <!-- 图片 -->
          <template v-if="media.type === 'image'">
            <img
              :src="media.url"
              :alt="media.name"
              draggable="false"
              @load="handleImageLoad($event, media)"
            />
          </template>

          <!-- 视频 -->
          <template v-else-if="media.type === 'video'">
            <video
              :src="media.url"
              :poster="media.videoPoster"
              controls
              preload="metadata"
              @loadedmetadata="handleVideoLoad($event, media)"
              @play="updateMedia(media.id, { isPlaying: true })"
              @pause="updateMedia(media.id, { isPlaying: false })"
            />
          </template>
        </div>

        <!-- 调整大小手柄 -->
        <div
          class="resize-handle resize-se"
          @mousedown="startResize($event, media, 'se')"
          @touchstart="startResizeTouch($event, media, 'se')"
        />
        <div
          class="resize-handle resize-sw"
          @mousedown="startResize($event, media, 'sw')"
          @touchstart="startResizeTouch($event, media, 'sw')"
        />
        <div
          class="resize-handle resize-ne"
          @mousedown="startResize($event, media, 'ne')"
          @touchstart="startResizeTouch($event, media, 'ne')"
        />
        <div
          class="resize-handle resize-nw"
          @mousedown="startResize($event, media, 'nw')"
          @touchstart="startResizeTouch($event, media, 'nw')"
        />
      </div>
    </TransitionGroup>

    <!-- 触发按钮 -->
    <el-button
      v-if="mediaList.length === 0"
      class="viewer-trigger"
      :class="{ 'is-dragging': buttonDragState.isDragging }"
      :icon="Picture"
      circle
      size="large"
      :style="getButtonStyle()"
      @mousedown="startButtonDrag"
      @touchstart="startButtonDragTouch"
      @click="handleButtonClick"
    />

    <el-button
      v-else
      class="viewer-trigger has-media"
      :class="{ 'is-dragging': buttonDragState.isDragging }"
      :icon="PictureFilled"
      circle
      size="large"
      :style="getButtonStyle()"
      @mousedown="startButtonDrag"
      @touchstart="startButtonDragTouch"
      @click="handleButtonClick"
    >
      <span class="media-count">{{ mediaList.length }}</span>
    </el-button>

    <!-- 添加媒体对话框 -->
    <el-dialog
      v-model="showUploadDialog"
      title="添加媒体"
      width="520px"
      destroy-on-close
      :teleported="true"
      :append-to-body="true"
    >
      <!-- 类型选择 Tab -->
      <el-tabs v-model="activeTab" class="media-tabs">
        <el-tab-pane label="图片" name="image">
          <el-upload
            class="media-uploader"
            drag
            action="#"
            :auto-upload="false"
            :on-change="handleFileChange"
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
              placeholder="输入视频链接（支持 MP4、WebM 等直接链接）"
              clearable
              size="large"
            >
              <template #prefix>
                <el-icon><VideoPlay /></el-icon>
              </template>
            </el-input>
            <el-button
              type="primary"
              :disabled="!videoUrl.trim()"
              @click="addVideoFromUrl"
            >
              <el-icon><Plus /></el-icon>
              添加视频
            </el-button>
          </div>
          <div class="video-hint">
            <el-icon><InfoFilled /></el-icon>
            <span>支持直接视频链接（.mp4/.webm），暂不支持 YouTube 等第三方平台</span>
          </div>
        </el-tab-pane>
      </el-tabs>

      <!-- 已添加媒体列表 -->
      <div v-if="mediaList.length > 0" class="uploaded-media">
        <h4>已添加</h4>
        <div class="media-list">
          <div
            v-for="media in lazyLoadMedia"
            :key="media.id"
            v-memo="[media.isVisible, media.thumbnailUrl]"
            class="media-item"
            :class="{ 'is-hidden': !media.isVisible, 'is-video': media.type === 'video' }"
          >
            <template v-if="media.type === 'image'">
              <img
                :src="media.thumbnailUrl || media.url"
                :alt="media.name"
                loading="lazy"
                @error="handleImageError($event, media)"
              />
            </template>
            <template v-else>
              <div class="video-thumbnail">
                <el-icon><VideoPlay /></el-icon>
                <span class="video-name">{{ media.name }}</span>
              </div>
            </template>
            <div class="media-controls">
              <el-switch
                :model-value="media.isVisible"
                size="small"
                @update:model-value="toggleMediaVisibility(media.id)"
              />
              <el-button
                class="delete-btn"
                :icon="Delete"
                circle
                size="small"
                type="danger"
                @click="closeMedia(media.id)"
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
import { ref, reactive, computed, onMounted, onUnmounted, watch } from 'vue'
import {
  Picture,
  PictureFilled,
  Close,
  Upload,
  Delete,
  VideoPlay,
  Plus,
  InfoFilled
} from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import type { UploadFile } from 'element-plus'
import { useFloatingMediaStore } from '@/stores'
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

interface ButtonDragState {
  isDragging: boolean
  hasMoved: boolean
  startX: number
  startY: number
  initialX: number
  initialY: number
}

const floatingMediaStore = useFloatingMediaStore()
const showUploadDialog = ref(false)
const activeMediaId = ref<string | null>(null)
const uploadFileList = ref<UploadFile[]>([])
const activeTab = ref('image')
const videoUrl = ref('')

// 按钮位置
const buttonPosition = ref({ x: 0, y: 50 })
const buttonDragState = reactive<ButtonDragState>({
  isDragging: false,
  hasMoved: false,
  startX: 0,
  startY: 0,
  initialX: 0,
  initialY: 0
})

// 计算属性
const visibleMedia = computed(() => floatingMediaStore.visibleMedia())
const mediaList = computed(() => floatingMediaStore.mediaList)
const lazyLoadMedia = computed(() => mediaList.value)

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

const scheduleIdleTask = (callback: () => void, options?: { timeout?: number }) => {
  if ('requestIdleCallback' in window) {
    requestIdleCallback(callback, options)
  } else {
    setTimeout(callback, options?.timeout || 0)
  }
}

// 处理文件上传
const handleFileChange = async (uploadFile: UploadFile) => {
  const file = uploadFile.raw
  if (!file) return

  if (!file.type.startsWith('image/')) {
    ElMessage.error(`跳过非图片文件: ${file.name}`)
    return
  }

  try {
    const originalDataURL = await fileToDataURL(file)
    const newImage = await floatingMediaStore.addImage({
      url: originalDataURL,
      name: file.name,
      x: 100 + mediaList.value.length * 30,
      y: 100 + mediaList.value.length * 30,
      width: 300,
      height: 200,
      isVisible: true
    })

    scheduleIdleTask(() => {
      generateThumbnail(file).then(thumbnailDataURL => {
        floatingMediaStore.updateMedia(newImage.id, { thumbnailUrl: thumbnailDataURL })
      }).catch(() => {})
    }, { timeout: 1000 })
  } catch (error) {
    ElMessage.error(`处理文件失败: ${file.name}`)
  }
}

// 从 URL 添加视频
const addVideoFromUrl = async () => {
  const url = videoUrl.value.trim()
  if (!url) return

  // 简单验证是否为有效 URL
  try {
    new URL(url)
  } catch {
    ElMessage.error('请输入有效的视频链接')
    return
  }

  try {
    const name = url.split('/').pop() || '视频'
    await floatingMediaStore.addVideo({
      url,
      name,
      x: 100 + mediaList.value.length * 30,
      y: 100 + mediaList.value.length * 30,
      width: 480,
      height: 270,
      isVisible: true
    })
    ElMessage.success('视频已添加')
    videoUrl.value = ''
  } catch (error) {
    ElMessage.error('添加视频失败')
  }
}

// 关闭媒体
const closeMedia = async (id: string) => {
  await floatingMediaStore.removeMedia(id)
}

// 监听对话框关闭
watch(showUploadDialog, (newVal) => {
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
    const media = mediaList.value.find(m => m.id === dragState.mediaId)
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
    const media = mediaList.value.find(m => m.id === dragState.mediaId)
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
    const media = mediaList.value.find(m => m.id === dragState.mediaId)
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
    const media = mediaList.value.find(m => m.id === resizeState.mediaId)
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
    const media = mediaList.value.find(m => m.id === resizeState.mediaId)
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
    const media = mediaList.value.find(m => m.id === resizeState.mediaId)
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
  const aspectRatio = naturalWidth / naturalHeight
  const duration = video.duration

  const newHeight = media.width / aspectRatio

  await floatingMediaStore.updateMedia(media.id, {
    naturalWidth,
    naturalHeight,
    aspectRatio,
    height: newHeight,
    videoDuration: isNaN(duration) ? undefined : duration
  })
}

// 更新媒体
const updateMedia = async (id: string, updates: Partial<FloatingMedia>) => {
  await floatingMediaStore.updateMedia(id, updates)
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

// 获取按钮样式
const getButtonStyle = () => {
  if (buttonPosition.value.x !== 0 || buttonPosition.value.y !== 50) {
    return {
      position: 'fixed',
      left: `${buttonPosition.value.x}px`,
      top: `${buttonPosition.value.y}px`,
      right: 'auto',
      transform: 'none'
    }
  }
  return {
    position: 'fixed',
    right: '24px',
    top: '50%',
    transform: 'translateY(-50%)'
  }
}

// 开始拖拽按钮
const startButtonDrag = (e: MouseEvent) => {
  if (e.button !== 0) return

  buttonDragState.isDragging = true
  buttonDragState.hasMoved = false
  buttonDragState.startX = e.clientX
  buttonDragState.startY = e.clientY

  if (buttonPosition.value.x === 0 && buttonPosition.value.y === 50) {
    const buttonEl = e.currentTarget as HTMLElement
    const rect = buttonEl.getBoundingClientRect()
    buttonPosition.value.x = rect.left
    buttonPosition.value.y = rect.top
  }

  buttonDragState.initialX = buttonPosition.value.x
  buttonDragState.initialY = buttonPosition.value.y
}

// 触摸开始拖拽按钮
const startButtonDragTouch = (e: TouchEvent) => {
  if (e.touches.length !== 1) return

  const touch = e.touches[0]!
  buttonDragState.isDragging = true
  buttonDragState.hasMoved = false
  buttonDragState.startX = touch.clientX
  buttonDragState.startY = touch.clientY

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

    const moveThreshold = 5
    if (Math.abs(deltaX) > moveThreshold || Math.abs(deltaY) > moveThreshold) {
      buttonDragState.hasMoved = true
    }

    buttonPosition.value.x = buttonDragState.initialX + deltaX
    buttonPosition.value.y = buttonDragState.initialY + deltaY

    const buttonSize = 56
    buttonPosition.value.x = Math.max(0, Math.min(window.innerWidth - buttonSize, buttonPosition.value.x))
    buttonPosition.value.y = Math.max(0, Math.min(window.innerHeight - buttonSize, buttonPosition.value.y))
  }
}

// 处理按钮触摸拖拽移动
const handleButtonDragMoveTouch = (e: TouchEvent) => {
  if (buttonDragState.isDragging && e.touches.length === 1) {
    const touch = e.touches[0]!
    const deltaX = touch.clientX - buttonDragState.startX
    const deltaY = touch.clientY - buttonDragState.startY

    const moveThreshold = 5
    if (Math.abs(deltaX) > moveThreshold || Math.abs(deltaY) > moveThreshold) {
      buttonDragState.hasMoved = true
    }

    buttonPosition.value.x = buttonDragState.initialX + deltaX
    buttonPosition.value.y = buttonDragState.initialY + deltaY

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
  if (buttonDragState.hasMoved) {
    e.stopPropagation()
    return
  }
  showUploadDialog.value = true
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
  if (dragState.isDragging || resizeState.isResizing || buttonDragState.isDragging) {
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

// 全局鼠标事件监听
onMounted(() => {
  document.addEventListener('mousemove', handleDragMove)
  document.addEventListener('mousemove', handleResizeMove)
  document.addEventListener('mousemove', handleButtonDragMove)
  document.addEventListener('mouseup', endDrag)
  document.addEventListener('mouseup', endResize)
  document.addEventListener('mouseup', endButtonDrag)
  document.addEventListener('click', handleClickOutside)
  document.addEventListener('touchmove', handleDragMoveTouch, { passive: false })
  document.addEventListener('touchmove', handleResizeMoveTouch, { passive: false })
  document.addEventListener('touchmove', handleButtonDragMoveTouch, { passive: false })
  document.addEventListener('touchend', endDrag)
  document.addEventListener('touchend', endResize)
  document.addEventListener('touchend', endButtonDrag)
  document.addEventListener('touchend', handleTouchEndOutside)
})

onUnmounted(() => {
  document.removeEventListener('mousemove', handleDragMove)
  document.removeEventListener('mousemove', handleResizeMove)
  document.removeEventListener('mousemove', handleButtonDragMove)
  document.removeEventListener('mouseup', endDrag)
  document.removeEventListener('mouseup', endResize)
  document.removeEventListener('mouseup', endButtonDrag)
  document.removeEventListener('click', handleClickOutside)
  document.removeEventListener('touchmove', handleDragMoveTouch)
  document.removeEventListener('touchmove', handleResizeMoveTouch)
  document.removeEventListener('touchmove', handleButtonDragMoveTouch)
  document.removeEventListener('touchend', endDrag)
  document.removeEventListener('touchend', endResize)
  document.removeEventListener('touchend', endButtonDrag)
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
  background: #000;
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
  touch-action: none;
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

.viewer-trigger.has-media {
  background: linear-gradient(135deg, #67c23a, #85ce61);
  box-shadow: 0 4px 16px rgba(103, 194, 58, 0.4);
}

.media-count {
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

/* Tab 样式 */
.media-tabs :deep(.el-tabs__header) {
  margin-bottom: 16px;
}

/* 上传区域 */
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

.video-hint {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 12px;
  background: #f5f7fa;
  border-radius: 8px;
  font-size: 12px;
  color: #909399;
}

.video-hint .el-icon {
  flex-shrink: 0;
  margin-top: 2px;
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

.media-item .video-thumbnail {
  width: 100px;
  height: 100px;
  border-radius: 8px;
  border: 2px solid #eee;
  background: linear-gradient(135deg, #2c3e50, #34495e);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  color: white;
  transition: all 0.3s ease;
}

.media-item.is-hidden .video-thumbnail {
  border-color: #ccc;
  opacity: 0.5;
}

.media-item .video-thumbnail .el-icon {
  font-size: 32px;
  color: #ff85a2;
}

.media-item .video-name {
  font-size: 11px;
  max-width: 90px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  padding: 0 4px;
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
  .viewer-trigger {
    width: 64px;
    height: 64px;
    font-size: 28px;
    right: 16px;
  }

  .viewer-trigger:hover {
    transform: translateY(-50%) scale(1.05);
  }

  .viewer-trigger.is-dragging {
    transform: scale(1.05);
  }

  .media-count {
    width: 24px;
    height: 24px;
    font-size: 14px;
    top: -6px;
    right: -6px;
  }

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
  .media-item .video-thumbnail {
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

  .viewer-trigger:hover {
    transform: translateY(-50%) scale(1);
    box-shadow: 0 4px 16px rgba(255, 133, 162, 0.4);
  }

  .floating-close-btn:active {
    transform: scale(1.1);
    box-shadow: 0 4px 12px rgba(255, 107, 107, 0.6);
  }

  .resize-handle:active {
    background: #ff6b9d;
    transform: scale(1.2);
  }

  .viewer-trigger:active {
    transform: translateY(-50%) scale(1.1);
    box-shadow: 0 6px 20px rgba(255, 133, 162, 0.5);
  }
}
</style>
