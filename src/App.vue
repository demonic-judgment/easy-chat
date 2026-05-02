<template>
  <div class="app-container" :style="backgroundStyle">
    <RouterView />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { RouterView } from 'vue-router'
import { useSettingsStore } from '@/stores'

const settingsStore = useSettingsStore()

const backgroundStyle = computed(() => {
  const { type, value, opacity } = settingsStore.settings.background
  if (type === 'image') {
    return {
      backgroundImage: `url(${value})`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backgroundRepeat: 'no-repeat',
      backgroundAttachment: 'fixed'
    }
  }
  return {
    backgroundColor: value
  }
})
</script>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html, body {
  height: 100%;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
}

.app-container {
  min-height: 100vh;
  width: 100%;
}

/* Element Plus 主题色覆盖 */
:root {
  --el-color-primary: #ff85a2;
  --el-color-primary-light-3: #ffa8c2;
  --el-color-primary-light-5: #ffc4d6;
  --el-color-primary-light-7: #ffe0eb;
  --el-color-primary-light-8: #ffeff5;
  --el-color-primary-light-9: #fff5f8;
  --el-color-primary-dark-2: #e66b8a;
}

/* 全局滚动条样式 */
::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

::-webkit-scrollbar-track {
  background: transparent;
}

::-webkit-scrollbar-thumb {
  background: rgba(255, 133, 162, 0.3);
  border-radius: 4px;
}

::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 133, 162, 0.5);
}

/* 选中文字样式 */
::selection {
  background: rgba(255, 133, 162, 0.3);
  color: inherit;
}
</style>
