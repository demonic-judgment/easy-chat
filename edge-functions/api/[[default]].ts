/**
 * EdgeOne Makers Edge Functions 入口
 *
 * 文件路由：edge-functions/api/[[default]].ts -> /api/*
 * 业务逻辑与 Cloudflare 版 server/index.ts 保持一致，双平台共存期间两份代码
 * 相互独立，避免改动影响现有 workers.dev 部署；迁移稳定后可把公共部分抽到
 * server/core.ts 复用。
 *
 * 与 Cloudflare 版的差异：
 * 1. 入口从 `export default { fetch }` 改为 onRequest(context)，同时提供
 *    命名导出与 default 导出以兼容不同版本的 Makers 构建器；
 * 2. 上游 fetch 通过 eo.timeoutSetting 放宽读超时（默认 15s 会截断 SSE 长流）；
 * 3. 用 context.waitUntil 显式声明流式后台任务的生命周期；
 * 4. 去掉 setTimeout 批量 flush，改为逐事件写入，避免依赖边缘运行时的 Timer API；
 * 5. 边缘 V8 运行时没有 Response.json()，统一用 new Response(JSON.stringify(...))。
 */

interface ChatMessage {
  role: string;
  content: unknown;
}

interface ChatRequest {
  apiUrl: string;
  apiKey: string;
  messages: ChatMessage[];
  params: Record<string, unknown>;
  stream?: boolean;
}

interface ChatResponse {
  success: boolean;
  data?: {
    content: string;
    meta?: Record<string, any>;
  };
  error?: string;
}

interface StreamEvent {
  content?: string;
  done?: boolean;
  error?: string;
  meta?: Record<string, any>;
}

/** 自包含声明，不依赖 Cloudflare 的 worker-configuration.d.ts；env 为 Makers 控制台环境变量 */
interface EventContext {
  request: Request;
  params: Record<string, string>;
  env: Record<string, string>;
  waitUntil?: (task: Promise<unknown>) => void;
}

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Content-Type": "application/json",
};

/**
 * EdgeOne 边缘运行时 fetch 的 readTimeout 默认 15s，最大 300s。
 * SSE 长回复必须放宽，否则会在中途被断开。
 */
function fetchUpstream(
  apiUrl: string,
  requestBody: Record<string, any>,
  apiKey: string
): Promise<Response> {
  return fetch(apiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(requestBody),
    eo: {
      timeoutSetting: {
        connectTimeout: 10000,
        readTimeout: 300000,
        writeTimeout: 300000,
      },
    },
  } as RequestInit);
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: CORS_HEADERS });
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

/**
 * onRequest 覆盖全部 HTTP 方法（含 OPTIONS 预检）。
 * 若改用 onRequestPost，需额外导出 onRequestOptions 处理预检。
 */
export async function onRequest(context: EventContext): Promise<Response> {
  const { request } = context;
  const url = new URL(request.url);

  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    });
  }

  // 文件路由已把本函数限定在 /api/*，此处保留判断便于与 Cloudflare 版对照
  if (!url.pathname.startsWith("/api/")) {
    return new Response(null, { status: 404 });
  }

  if (url.pathname === "/api/chat" && request.method === "POST") {
    try {
      const body = (await request.json()) as ChatRequest;
      const { apiUrl, apiKey, messages, params, stream } = body;

      if (!apiUrl || !apiKey) {
        const response: ChatResponse = {
          success: false,
          error: "缺少 API 地址或密钥",
        };
        return json(response, 400);
      }

      return stream
        ? await handleStreamRequest(context, apiUrl, apiKey, messages, params)
        : await handleNonStreamRequest(apiUrl, apiKey, messages, params);
    } catch (error) {
      const response: ChatResponse = {
        success: false,
        error: errorMessage(error, "处理请求时发生错误"),
      };
      return json(response, 500);
    }
  }

  if (url.pathname === "/api/test") {
    return json({
      success: true,
      message: "API 服务正常运行",
      timestamp: new Date().toISOString(),
    });
  }

  return json({ success: false, error: "未找到该接口" } as ChatResponse, 404);
}

// Makers 快速开始示例用 default 导出，Function Handlers 文档用命名导出，两者都提供
export default onRequest;

/** 处理非流式请求 */
async function handleNonStreamRequest(
  apiUrl: string,
  apiKey: string,
  messages: ChatMessage[],
  params: Record<string, unknown>
): Promise<Response> {
  const requestBody: Record<string, any> = { messages, ...params };

  const modelResponse = await fetchUpstream(apiUrl, requestBody, apiKey);

  if (!modelResponse.ok) {
    const errorText = await modelResponse.text();
    const response: ChatResponse = {
      success: false,
      error: `模型 API 错误: ${modelResponse.status} - ${errorText}`,
    };
    return json(response, 500);
  }

  const modelData = await modelResponse.json();
  const response: ChatResponse = {
    success: true,
    data: parseModelResponse(modelData),
  };
  return json(response);
}

/** 处理流式请求（SSE） */
async function handleStreamRequest(
  context: EventContext,
  apiUrl: string,
  apiKey: string,
  messages: ChatMessage[],
  params: Record<string, unknown>
): Promise<Response> {
  const requestBody: Record<string, any> = { messages, stream: true, ...params };

  const modelResponse = await fetchUpstream(apiUrl, requestBody, apiKey);

  if (!modelResponse.ok) {
    const errorText = await modelResponse.text();
    const response: ChatResponse = {
      success: false,
      error: `模型 API 错误: ${modelResponse.status} - ${errorText}`,
    };
    return json(response, 500);
  }

  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();
  const encoder = new TextEncoder();

  const send = async (event: StreamEvent) => {
    await writer.write(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
  };

  const task = (async () => {
    let accumulatedMeta: Record<string, any> | undefined;
    let hasSentDone = false;

    const processLine = async (line: string) => {
      const trimmedLine = line.trim();
      if (!trimmedLine || !trimmedLine.startsWith("data: ")) return;

      const data = trimmedLine.slice(6);

      if (data === "[DONE]") {
        if (!hasSentDone) {
          await send({ done: true, meta: accumulatedMeta });
          hasSentDone = true;
        }
        return;
      }

      try {
        const parsed = JSON.parse(data);
        const content = extractStreamContent(parsed);
        if (content !== null) await send({ content });

        const meta = extractStreamMeta(parsed);
        if (meta) accumulatedMeta = { ...accumulatedMeta, ...meta };

        if (checkStreamComplete(parsed) && !hasSentDone) {
          await send({ done: true, meta: accumulatedMeta });
          hasSentDone = true;
        }
      } catch {
        // 忽略单行解析错误，继续处理后续事件
      }
    };

    try {
      if (!modelResponse.body) {
        await send({ done: true });
        return;
      }

      const reader = modelResponse.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) await processLine(line);
      }

      if (buffer.trim()) await processLine(buffer);
      if (!hasSentDone) await send({ done: true, meta: accumulatedMeta });
    } catch (error) {
      try {
        await send({ error: errorMessage(error, "流处理错误") });
      } catch {
        // 客户端已断开，忽略
      }
    } finally {
      try {
        await writer.close();
      } catch {
        // 流已关闭，忽略
      }
    }
  })();

  // Cloudflare 靠响应流保活；EdgeOne 需要显式声明后台任务生命周期，
  // 否则函数实例可能在流写完之前被回收。
  context.waitUntil?.(task);

  return new Response(readable, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

/** 从流式响应中提取内容 */
function extractStreamContent(data: any): string | null {
  // OpenAI 流式格式
  if (data.choices && Array.isArray(data.choices)) {
    const choice = data.choices[0];
    if (choice?.delta?.content) return choice.delta.content;
  }

  // Claude 流式格式
  if (data.type === "content_block_delta" && data.delta?.text) {
    return data.delta.text;
  }

  // 通用格式
  if (data.content) return data.content;
  if (data.text) return data.text;

  return null;
}

/** 检查流式响应是否完成 */
function checkStreamComplete(data: any): boolean {
  if (data.choices?.[0]?.finish_reason) return true;
  if (data.type === "message_stop") return true;
  if (data.done === true) return true;
  return false;
}

/** 提取流式响应的元数据 */
function extractStreamMeta(data: any): Record<string, any> | undefined {
  const meta: Record<string, any> = {};

  if (data.model) meta.model = data.model;
  if (data.usage) meta.usage = data.usage;
  if (data.choices?.[0]?.finish_reason) {
    meta.finishReason = data.choices[0].finish_reason;
  }

  return Object.keys(meta).length > 0 ? meta : undefined;
}

/** 解析模型响应数据（非流式）：OpenAI、Claude、Gemini 等 */
function parseModelResponse(data: any): {
  content: string;
  meta?: Record<string, any>;
} {
  // OpenAI 格式
  if (data.choices && Array.isArray(data.choices)) {
    const choice = data.choices[0];
    if (choice.message && choice.message.content) {
      return {
        content: choice.message.content,
        meta: {
          model: data.model,
          usage: data.usage,
          finishReason: choice.finish_reason,
        },
      };
    }
    if (choice.delta && choice.delta.content) {
      return {
        content: choice.delta.content,
        meta: { model: data.model, finishReason: choice.finish_reason },
      };
    }
    if (choice.text) {
      return {
        content: choice.text,
        meta: { finishReason: choice.finish_reason },
      };
    }
  }

  // Claude 格式
  if (data.content && Array.isArray(data.content)) {
    const textContent = data.content
      .filter((item: any) => item.type === "text")
      .map((item: any) => item.text)
      .join("");
    return {
      content: textContent,
      meta: {
        model: data.model,
        usage: data.usage,
        stopReason: data.stop_reason,
      },
    };
  }

  // Gemini 格式
  if (data.candidates && Array.isArray(data.candidates)) {
    const candidate = data.candidates[0];
    if (candidate.content && candidate.content.parts) {
      const text = candidate.content.parts
        .filter((part: any) => part.text)
        .map((part: any) => part.text)
        .join("");
      return {
        content: text,
        meta: { finishReason: candidate.finishReason },
      };
    }
  }

  // 通用文本字段
  if (data.text) return { content: data.text };
  if (data.content) return { content: data.content };
  if (data.response) return { content: data.response };
  if (data.output) return { content: data.output };
  if (data.result) return { content: data.result };

  return { content: JSON.stringify(data, null, 2), meta: { raw: true } };
}
