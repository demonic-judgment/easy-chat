import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { AppSettings, BackgroundSettings } from '@/types'

const defaultSettings: AppSettings = {
  background: {
    type: 'color',
    value: '#ffeef5',
    opacity: 1
  },
  chatOpacity: 0.95,
  avatarSize: 36
}

export const useSettingsStore = defineStore('settings', () => {
  // State
  const settings = ref<AppSettings>({ ...defaultSettings })

  // Getters
  const backgroundStyle = () => {
    const { type, value, opacity } = settings.value.background
    if (type === 'image') {
      return {
        backgroundImage: `url(${value})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        opacity
      }
    }
    return {
      backgroundColor: value,
      opacity
    }
  }

  // Actions
  const loadSettings = () => {
    const stored = localStorage.getItem('easy-chat-settings')
    if (stored) {
      settings.value = { ...defaultSettings, ...JSON.parse(stored) }
    }
  }

  const saveSettings = () => {
    localStorage.setItem('easy-chat-settings', JSON.stringify(settings.value))
  }

  const updateBackground = (background: Partial<BackgroundSettings>) => {
    settings.value.background = {
      ...settings.value.background,
      ...background
    }
    saveSettings()
  }

  const updateChatOpacity = (opacity: number) => {
    settings.value.chatOpacity = opacity
    saveSettings()
  }

  const updateAvatarSize = (size: number) => {
    settings.value.avatarSize = size
    saveSettings()
  }

  const resetSettings = () => {
    settings.value = { ...defaultSettings }
    saveSettings()
  }

  // 初始化时加载数据
  loadSettings()

  return {
    settings,
    backgroundStyle,
    loadSettings,
    saveSettings,
    updateBackground,
    updateChatOpacity,
    updateAvatarSize,
    resetSettings
  }
})
