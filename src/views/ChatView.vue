<template>
  <div class="chat-view">
    <!-- 侧边栏组件 -->
    <AgentSidebar />

    <!-- 聊天主区域 - 始终居中 -->
    <main class="chat-container">
      <div class="chat-main" :style="chatMainStyle">
        <!-- 头部 -->
        <header class="chat-header">
          <div class="chat-title">
            <template v-if="chatStore.currentChat && agentStore.currentAgent">
              <el-avatar
                :size="32"
                :icon="agentStore.currentAgent.avatar ? undefined : UserFilled"
                :src="agentStore.currentAgent.avatar"
                class="header-avatar"
              >
                {{ agentStore.currentAgent.avatar ? undefined : agentStore.currentAgent.name.charAt(0).toUpperCase() }}
              </el-avatar>
              <span>{{ chatStore.currentChat.title }}</span>
            </template>
            <template v-else>
              <span>请选择一个聊天或创建新对话</span>
            </template>
          </div>
          <el-button
            :icon="Setting"
            circle
            class="settings-btn"
            @click="showSettings = true"
          />
        </header>

        <!-- 消息区域 -->
        <div class="chat-messages" ref="messagesContainer">
          <template v-if="currentMessages.length > 0">
            <ChatMessage
              v-for="(message, index) in currentMessages"
              :key="message.id"
              :message="message"
              :agent-name="agentStore.currentAgent?.name"
              :agent-avatar="agentStore.currentAgent?.avatar"
              :is-latest-assistant-message="isLatestAssistantMessage(message, index)"
              @delete="handleDeleteMessage"
              @delete-with-below="handleDeleteWithBelow"
              @regenerate="handleRegenerate"
              ref="messageRefs"
            />
          </template>
          <div v-else class="empty-state">
            <el-empty description="开始一个新的对话吧">
              <el-button
                v-if="agentStore.currentAgentId"
                type="primary"
                @click="startNewChat"
              >
                开始对话
              </el-button>
            </el-empty>
          </div>
        </div>

        <!-- 输入框 -->
        <ChatInput
          :loading="isLoading"
          @send="handleSendMessage"
          @pause="handlePause"
          @preview="handlePreviewRequest"
        />
      </div>
    </main>

    <!-- 设置面板 -->
    <SettingsPanel v-model="showSettings" />

    <!-- 悬浮图片查看器 -->
    <FloatingImageViewer />

    <!-- 预览请求体弹窗 -->
    <el-dialog
      v-model="showPreviewDialog"
      title="预览请求体"
      width="70%"
      :close-on-click-modal="true"
      class="preview-dialog"
    >
      <pre class="preview-content">{{ previewRequestBody }}</pre>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
import { UserFilled, Setting } from '@element-plus/icons-vue'
import AgentSidebar from '@/components/AgentSidebar.vue'
import ChatMessage from '@/components/ChatMessage.vue'
import ChatInput from '@/components/ChatInput.vue'
import SettingsPanel from '@/components/SettingsPanel.vue'
import FloatingImageViewer from '@/components/FloatingImageViewer.vue'
import { useAgentStore, useChatStore, useMessageStore, useModelStore, useSettingsStore, usePromptStore } from '@/stores'
import type { MessageRole, Message, ImageContent } from '@/types'
import { assembleMessages } from '@/utils/templateParser'

const agentStore = useAgentStore()
const chatStore = useChatStore()
const messageStore = useMessageStore()
const modelStore = useModelStore()
const settingsStore = useSettingsStore()
const promptStore = usePromptStore()

const showSettings = ref(false)
const isLoading = ref(false)
const messagesContainer = ref<HTMLElement>()
const messageRefs = ref<InstanceType<typeof ChatMessage>[]>([])
const showPreviewDialog = ref(false)
const previewRequestBody = ref<string>('')

// 用于取消请求
const abortController = ref<AbortController | null>(null)

const currentMessages = computed(() => {
  if (!chatStore.currentChatId) return []
  return messageStore.getMessagesByChatId(chatStore.currentChatId).filter(m => m.role !== 'system')
})

const chatMainStyle = computed(() => ({
  backgroundColor: `rgba(255, 255, 255, ${settingsStore.settings.chatOpacity})`
}))

// 检查用户是否在底部附近（阈值 100px）
const isNearBottom = (): boolean => {
  if (!messagesContainer.value) return true
  const container = messagesContainer.value
  const threshold = 100
  return container.scrollHeight - container.scrollTop - container.clientHeight < threshold
}

const scrollToBottom = (force: boolean = false) => {
  nextTick(() => {
    if (messagesContainer.value) {
      // 只有当强制滚动或用户已经在底部附近时才滚动
      if (force || isNearBottom()) {
        messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
      }
    }
  })
}

const startNewChat = async () => {
  if (!agentStore.currentAgentId) return
  const agent = agentStore.getAgentById(agentStore.currentAgentId)
  if (agent) {
    const chat = await chatStore.createChat(agentStore.currentAgentId, `与 ${agent.name} 的对话`)
    await messageStore.createMessage(chat.id, 'system', agent.roleDescription)
    if (agent.firstMessage.trim()) {
      await messageStore.createMessage(chat.id, 'assistant', agent.firstMessage)
    }
    chatStore.setCurrentChat(chat.id)
  }
}

const syncAgentConfigToCurrentAgentChats = async () => {
  if (!agentStore.currentAgentId) return
  const agent = agentStore.getAgentById(agentStore.currentAgentId)
  if (!agent) return

  const chats = chatStore.getChatsByAgentId(agentStore.currentAgentId)
  for (const chat of chats) {
    const chatMessages = messageStore.getMessagesByChatId(chat.id)
    const systemMsg = chatMessages.find(m => m.role === 'system')
    if (systemMsg) {
      await messageStore.updateMessage(systemMsg.id, { content: agent.roleDescription })
    }

    const firstAssistantMsg = chatMessages.find(m => m.role === 'assistant')
    if (firstAssistantMsg && agent.firstMessage.trim()) {
      await messageStore.updateMessage(firstAssistantMsg.id, { content: agent.firstMessage })
    }
  }
}

watch(() => agentStore.agentUpdateTimestamp, (newTimestamp) => {
  if (newTimestamp > 0) {
    syncAgentConfigToCurrentAgentChats()
  }
})

/**
 * 构建发送给模型的消息数组
 * 支持提示词模板和图片
 */
const buildMessages = (
  userContent: string,
  chatHistory: Message[],
  agentRoleDescription: string,
  images?: ImageContent[]
): Array<{ role: MessageRole; content: string }> => {
  // 获取当前智能体ID
  const currentAgentId = agentStore.currentAgentId

  // 查找适用于当前智能体的模板
  // 优先使用指定了当前智能体的模板，如果没有则使用通用的（agentIds为空的）
  const applicableTemplates = promptStore.templates.filter(t => {
    if (t.agentIds.length === 0) return true // 通用模板
    if (currentAgentId && t.agentIds.includes(currentAgentId)) return true // 指定了当前智能体
    return false
  })

  // 使用第一个适用的模板
  const template = applicableTemplates[0]

  // 构建用户内容（包含图片描述）
  let finalUserContent = userContent
  if (images && images.length > 0) {
    const imageDesc = images.map((img, i) => `[图片${i + 1}: ${img.name || '未命名'}]`).join('\n')
    finalUserContent = imageDesc + (userContent ? '\n\n' + userContent : '')
  }

  if (template) {
    // 使用模板组装消息
    // 过滤掉用户刚发送的消息（还未保存到 history）
    const historyWithoutCurrent = chatHistory.filter(m => m.role !== 'user' || m.content !== userContent)

    return assembleMessages(
      template.template,
      agentRoleDescription,
      historyWithoutCurrent,
      finalUserContent,
      template.prompts // 传入模板内的提示词列表，用于解析 *自定义1* 等标签
    )
  }

  // 默认行为：添加角色描述作为system消息，然后使用所有历史消息
  const messages: Array<{ role: MessageRole; content: string }> = []

  if (agentRoleDescription.trim()) {
    messages.push({ role: 'system', content: agentRoleDescription })
  }

  for (const m of chatHistory) {
    if (m.role !== 'system') {
      messages.push({ role: m.role, content: m.content })
    }
  }

  // 添加用户当前发送的消息
  if (finalUserContent.trim()) {
    messages.push({ role: 'user', content: finalUserContent })
  }

  return messages
}

const streamingMessageId = ref<string | null>(null)

const handleSendMessage = async (content: string, images?: ImageContent[]) => {
  if (!modelStore.currentModelId) return

  // 如果没有选中的会话，自动创建新对话
  if (!chatStore.currentChatId) {
    if (!agentStore.currentAgentId) return
    const agent = agentStore.getAgentById(agentStore.currentAgentId)
    if (!agent) return
    const chat = await chatStore.createChat(agentStore.currentAgentId, `与 ${agent.name} 的对话`)
    await messageStore.createMessage(chat.id, 'system', agent.roleDescription)
    if (agent.firstMessage.trim()) {
      await messageStore.createMessage(chat.id, 'assistant', agent.firstMessage)
    }
    chatStore.setCurrentChat(chat.id)
  }

  // 先保存用户消息
  await messageStore.createMessage(chatStore.currentChatId!, 'user' as MessageRole, content, images)
  scrollToBottom(true) // 用户发送消息时强制滚动到底部
  isLoading.value = true
  streamingMessageId.value = null

  // 创建新的 AbortController
  abortController.value = new AbortController()

  try {
    const model = modelStore.getModelById(modelStore.currentModelId)
    if (!model) throw new Error('未找到模型配置')

    const agent = agentStore.currentAgent
    const roleDescription = agent?.roleDescription || ''

    // 使用自定义模板构建消息
    const messages = buildMessages(content, currentMessages.value, roleDescription)

    let modelParams = {}
    try {
      modelParams = JSON.parse(model.params)
    } catch {
      // 使用默认参数
    }

    // 使用流式请求
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        apiUrl: model.apiUrl,
        apiKey: model.apiKey,
        messages,
        params: modelParams,
        stream: true
      }),
      signal: abortController.value.signal
    })

    if (!response.ok) throw new Error('请求失败')

    // 处理流式响应
    const reader = response.body?.getReader()
    if (!reader) throw new Error('无法读取响应')

    const decoder = new TextDecoder()
    let buffer = ''
    let fullContent = ''
    let meta: Record<string, any> | undefined

    // 创建空消息用于流式更新
    const message = await messageStore.createMessage(
      chatStore.currentChatId!,
      'assistant' as MessageRole,
      ''
    )
    streamingMessageId.value = message.id

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        const trimmedLine = line.trim()
        if (!trimmedLine || !trimmedLine.startsWith('data: ')) continue

        const data = trimmedLine.slice(6)

        try {
          const event = JSON.parse(data)

          if (event.error) {
            throw new Error(event.error)
          }

          if (event.content) {
            fullContent += event.content
            // 流式更新时跳过 IndexedDB 存储，提升性能
            await messageStore.updateMessage(message.id, { content: fullContent }, true)
            scrollToBottom()
          }

          if (event.done) {
            meta = event.meta
            console.log("[Client] Received done event, meta:", JSON.stringify(meta))
          }
        } catch (e) {
          // 忽略解析错误
        }
      }
    }

    // 处理剩余缓冲区
    if (buffer.trim()) {
      const trimmedLine = buffer.trim()
      if (trimmedLine.startsWith('data: ')) {
        const data = trimmedLine.slice(6)
        try {
          const event = JSON.parse(data)
          if (event.content) {
            fullContent += event.content
          }
          if (event.meta) {
            meta = event.meta
          }
        } catch (e) {
          // 忽略解析错误
        }
      }
    }

    // 更新最终消息内容和元数据
    console.log("[Client] Updating message with meta:", JSON.stringify(meta))
    await messageStore.updateMessage(message.id, {
      content: fullContent,
      meta
    })
    streamingMessageId.value = null
    scrollToBottom()

  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      // 用户主动暂停，不显示错误
      console.log('请求已被用户暂停')
    } else {
      if (streamingMessageId.value) {
        await messageStore.updateMessage(
          streamingMessageId.value,
          { content: `抱歉，发生了错误: ${error instanceof Error ? error.message : '未知错误'}` }
        )
      } else {
        await messageStore.createMessage(
          chatStore.currentChatId!,
          'assistant' as MessageRole,
          `抱歉，发生了错误: ${error instanceof Error ? error.message : '未知错误'}`
        )
      }
      scrollToBottom()
    }
  } finally {
    isLoading.value = false
    streamingMessageId.value = null
    abortController.value = null
  }
}

// 暂停响应
const handlePause = () => {
  if (abortController.value) {
    abortController.value.abort()
    abortController.value = null
    isLoading.value = false
    streamingMessageId.value = null
  }
}

// 判断是否为最新的AI消息
const isLatestAssistantMessage = (message: Message, index: number): boolean => {
  // 找到最后一条AI消息的索引
  let lastAssistantIndex = -1
  for (let i = currentMessages.value.length - 1; i >= 0; i--) {
    if (currentMessages.value[i]?.role === 'assistant') {
      lastAssistantIndex = i
      break
    }
  }
  return index === lastAssistantIndex
}

// 删除单条消息
const handleDeleteMessage = async (messageId: string) => {
  await messageStore.deleteMessage(messageId)
}

// 删除本条及以下消息
const handleDeleteWithBelow = async (messageId: string) => {
  if (chatStore.currentChatId) {
    await messageStore.deleteMessageAndAfter(chatStore.currentChatId, messageId)
  }
}

// 重新生成消息
const handleRegenerate = async (messageId: string) => {
  if (!chatStore.currentChatId || !modelStore.currentModelId) return

  // 找到当前消息
  const message = messageStore.getMessageById(messageId)
  if (!message) return

  // 找到前一条用户消息
  const chatMessages = currentMessages.value
  const messageIndex = chatMessages.findIndex(m => m.id === messageId)
  if (messageIndex <= 0) return

  const userMessage = chatMessages[messageIndex - 1]
  if (userMessage?.role !== 'user') return

  isLoading.value = true
  abortController.value = new AbortController()

  // 创建新的空白变体，将当前内容保存为变体，切换到新的空白变体
  await messageStore.createEmptyVariant(messageId)

  try {
    const model = modelStore.getModelById(modelStore.currentModelId)
    if (!model) throw new Error('未找到模型配置')

    const agent = agentStore.currentAgent
    const roleDescription = agent?.roleDescription || ''

    // 构建消息历史（只包含当前消息之前的对话）
    const historyBeforeUser = chatMessages.slice(0, messageIndex - 1)
    const messages = buildMessages(userMessage.content, historyBeforeUser, roleDescription)

    let modelParams = {}
    try {
      modelParams = JSON.parse(model.params)
    } catch {
      // 使用默认参数
    }

    // 使用流式请求
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        apiUrl: model.apiUrl,
        apiKey: model.apiKey,
        messages,
        params: modelParams,
        stream: true
      }),
      signal: abortController.value.signal
    })

    if (!response.ok) throw new Error('请求失败')

    const reader = response.body?.getReader()
    if (!reader) throw new Error('无法读取响应')

    const decoder = new TextDecoder()
    let buffer = ''
    let fullContent = ''
    let meta: Record<string, any> | undefined

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        const trimmedLine = line.trim()
        if (!trimmedLine || !trimmedLine.startsWith('data: ')) continue

        const data = trimmedLine.slice(6)

        try {
          const event = JSON.parse(data)

          if (event.error) {
            throw new Error(event.error)
          }

          if (event.content) {
            fullContent += event.content
            // 实时更新当前变体内容，实现打字机效果
            await messageStore.updateCurrentVariant(messageId, fullContent)
            scrollToBottom()
          }

          if (event.done) {
            meta = event.meta
          }
        } catch (e) {
          // 忽略解析错误
        }
      }
    }

    // 处理剩余缓冲区
    if (buffer.trim()) {
      const trimmedLine = buffer.trim()
      if (trimmedLine.startsWith('data: ')) {
        const data = trimmedLine.slice(6)
        try {
          const event = JSON.parse(data)
          if (event.content) {
            fullContent += event.content
          }
          if (event.meta) {
            meta = event.meta
          }
        } catch (e) {
          // 忽略解析错误
        }
      }
    }

    // 更新最终变体内容和元数据
    await messageStore.updateCurrentVariant(messageId, fullContent, meta)
    scrollToBottom()

  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.log('重新生成请求已被用户暂停')
    } else {
      console.error('重新生成失败:', error)
    }
  } finally {
    isLoading.value = false
    abortController.value = null
  }
}

watch(currentMessages, () => {
  scrollToBottom()
}, { deep: true })

// 预览请求体
const handlePreviewRequest = (content: string, images?: ImageContent[]) => {
  if (!chatStore.currentChatId || !modelStore.currentModelId) return

  const model = modelStore.getModelById(modelStore.currentModelId)
  if (!model) {
    previewRequestBody.value = '未找到模型配置'
    showPreviewDialog.value = true
    return
  }

  const agent = agentStore.currentAgent
  const roleDescription = agent?.roleDescription || ''

  // 构建消息（包含图片信息）
  const messages = buildMessages(content, currentMessages.value, roleDescription, images)

  let modelParams = {}
  try {
    modelParams = JSON.parse(model.params)
  } catch {
    // 使用默认参数
  }

  // 构建请求体
  const requestBody = {
    apiUrl: model.apiUrl,
    apiKey: model.apiKey ? '***' : '',
    messages,
    params: modelParams,
    stream: true
  }

  previewRequestBody.value = JSON.stringify(requestBody, null, 2)
  showPreviewDialog.value = true
}
</script>

<style scoped>
.chat-view {
  display: flex;
  height: 100vh;
  width: 100vw;
  overflow: hidden;
}

/* 聊天容器 - 占据剩余空间并居中内容 */
.chat-container {
  flex: 1;
  display: flex;
  justify-content: center;
  padding: 0 60px;
  overflow: hidden;
}

/* 聊天主区域 - 固定最大宽度，始终居中 */
.chat-main {
  width: 100%;
  max-width: 800px;
  height: 100%;
  display: flex;
  flex-direction: column;
  backdrop-filter: blur(10px);
  border-left: 1px solid rgba(255, 133, 162, 0.1);
  border-right: 1px solid rgba(255, 133, 162, 0.1);
  box-shadow: -8px 0 24px rgba(0, 0, 0, 0.06), 8px 0 24px rgba(0, 0, 0, 0.06);
}

/* 移动端适配 */
@media screen and (max-width: 768px) {
  .chat-container {
    padding: 0;
  }

  .chat-main {
    max-width: 100%;
    border-left: none;
    border-right: none;
  }

  .chat-header {
    padding: 12px 16px;
  }

  .chat-header .settings-btn {
    right: 16px;
  }

  .chat-messages {
    padding: 12px 4px;
  }
}

/* 头部 */
.chat-header {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px 24px;
  border-bottom: 1px solid rgba(255, 133, 162, 0.2);
  background: rgba(255, 255, 255, 0.8);
  flex-shrink: 0;
  position: relative;
}

.chat-header .settings-btn {
  position: absolute;
  right: 24px;
}

.chat-title {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 16px;
  font-weight: 500;
  color: #333;
}

.header-avatar {
  background: linear-gradient(135deg, #ff85a2, #ff6b9d);
}

.settings-btn {
  border-color: rgba(255, 133, 162, 0.3);
  color: #ff85a2;
}

.settings-btn:hover {
  background: rgba(255, 133, 162, 0.1);
  border-color: #ff85a2;
}

/* 消息区域 */
.chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 16px 8px;
}

.empty-state {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* 滚动条样式 */
.chat-messages::-webkit-scrollbar {
  width: 6px;
}

.chat-messages::-webkit-scrollbar-track {
  background: transparent;
}

.chat-messages::-webkit-scrollbar-thumb {
  background: rgba(255, 133, 162, 0.3);
  border-radius: 3px;
}

.chat-messages::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 133, 162, 0.5);
}

/* 预览请求体弹窗样式 */
.preview-dialog :deep(.el-dialog__body) {
  padding: 20px;
}

.preview-content {
  background: #f5f5f5;
  padding: 16px;
  border-radius: 8px;
  overflow-x: auto;
  font-size: 13px;
  line-height: 1.6;
  margin: 0;
  max-height: 60vh;
  overflow-y: auto;
}
</style>
