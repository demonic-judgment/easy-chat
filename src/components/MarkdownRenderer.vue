<template>
  <div class="markdown-body" v-html="renderedContent"></div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { marked } from 'marked'
import hljs from 'highlight.js'
import 'highlight.js/styles/github.css'

const props = defineProps<{
  content: string
}>()

marked.use({
  gfm: true,
  breaks: true,
  renderer: {
    code({ text, lang }: { text: string; lang?: string }) {
      const language = lang || 'plaintext'
      const highlighted = language !== 'plaintext'
        ? hljs.highlight(text, { language }).value
        : hljs.highlightAuto(text).value
      return `<pre><code class="hljs language-${language}">${highlighted}</code></pre>`
    }
  }
})

const renderedContent = computed(() => {
  return marked.parse(props.content || '')
})
</script>

<style scoped>
.markdown-body {
  font-size: 14px;
  line-height: 1.6;
  color: inherit;
}

.markdown-body :deep(h1),
.markdown-body :deep(h2),
.markdown-body :deep(h3),
.markdown-body :deep(h4),
.markdown-body :deep(h5),
.markdown-body :deep(h6) {
  margin-top: 16px;
  margin-bottom: 8px;
  font-weight: 600;
  line-height: 1.25;
}

.markdown-body :deep(p) {
  margin-top: 0;
  margin-bottom: 12px;
}

.markdown-body :deep(ol) {
  margin-top: 0;
  margin-bottom: 12px;
  padding-left: 24px;
}

.markdown-body :deep(li) {
  margin-bottom: 4px;
}

.markdown-body :deep(code) {
  background-color: rgba(0, 0, 0, 0.05);
  padding: 2px 6px;
  border-radius: 4px;
  font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
  font-size: 85%;
}

.markdown-body :deep(pre) {
  background-color: #f6f8fa;
  padding: 16px;
  border-radius: 8px;
  overflow-x: visible;
  white-space: pre-wrap;
  word-wrap: break-word;
  margin-bottom: 12px;
}

.markdown-body :deep(pre code) {
  background-color: transparent;
  padding: 0;
  border-radius: 0;
  font-size: 100%;
}

.markdown-body :deep(blockquote) {
  margin: 0 0 12px;
  padding: 0 16px;
  color: #6a737d;
  border-left: 4px solid #dfe2e5;
}

.markdown-body :deep(table) {
  border-collapse: collapse;
  width: 100%;
  margin-bottom: 12px;
}

.markdown-body :deep(th),
.markdown-body :deep(td) {
  border: 1px solid #dfe2e5;
  padding: 8px 12px;
  text-align: left;
}

.markdown-body :deep(th) {
  background-color: #f6f8fa;
  font-weight: 600;
}

.markdown-body :deep(a) {
  color: #ff85a2;
  text-decoration: none;
}

.markdown-body :deep(a:hover) {
  text-decoration: underline;
}

.markdown-body :deep(hr) {
  border: none;
  border-top: 1px solid #e1e4e8;
  margin: 16px 0;
}

/* 加粗 - 使用温暖的珊瑚色 */
.markdown-body :deep(strong),
.markdown-body :deep(b) {
  font-weight: 600;
  color: #e85a71;
}

/* 斜体 - 使用暗橙黄色 */
.markdown-body :deep(em),
.markdown-body :deep(i) {
  font-style: italic;
  color: #cc8400;
}

/* 列表项标记 - 使用清新的青绿色 */
.markdown-body :deep(ul) {
  list-style: none;
  padding-left: 20px;
}

.markdown-body :deep(ul li) {
  position: relative;
  padding-left: 16px;
}

.markdown-body :deep(ul li::before) {
  content: "•";
  position: absolute;
  left: 0;
  color: #4ecdc4;
  font-weight: bold;
  font-size: 1.2em;
  line-height: 1.2;
}

.markdown-body :deep(ol li::marker) {
  color: #4ecdc4;
  font-weight: 600;
}

/* 删除线 */
.markdown-body :deep(del),
.markdown-body :deep(s) {
  text-decoration: line-through;
}

/* 图片 */
.markdown-body :deep(img) {
  max-width: 100%;
  height: auto;
  border-radius: 8px;
  margin: 8px 0;
}

/* 任务列表 */
.markdown-body :deep(input[type="checkbox"]) {
  margin-right: 8px;
  cursor: default;
}

.markdown-body :deep(li:has(input[type="checkbox"])) {
  list-style: none;
  margin-left: -20px;
}

/* 代码高亮 */
.markdown-body :deep(.hljs) {
  background: transparent;
  padding: 0;
}
</style>
