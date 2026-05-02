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

      <!-- 提示词模板 -->
      <el-tab-pane label="提示词模板" name="template">
        <div class="settings-section">
          <div class="section-header">
            <h4>模板列表</h4>
            <el-button type="primary" :icon="Plus" size="small" @click="addTemplate">
              添加模板
            </el-button>
          </div>

          <div class="template-list">
            <el-card
              v-for="template in promptStore.templates"
              :key="template.id"
              class="template-card"
              shadow="hover"
            >
              <div class="template-card-header">
                <div class="template-name">{{ template.name }}</div>
                <div class="template-actions">
                  <el-button :icon="Edit" circle size="small" @click="editTemplate(template)" />
                  <el-button :icon="Delete" circle size="small" type="danger" @click="deleteTemplate(template.id)" />
                </div>
              </div>
              <div class="template-agents">
                <el-tag v-if="template.agentIds.length === 0" size="small" type="info">通用</el-tag>
                <el-tag
                  v-for="agentId in template.agentIds"
                  :key="agentId"
                  size="small"
                  type="success"
                  class="agent-tag"
                >
                  {{ getAgentNameById(agentId) }}
                </el-tag>
              </div>
              <div class="template-content">{{ truncate(template.template, 80) }}</div>
              <div class="template-prompts-count">
                包含 {{ template.prompts.length }} 个提示词
              </div>
            </el-card>
          </div>

          <div v-if="promptStore.templates.length === 0" class="empty-templates">
            暂无提示词模板
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
                <li><code>*自定义1*</code> - 引用模板中名称为"自定义1"的提示词</li>
                <li><code>*自定义2*</code> - 引用模板中名称为"自定义2"的提示词</li>
              </ul>
              <p class="help-tip">提示：相同角色的连续消息会自动合并；可在模板中组合多个提示词，如 <code>*自定义1*</code> + <code>*自定义2*</code></p>
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

            <el-form-item label="头像大小">
              <el-slider v-model="avatarSize" :min="24" :max="64" :step="4" show-stops />
              <div class="form-tip">聊天界面中头像的显示尺寸（像素）</div>
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

    <!-- 模板编辑对话框 -->
    <el-dialog
      v-model="showTemplateDialog"
      :title="editingTemplateId ? '编辑模板' : '添加模板'"
      width="800px"
      destroy-on-close
    >
      <el-form :model="templateForm" label-width="100px">
        <el-form-item label="模板名称">
          <el-input v-model="templateForm.name" placeholder="例如：默认模板" />
        </el-form-item>
        <el-form-item label="适用智能体">
          <el-select
            v-model="templateForm.agentIds"
            multiple
            collapse-tags
            collapse-tags-tooltip
            placeholder="选择适用智能体（不选则适用所有）"
            style="width: 100%"
          >
            <el-option
              v-for="agent in agentStore.agents"
              :key="agent.id"
              :label="agent.name"
              :value="agent.id"
            />
          </el-select>
          <div class="form-tip">不选择任何智能体时，该模板将适用于所有智能体</div>
        </el-form-item>
        <el-form-item label="模板内容">
          <el-input
            v-model="templateForm.template"
            type="textarea"
            :rows="4"
            placeholder="例如: *role_description*\n\n*自定义1*\n\n*自定义2*\n\n*user_reply*"
          />
          <div class="form-tip">
            使用 <code>*role_description*</code>, <code>*chat_history*</code>, <code>*user_reply*</code>, <code>*自定义1*</code> 等标签配置消息组装
          </div>
          <div v-if="templateError" class="template-error">{{ templateError }}</div>
        </el-form-item>
      </el-form>

      <el-divider />

      <!-- 提示词列表 -->
      <div class="prompts-section">
        <div class="section-header">
          <h4>提示词列表</h4>
          <el-button type="primary" :icon="Plus" size="small" @click="addPromptToCurrentTemplate">
            添加提示词
          </el-button>
        </div>

        <div class="prompt-items-list">
          <el-card
            v-for="prompt in templateForm.prompts"
            :key="prompt.id"
            class="prompt-item-card"
            shadow="hover"
          >
            <div class="prompt-item-header">
              <div class="prompt-item-name">{{ prompt.name }}</div>
              <div class="prompt-item-actions">
                <el-tag size="small" :type="getRoleTagType(prompt.role)" class="role-tag">
                  {{ getRoleLabel(prompt.role) }}
                </el-tag>
                <el-button :icon="Edit" circle size="small" @click="editPromptInTemplate(prompt)" />
                <el-button :icon="Delete" circle size="small" type="danger" @click="deletePromptFromCurrentTemplate(prompt.id)" />
              </div>
            </div>
            <div class="prompt-item-content">{{ truncate(prompt.content, 60) }}</div>
          </el-card>
        </div>

        <div v-if="templateForm.prompts.length === 0" class="empty-prompts">
          暂无提示词，点击上方按钮添加
        </div>
      </div>

      <template #footer>
        <el-button @click="showTemplateDialog = false">取消</el-button>
        <el-button type="primary" @click="saveTemplate">保存</el-button>
      </template>
    </el-dialog>

    <!-- 提示词编辑对话框（在模板内） -->
    <el-dialog
      v-model="showPromptDialog"
      :title="editingPromptId ? '编辑提示词' : '添加提示词'"
      width="500px"
      destroy-on-close
      append-to-body
    >
      <el-form :model="promptForm" label-width="80px">
        <el-form-item label="名称">
          <el-input v-model="promptForm.name" placeholder="提示词名称，如：自定义1" />
        </el-form-item>
        <el-form-item label="角色">
          <el-radio-group v-model="promptForm.role">
            <el-radio-button label="system">System</el-radio-button>
            <el-radio-button label="user">User</el-radio-button>
            <el-radio-button label="assistant">Assistant</el-radio-button>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="内容">
          <el-input
            v-model="promptForm.content"
            type="textarea"
            :rows="6"
            placeholder="输入提示词内容..."
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showPromptDialog = false">取消</el-button>
        <el-button type="primary" @click="savePromptToTemplate">保存</el-button>
      </template>
    </el-dialog>
  </el-drawer>
</template>

<script setup lang="ts">
import { ref, reactive, watch } from 'vue'
import { Plus, Edit, Delete } from '@element-plus/icons-vue'
import { useModelStore, usePromptStore, useSettingsStore, useAgentStore } from '@/stores'
import type { ModelConfig, PromptTemplate, PromptItem, MessageRole } from '@/types'
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
const agentStore = useAgentStore()

const visible = ref(props.modelValue)
const activeTab = ref('model')

// 背景设置
const bgType = ref(settingsStore.settings.background.type)
const bgColor = ref(settingsStore.settings.background.value)
const bgImageUrl = ref(settingsStore.settings.background.value)
const bgOpacity = ref(settingsStore.settings.background.opacity)
const chatOpacity = ref(settingsStore.settings.chatOpacity)
const avatarSize = ref(settingsStore.settings.avatarSize)

// 模型编辑
const showModelDialog = ref(false)
const editingModelId = ref<string | null>(null)
const modelForm = reactive({
  name: '',
  apiUrl: '',
  apiKey: '',
  params: ''
})

// 模板编辑
const showTemplateDialog = ref(false)
const editingTemplateId = ref<string | null>(null)
const templateError = ref('')
const templateForm = reactive({
  name: '',
  template: '',
  agentIds: [] as string[],
  prompts: [] as PromptItem[]
})

// 提示词编辑（在模板内）
const showPromptDialog = ref(false)
const editingPromptId = ref<string | null>(null)
const promptForm = reactive({
  name: '',
  content: '',
  role: 'system' as MessageRole
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

// 模板相关方法
const addTemplate = () => {
  editingTemplateId.value = null
  templateForm.name = ''
  templateForm.template = getDefaultTemplate()
  templateForm.agentIds = []
  templateForm.prompts = []
  templateError.value = ''
  showTemplateDialog.value = true
}

const editTemplate = (template: PromptTemplate) => {
  editingTemplateId.value = template.id
  templateForm.name = template.name
  templateForm.template = template.template
  templateForm.agentIds = [...template.agentIds]
  templateForm.prompts = [...template.prompts]
  templateError.value = ''
  showTemplateDialog.value = true
}

const saveTemplate = () => {
  if (!templateForm.name.trim()) {
    return
  }

  // 验证模板
  const validation = validateTemplate(templateForm.template, templateForm.prompts)
  if (!validation.valid) {
    templateError.value = validation.error || '模板格式错误'
    return
  }
  templateError.value = ''

  if (editingTemplateId.value) {
    promptStore.updateTemplate(editingTemplateId.value, {
      name: templateForm.name,
      template: templateForm.template,
      agentIds: templateForm.agentIds,
      prompts: templateForm.prompts
    })
  } else {
    promptStore.createTemplate({
      name: templateForm.name,
      template: templateForm.template,
      agentIds: templateForm.agentIds,
      prompts: templateForm.prompts
    })
  }

  showTemplateDialog.value = false
}

const deleteTemplate = (id: string) => {
  promptStore.deleteTemplate(id)
}

// 模板内提示词相关方法
const addPromptToCurrentTemplate = () => {
  editingPromptId.value = null
  promptForm.name = ''
  promptForm.content = ''
  promptForm.role = 'system'
  showPromptDialog.value = true
}

const editPromptInTemplate = (prompt: PromptItem) => {
  editingPromptId.value = prompt.id
  promptForm.name = prompt.name
  promptForm.content = prompt.content
  promptForm.role = prompt.role
  showPromptDialog.value = true
}

const savePromptToTemplate = () => {
  if (!promptForm.name.trim() || !promptForm.content.trim()) {
    return
  }

  if (editingPromptId.value) {
    // 更新现有提示词
    const index = templateForm.prompts.findIndex(p => p.id === editingPromptId.value)
    if (index !== -1) {
      const existing = templateForm.prompts[index]!
      templateForm.prompts[index] = {
        id: existing.id,
        name: promptForm.name,
        content: promptForm.content,
        role: promptForm.role,
        createdAt: existing.createdAt,
        updatedAt: Date.now()
      }
    }
  } else {
    // 添加新提示词
    const newPrompt: PromptItem = {
      id: Date.now().toString(),
      name: promptForm.name,
      content: promptForm.content,
      role: promptForm.role,
      createdAt: Date.now(),
      updatedAt: Date.now()
    }
    templateForm.prompts.push(newPrompt)
  }

  showPromptDialog.value = false
}

const deletePromptFromCurrentTemplate = (promptId: string) => {
  const index = templateForm.prompts.findIndex(p => p.id === promptId)
  if (index !== -1) {
    templateForm.prompts.splice(index, 1)
  }
}

const saveSettings = () => {
  settingsStore.updateBackground({
    type: bgType.value,
    value: bgType.value === 'color' ? bgColor.value : bgImageUrl.value,
    opacity: bgOpacity.value
  })
  settingsStore.updateChatOpacity(chatOpacity.value)
  settingsStore.updateAvatarSize(avatarSize.value)
}

const resetSettings = () => {
  settingsStore.resetSettings()
  bgType.value = settingsStore.settings.background.type
  bgColor.value = settingsStore.settings.background.value
  bgImageUrl.value = settingsStore.settings.background.value
  bgOpacity.value = settingsStore.settings.background.opacity
  chatOpacity.value = settingsStore.settings.chatOpacity
  avatarSize.value = settingsStore.settings.avatarSize
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

const getAgentNameById = (agentId: string) => {
  const agent = agentStore.getAgentById(agentId)
  return agent?.name || '未知智能体'
}
</script>

<style scoped>
.settings-tabs {
  height: 100%;
}

.settings-tabs :deep(.el-tab-pane) {
  height: calc(100vh - 120px);
  overflow-y: auto;
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
.template-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.model-card,
.template-card {
  border-radius: 12px;
  transition: all 0.3s ease;
}

.model-card.active {
  border: 2px solid #ff85a2;
}

.model-card-header,
.template-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.model-name,
.template-name {
  font-size: 15px;
  font-weight: 500;
  color: #333;
}

.model-actions,
.template-actions {
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

.template-agents {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-bottom: 8px;
}

.agent-tag {
  margin-right: 4px;
}

.template-content {
  font-size: 12px;
  color: #888;
  margin-bottom: 4px;
  font-family: monospace;
}

.template-prompts-count {
  font-size: 12px;
  color: #999;
}

.empty-templates {
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
}

.help-tip {
  margin-top: 12px;
  padding: 8px 12px;
  background: #f0f9ff;
  border-radius: 6px;
  color: #666;
}

/* 提示词部分样式 */
.prompts-section {
  margin-top: 16px;
}

.prompt-items-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-height: 300px;
  overflow-y: auto;
}

.prompt-item-card {
  border-radius: 8px;
}

.prompt-item-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.prompt-item-name {
  font-size: 14px;
  font-weight: 500;
  color: #333;
}

.prompt-item-actions {
  display: flex;
  gap: 8px;
}

.prompt-item-content {
  font-size: 13px;
  color: #666;
  line-height: 1.5;
  white-space: pre-wrap;
}

.empty-prompts {
  text-align: center;
  padding: 24px;
  color: #999;
  font-size: 13px;
}
</style>
