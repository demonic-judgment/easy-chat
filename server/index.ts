import type { ModelParams } from "../src/types";

interface ChatMessage {
  role: string;
  content: string;
}

interface ChatRequest {
  apiUrl: string;
  apiKey: string;
  messages: ChatMessage[];
  params: ModelParams;
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

// SSE 格式的事件数据
interface StreamEvent {
  content?: string;
  done?: boolean;
  error?: string;
  meta?: Record<string, any>;
}

export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    // 处理 CORS
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

    // API 路由
    if (url.pathname.startsWith("/api/")) {
      const corsHeaders = {
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "application/json",
      };

      // 聊天接口
      if (url.pathname === "/api/chat" && request.method === "POST") {
        try {
          const body = (await request.json()) as ChatRequest;
          const { apiUrl, apiKey, messages, params, stream } = body;

          if (!apiUrl || !apiKey) {
            const response: ChatResponse = {
              success: false,
              error: "缺少 API 地址或密钥",
            };
            return new Response(JSON.stringify(response), {
              status: 400,
              headers: corsHeaders,
            });
          }

          // 如果请求流式响应
          if (stream) {
            return handleStreamRequest(apiUrl, apiKey, messages, params);
          }

          // 非流式请求
          return handleNonStreamRequest(apiUrl, apiKey, messages, params);
        } catch (error) {
          const response: ChatResponse = {
            success: false,
            error:
              error instanceof Error ? error.message : "处理请求时发生错误",
          };
          return new Response(JSON.stringify(response), {
            status: 500,
            headers: corsHeaders,
          });
        }
      }

      // 测试接口
      if (url.pathname === "/api/test") {
        return new Response(
          JSON.stringify({
            success: true,
            message: "API 服务正常运行",
            timestamp: new Date().toISOString(),
          }),
          { headers: corsHeaders }
        );
      }

      // 404
      return new Response(
        JSON.stringify({
          success: false,
          error: "未找到该接口",
        }),
        { status: 404, headers: corsHeaders }
      );
    }

    // 静态资源请求，返回 404 让 assets handler 处理
    return new Response(null, { status: 404 });
  },
} satisfies ExportedHandler<Env>;

/**
 * 处理非流式请求
 */
async function handleNonStreamRequest(
  apiUrl: string,
  apiKey: string,
  messages: ChatMessage[],
  params: ModelParams
): Promise<Response> {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Content-Type": "application/json",
  };

  // 构建请求体
  const requestBody: Record<string, any> = {
    messages,
    ...params,
  };

  // 调用模型 API
  const modelResponse = await fetch(apiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(requestBody),
  });

  if (!modelResponse.ok) {
    const errorText = await modelResponse.text();
    const response: ChatResponse = {
      success: false,
      error: `模型 API 错误: ${modelResponse.status} - ${errorText}`,
    };
    return new Response(JSON.stringify(response), {
      status: 500,
      headers: corsHeaders,
    });
  }

  // 解析模型响应
  const modelData = await modelResponse.json();
  const parsedResponse = parseModelResponse(modelData);

  const response: ChatResponse = {
    success: true,
    data: parsedResponse,
  };

  return new Response(JSON.stringify(response), {
    headers: corsHeaders,
  });
}

/**
 * 处理流式请求（SSE）
 */
async function handleStreamRequest(
  apiUrl: string,
  apiKey: string,
  messages: ChatMessage[],
  params: ModelParams
): Promise<Response> {
  // 构建请求体，添加 stream: true
  const requestBody: Record<string, any> = {
    messages,
    stream: true,
    ...params,
  };

  // 调用模型 API
  const modelResponse = await fetch(apiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(requestBody),
  });

  if (!modelResponse.ok) {
    const errorText = await modelResponse.text();
    const response: ChatResponse = {
      success: false,
      error: `模型 API 错误: ${modelResponse.status} - ${errorText}`,
    };
    return new Response(JSON.stringify(response), {
      status: 500,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "application/json",
      },
    });
  }

  // 创建 SSE 流
  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();
  const encoder = new TextEncoder();

  // 处理流式响应
  if (modelResponse.body) {
    const reader = modelResponse.body.getReader();
    const decoder = new TextDecoder();

    // 异步处理流
    (async () => {
      try {
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            const trimmedLine = line.trim();
            if (!trimmedLine || !trimmedLine.startsWith("data: ")) continue;

            const data = trimmedLine.slice(6); // 移除 "data: " 前缀

            // 处理流结束标记
            if (data === "[DONE]") {
              const event: StreamEvent = { done: true };
              await writer.write(
                encoder.encode(`data: ${JSON.stringify(event)}\n\n`)
              );
              continue;
            }

            try {
              const parsed = JSON.parse(data);
              const content = extractStreamContent(parsed);

              if (content !== null) {
                const event: StreamEvent = { content };
                await writer.write(
                  encoder.encode(`data: ${JSON.stringify(event)}\n\n`)
                );
              }

              // 检查是否完成
              const isDone = checkStreamComplete(parsed);
              if (isDone) {
                const meta = extractStreamMeta(parsed);
                const event: StreamEvent = { done: true, meta };
                await writer.write(
                  encoder.encode(`data: ${JSON.stringify(event)}\n\n`)
                );
              }
            } catch (e) {
              // 忽略解析错误
            }
          }
        }

        // 处理剩余缓冲区
        if (buffer.trim()) {
          const trimmedLine = buffer.trim();
          if (trimmedLine.startsWith("data: ")) {
            const data = trimmedLine.slice(6);
            if (data !== "[DONE]") {
              try {
                const parsed = JSON.parse(data);
                const content = extractStreamContent(parsed);
                if (content !== null) {
                  const event: StreamEvent = { content };
                  await writer.write(
                    encoder.encode(`data: ${JSON.stringify(event)}\n\n`)
                  );
                }
              } catch (e) {
                // 忽略解析错误
              }
            }
          }
        }
      } catch (error) {
        const event: StreamEvent = {
          error: error instanceof Error ? error.message : "流处理错误",
        };
        await writer.write(
          encoder.encode(`data: ${JSON.stringify(event)}\n\n`)
        );
      } finally {
        await writer.close();
      }
    })();
  }

  return new Response(readable, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

/**
 * 从流式响应中提取内容
 */
function extractStreamContent(data: any): string | null {
  // OpenAI 流式格式
  if (data.choices && Array.isArray(data.choices)) {
    const choice = data.choices[0];
    if (choice?.delta?.content) {
      return choice.delta.content;
    }
  }

  // Claude 流式格式
  if (data.type === "content_block_delta" && data.delta?.text) {
    return data.delta.text;
  }

  // 通用格式
  if (data.content) {
    return data.content;
  }
  if (data.text) {
    return data.text;
  }

  return null;
}

/**
 * 检查流式响应是否完成
 */
function checkStreamComplete(data: any): boolean {
  // OpenAI 格式
  if (data.choices?.[0]?.finish_reason) {
    return true;
  }

  // Claude 格式
  if (data.type === "message_stop") {
    return true;
  }

  // 通用格式
  if (data.done === true) {
    return true;
  }

  return false;
}

/**
 * 提取流式响应的元数据
 */
function extractStreamMeta(data: any): Record<string, any> | undefined {
  const meta: Record<string, any> = {};

  if (data.model) meta.model = data.model;
  if (data.usage) meta.usage = data.usage;
  if (data.choices?.[0]?.finish_reason) {
    meta.finishReason = data.choices[0].finish_reason;
  }

  return Object.keys(meta).length > 0 ? meta : undefined;
}

/**
 * 解析模型响应数据（非流式）
 * 支持多种模型格式：OpenAI、Claude、Gemini 等
 */
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
      // 流式响应格式
      return {
        content: choice.delta.content,
        meta: {
          model: data.model,
          finishReason: choice.finish_reason,
        },
      };
    }
    if (choice.text) {
      // 旧版 completion 格式
      return {
        content: choice.text,
        meta: {
          finishReason: choice.finish_reason,
        },
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
        meta: {
          finishReason: candidate.finishReason,
        },
      };
    }
  }

  // 通用文本字段
  if (data.text) {
    return { content: data.text };
  }
  if (data.content) {
    return { content: data.content };
  }
  if (data.response) {
    return { content: data.response };
  }
  if (data.output) {
    return { content: data.output };
  }
  if (data.result) {
    return { content: data.result };
  }

  // 如果无法解析，返回原始数据字符串
  return {
    content: JSON.stringify(data, null, 2),
    meta: { raw: true },
  };
}
