import type {
  ChatDispatchResponse,
  ChatHistoryMessage,
  ChatMessageInput,
  ChatQuickReply,
  SavedChatMessage,
} from "../chatbot";
import { logWebEvent } from "../logger";

export type ApiEnvironment = "production" | "test";
export type ChatHistoryTimePeriod =
  | "last_hour"
  | "last_day"
  | "last_week"
  | "last_month"
  | "all";
export type ChatHistoryRoleFilter = "all" | "user" | "assistant";

const DEFAULT_API_ENVIRONMENT: ApiEnvironment = "production";

function normalizeBasePath(value: string) {
  const normalized = value.trim();

  if (!normalized) {
    return "/api";
  }

  if (normalized === "/") {
    return "";
  }

  return normalized.endsWith("/") ? normalized.slice(0, -1) : normalized;
}

const API_BASE_PATH_BY_ENVIRONMENT: Record<ApiEnvironment, string> = {
  production: normalizeBasePath(
    import.meta.env.VITE_API_BASE_PRODUCTION ??
      import.meta.env.VITE_API_BASE ??
      "/api",
  ),
  test: normalizeBasePath(
    import.meta.env.VITE_API_BASE_TEST ??
      import.meta.env.VITE_API_BASE ??
      "/api",
  ),
};

let currentApiEnvironment: ApiEnvironment = DEFAULT_API_ENVIRONMENT;

export function setApiEnvironment(environment: ApiEnvironment) {
  currentApiEnvironment = environment;
}

export function getApiEnvironment(): ApiEnvironment {
  return currentApiEnvironment;
}

function buildApiRoute(path: string) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${API_BASE_PATH_BY_ENVIRONMENT[currentApiEnvironment]}${normalizedPath}`;
}

type ApiErrorBody = {
  error?: string;
  traceId?: string;
};

export class ApiRequestError extends Error {
  status: number;
  traceId: string | null;

  constructor(message: string, status: number, traceId: string | null = null) {
    super(message);
    this.name = "ApiRequestError";
    this.status = status;
    this.traceId = traceId;
  }
}

function toHex(bytes: Uint8Array) {
  return Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join(
    "",
  );
}

function randomHex(byteLength: number) {
  const bytes = new Uint8Array(byteLength);

  if (globalThis.crypto?.getRandomValues) {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = Math.floor(Math.random() * 256);
    }
  }

  return toHex(bytes);
}

export function generateActionTraceId(): string {
  return randomHex(16);
}

function createTraceparent(actionTraceId?: string) {
  const traceId = actionTraceId ?? randomHex(16);
  const spanId = randomHex(8);
  return `00-${traceId}-${spanId}-01`;
}

function parseTraceIdFromTraceparent(traceparent: string | null) {
  if (!traceparent) {
    return null;
  }

  const parts = traceparent.trim().split("-");

  if (parts.length < 4) {
    return null;
  }

  const traceId = parts[1]?.toLowerCase();

  if (!/^[0-9a-f]{32}$/.test(traceId) || /^0{32}$/.test(traceId)) {
    return null;
  }

  return traceId;
}

function createTraceHeaders(init?: HeadersInit, actionTraceId?: string) {
  const headers = new Headers(init);
  const traceparent = createTraceparent(actionTraceId);
  headers.set("traceparent", traceparent);

  return {
    headers,
    traceId: parseTraceIdFromTraceparent(traceparent),
  };
}

async function apiFetch(
  route: string,
  init: RequestInit = {},
  actionTraceId?: string,
): Promise<{ response: Response; traceId: string | null; method: string }> {
  const { headers, traceId } = createTraceHeaders(init.headers, actionTraceId);
  headers.set("x-app-environment", currentApiEnvironment);
  const method = init.method ?? "GET";
  const startedAt = performance.now();

  try {
    const response = await fetch(route, {
      ...init,
      headers,
    });

    const status = response.status;
    const level = status >= 400 ? "error" : status >= 300 ? "warn" : "info";
    logWebEvent({
      level,
      layer: "web",
      message: "http_request_completed",
      traceId,
      http_method: method,
      http_route: route,
      http_status_code: status,
      duration_ms: Number((performance.now() - startedAt).toFixed(3)),
    });

    return { response, traceId, method };
  } catch (error) {
    logWebEvent({
      level: "error",
      layer: "web",
      message: "http_request_failed",
      traceId,
      http_method: method,
      http_route: route,
      duration_ms: Number((performance.now() - startedAt).toFixed(3)),
      error_name: error instanceof Error ? error.name : "UnknownError",
      error_message: error instanceof Error ? error.message : String(error),
      error_stack: error instanceof Error ? error.stack : undefined,
    });

    throw error;
  }
}

async function handleApiResponse(
  response: Response,
  requestMeta?: { traceId: string | null; route: string; method: string },
) {
  if (response.ok) {
    if (response.status === 204) {
      return null;
    }

    return response.json();
  }

  let errorMessage = "Chatbot API request failed.";
  let traceId: string | null = null;

  try {
    const errorBody = (await response.json()) as ApiErrorBody;
    if (errorBody.error) {
      errorMessage = errorBody.error;
    }

    if (errorBody.traceId) {
      traceId = errorBody.traceId;
    }
  } catch {
    // Ignore JSON parsing failures and keep the fallback message.
  }

  if (!traceId) {
    traceId = parseTraceIdFromTraceparent(response.headers.get("traceparent"));
  }

  logWebEvent({
    level: "error",
    layer: "web",
    message: "http_response_error",
    traceId: traceId ?? requestMeta?.traceId,
    http_method: requestMeta?.method,
    http_route: requestMeta?.route,
    http_status_code: response.status,
    error_message: errorMessage,
  });

  throw new ApiRequestError(errorMessage, response.status, traceId);
}

export async function askChatbot(
  message: ChatMessageInput,
  actionTraceId?: string,
): Promise<SavedChatMessage> {
  const route = buildApiRoute("/chats");
  const { response, traceId, method } = await apiFetch(
    route,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify(message),
    },
    actionTraceId,
  );

  return handleApiResponse(response, {
    traceId,
    route,
    method,
  }) as Promise<SavedChatMessage>;
}

export async function dispatchChatbotMessage(
  message: ChatMessageInput,
  actionTraceId?: string,
): Promise<ChatDispatchResponse> {
  const route = buildApiRoute("/chats/dispatch");
  const { response, traceId, method } = await apiFetch(
    route,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify(message),
    },
    actionTraceId,
  );

  return handleApiResponse(response, {
    traceId,
    route,
    method,
  }) as Promise<ChatDispatchResponse>;
}

export async function getChatHistory(
  profileId: number,
  actionTraceId?: string,
): Promise<SavedChatMessage[]> {
  const route = buildApiRoute(`/profiles/${profileId}/chats`);
  const { response, traceId, method } = await apiFetch(
    route,
    {},
    actionTraceId,
  );

  return handleApiResponse(response, {
    traceId,
    route,
    method,
  }) as Promise<SavedChatMessage[]>;
}

export async function listChatHistoryMessages(
  profileId: number,
  options?: {
    sessionId?: string;
    quality?: number | null;
    timePeriod?: ChatHistoryTimePeriod;
    role?: ChatHistoryRoleFilter;
  },
  actionTraceId?: string,
): Promise<ChatHistoryMessage[]> {
  const query = new URLSearchParams();

  if (options?.sessionId && options.sessionId.trim().length > 0) {
    query.set("sessionId", options.sessionId.trim());
  }

  if (
    typeof options?.quality === "number" &&
    Number.isInteger(options.quality)
  ) {
    query.set("quality", String(options.quality));
  }

  if (typeof options?.timePeriod === "string" && options.timePeriod) {
    query.set("timePeriod", options.timePeriod);
  }

  if (typeof options?.role === "string" && options.role) {
    query.set("role", options.role);
  }

  const suffix = query.size > 0 ? `?${query.toString()}` : "";
  const route = buildApiRoute(`/profiles/${profileId}/chat-history${suffix}`);
  const { response, traceId, method } = await apiFetch(
    route,
    {},
    actionTraceId,
  );

  return handleApiResponse(response, {
    traceId,
    route,
    method,
  }) as Promise<ChatHistoryMessage[]>;
}

export async function listChatQuickReplies(
  actionTraceId?: string,
): Promise<ChatQuickReply[]> {
  const route = buildApiRoute("/chats/quick-reply");
  const { response, traceId, method } = await apiFetch(
    route,
    {},
    actionTraceId,
  );

  return handleApiResponse(response, {
    traceId,
    route,
    method,
  }) as Promise<ChatQuickReply[]>;
}

export async function getChatMessage(
  chatId: number,
  actionTraceId?: string,
): Promise<SavedChatMessage> {
  const route = buildApiRoute(`/chats/${chatId}`);
  const { response, traceId, method } = await apiFetch(
    route,
    {},
    actionTraceId,
  );

  return handleApiResponse(response, {
    traceId,
    route,
    method,
  }) as Promise<SavedChatMessage>;
}
