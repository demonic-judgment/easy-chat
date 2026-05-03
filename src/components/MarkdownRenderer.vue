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
  breaks: true
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

.markdown-body :deep(ul),
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
</style>
