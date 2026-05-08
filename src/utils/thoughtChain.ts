export interface ThoughtChain {
  reasoning: string
  content: string
  hasReasoning: boolean
}

const THINK_TAGS = [
  { open: '<think>', close: '</think>', name: 'think' },
  { open: '<thinking>', close: '</thinking>', name: 'thinking' },
  { open: '<think>', close: '</think>', name: 'claude' },
  { open: '<reasoning>', close: '</reasoning>', name: 'reasoning' },
  { open: '<analysis>', close: '</analysis>', name: 'analysis' }
]

const REASONING_PATTERNS = [
  /^(?:让我想想|让我思考|思考过程| Reasoning | Thoughts?:?\s*)\n?/im,
  /^(?:首先|第一步|首先，)/m,
  /^(?:因此|所以|综上所述)/m
]

export function parseThoughtChain(content: string): ThoughtChain {
  if (!content || typeof content !== 'string') {
    return { reasoning: '', content: '', hasReasoning: false }
  }

  for (const tag of THINK_TAGS) {
    const openIndex = content.indexOf(tag.open)
    const closeIndex = content.indexOf(tag.close)

    if (openIndex !== -1 && closeIndex !== -1 && closeIndex > openIndex) {
      const reasoning = content.slice(
        openIndex + tag.open.length,
        closeIndex
      ).trim()

      let remainingContent = content.slice(0, openIndex).trim()
      if (remainingContent) {
        remainingContent += '\n' + content.slice(closeIndex + tag.close.length).trim()
      } else {
        remainingContent = content.slice(closeIndex + tag.close.length).trim()
      }

      if (reasoning) {
        return {
          reasoning,
          content: remainingContent,
          hasReasoning: true
        }
      }
    }
  }

  const lines = content.split('\n')
  const reasoningLines: string[] = []
  const contentLines: string[] = []
  let inReasoningBlock = false
  let reasoningStartFound = false

  for (const line of lines) {
    const trimmedLine = line.trim()

    const reasoningStartPattern = /^(?:让我想想|让我思考|思考过程|Reasoning|Thoughts?|分析过程|推理过程|我来分析)/i
    const reasoningEndPattern = /^(?:所以|因此|综上所述|总结|结论|最终|综上所述，)/i

    if (!reasoningStartFound && reasoningStartPattern.test(trimmedLine)) {
      inReasoningBlock = true
      reasoningStartFound = true
      reasoningLines.push(trimmedLine.replace(reasoningStartPattern, '').trim())
      continue
    }

    if (inReasoningBlock && reasoningEndPattern.test(trimmedLine)) {
      inReasoningBlock = false
      contentLines.push(trimmedLine)
      continue
    }

    if (inReasoningBlock) {
      if (trimmedLine.startsWith(' ') || trimmedLine.startsWith('\t') || /^\d+[.、]/.test(trimmedLine)) {
        reasoningLines.push(trimmedLine)
      } else if (reasoningLines.length > 0 && reasoningLines[reasoningLines.length - 1]) {
        inReasoningBlock = false
        contentLines.push(trimmedLine)
      } else {
        contentLines.push(trimmedLine)
      }
    } else {
      contentLines.push(trimmedLine)
    }
  }

  const reasoning = reasoningLines.join('\n').trim()
  const finalContent = contentLines.join('\n').trim()

  if (reasoning && reasoning.length > 10) {
    return {
      reasoning,
      content: finalContent,
      hasReasoning: true
    }
  }

  return {
    reasoning: '',
    content: content,
    hasReasoning: false
  }
}

export function hasThoughtChain(content: string): boolean {
  if (!content || typeof content !== 'string') {
    return false
  }

  for (const tag of THINK_TAGS) {
    if (content.includes(tag.open) && content.includes(tag.close)) {
      return true
    }
  }

  const reasoningIndicators = [
    '让我想想',
    '让我思考',
    '思考过程',
    'Reasoning',
    'Thoughts?',
    '分析过程',
    '推理过程',
    '我来分析',
    '首先，',
    '因此，'
  ]

  for (const indicator of reasoningIndicators) {
    if (content.toLowerCase().includes(indicator.toLowerCase())) {
      const index = content.toLowerCase().indexOf(indicator.toLowerCase())
      const context = content.slice(Math.max(0, index - 50), index + indicator.length + 100)
      if (context.split('\n').length >= 3 || context.length > 150) {
        return true
      }
    }
  }

  return false
}
