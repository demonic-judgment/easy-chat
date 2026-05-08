import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { AppSettings, BackgroundSettings } from '@/types'
import { toStorable } from '@/utils/storable'
import { db } from '@/db'

const defaultSettings: AppSettings = {
  background: {
    type: 'color',
    value: '#ffeef5',
    opacity: 1
  },
  chatOpacity: 0.95
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
  const loadSettings = async () => {
    const record = await db.settings.get('app-settings')
    if (record) {
      settings.value = { ...defaultSettings, ...record.value }
    }
  }

  const saveSettings = async () => {
    await db.settings.put({ id: 'app-settings', value: toStorable(settings.value) })
  }

  const updateBackground = async (background: Partial<BackgroundSettings>) => {
    settings.value.background = {
      ...settings.value.background,
      ...background
    }
    await saveSettings()
  }

  const updateChatOpacity = async (opacity: number) => {
    settings.value.chatOpacity = opacity
    await saveSettings()
  }

  const resetSettings = async () => {
    settings.value = { ...defaultSettings }
    await saveSettings()
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
    resetSettings
  }
})
