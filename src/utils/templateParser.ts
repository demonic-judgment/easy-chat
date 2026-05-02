import type { TemplateSegment, TemplateTag, ChatHistoryRange, Message, MessageRole, PromptItem } from '@/types'

/**
 * 解析模板字符串，提取标签和文本
 * 支持标签: *role_description*, *chat_history*, *chat_history[-1]*, *chat_history[0-5]*, *user_reply*, *自定义1*, *自定义2* 等
 */
export function parseTemplate(template: string): TemplateSegment[] {
  const segments: TemplateSegment[] = []
  // 匹配 *tag* 或 *tag[range]* 模式，支持中文标签如 *自定义1*
  const regex = /\*([^\*\s\[\]]+)(?:\[([^\]]*)\])?\*/g
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = regex.exec(template)) !== null) {
    // 添加标签前的文本
    if (match.index > lastIndex) {
      const text = template.slice(lastIndex, match.index).trim()
      if (text) {
        segments.push({ type: 'text', content: text })
      }
    }

    const tagName = match[1] as TemplateTag
    const rangeStr = match[2]

    const segment: TemplateSegment = {
      type: 'tag',
      content: match[0],
      tag: tagName
    }

    // 解析 chat_history 的范围
    if (tagName === 'chat_history' && rangeStr !== undefined) {
      segment.chatHistoryRange = parseChatHistoryRange(rangeStr)
    }

    segments.push(segment)
    lastIndex = regex.lastIndex
  }

  // 添加最后剩余的文本
  if (lastIndex < template.length) {
    const text = template.slice(lastIndex).trim()
    if (text) {
      segments.push({ type: 'text', content: text })
    }
  }

  return segments
}

/**
 * 解析 chat_history 的范围字符串
 * 支持: [-1], [0], [0-5], [2-], [-3--1]
 */
function parseChatHistoryRange(rangeStr: string): ChatHistoryRange {
  const trimmed = rangeStr.trim()

  // 检查是否是区间格式 (如 0-5, 2-, -3--1)
  const rangeMatch = trimmed.match(/^(-?\d+)\s*-\s*(-?\d+)?$/)
  if (rangeMatch && rangeMatch[1]) {
    const start = parseInt(rangeMatch[1], 10)
    const end = rangeMatch[2] !== undefined ? parseInt(rangeMatch[2], 10) : undefined
    return { start, end, isSingle: false }
  }

  // 单个索引
  const singleMatch = trimmed.match(/^(-?\d+)$/)
  if (singleMatch && singleMatch[1]) {
    const index = parseInt(singleMatch[1], 10)
    return { start: index, end: index, isSingle: true }
  }

  // 默认返回全部
  return { isSingle: false }
}

/**
 * 根据范围获取聊天记录
 */
function getChatHistoryByRange(
  messages: Message[],
  range?: ChatHistoryRange
): Message[] {
  if (!range || (range.start === undefined && range.end === undefined)) {
    return [...messages]
  }

  const length = messages.length
  let start = range.start ?? 0
  let end = range.end ?? length - 1

  // 处理负数索引
  if (start < 0) start = length + start
  if (end < 0) end = length + end

  // 确保索引在有效范围内
  start = Math.max(0, Math.min(start, length - 1))
  end = Math.max(0, Math.min(end, length - 1))

  // 确保 start <= end
  if (start > end) {
    [start, end] = [end, start]
  }

  return messages.slice(start, end + 1)
}

/**
 * 组装消息数组
 * @param template 模板字符串
 * @param roleDescription 角色描述
 * @param chatHistory 聊天记录
 * @param userReply 用户当前回复
 * @param availablePrompts 可用的提示词列表，用于解析 *自定义1* 等标签
 * @returns 组装后的消息数组
 */
export function assembleMessages(
  template: string,
  roleDescription: string,
  chatHistory: Message[],
  userReply: string,
  availablePrompts: PromptItem[] = []
): Array<{ role: MessageRole; content: string }> {
  const segments = parseTemplate(template)
  const result: Array<{ role: MessageRole; content: string }> = []

  for (const segment of segments) {
    if (segment.type === 'text') {
      // 文本段，作为 system 消息
      if (segment.content.trim()) {
        result.push({ role: 'system', content: segment.content })
      }
      continue
    }

    const tag = segment.tag

    switch (tag) {
      case 'role_description':
        if (roleDescription.trim()) {
          result.push({ role: 'system', content: roleDescription })
        }
        break

      case 'chat_history':
        const historyMessages = getChatHistoryByRange(chatHistory, segment.chatHistoryRange)
        for (const msg of historyMessages) {
          result.push({ role: msg.role, content: msg.content })
        }
        break

      case 'user_reply':
        if (userReply.trim()) {
          result.push({ role: 'user', content: userReply })
        }
        break

      default:
        // 尝试匹配提示词名称，如 *自定义1*、*自定义2*
        const matchedPrompt = availablePrompts.find(p => p.name === tag)
        if (matchedPrompt && matchedPrompt.content.trim()) {
          result.push({ role: matchedPrompt.role, content: matchedPrompt.content })
        }
        break
    }
  }

  // 合并连续相同角色的消息
  return mergeConsecutiveMessages(result)
}

/**
 * 合并连续相同角色的消息
 */
function mergeConsecutiveMessages(
  messages: Array<{ role: MessageRole; content: string }>
): Array<{ role: MessageRole; content: string }> {
  if (messages.length === 0) return []

  const result: Array<{ role: MessageRole; content: string }> = []
  let current: { role: MessageRole; content: string } = messages[0]!

  for (let i = 1; i < messages.length; i++) {
    const next = messages[i]!
    if (next.role === current.role) {
      // 合并消息内容
      current.content += '\n\n' + next.content
    } else {
      result.push(current)
      current = next
    }
  }
  result.push(current)

  return result
}

/**
 * 获取默认模板
 */
export function getDefaultTemplate(): string {
  return '*role_description*\n\n*chat_history*\n\n*user_reply*'
}

/**
 * 验证模板是否有效
 * @param template 模板字符串
 * @param availablePrompts 可用的提示词列表，用于验证自定义标签
 */
export function validateTemplate(
  template: string,
  availablePrompts: PromptItem[] = []
): { valid: boolean; error?: string } {
  try {
    const segments = parseTemplate(template)

    // 检查是否有至少一个标签
    const hasTag = segments.some(s => s.type === 'tag')
    if (!hasTag) {
      return { valid: false, error: '模板中至少需要包含一个标签' }
    }

    // 检查标签是否有效（内置标签或自定义提示词名称）
    const validTags: TemplateTag[] = ['role_description', 'chat_history', 'user_reply', 'custom']
    const promptNames = availablePrompts.map(p => p.name)
    const allValidTags = [...validTags, ...promptNames]

    for (const segment of segments) {
      if (segment.type === 'tag' && segment.tag) {
        // 允许任何标签（支持自定义提示词名称如 *自定义1*）
        // 只检查是否是已知内置标签或自定义提示词名称
        if (!allValidTags.includes(segment.tag)) {
          // 如果是未知标签，给出警告但不阻止保存
          // 因为可能是引用其他提示词，在运行时才能确定
        }
      }
    }

    return { valid: true }
  } catch (error) {
    return { valid: false, error: '模板解析错误' }
  }
}
