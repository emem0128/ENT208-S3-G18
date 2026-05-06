export type MiniMaxMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

const MINIMAX_MODEL = 'qwen/qwen3.5-397b-a17b';
const MINIMAX_ENDPOINT = '/api/nvidia/chat/completions';

function getMiniMaxApiKey() {
  return import.meta.env.VITE_NVIDIA_API_KEY?.trim();
}

export function hasMiniMaxApiKey() {
  return Boolean(getMiniMaxApiKey());
}

async function parseMiniMaxError(response: Response) {
  let errorMessage = `模型请求失败：HTTP ${response.status}`;

  try {
    const errorData = await response.json();
    const detail =
      typeof errorData?.error?.message === 'string'
        ? errorData.error.message
        : typeof errorData?.message === 'string'
          ? errorData.message
          : '';

    if (detail) {
      errorMessage = `${errorMessage}，${detail}`;
    }
  } catch {
    // Ignore JSON parse errors and keep the HTTP-level message.
  }

  return errorMessage;
}

export async function chatWithMiniMax(messages: MiniMaxMessage[]) {
  const apiKey = getMiniMaxApiKey();

  if (!apiKey) {
    throw new Error('未配置 NVIDIA API Key，请先在环境变量中设置 VITE_NVIDIA_API_KEY。');
  }

  const response = await fetch(MINIMAX_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: MINIMAX_MODEL,
      messages,
      temperature: 0.3,
    }),
  });

  if (!response.ok) {
    throw new Error(await parseMiniMaxError(response));
  }

  const data = (await response.json()) as {
    choices?: Array<{
      message?: {
        content?: string;
      };
    }>;
  };

  const content = data.choices?.[0]?.message?.content;
  return typeof content === 'string' ? content.trim() : '';
}

export async function chatWithMiniMaxStream(
  messages: MiniMaxMessage[],
  onChunk: (text: string) => void
) {
  const apiKey = getMiniMaxApiKey();

  if (!apiKey) {
    throw new Error('未配置 NVIDIA API Key，请先在环境变量中设置 VITE_NVIDIA_API_KEY。');
  }

  const response = await fetch(MINIMAX_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: MINIMAX_MODEL,
      messages,
      temperature: 0.3,
      stream: true,
    }),
  });

  if (!response.ok) {
    throw new Error(await parseMiniMaxError(response));
  }

  if (!response.body) {
    throw new Error('模型流式响应不可用，请稍后重试。');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';
  let fullText = '';

  while (true) {
    const { done, value } = await reader.read();

    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      const trimmedLine = line.trim();

      if (!trimmedLine || !trimmedLine.startsWith('data:')) {
        continue;
      }

      const payload = trimmedLine.slice(5).trim();

      if (!payload || payload === '[DONE]') {
        continue;
      }

      try {
        const parsed = JSON.parse(payload) as {
          choices?: Array<{
            delta?: {
              content?: string;
            };
          }>;
        };

        const content = parsed.choices?.[0]?.delta?.content;
        if (typeof content === 'string' && content) {
          fullText += content;
          onChunk(content);
        }
      } catch {
        // Ignore malformed stream frames and continue parsing later chunks.
      }
    }
  }

  const finalBuffered = buffer.trim();
  if (finalBuffered.startsWith('data:')) {
    const payload = finalBuffered.slice(5).trim();
    if (payload && payload !== '[DONE]') {
      try {
        const parsed = JSON.parse(payload) as {
          choices?: Array<{
            delta?: {
              content?: string;
            };
          }>;
        };
        const content = parsed.choices?.[0]?.delta?.content;
        if (typeof content === 'string' && content) {
          fullText += content;
          onChunk(content);
        }
      } catch {
        // Ignore malformed trailing frame.
      }
    }
  }

  return fullText.trim();
}
