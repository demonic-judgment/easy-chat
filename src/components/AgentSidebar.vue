<template>
  <div class="agent-sidebar-container">
    <!-- 始终可见的悬浮按钮 -->
    <button class="toggle-btn" @click="isOpen = !isOpen">
      <el-icon :size="20">
        <Fold v-if="isOpen" />
        <Expand v-else />
      </el-icon>
    </button>

    <!-- 悬浮侧边栏 -->
    <Transition name="slide">
      <div v-show="isOpen" class="sidebar-overlay">
        <div class="sidebar-content">
          <div class="sidebar-header">
            <h3 class="sidebar-title">智能体</h3>
          </div>

          <div class="agent-list">
            <div
              v-for="agent in agentStore.agents"
              :key="agent.id"
              class="agent-item"
              :class="{ active: agentStore.currentAgentId === agent.id }"
              @click="selectAgent(agent.id)"
            >
              <el-avatar :size="32" :icon="UserFilled" class="agent-avatar" />
              <div class="agent-info">
                <div class="agent-name">{{ agent.name }}</div>
                <div class="agent-desc">{{ truncate(agent.roleDescription, 20) }}</div>
              </div>
              <el-dropdown trigger="click" @command="handleCommand($event, agent.id)">
                <el-button :icon="More" circle size="small" class="more-btn" @click.stop />
                <template #dropdown>
                  <el-dropdown-menu>
                    <el-dropdown-item command="edit">编辑</el-dropdown-item>
                    <el-dropdown-item command="delete" divided>删除</el-dropdown-item>
                  </el-dropdown-menu>
                </template>
              </el-dropdown>
            </div>
          </div>

          <el-button
            type="primary"
            :icon="Plus"
            class="add-agent-btn"
            @click="showAgentDialog = true"
          >
            新建智能体
          </el-button>

          <!-- 聊天历史 -->
          <div v-if="agentStore.currentAgentId" class="chat-history">
            <div class="section-header">
              <h4 class="section-title">聊天记录</h4>
              <el-button :icon="Plus" circle size="small" @click="createNewChat" />
            </div>
            <div class="chat-list">
              <div
                v-for="chat in chatStore.getChatsByAgentId(agentStore.currentAgentId)"
                :key="chat.id"
                class="chat-item"
                :class="{ active: chatStore.currentChatId === chat.id }"
                @click="selectChat(chat.id)"
              >
                <el-icon class="chat-icon"><ChatDotRound /></el-icon>
                <span class="chat-title">{{ chat.title }}</span>
                <el-button
                  :icon="Delete"
                  circle
                  size="small"
                  class="delete-chat-btn"
                  @click.stop="deleteChat(chat.id)"
                />
              </div>
              <div v-if="chatStore.getChatsByAgentId(agentStore.currentAgentId).length === 0" class="empty-chat">
                暂无聊天记录
              </div>
            </div>
          </div>
        </div>
      </div>
    </Transition>

    <!-- 遮罩层（点击可关闭侧边栏） -->
    <Transition name="fade">
      <div v-if="isOpen" class="backdrop" @click="isOpen = false"></div>
    </Transition>

    <!-- 智能体编辑对话框 -->
    <el-dialog
      v-model="showAgentDialog"
      title="智能体设置"
      width="500px"
      destroy-on-close
    >
      <el-form :model="agentForm" label-width="80px">
        <el-form-item label="名称">
          <el-input v-model="agentForm.name" placeholder="输入智能体名称" />
        </el-form-item>
        <el-form-item label="角色描述">
          <el-input
            v-model="agentForm.roleDescription"
            type="textarea"
            :rows="3"
            placeholder="描述智能体的角色和行为"
          />
        </el-form-item>
        <el-form-item label="第一条消息">
          <el-input
            v-model="agentForm.firstMessage"
            type="textarea"
            :rows="2"
            placeholder="对话开始时的第一条消息"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showAgentDialog = false">取消</el-button>
        <el-button type="primary" @click="saveAgent">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import {
  Expand,
  Fold,
  Plus,
  UserFilled,
  More,
  ChatDotRound,
  Delete
} from '@element-plus/icons-vue'
import { useAgentStore, useChatStore, useMessageStore } from '@/stores'

const agentStore = useAgentStore()
const chatStore = useChatStore()
const messageStore = useMessageStore()

const isOpen = ref(false)
const showAgentDialog = ref(false)
const editingAgentId = ref<string | null>(null)

const agentForm = reactive({
  name: '',
  roleDescription: '',
  firstMessage: ''
})

const selectAgent = (id: string) => {
  agentStore.setCurrentAgent(id)
  const chats = chatStore.getChatsByAgentId(id)
  if (chats.length > 0 && chats[0]) {
    chatStore.setCurrentChat(chats[0].id)
  } else {
    chatStore.setCurrentChat(null)
  }
}

const selectChat = (id: string) => {
  chatStore.setCurrentChat(id)
}

const createNewChat = () => {
  const currentId = agentStore.currentAgentId
  if (!currentId) return
  const agent = agentStore.getAgentById(currentId)
  if (agent) {
    const chat = chatStore.createChat(currentId, `与 ${agent.name} 的对话`)
    messageStore.createMessage(chat.id, 'system', agent.roleDescription)
    if (agent.firstMessage.trim()) {
      messageStore.createMessage(chat.id, 'assistant', agent.firstMessage)
    }
    chatStore.setCurrentChat(chat.id)
  }
}

const deleteChat = (id: string) => {
  messageStore.deleteMessagesByChatId(id)
  chatStore.deleteChat(id)
}

const handleCommand = (command: string, agentId: string) => {
  if (command === 'edit') {
    const agent = agentStore.getAgentById(agentId)
    if (agent) {
      editingAgentId.value = agentId
      agentForm.name = agent.name
      agentForm.roleDescription = agent.roleDescription
      agentForm.firstMessage = agent.firstMessage
      showAgentDialog.value = true
    }
  } else if (command === 'delete') {
    const chats = chatStore.getChatsByAgentId(agentId)
    chats.forEach(chat => {
      messageStore.deleteMessagesByChatId(chat.id)
      chatStore.deleteChat(chat.id)
    })
    agentStore.deleteAgent(agentId)
  }
}

const saveAgent = () => {
  if (!agentForm.name.trim()) return

  if (editingAgentId.value) {
    agentStore.updateAgent(editingAgentId.value, { ...agentForm })
  } else {
    agentStore.createAgent({ ...agentForm })
  }

  showAgentDialog.value = false
  editingAgentId.value = null
  agentForm.name = ''
  agentForm.roleDescription = ''
  agentForm.firstMessage = ''
}

const truncate = (str: string, length: number) => {
  if (!str || str.length <= length) return str
  return str.substring(0, length) + '...'
}
</script>

<style scoped>
.agent-sidebar-container {
  position: relative;
}

/* 悬浮按钮 - 始终固定在左上角 */
.toggle-btn {
  position: fixed;
  left: 16px;
  top: 16px;
  z-index: 1001;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  border: 1px solid rgba(255, 133, 162, 0.3);
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(10px);
  color: #ff85a2;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
  transition: all 0.2s ease;
}

.toggle-btn:hover {
  background: rgba(255, 133, 162, 0.1);
  border-color: #ff85a2;
  transform: scale(1.05);
}

/* 侧边栏遮罩层 */
.sidebar-overlay {
  position: fixed;
  left: 0;
  top: 0;
  width: 280px;
  height: 100vh;
  z-index: 1000;
  background: rgba(255, 255, 255, 0.98);
  backdrop-filter: blur(20px);
  box-shadow: 4px 0 24px rgba(0, 0, 0, 0.12);
}

.sidebar-content {
  height: 100%;
  display: flex;
  flex-direction: column;
  padding: 70px 16px 20px;
  overflow-y: auto;
}

/* 滑入动画 */
.slide-enter-active,
.slide-leave-active {
  transition: transform 0.3s ease;
}

.slide-enter-from,
.slide-leave-to {
  transform: translateX(-100%);
}

/* 背景遮罩 */
.backdrop {
  position: fixed;
  inset: 0;
  z-index: 999;
  background: rgba(0, 0, 0, 0.2);
  backdrop-filter: blur(2px);
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

/* 侧边栏内容样式 */
.sidebar-header {
  margin-bottom: 16px;
}

.sidebar-title {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: #333;
  text-align: center;
}

.agent-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 12px;
}

.agent-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
  position: relative;
}

.agent-item:hover {
  background: rgba(255, 133, 162, 0.1);
}

.agent-item.active {
  background: linear-gradient(135deg, rgba(255, 133, 162, 0.15), rgba(255, 107, 157, 0.15));
  border: 1px solid rgba(255, 133, 162, 0.3);
}

.agent-avatar {
  background: linear-gradient(135deg, #ff85a2, #ff6b9d);
  flex-shrink: 0;
}

.agent-info {
  flex: 1;
  min-width: 0;
}

.agent-name {
  font-size: 14px;
  font-weight: 500;
  color: #333;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.agent-desc {
  font-size: 12px;
  color: #999;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-top: 2px;
}

.more-btn {
  opacity: 0;
  transition: opacity 0.2s;
  border: none;
  background: transparent;
}

.agent-item:hover .more-btn {
  opacity: 1;
}

.add-agent-btn {
  width: 100%;
  margin-bottom: 16px;
  background: linear-gradient(135deg, #ff85a2, #ff6b9d);
  border: none;
  border-radius: 12px;
}

/* 聊天历史 */
.chat-history {
  border-top: 1px solid rgba(255, 133, 162, 0.2);
  padding-top: 16px;
  flex: 1;
  overflow-y: auto;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.section-title {
  margin: 0;
  font-size: 13px;
  font-weight: 600;
  color: #666;
}

.chat-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.chat-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.chat-item:hover {
  background: rgba(255, 133, 162, 0.08);
}

.chat-item.active {
  background: rgba(255, 133, 162, 0.15);
}

.chat-icon {
  font-size: 14px;
  color: #ff85a2;
}

.chat-title {
  flex: 1;
  font-size: 13px;
  color: #555;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.delete-chat-btn {
  opacity: 0;
  transition: opacity 0.2s;
  border: none;
  background: transparent;
  color: #999;
}

.chat-item:hover .delete-chat-btn {
  opacity: 1;
}

.delete-chat-btn:hover {
  color: #f56c6c;
}

.empty-chat {
  text-align: center;
  padding: 20px;
  color: #999;
  font-size: 13px;
}
</style>
