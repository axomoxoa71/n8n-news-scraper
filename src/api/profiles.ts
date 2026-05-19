import type {
  ErrorInput,
  ProfileInput,
  SavedErrorItem,
  SavedProfile,
  SavedNewsItem,
  NotificationChannel,
  NotificationChannelInput,
  Source,
  SourceInput,
} from "../profiles";
import { logWebEvent } from "../logger";

export type ApiEnvironment = "production" | "test";

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

    logWebEvent({
      level: "info",
      layer: "web",
      message: "http_request_completed",
      traceId,
      http_method: method,
      http_route: route,
      http_status_code: response.status,
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

  let errorMessage = "Profile API request failed.";
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

export async function listProfiles(
  actionTraceId?: string,
): Promise<SavedProfile[]> {
  const route = buildApiRoute("/profiles");
  const { response, traceId, method } = await apiFetch(
    route,
    {},
    actionTraceId,
  );
  return handleApiResponse(response, { traceId, route, method }) as Promise<
    SavedProfile[]
  >;
}

export async function createProfile(
  profile: ProfileInput,
  actionTraceId?: string,
): Promise<SavedProfile> {
  const route = buildApiRoute("/profiles");
  const { response, traceId, method } = await apiFetch(
    route,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify(profile),
    },
    actionTraceId,
  );

  return handleApiResponse(response, {
    traceId,
    route,
    method,
  }) as Promise<SavedProfile>;
}

export async function updateProfile(
  profileId: number,
  profile: ProfileInput,
  actionTraceId?: string,
): Promise<SavedProfile> {
  const route = buildApiRoute(`/profiles/${profileId}`);
  const { response, traceId, method } = await apiFetch(
    route,
    {
      method: "PUT",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify(profile),
    },
    actionTraceId,
  );

  return handleApiResponse(response, {
    traceId,
    route,
    method,
  }) as Promise<SavedProfile>;
}

export async function deleteProfile(
  profileId: number,
  actionTraceId?: string,
): Promise<void> {
  const route = buildApiRoute(`/profiles/${profileId}`);
  const { response, traceId, method } = await apiFetch(
    route,
    {
      method: "DELETE",
    },
    actionTraceId,
  );

  await handleApiResponse(response, { traceId, route, method });
}

export async function listSources(actionTraceId?: string): Promise<Source[]> {
  const route = buildApiRoute("/sources");
  const { response, traceId, method } = await apiFetch(
    route,
    {},
    actionTraceId,
  );
  return handleApiResponse(response, { traceId, route, method }) as Promise<
    Source[]
  >;
}

export async function createSource(
  source: SourceInput,
  actionTraceId?: string,
): Promise<Source> {
  const route = buildApiRoute("/sources");
  const { response, traceId, method } = await apiFetch(
    route,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify(source),
    },
    actionTraceId,
  );

  return handleApiResponse(response, {
    traceId,
    route,
    method,
  }) as Promise<Source>;
}

export async function updateSource(
  sourceId: number,
  source: SourceInput,
  actionTraceId?: string,
): Promise<Source> {
  const route = buildApiRoute(`/sources/${sourceId}`);
  const { response, traceId, method } = await apiFetch(
    route,
    {
      method: "PUT",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify(source),
    },
    actionTraceId,
  );

  return handleApiResponse(response, {
    traceId,
    route,
    method,
  }) as Promise<Source>;
}

export async function deleteSource(
  sourceId: number,
  actionTraceId?: string,
): Promise<void> {
  const route = buildApiRoute(`/sources/${sourceId}`);
  const { response, traceId, method } = await apiFetch(
    route,
    {
      method: "DELETE",
    },
    actionTraceId,
  );

  await handleApiResponse(response, { traceId, route, method });
}

export async function listNews(
  sourceId: number,
  actionTraceId?: string,
): Promise<SavedNewsItem[]> {
  const route = buildApiRoute(`/news?sourceId=${sourceId}`);
  const { response, traceId, method } = await apiFetch(
    route,
    {},
    actionTraceId,
  );

  return handleApiResponse(response, { traceId, route, method }) as Promise<
    SavedNewsItem[]
  >;
}

export async function updateNewsFavorite(
  newsId: number,
  sourceId: number,
  favorite: boolean,
  actionTraceId?: string,
): Promise<SavedNewsItem> {
  const route = buildApiRoute(`/news/${newsId}/favorite`);
  const { response, traceId, method } = await apiFetch(
    route,
    {
      method: "PUT",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        sourceId,
        favorite,
      }),
    },
    actionTraceId,
  );

  return handleApiResponse(response, {
    traceId,
    route,
    method,
  }) as Promise<SavedNewsItem>;
}

// Notification Channels API

export async function listNotificationChannels(
  actionTraceId?: string,
): Promise<NotificationChannel[]> {
  const route = buildApiRoute("/notification-profiles");
  const { response, traceId, method } = await apiFetch(
    route,
    {},
    actionTraceId,
  );
  return handleApiResponse(response, { traceId, route, method }) as Promise<
    NotificationChannel[]
  >;
}

export async function createNotificationChannel(
  channel: NotificationChannelInput,
  actionTraceId?: string,
): Promise<NotificationChannel> {
  const route = buildApiRoute("/notification-profiles");
  const { response, traceId, method } = await apiFetch(
    route,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify(channel),
    },
    actionTraceId,
  );

  return handleApiResponse(response, {
    traceId,
    route,
    method,
  }) as Promise<NotificationChannel>;
}

export async function updateNotificationChannel(
  channelId: number,
  channel: NotificationChannelInput,
  actionTraceId?: string,
): Promise<NotificationChannel> {
  const route = buildApiRoute(`/notification-profiles/${channelId}`);
  const { response, traceId, method } = await apiFetch(
    route,
    {
      method: "PUT",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify(channel),
    },
    actionTraceId,
  );

  return handleApiResponse(response, {
    traceId,
    route,
    method,
  }) as Promise<NotificationChannel>;
}

export async function deleteNotificationChannel(
  channelId: number,
  actionTraceId?: string,
): Promise<void> {
  const route = buildApiRoute(`/notification-profiles/${channelId}`);
  const { response, traceId, method } = await apiFetch(
    route,
    {
      method: "DELETE",
    },
    actionTraceId,
  );

  await handleApiResponse(response, { traceId, route, method });
}

export async function triggerScrapeWorkflow(
  profileId: number,
  actionTraceId?: string,
): Promise<void> {
  const route = buildApiRoute("/news/profile/scrape");
  const { response, traceId, method } = await apiFetch(
    route,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ profileId }),
    },
    actionTraceId,
  );

  await handleApiResponse(response, { traceId, route, method });
}

// New: trigger scrape workflow for a source
export async function triggerSourceScrapeWorkflow(
  sourceId: number,
  actionTraceId?: string,
): Promise<void> {
  const route = buildApiRoute("/news/source/scrape");
  const { response, traceId, method } = await apiFetch(
    route,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ sourceId }),
    },
    actionTraceId,
  );

  await handleApiResponse(response, { traceId, route, method });
}

export async function listErrors(
  profileId: number | null,
  search = "",
  timeFrame: "lastHour" | "lastDay" | "lastWeek" | "lastMonth" | "all" = "lastHour",
  externalRefId: string | null = null,
  actionTraceId?: string,
): Promise<SavedErrorItem[]> {
  const searchValue = search.trim();
  const searchParams = new URLSearchParams();

  if (typeof profileId === "number" && Number.isInteger(profileId) && profileId > 0) {
    searchParams.set("profileId", String(profileId));
  }

  if (searchValue) {
    searchParams.set("search", searchValue);
  }

  searchParams.set("timeFrame", timeFrame);

  if (externalRefId) {
    searchParams.set("externalRefId", externalRefId);
  }

  const route = buildApiRoute(`/errors?${searchParams.toString()}`);
  const { response, traceId, method } = await apiFetch(
    route,
    {},
    actionTraceId,
  );

  return handleApiResponse(response, { traceId, route, method }) as Promise<
    SavedErrorItem[]
  >;
}

export async function listExternalReferenceIds(actionTraceId?: string): Promise<{ type: string; id: string }[]> {
  const route = buildApiRoute("/errors/external-references");
  const { response, traceId, method } = await apiFetch(
    route,
    {},
    actionTraceId,
  );

  return handleApiResponse(response, { traceId, route, method }) as Promise<
    { type: string; id: string }[]
  >;
}

export async function getError(
  profileId: number | null,
  errorId: number,
  actionTraceId?: string,
): Promise<SavedErrorItem> {
  const searchParams = new URLSearchParams();
  if (typeof profileId === "number" && Number.isInteger(profileId) && profileId > 0) {
    searchParams.set("profileId", String(profileId));
  }

  const querySuffix = searchParams.toString();
  const route = buildApiRoute(
    `/errors/${errorId}${querySuffix ? `?${querySuffix}` : ""}`,
  );
  const { response, traceId, method } = await apiFetch(
    route,
    {},
    actionTraceId,
  );

  return handleApiResponse(response, {
    traceId,
    route,
    method,
  }) as Promise<SavedErrorItem>;
}

export async function createError(
  errorInput: ErrorInput,
  actionTraceId?: string,
): Promise<SavedErrorItem> {
  const route = buildApiRoute("/errors");
  const { response, traceId, method } = await apiFetch(
    route,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify(errorInput),
    },
    actionTraceId,
  );

  return handleApiResponse(response, {
    traceId,
    route,
    method,
  }) as Promise<SavedErrorItem>;
}

// For backwards compatibility
export const listNotificationProfiles = listNotificationChannels;
export const createNotificationProfile = createNotificationChannel;
export const updateNotificationProfile = updateNotificationChannel;
export const deleteNotificationProfile = deleteNotificationChannel;
