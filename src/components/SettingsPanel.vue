<template>
  <el-drawer
    v-model="visible"
    title="设置"
    size="500px"
    destroy-on-close
  >
    <el-tabs v-model="activeTab" class="settings-tabs">
      <!-- 大模型配置 -->
      <el-tab-pane label="模型配置" name="model">
        <div class="settings-section">
          <div class="section-header">
            <h4>模型列表</h4>
            <el-button type="primary" :icon="Plus" size="small" @click="addModel">
              添加模型
            </el-button>
          </div>

          <div class="model-list">
            <el-card
              v-for="model in modelStore.models"
              :key="model.id"
              class="model-card"
              :class="{ active: modelStore.currentModelId === model.id }"
              shadow="hover"
            >
              <div class="model-card-header">
                <div class="model-name">{{ model.name }}</div>
                <div class="model-actions">
                  <el-button
                    :type="modelStore.currentModelId === model.id ? 'success' : 'default'"
                    size="small"
                    @click="selectModel(model.id)"
                  >
                    {{ modelStore.currentModelId === model.id ? '当前使用' : '使用' }}
                  </el-button>
                  <el-button :icon="Edit" circle size="small" @click="editModel(model)" />
                  <el-button :icon="Delete" circle size="small" type="danger" @click="deleteModel(model.id)" />
                </div>
              </div>
              <div class="model-info">
                <div class="info-item">
                  <span class="label">API地址:</span>
                  <span class="value">{{ truncate(model.apiUrl, 40) }}</span>
                </div>
              </div>
            </el-card>
          </div>
        </div>
      </el-tab-pane>

      <!-- 自定义提示词 -->
      <el-tab-pane label="提示词" name="prompt">
        <div class="settings-section">
          <div class="section-header">
            <h4>提示词列表</h4>
            <el-button type="primary" :icon="Plus" size="small" @click="addPrompt">
              添加提示词
            </el-button>
          </div>

          <div class="prompt-list">
            <el-card
              v-for="prompt in promptStore.prompts"
              :key="prompt.id"
              class="prompt-card"
              shadow="hover"
            >
              <div class="prompt-card-header">
                <div class="prompt-name">{{ prompt.name }}</div>
                <div class="prompt-actions">
                  <el-tag size="small" :type="getRoleTagType(prompt.role)" class="role-tag">
                    {{ getRoleLabel(prompt.role) }}
                  </el-tag>
                  <el-button :icon="Edit" circle size="small" @click="editPrompt(prompt)" />
                  <el-button :icon="Delete" circle size="small" type="danger" @click="deletePrompt(prompt.id)" />
                </div>
              </div>
              <div class="prompt-template">{{ truncate(prompt.template, 80) }}</div>
              <div class="prompt-content">{{ truncate(prompt.content, 60) }}</div>
            </el-card>
          </div>

          <div v-if="promptStore.prompts.length === 0" class="empty-prompts">
            暂无自定义提示词
          </div>

          <el-divider />

          <div class="template-help">
            <h4>模板语法说明</h4>
            <div class="help-content">
              <p>使用 <code>*标签*</code> 来配置消息组装位置：</p>
              <ul>
                <li><code>*role_description*</code> - 角色描述（system 消息）</li>
                <li><code>*chat_history*</code> - 全部聊天记录</li>
                <li><code>*chat_history[-1]*</code> - 最后一条消息</li>
                <li><code>*chat_history[0-5]*</code> - 第1到第6条消息</li>
                <li><code>*user_reply*</code> - 用户当前回复</li>
                <li><code>*custom*</code> - 自定义提示词内容</li>
              </ul>
              <p class="help-tip">提示：相同角色的连续消息会自动合并</p>
            </div>
          </div>
        </div>
      </el-tab-pane>

      <!-- 界面设置 -->
      <el-tab-pane label="界面" name="ui">
        <div class="settings-section">
          <h4>背景设置</h4>
          <el-form label-width="100px">
            <el-form-item label="背景类型">
              <el-radio-group v-model="bgType">
                <el-radio-button label="color">纯色</el-radio-button>
                <el-radio-button label="image">图片</el-radio-button>
              </el-radio-group>
            </el-form-item>

            <el-form-item label="背景颜色" v-if="bgType === 'color'">
              <el-color-picker v-model="bgColor" show-alpha />
            </el-form-item>

            <el-form-item label="背景图片" v-if="bgType === 'image'">
              <el-input v-model="bgImageUrl" placeholder="输入图片URL" />
            </el-form-item>

            <el-form-item label="背景透明度">
              <el-slider v-model="bgOpacity" :min="0" :max="1" :step="0.1" />
            </el-form-item>

            <el-form-item label="聊天区透明度">
              <el-slider v-model="chatOpacity" :min="0.5" :max="1" :step="0.05" />
            </el-form-item>
          </el-form>

          <el-divider />

          <el-button type="primary" @click="saveSettings">保存设置</el-button>
          <el-button @click="resetSettings">恢复默认</el-button>
        </div>
      </el-tab-pane>
    </el-tabs>

    <!-- 模型编辑对话框 -->
    <el-dialog
      v-model="showModelDialog"
      :title="editingModelId ? '编辑模型' : '添加模型'"
      width="500px"
      destroy-on-close
    >
      <el-form :model="modelForm" label-width="100px">
        <el-form-item label="模型名称">
          <el-input v-model="modelForm.name" placeholder="例如: GPT-4" />
        </el-form-item>
        <el-form-item label="API地址">
          <el-input v-model="modelForm.apiUrl" placeholder="https://api.openai.com/v1/chat/completions" />
        </el-form-item>
        <el-form-item label="API密钥">
          <el-input v-model="modelForm.apiKey" type="password" placeholder="sk-..." show-password />
        </el-form-item>
        <el-form-item label="模型参数">
          <el-input
            v-model="modelForm.params"
            type="textarea"
            :rows="6"
            placeholder='{"temperature": 0.7, "max_tokens": 2000, "model": "gpt-4"}'
          />
          <div class="form-tip">JSON格式，将被直接发送到模型API</div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showModelDialog = false">取消</el-button>
        <el-button type="primary" @click="saveModel">保存</el-button>
      </template>
    </el-dialog>

    <!-- 提示词编辑对话框 -->
    <el-dialog
      v-model="showPromptDialog"
      :title="editingPromptId ? '编辑提示词' : '添加提示词'"
      width="600px"
      destroy-on-close
    >
      <el-form :model="promptForm" label-width="80px">
        <el-form-item label="名称">
          <el-input v-model="promptForm.name" placeholder="提示词名称" />
        </el-form-item>
        <el-form-item label="角色">
          <el-radio-group v-model="promptForm.role">
            <el-radio-button label="system">System</el-radio-button>
            <el-radio-button label="user">User</el-radio-button>
            <el-radio-button label="assistant">Assistant</el-radio-button>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="模板">
          <el-input
            v-model="promptForm.template"
            type="textarea"
            :rows="4"
            placeholder="例如: *role_description*\n\n*chat_history*\n\n*custom*\n\n*user_reply*"
          />
          <div class="form-tip">
            使用 <code>*role_description*</code>, <code>*chat_history*</code>, <code>*user_reply*</code>, <code>*custom*</code> 标签配置消息组装
          </div>
          <div v-if="templateError" class="template-error">{{ templateError }}</div>
        </el-form-item>
        <el-form-item label="内容">
          <el-input
            v-model="promptForm.content"
            type="textarea"
            :rows="6"
            placeholder="输入自定义提示词内容..."
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showPromptDialog = false">取消</el-button>
        <el-button type="primary" @click="savePrompt">保存</el-button>
      </template>
    </el-dialog>
  </el-drawer>
</template>

<script setup lang="ts">
import { ref, reactive, watch } from 'vue'
import { Plus, Edit, Delete } from '@element-plus/icons-vue'
import { useModelStore, usePromptStore, useSettingsStore } from '@/stores'
import type { ModelConfig, CustomPrompt, MessageRole } from '@/types'
import { validateTemplate, getDefaultTemplate } from '@/utils/templateParser'

const props = defineProps<{
  modelValue: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

const modelStore = useModelStore()
const promptStore = usePromptStore()
const settingsStore = useSettingsStore()

const visible = ref(props.modelValue)
const activeTab = ref('model')

// 背景设置
const bgType = ref(settingsStore.settings.background.type)
const bgColor = ref(settingsStore.settings.background.value)
const bgImageUrl = ref(settingsStore.settings.background.value)
const bgOpacity = ref(settingsStore.settings.background.opacity)
const chatOpacity = ref(settingsStore.settings.chatOpacity)

// 模型编辑
const showModelDialog = ref(false)
const editingModelId = ref<string | null>(null)
const modelForm = reactive({
  name: '',
  apiUrl: '',
  apiKey: '',
  params: ''
})

// 提示词编辑
const showPromptDialog = ref(false)
const editingPromptId = ref<string | null>(null)
const templateError = ref('')
const promptForm = reactive({
  name: '',
  content: '',
  role: 'system' as MessageRole,
  template: ''
})

watch(() => props.modelValue, (val) => {
  visible.value = val
})

watch(visible, (val) => {
  emit('update:modelValue', val)
})

const selectModel = (id: string) => {
  modelStore.setCurrentModel(id)
}

const addModel = () => {
  editingModelId.value = null
  modelForm.name = ''
  modelForm.apiUrl = ''
  modelForm.apiKey = ''
  modelForm.params = JSON.stringify({
    temperature: 0.7,
    max_tokens: 2000,
    model: 'gpt-3.5-turbo'
  }, null, 2)
  showModelDialog.value = true
}

const editModel = (model: ModelConfig) => {
  editingModelId.value = model.id
  modelForm.name = model.name
  modelForm.apiUrl = model.apiUrl
  modelForm.apiKey = model.apiKey
  modelForm.params = model.params
  showModelDialog.value = true
}

const saveModel = () => {
  if (!modelForm.name.trim() || !modelForm.apiUrl.trim()) {
    return
  }

  if (editingModelId.value) {
    modelStore.updateModel(editingModelId.value, {
      name: modelForm.name,
      apiUrl: modelForm.apiUrl,
      apiKey: modelForm.apiKey,
      params: modelForm.params
    })
  } else {
    modelStore.createModel({
      name: modelForm.name,
      apiUrl: modelForm.apiUrl,
      apiKey: modelForm.apiKey,
      params: modelForm.params
    })
  }

  showModelDialog.value = false
}

const deleteModel = (id: string) => {
  modelStore.deleteModel(id)
}

const addPrompt = () => {
  editingPromptId.value = null
  promptForm.name = ''
  promptForm.content = ''
  promptForm.role = 'system'
  promptForm.template = getDefaultTemplate()
  templateError.value = ''
  showPromptDialog.value = true
}

const editPrompt = (prompt: CustomPrompt) => {
  editingPromptId.value = prompt.id
  promptForm.name = prompt.name
  promptForm.content = prompt.content
  promptForm.role = prompt.role
  promptForm.template = prompt.template
  templateError.value = ''
  showPromptDialog.value = true
}

const savePrompt = () => {
  if (!promptForm.name.trim() || !promptForm.content.trim()) {
    return
  }

  // 验证模板
  const validation = validateTemplate(promptForm.template)
  if (!validation.valid) {
    templateError.value = validation.error || '模板格式错误'
    return
  }
  templateError.value = ''

  if (editingPromptId.value) {
    promptStore.updatePrompt(editingPromptId.value, {
      name: promptForm.name,
      content: promptForm.content,
      role: promptForm.role,
      template: promptForm.template
    })
  } else {
    promptStore.createPrompt({
      name: promptForm.name,
      content: promptForm.content,
      role: promptForm.role,
      template: promptForm.template
    })
  }

  showPromptDialog.value = false
}

const deletePrompt = (id: string) => {
  promptStore.deletePrompt(id)
}

const saveSettings = () => {
  settingsStore.updateBackground({
    type: bgType.value,
    value: bgType.value === 'color' ? bgColor.value : bgImageUrl.value,
    opacity: bgOpacity.value
  })
  settingsStore.updateChatOpacity(chatOpacity.value)
}

const resetSettings = () => {
  settingsStore.resetSettings()
  bgType.value = settingsStore.settings.background.type
  bgColor.value = settingsStore.settings.background.value
  bgImageUrl.value = settingsStore.settings.background.value
  bgOpacity.value = settingsStore.settings.background.opacity
  chatOpacity.value = settingsStore.settings.chatOpacity
}

const truncate = (str: string, length: number) => {
  if (str.length <= length) return str
  return str.substring(0, length) + '...'
}

const getRoleLabel = (role: MessageRole) => {
  const labels: Record<MessageRole, string> = {
    system: 'System',
    user: 'User',
    assistant: 'Assistant'
  }
  return labels[role]
}

const getRoleTagType = (role: MessageRole) => {
  const types: Record<MessageRole, '' | 'success' | 'warning' | 'info' | 'danger'> = {
    system: 'danger',
    user: 'success',
    assistant: 'warning'
  }
  return types[role]
}
</script>

<style scoped>
.settings-tabs {
  height: 100%;
}

.settings-section {
  padding: 16px;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.section-header h4 {
  margin: 0;
  font-size: 16px;
  color: #333;
}

.model-list,
.prompt-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.model-card,
.prompt-card {
  border-radius: 12px;
  transition: all 0.3s ease;
}

.model-card.active {
  border: 2px solid #ff85a2;
}

.model-card-header,
.prompt-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.model-name,
.prompt-name {
  font-size: 15px;
  font-weight: 500;
  color: #333;
}

.model-actions,
.prompt-actions {
  display: flex;
  gap: 8px;
}

.model-info {
  font-size: 13px;
  color: #666;
}

.info-item {
  display: flex;
  gap: 8px;
}

.label {
  color: #999;
  flex-shrink: 0;
}

.value {
  color: #666;
  word-break: break-all;
}

.prompt-template {
  font-size: 12px;
  color: #888;
  margin-bottom: 4px;
  font-family: monospace;
}

.prompt-content {
  font-size: 13px;
  color: #666;
  line-height: 1.5;
  white-space: pre-wrap;
}

.empty-prompts {
  text-align: center;
  padding: 40px;
  color: #999;
}

.form-tip {
  font-size: 12px;
  color: #999;
  margin-top: 4px;
}

.template-error {
  font-size: 12px;
  color: #f56c6c;
  margin-top: 4px;
}

.role-tag {
  margin-right: 8px;
}

.template-help {
  margin-top: 16px;
}

.template-help h4 {
  margin: 0 0 12px 0;
  font-size: 14px;
  color: #333;
}

.help-content {
  font-size: 13px;
  color: #666;
  line-height: 1.8;
}

.help-content ul {
  margin: 8px 0;
  padding-left: 20px;
}

.help-content li {
  margin: 4px 0;
}

.help-content code {
  background: #f5f5f5;
  padding: 2px 6px;
  border-radius: 4px;
  font-family: monospace;
  font-size: 12px;
  color: #ff85a2;
}

.help-tip {
  color: #999;
  font-size: 12px;
  margin-top: 8px;
}

:deep(.el-drawer__body) {
  padding: 0;
}

:deep(.el-tabs__header) {
  margin-bottom: 0;
  padding: 0 16px;
}

:deep(.el-tabs__item) {
  font-size: 14px;
}

:deep(.el-tabs__item.is-active) {
  color: #ff85a2;
}

:deep(.el-tabs__active-bar) {
  background-color: #ff85a2;
}
</style>
