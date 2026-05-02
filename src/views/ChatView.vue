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
              <el-avatar :size="32" :icon="UserFilled" class="header-avatar" />
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
              v-for="message in currentMessages"
              :key="message.id"
              :message="message"
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
        />
      </div>
    </main>

    <!-- 设置面板 -->
    <SettingsPanel v-model="showSettings" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
import { UserFilled, Setting } from '@element-plus/icons-vue'
import AgentSidebar from '@/components/AgentSidebar.vue'
import ChatMessage from '@/components/ChatMessage.vue'
import ChatInput from '@/components/ChatInput.vue'
import SettingsPanel from '@/components/SettingsPanel.vue'
import { useAgentStore, useChatStore, useMessageStore, useModelStore, useSettingsStore, usePromptStore } from '@/stores'
import type { MessageRole, Message } from '@/types'
import { assembleMessages, getDefaultTemplate } from '@/utils/templateParser'

const agentStore = useAgentStore()
const chatStore = useChatStore()
const messageStore = useMessageStore()
const modelStore = useModelStore()
const settingsStore = useSettingsStore()
const promptStore = usePromptStore()

const showSettings = ref(false)
const isLoading = ref(false)
const messagesContainer = ref<HTMLElement>()

const currentMessages = computed(() => {
  if (!chatStore.currentChatId) return []
  return messageStore.getMessagesByChatId(chatStore.currentChatId).filter(m => m.role !== 'system')
})

const chatMainStyle = computed(() => ({
  backgroundColor: `rgba(255, 255, 255, ${settingsStore.settings.chatOpacity})`
}))

const scrollToBottom = () => {
  nextTick(() => {
    if (messagesContainer.value) {
      messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
    }
  })
}

const startNewChat = () => {
  if (!agentStore.currentAgentId) return
  const agent = agentStore.getAgentById(agentStore.currentAgentId)
  if (agent) {
    const chat = chatStore.createChat(agentStore.currentAgentId, `与 ${agent.name} 的对话`)
    messageStore.createMessage(chat.id, 'system', agent.roleDescription)
    if (agent.firstMessage.trim()) {
      messageStore.createMessage(chat.id, 'assistant', agent.firstMessage)
    }
    chatStore.setCurrentChat(chat.id)
  }
}

/**
 * 构建发送给模型的消息数组
 * 支持自定义提示词模板
 */
const buildMessages = (
  userContent: string,
  chatHistory: Message[],
  agentRoleDescription: string
): Array<{ role: MessageRole; content: string }> => {
  // 获取当前使用的自定义提示词（如果有）
  // 这里可以扩展为让用户选择使用哪个提示词
  const customPrompt = promptStore.prompts[0]

  if (customPrompt) {
    // 使用自定义提示词模板组装消息
    // 过滤掉用户刚发送的消息（还未保存到 history）
    const historyWithoutCurrent = chatHistory.filter(m => m.role !== 'user' || m.content !== userContent)

    return assembleMessages(
      customPrompt.template,
      agentRoleDescription,
      historyWithoutCurrent,
      userContent,
      customPrompt.content,
      customPrompt.role
    )
  }

  // 默认行为：使用所有历史消息
  return chatHistory.map(m => ({
    role: m.role,
    content: m.content
  }))
}

const streamingMessageId = ref<string | null>(null)

const handleSendMessage = async (content: string) => {
  if (!chatStore.currentChatId || !modelStore.currentModelId) return

  // 先保存用户消息
  messageStore.createMessage(chatStore.currentChatId, 'user' as MessageRole, content)
  scrollToBottom()
  isLoading.value = true
  streamingMessageId.value = null

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
      })
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
    const message = messageStore.createMessage(
      chatStore.currentChatId,
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
            messageStore.updateMessage(message.id, { content: fullContent })
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

    // 更新最终消息内容和元数据
    messageStore.updateMessage(message.id, {
      content: fullContent,
      meta
    })
    streamingMessageId.value = null
    scrollToBottom()

  } catch (error) {
    if (streamingMessageId.value) {
      messageStore.updateMessage(
        streamingMessageId.value,
        { content: `抱歉，发生了错误: ${error instanceof Error ? error.message : '未知错误'}` }
      )
    } else {
      messageStore.createMessage(
        chatStore.currentChatId,
        'assistant' as MessageRole,
        `抱歉，发生了错误: ${error instanceof Error ? error.message : '未知错误'}`
      )
    }
    scrollToBottom()
  } finally {
    isLoading.value = false
    streamingMessageId.value = null
  }
}

watch(currentMessages, () => {
  scrollToBottom()
}, { deep: true })
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
}

/* 头部 */
.chat-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 24px;
  border-bottom: 1px solid rgba(255, 133, 162, 0.2);
  background: rgba(255, 255, 255, 0.8);
  flex-shrink: 0;
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
  padding: 24px;
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
</style>
