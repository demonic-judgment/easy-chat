export { useAgentStore } from './agent'
export { useChatStore } from './chat'
export { useMessageStore } from './message'
export { usePromptStore } from './prompt'
export { useModelStore } from './model'
export { useSettingsStore } from './settings'
import { useFloatingMediaStore } from './floatingMedia'
export { useFloatingMediaStore }
// 向后兼容：保留旧名称
export const useFloatingImageStore = useFloatingMediaStore
