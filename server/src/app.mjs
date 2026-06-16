import express from "express";
import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { logEvent } from "./logger.mjs";
import {
  validateChatMessageInput,
  validateProfileInput,
  validateSourceInput,
} from "./validation.mjs";

const TRACEPARENT_PATTERN =
  /^([0-9a-f]{2})-([0-9a-f]{32})-([0-9a-f]{16})-([0-9a-f]{2})(?:-.+)?$/i;
const PROFILE_CONTEXT_PATTERN = /\bprofile\b/i;

const QUICK_REPLY_CONFIG_PATH = new URL("./quick-reply.json", import.meta.url);

function loadQuickReplyConfig() {
  try {
    const parsedConfig = JSON.parse(
      readFileSync(QUICK_REPLY_CONFIG_PATH, "utf8"),
    );

    if (!Array.isArray(parsedConfig)) {
      return [];
    }

    return parsedConfig
      .filter(
        (entry) =>
          typeof entry?.name === "string" && typeof entry?.prompt === "string",
      )
      .map((entry) => ({
        name: entry.name.trim(),
        prompt: entry.prompt.trim(),
      }))
      .filter((entry) => entry.name.length > 0 && entry.prompt.length > 0);
  } catch {
    return [];
  }
}

const QUICK_REPLY_CONFIG = loadQuickReplyConfig();

function randomHex(byteLength) {
  return randomBytes(byteLength).toString("hex");
}

function parseTraceparent(headerValue) {
  if (typeof headerValue !== "string") {
    return null;
  }

  const match = headerValue.trim().match(TRACEPARENT_PATTERN);

  if (!match) {
    return null;
  }

  const [, version, traceId, parentSpanId, traceFlags] = match;

  if (version.toLowerCase() === "ff") {
    return null;
  }

  if (/^0{32}$/.test(traceId) || /^0{16}$/.test(parentSpanId)) {
    return null;
  }

  return {
    version: version.toLowerCase(),
    traceId: traceId.toLowerCase(),
    parentSpanId: parentSpanId.toLowerCase(),
    traceFlags: traceFlags.toLowerCase(),
  };
}

function enrichMessageWithProfileContext(message, profile, source) {
  if (typeof message !== "string") {
    return "";
  }

  const trimmedMessage = message.trim();
  if (!PROFILE_CONTEXT_PATTERN.test(trimmedMessage)) {
    return trimmedMessage;
  }

  const contextLines = [];

  if (Number.isInteger(profile?.sourceId) && profile.sourceId > 0) {
    contextLines.push(`Source Id: ${profile.sourceId}`);
  }

  if (typeof source?.name === "string" && source.name.trim().length > 0) {
    contextLines.push(`Source Name: ${source.name.trim()}`);
  }

  return contextLines.length > 0
    ? `${trimmedMessage}\n\n${contextLines.join("\n")}`
    : trimmedMessage;
}

function createTraceContext(request) {
  const incoming = parseTraceparent(request.header("traceparent"));
  const traceId = incoming?.traceId ?? randomHex(16);
  const traceFlags = incoming?.traceFlags ?? "01";
  const spanId = randomHex(8);

  return {
    traceId,
    spanId,
    parentSpanId: incoming?.parentSpanId ?? null,
    traceFlags,
    traceparent: `00-${traceId}-${spanId}-${traceFlags}`,
  };
}

function getTraceContext(request) {
  if (request.traceContext) {
    return request.traceContext;
  }

  const fallbackTraceId = randomHex(16);
  return {
    traceId: fallbackTraceId,
    spanId: randomHex(8),
    parentSpanId: null,
    traceFlags: "01",
    traceparent: `00-${fallbackTraceId}-${randomHex(8)}-01`,
  };
}

function sendError(request, response, statusCode, errorMessage) {
  const traceContext = getTraceContext(request);

  response.status(statusCode).json({
    error: errorMessage,
    traceId: traceContext.traceId,
  });
}

function isNewsIdConflictError(error) {
  return (
    error !== null &&
    typeof error === "object" &&
    error.code === "23505" &&
    error.constraint === "news_t_news_id_uk"
  );
}

function parseProfileId(value) {
  const profileId = Number(value);
  return Number.isInteger(profileId) && profileId > 0 ? profileId : null;
}

function parseOptionalInteger(value) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : null;
}

function parseTagIds(value) {
  if (value === undefined || value === null || value === "") {
    return [];
  }

  const rawValues = Array.isArray(value) ? value : [value];
  const tagIds = [];

  for (const rawValue of rawValues) {
    const parts = String(rawValue)
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean);

    if (parts.length === 0) {
      return null;
    }

    for (const part of parts) {
      const parsed = Number(part);
      if (!Number.isInteger(parsed) || parsed <= 0) {
        return null;
      }

      if (!tagIds.includes(parsed)) {
        tagIds.push(parsed);
      }
    }
  }

  return tagIds;
}

function parseChatHistoryTimePeriod(value) {
  if (value === undefined || value === null || value === "") {
    return "last_day";
  }

  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim().toLocaleLowerCase();
  if (
    normalized === "last_hour" ||
    normalized === "last_day" ||
    normalized === "last_week" ||
    normalized === "last_month" ||
    normalized === "all"
  ) {
    return normalized;
  }

  return null;
}

function parseChatHistoryRole(value) {
  if (value === undefined || value === null || value === "") {
    return "all";
  }

  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim().toLocaleLowerCase();
  if (
    normalized === "all" ||
    normalized === "user" ||
    normalized === "assistant"
  ) {
    return normalized;
  }

  return null;
}

function getChatHistorySinceTimestamp(timePeriod, now = new Date()) {
  if (timePeriod === "all") {
    return null;
  }

  const periodStart = new Date(now.getTime());

  if (timePeriod === "last_hour") {
    periodStart.setHours(periodStart.getHours() - 1);
    return periodStart.toISOString();
  }

  if (timePeriod === "last_week") {
    periodStart.setDate(periodStart.getDate() - 7);
    return periodStart.toISOString();
  }

  if (timePeriod === "last_month") {
    periodStart.setMonth(periodStart.getMonth() - 1);
    return periodStart.toISOString();
  }

  periodStart.setDate(periodStart.getDate() - 1);
  return periodStart.toISOString();
}

function parseBoolean(value) {
  return typeof value === "boolean" ? value : null;
}

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function findStringInJson(value, preferredKeys) {
  const queue = [{ value, isRoot: true }];

  while (queue.length > 0) {
    const currentEntry = queue.shift();
    const current = currentEntry?.value;

    if (
      currentEntry?.isRoot &&
      typeof current === "string" &&
      current.trim().length > 0
    ) {
      return current.trim();
    }

    if (Array.isArray(current)) {
      for (const entry of current) {
        queue.push({ value: entry, isRoot: false });
      }
      continue;
    }

    if (!isRecord(current)) {
      continue;
    }

    for (const key of preferredKeys) {
      const preferredValue = current[key];
      if (
        typeof preferredValue === "string" &&
        preferredValue.trim().length > 0
      ) {
        return preferredValue.trim();
      }
    }

    for (const entry of Object.values(current)) {
      queue.push({ value: entry, isRoot: false });
    }
  }

  return null;
}

function resolveChatbotWebhookConfig(request, requestedEnvironment) {
  const environmentWebhookConfig =
    request.app.locals?.chatbotWebhookByEnvironment?.[requestedEnvironment];

  return {
    workflowUrl:
      environmentWebhookConfig?.webhookUrl ?? request.app.locals?.chatbotWebhookUrl,
    basicAuthUser:
      environmentWebhookConfig?.basicAuthUser ??
      request.app.locals?.chatbotWebhookBasicAuthUser,
    basicAuthPassword:
      environmentWebhookConfig?.basicAuthPassword ??
      request.app.locals?.chatbotWebhookBasicAuthPassword,
  };
}

async function resolveChatProfileContext(repositoryInstance, profileId) {
  const profiles = await repositoryInstance.listProfiles();
  const selectedProfile =
    profiles.find((profile) => profile.id === profileId) ?? null;

  const sources =
    typeof repositoryInstance.listSources === "function"
      ? await repositoryInstance.listSources()
      : [];
  const selectedSource =
    sources.find((source) => source.id === selectedProfile?.sourceId) ?? null;

  return {
    selectedProfile,
    selectedSource,
  };
}

function buildChatbotWebhookPayload(chatMessage, selectedProfile, selectedSource) {
  return {
    sessionId: chatMessage.sessionId,
    sourceId: selectedProfile.sourceId,
    sourceName: selectedSource?.name ?? null,
    message: enrichMessageWithProfileContext(
      chatMessage.message,
      selectedProfile,
      selectedSource,
    ),
  };
}

function buildWebhookHeaders(traceparent, basicAuthUser, basicAuthPassword) {
  const webhookHeaders = {
    "content-type": "application/json",
    traceparent,
  };

  if (basicAuthUser && basicAuthPassword) {
    webhookHeaders.authorization = `Basic ${encodeBasicAuth(
      basicAuthUser,
      basicAuthPassword,
    )}`;
  }

  return webhookHeaders;
}

function parseErrorInput(body) {
  const profileId = parseProfileId(body?.profileId);
  const errorMessage =
    typeof body?.errorMessage === "string" ? body.errorMessage.trim() : "";
  const errorDescription =
    typeof body?.errorDescription === "string"
      ? body.errorDescription.trim() || null
      : null;
  const errorStack =
    typeof body?.errorStack === "string"
      ? body.errorStack.trim() || null
      : null;
  const nodeName =
    typeof body?.nodeName === "string" ? body.nodeName.trim() : "";
  const nodeType =
    typeof body?.nodeType === "string" ? body.nodeType.trim() : "";
  const workflowName =
    typeof body?.workflowName === "string" ? body.workflowName.trim() : "";
  const workflowId =
    typeof body?.workflowId === "string" ? body.workflowId.trim() : "";
  const executionId =
    typeof body?.executionId === "string" ? body.executionId.trim() : "";
  const traceId = typeof body?.traceId === "string" ? body.traceId.trim() : "";
  const externalRefName =
    typeof body?.externalRefName === "string"
      ? body.externalRefName.trim() || null
      : null;
  const rawHttpCode = body?.errorHttpCode;
  const errorHttpCode =
    rawHttpCode !== undefined && rawHttpCode !== null
      ? Number(rawHttpCode)
      : null;

  if (profileId === null) {
    return { valid: false, error: "profileId must be a positive integer." };
  }

  if (!errorMessage) {
    return { valid: false, error: "errorMessage is required." };
  }

  if (!executionId) {
    return { valid: false, error: "executionId is required." };
  }

  if (!nodeName) {
    return { valid: false, error: "nodeName is required." };
  }

  if (!nodeType) {
    return { valid: false, error: "nodeType is required." };
  }

  if (!workflowName) {
    return { valid: false, error: "workflowName is required." };
  }

  if (!workflowId) {
    return { valid: false, error: "workflowId is required." };
  }

  if (
    errorHttpCode !== null &&
    (!Number.isInteger(errorHttpCode) ||
      errorHttpCode < 100 ||
      errorHttpCode > 999)
  ) {
    return {
      valid: false,
      error: "errorHttpCode must be a 3-digit integer (100-999) when provided.",
    };
  }

  return {
    valid: true,
    value: {
      profileId,
      errorMessage,
      errorDescription,
      errorStack,
      errorHttpCode,
      executionId,
      nodeName,
      nodeType,
      workflowName,
      workflowId,
      traceId: traceId || randomHex(16),
      externalRefName,
      json:
        body?.json && typeof body.json === "object" && !Array.isArray(body.json)
          ? body.json
          : null,
    },
  };
}

function parseNewsInput(body) {
  const sourceId = parseProfileId(body?.sourceId ?? body?.profileId);
  const newsId = typeof body?.newsId === "string" ? body.newsId.trim() : "";
  const title = typeof body?.title === "string" ? body.title.trim() : "";
  const summary = typeof body?.summary === "string" ? body.summary.trim() : "";
  const origin = typeof body?.origin === "string" ? body.origin.trim() : "";
  const url = typeof body?.url === "string" ? body.url.trim() : "";
  const favorite = typeof body?.favorite === "boolean" ? body.favorite : false;
  const timestamp =
    typeof body?.timestamp === "string" && body.timestamp.trim()
      ? body.timestamp.trim()
      : new Date().toISOString();

  if (sourceId === null) {
    return { valid: false, error: "profileId must be a positive integer." };
  }

  if (!newsId) {
    return { valid: false, error: "newsId is required." };
  }

  if (!title) {
    return { valid: false, error: "title is required." };
  }

  if (!summary) {
    return { valid: false, error: "summary is required." };
  }

  if (!url) {
    return { valid: false, error: "url is required." };
  }

  const parsedTimestamp = new Date(timestamp);
  if (Number.isNaN(parsedTimestamp.getTime())) {
    return { valid: false, error: "timestamp must be a valid ISO datetime." };
  }

  return {
    valid: true,
    value: {
      newsId,
      sourceId,
      title,
      summary,
      origin,
      url,
      timestamp: parsedTimestamp.toISOString(),
      favorite,
    },
  };
}

function encodeBasicAuth(user, password) {
  return Buffer.from(`${user}:${password}`, "utf8").toString("base64");
}

function getElapsedMilliseconds(startTime) {
  return Number((Number(process.hrtime.bigint() - startTime) / 1_000_000).toFixed(3));
}

const LOG_ALLOWED_REQUEST_HEADERS = new Set([
  "accept",
  "accept-encoding",
  "accept-language",
  "content-type",
  "host",
  "origin",
  "referer",
  "traceparent",
  "tracestate",
  "user-agent",
  "x-app-environment",
  "x-forwarded-for",
  "x-forwarded-host",
  "x-forwarded-proto",
  "x-request-id",
]);
const LOG_SENSITIVE_KEY_PATTERN =
  /(authorization|cookie|token|secret|password|api[_-]?key|pwd)/i;
const LOG_MAX_STRING_LENGTH = 512;
const LOG_MAX_BODY_LENGTH = 2_048;
const LOG_MAX_OBJECT_DEPTH = 4;
const LOG_MAX_OBJECT_KEYS = 40;
const CHATBOT_WEBHOOK_TIMEOUT_DEFAULT_MS = 60_000;

function truncateForLog(value, maxLength = LOG_MAX_STRING_LENGTH) {
  if (typeof value !== "string") {
    return value;
  }

  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength)}...(truncated)`;
}

function sanitizeForLog(value, depth = 0) {
  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value === "string") {
    return truncateForLog(value);
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return value;
  }

  if (depth >= LOG_MAX_OBJECT_DEPTH) {
    return "(max-depth-reached)";
  }

  if (Array.isArray(value)) {
    return value.slice(0, LOG_MAX_OBJECT_KEYS).map((entry) => sanitizeForLog(entry, depth + 1));
  }

  if (typeof value === "object") {
    const entries = Object.entries(value).slice(0, LOG_MAX_OBJECT_KEYS);
    const sanitized = {};

    for (const [key, entryValue] of entries) {
      if (LOG_SENSITIVE_KEY_PATTERN.test(key)) {
        sanitized[key] = "(redacted)";
        continue;
      }

      sanitized[key] = sanitizeForLog(entryValue, depth + 1);
    }

    return sanitized;
  }

  return truncateForLog(String(value));
}

function sanitizeHeadersForLog(headers) {
  if (!headers || typeof headers !== "object") {
    return undefined;
  }

  const sanitizedHeaders = {};

  for (const [rawKey, rawValue] of Object.entries(headers)) {
    const key = String(rawKey).toLocaleLowerCase();

    if (!LOG_ALLOWED_REQUEST_HEADERS.has(key)) {
      continue;
    }

    if (Array.isArray(rawValue)) {
      sanitizedHeaders[key] = rawValue.map((entry) =>
        truncateForLog(String(entry), LOG_MAX_BODY_LENGTH),
      );
      continue;
    }

    if (typeof rawValue === "string" || typeof rawValue === "number") {
      sanitizedHeaders[key] = truncateForLog(
        String(rawValue),
        LOG_MAX_BODY_LENGTH,
      );
    }
  }

  return Object.keys(sanitizedHeaders).length > 0 ? sanitizedHeaders : undefined;
}

function sanitizeWebhookResponseBodyForLog(rawBody) {
  if (typeof rawBody !== "string") {
    return undefined;
  }

  const trimmedBody = rawBody.trim();

  if (!trimmedBody) {
    return "";
  }

  const truncatedBody = truncateForLog(trimmedBody, LOG_MAX_BODY_LENGTH);

  try {
    const parsed = JSON.parse(trimmedBody);
    return sanitizeForLog(parsed);
  } catch {
    return truncatedBody;
  }
}

function resolveChatbotWebhookTimeoutMs(request) {
  const timeoutMs = Number(request.app.locals?.chatbotWebhookTimeoutMs);
  return Number.isFinite(timeoutMs) && timeoutMs > 0
    ? timeoutMs
    : CHATBOT_WEBHOOK_TIMEOUT_DEFAULT_MS;
}

async function postWebhookWithTimeout({
  workflowUrl,
  headers,
  payload,
  timeoutMs,
}) {
  const abortController = new AbortController();
  const timeoutHandle = setTimeout(() => {
    abortController.abort();
  }, timeoutMs);
  const requestStart = process.hrtime.bigint();

  try {
    const response = await fetch(workflowUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      signal: abortController.signal,
    });

    return {
      response,
      timedOut: false,
      durationMs: getElapsedMilliseconds(requestStart),
    };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return {
        response: null,
        timedOut: true,
        durationMs: getElapsedMilliseconds(requestStart),
        error,
      };
    }

    throw error;
  } finally {
    clearTimeout(timeoutHandle);
  }
}

async function readWebhookResponsePayload(workflowResponse) {
  let rawWebhookResponseBody = "";
  try {
    rawWebhookResponseBody = await workflowResponse.text();
  } catch {
    rawWebhookResponseBody = "";
  }

  const normalizedWebhookBody = rawWebhookResponseBody.trim();

  let responseBody = null;
  if (normalizedWebhookBody) {
    try {
      responseBody = JSON.parse(normalizedWebhookBody);
    } catch {
      responseBody = null;
    }
  }

  return {
    normalizedWebhookBody,
    responseBody,
  };
}

function extractChatbotResponsePayload(responseBody, normalizedWebhookBody) {
  const agentResponseFromJson = findStringInJson(responseBody, [
    "agentResponse",
    "answer",
    "response",
    "output",
    "text",
    "message",
  ]);

  const agentResponse =
    agentResponseFromJson && agentResponseFromJson.trim().length > 0
      ? agentResponseFromJson
      : normalizedWebhookBody && responseBody === null
        ? normalizedWebhookBody
        : null;

  const executionId = findStringInJson(responseBody, [
    "executionId",
    "execution_id",
    "id",
  ]);

  return {
    agentResponse,
    executionId,
  };
}

function logWebhookRequestStarted({
  traceContext,
  operation,
  workflowUrl,
  requestedEnvironment,
}) {
  logEvent({
    level: "info",
    layer: "webhook",
    message: "n8n_webhook_request_started",
    traceId: traceContext.traceId,
    span_id: traceContext.spanId,
    parent_span_id: traceContext.parentSpanId,
    webhook_operation: operation,
    workflow_url: workflowUrl,
    target: "n8n",
    requested_environment: requestedEnvironment,
    http_method: "POST",
  });
}

function logWebhookRequestCompleted({
  traceContext,
  operation,
  workflowUrl,
  workflowResponse,
  durationMs,
}) {
  logEvent({
    level:
      workflowResponse.status >= 400
        ? "error"
        : workflowResponse.status >= 300
          ? "warn"
          : "info",
    layer: "webhook",
    message: "n8n_webhook_request_completed",
    traceId: traceContext.traceId,
    span_id: traceContext.spanId,
    parent_span_id: traceContext.parentSpanId,
    webhook_operation: operation,
    workflow_url: workflowUrl,
    target: "n8n",
    http_method: "POST",
    http_status_code: workflowResponse.status,
    http_status_text: workflowResponse.statusText,
    is_ok: workflowResponse.ok,
    duration_ms: durationMs,
  });
}

function logWebhookRequestFailed({
  traceContext,
  operation,
  workflowUrl,
  durationMs,
  error,
}) {
  logEvent({
    level: "error",
    layer: "webhook",
    message: "n8n_webhook_request_failed",
    traceId: traceContext.traceId,
    span_id: traceContext.spanId,
    parent_span_id: traceContext.parentSpanId,
    webhook_operation: operation,
    workflow_url: workflowUrl,
    target: "n8n",
    http_method: "POST",
    duration_ms: durationMs,
    error_name: error instanceof Error ? error.name : "UnknownError",
    error_message: error instanceof Error ? error.message : String(error),
  });
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const HTTPS_URL_PATTERN = /^https?:\/\/.+/i;

function validateNotificationChannels(channels) {
  if (!Array.isArray(channels) || channels.length === 0) {
    return {
      valid: false,
      error: "At least one notification channel is required.",
    };
  }

  for (let index = 0; index < channels.length; index++) {
    const channel = channels[index];

    if (typeof channel !== "object" || channel === null) {
      return {
        valid: false,
        error: `Channel at index ${index} must be an object.`,
      };
    }

    const hasEmail = "emailAddresses" in channel;
    const hasSlack = "slackWebhookUrl" in channel;

    if (!hasEmail && !hasSlack) {
      return {
        valid: false,
        error: `Channel at index ${index} must have either emailAddresses or slackWebhookUrl.`,
      };
    }

    if (hasEmail) {
      const { emailAddresses } = channel;
      if (!Array.isArray(emailAddresses) || emailAddresses.length === 0) {
        return {
          valid: false,
          error: `Channel at index ${index}: emailAddresses must be a non-empty array.`,
        };
      }
      for (const address of emailAddresses) {
        if (
          typeof address !== "string" ||
          !EMAIL_PATTERN.test(address.trim())
        ) {
          return {
            valid: false,
            error: `Channel at index ${index}: "${address}" is not a valid email address.`,
          };
        }
      }
    }

    if (hasSlack) {
      const { slackWebhookUrl } = channel;
      if (
        typeof slackWebhookUrl !== "string" ||
        !HTTPS_URL_PATTERN.test(slackWebhookUrl.trim())
      ) {
        return {
          valid: false,
          error: `Channel at index ${index}: slackWebhookUrl must be a valid URL starting with http:// or https://.`,
        };
      }
    }
  }

  return { valid: true };
}

function getRequestedEnvironment(request) {
  const rawEnvironment = request.header("x-app-environment");
  return typeof rawEnvironment === "string" && rawEnvironment.trim() === "test"
    ? "test"
    : "production";
}

async function validateNotificationChannelSelection(repository, profileInput) {
  const selectedChannelIds =
    profileInput.notificationChannelIds.length > 0
      ? profileInput.notificationChannelIds
      : profileInput.notificationProfileId
        ? [profileInput.notificationProfileId]
        : [];

  if (selectedChannelIds.length === 0) {
    return { valid: true };
  }

  if (typeof repository.listNotificationProfiles !== "function") {
    return { valid: true };
  }

  const notificationProfiles = await repository.listNotificationProfiles();
  const existingProfileIds = new Set(
    notificationProfiles
      .map((profile) => Number(profile.id))
      .filter((profileId) => Number.isInteger(profileId) && profileId > 0),
  );

  const unknownChannelIds = selectedChannelIds.filter(
    (channelId) => !existingProfileIds.has(channelId),
  );

  if (unknownChannelIds.length === 0) {
    return { valid: true };
  }

  return {
    valid: false,
    error: `Unknown notification channel id(s): ${unknownChannelIds.join(", ")}.`,
  };
}

async function validateSourceSelection(repository, profileInput) {
  if (
    !Number.isInteger(profileInput.sourceId) ||
    Number(profileInput.sourceId) <= 0
  ) {
    return { valid: true };
  }

  if (typeof repository.listSources !== "function") {
    return { valid: true };
  }

  const sources = await repository.listSources();
  const existingSourceIds = new Set(
    sources
      .map((source) => Number(source.id))
      .filter((sourceId) => Number.isInteger(sourceId) && sourceId > 0),
  );

  if (existingSourceIds.has(profileInput.sourceId)) {
    return { valid: true };
  }

  return {
    valid: false,
    error: `Unknown source id: ${profileInput.sourceId}.`,
  };
}

async function validateProfileTagSelection(repository, profileInput) {
  if (typeof repository.listTags !== "function") {
    return { valid: true, value: profileInput };
  }

  const availableTags = await repository.listTags();
  const tagsById = new Map();
  const tagIdByName = new Map();

  for (const tag of availableTags) {
    const tagId = Number(tag.id);
    const tagName = typeof tag.tag === "string" ? tag.tag.trim() : "";

    if (!Number.isInteger(tagId) || tagId <= 0 || !tagName) {
      continue;
    }

    tagsById.set(tagId, tagName);
    tagIdByName.set(tagName.toLocaleLowerCase(), tagId);
  }

  const resolvedTagIds = [];
  const seenTagIds = new Set();

  if (Array.isArray(profileInput.tagIds) && profileInput.tagIds.length > 0) {
    const unknownTagIds = [];

    for (const rawId of profileInput.tagIds) {
      const tagId = Number(rawId);

      if (!tagsById.has(tagId)) {
        unknownTagIds.push(tagId);
        continue;
      }

      if (!seenTagIds.has(tagId)) {
        seenTagIds.add(tagId);
        resolvedTagIds.push(tagId);
      }
    }

    if (unknownTagIds.length > 0) {
      return {
        valid: false,
        error: `Unknown profile tag id(s): ${unknownTagIds.join(", ")}.`,
      };
    }
  } else {
    const unknownTagNames = [];

    for (const tagName of profileInput.tags ?? []) {
      const normalizedName = String(tagName).trim().toLocaleLowerCase();
      const tagId = tagIdByName.get(normalizedName);

      if (!tagId) {
        unknownTagNames.push(String(tagName));
        continue;
      }

      if (!seenTagIds.has(tagId)) {
        seenTagIds.add(tagId);
        resolvedTagIds.push(tagId);
      }
    }

    if (unknownTagNames.length > 0) {
      return {
        valid: false,
        error: `Unknown profile tag name(s): ${unknownTagNames.join(", ")}.`,
      };
    }
  }

  return {
    valid: true,
    value: {
      ...profileInput,
      tagIds: resolvedTagIds,
      tags: resolvedTagIds
        .map((tagId) => tagsById.get(tagId))
        .filter((tagName) => typeof tagName === "string"),
    },
  };
}

export function createNewsScraperApi({
  repository,
  repositoryByEnvironment,
  scrapWebhookUrl,
  scrapWebhookBasicAuthUser,
  scrapWebhookBasicAuthPassword,
  scrapWebhookByEnvironment,
  chatbotWebhookUrl,
  chatbotWebhookBasicAuthUser,
  chatbotWebhookBasicAuthPassword,
  chatbotWebhookByEnvironment,
  chatbotWebhookTimeoutMs = 60_000,
}) {
  function resolveRepository(request) {
    if (repositoryByEnvironment) {
      const env = getRequestedEnvironment(request);
      return repositoryByEnvironment[env] ?? repository;
    }
    return repository;
  }

  const app = express();
  app.set("etag", false);
  app.locals.scrapWebhookUrl = scrapWebhookUrl;
  app.locals.scrapWebhookBasicAuthUser = scrapWebhookBasicAuthUser;
  app.locals.scrapWebhookBasicAuthPassword = scrapWebhookBasicAuthPassword;
  app.locals.scrapWebhookByEnvironment = scrapWebhookByEnvironment;
  app.locals.chatbotWebhookUrl = chatbotWebhookUrl;
  app.locals.chatbotWebhookBasicAuthUser = chatbotWebhookBasicAuthUser;
  app.locals.chatbotWebhookBasicAuthPassword = chatbotWebhookBasicAuthPassword;
  app.locals.chatbotWebhookByEnvironment = chatbotWebhookByEnvironment;
  app.locals.chatbotWebhookTimeoutMs = chatbotWebhookTimeoutMs;

  app.use(express.json({ limit: "1mb" }));

  app.use((request, response, next) => {
    const traceContext = createTraceContext(request);
    request.traceContext = traceContext;
    response.setHeader("traceparent", traceContext.traceparent);

    const startTime = process.hrtime.bigint();

    response.on("finish", () => {
      const durationMs =
        Number(process.hrtime.bigint() - startTime) / 1_000_000;
      const statusCode = response.statusCode;
      const level =
        statusCode >= 400 ? "error" : statusCode >= 300 ? "warn" : "info";

      logEvent({
        level,
        layer: "api",
        message: "http_request_completed",
        traceId: traceContext.traceId,
        span_id: traceContext.spanId,
        parent_span_id: traceContext.parentSpanId,
        http_method: request.method,
        http_route: request.originalUrl,
        http_status_code: statusCode,
        duration_ms: Number(durationMs.toFixed(3)),
      });
    });

    next();
  });

  app.get("/api/health", (_request, response) => {
    response.json({ status: "ok" });
  });

  app.get("/api/profiles", async (request, response, next) => {
    try {
      const profiles = await resolveRepository(request).listProfiles();
      response.json(profiles);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/profiles", async (request, response, next) => {
    const validationResult = validateProfileInput(request.body);

    if (!validationResult.valid) {
      sendError(request, response, 400, validationResult.error);
      return;
    }

    try {
      const sourceSelectionValidation = await validateSourceSelection(
        resolveRepository(request),
        validationResult.value,
      );

      if (!sourceSelectionValidation.valid) {
        sendError(request, response, 400, sourceSelectionValidation.error);
        return;
      }

      const notificationChannelSelectionValidation =
        await validateNotificationChannelSelection(
          resolveRepository(request),
          validationResult.value,
        );

      if (!notificationChannelSelectionValidation.valid) {
        sendError(
          request,
          response,
          400,
          notificationChannelSelectionValidation.error,
        );
        return;
      }

      const tagSelectionValidation = await validateProfileTagSelection(
        resolveRepository(request),
        validationResult.value,
      );

      if (!tagSelectionValidation.valid) {
        sendError(request, response, 400, tagSelectionValidation.error);
        return;
      }

      const createdProfile = await resolveRepository(request).createProfile(
        tagSelectionValidation.value,
      );
      response.status(201).json(createdProfile);
    } catch (error) {
      next(error);
    }
  });

  app.put("/api/profiles/:id", async (request, response, next) => {
    const profileId = parseProfileId(request.params.id);

    if (profileId === null) {
      sendError(
        request,
        response,
        400,
        "Profile id must be a positive integer.",
      );
      return;
    }

    const validationResult = validateProfileInput(request.body);

    if (!validationResult.valid) {
      sendError(request, response, 400, validationResult.error);
      return;
    }

    try {
      const sourceSelectionValidation = await validateSourceSelection(
        resolveRepository(request),
        validationResult.value,
      );

      if (!sourceSelectionValidation.valid) {
        sendError(request, response, 400, sourceSelectionValidation.error);
        return;
      }

      const notificationChannelSelectionValidation =
        await validateNotificationChannelSelection(
          resolveRepository(request),
          validationResult.value,
        );

      if (!notificationChannelSelectionValidation.valid) {
        sendError(
          request,
          response,
          400,
          notificationChannelSelectionValidation.error,
        );
        return;
      }

      const tagSelectionValidation = await validateProfileTagSelection(
        resolveRepository(request),
        validationResult.value,
      );

      if (!tagSelectionValidation.valid) {
        sendError(request, response, 400, tagSelectionValidation.error);
        return;
      }

      const updatedProfile = await resolveRepository(request).updateProfile(
        profileId,
        tagSelectionValidation.value,
      );

      if (updatedProfile === null) {
        sendError(request, response, 404, "Profile not found.");
        return;
      }

      response.json(updatedProfile);
    } catch (error) {
      next(error);
    }
  });

  app.delete("/api/profiles/:id", async (request, response, next) => {
    const profileId = parseProfileId(request.params.id);

    if (profileId === null) {
      sendError(
        request,
        response,
        400,
        "Profile id must be a positive integer.",
      );
      return;
    }

    try {
      const deleted = await resolveRepository(request).deleteProfile(profileId);

      if (!deleted) {
        sendError(request, response, 404, "Profile not found.");
        return;
      }

      response.status(204).end();
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/sources", async (request, response, next) => {
    try {
      const sources = await resolveRepository(request).listSources();
      response.json(sources);
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/tags", async (request, response, next) => {
    try {
      const tags = await resolveRepository(request).listTags();
      response.json(tags);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/sources", async (request, response, next) => {
    const validationResult = validateSourceInput(request.body);

    if (!validationResult.valid) {
      sendError(request, response, 400, validationResult.error);
      return;
    }

    try {
      const createdSource = await resolveRepository(request).createSource(
        validationResult.value,
      );
      response.status(201).json(createdSource);
    } catch (error) {
      next(error);
    }
  });

  app.put("/api/sources/:id", async (request, response, next) => {
    const sourceId = parseProfileId(request.params.id);

    if (sourceId === null) {
      sendError(
        request,
        response,
        400,
        "Source id must be a positive integer.",
      );
      return;
    }

    const validationResult = validateSourceInput(request.body);

    if (!validationResult.valid) {
      sendError(request, response, 400, validationResult.error);
      return;
    }

    try {
      const updatedSource = await resolveRepository(request).updateSource(
        sourceId,
        validationResult.value,
      );

      if (updatedSource === null) {
        sendError(request, response, 404, "Source not found.");
        return;
      }

      response.json(updatedSource);
    } catch (error) {
      next(error);
    }
  });

  app.delete("/api/sources/:id", async (request, response, next) => {
    const sourceId = parseProfileId(request.params.id);

    if (sourceId === null) {
      sendError(
        request,
        response,
        400,
        "Source id must be a positive integer.",
      );
      return;
    }

    try {
      const deleted = await resolveRepository(request).deleteSource(sourceId);

      if (!deleted) {
        sendError(request, response, 404, "Source not found.");
        return;
      }

      response.status(204).end();
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/news", async (request, response, next) => {
    const sourceId = parseProfileId(
      request.query.sourceId ?? request.query.profileId,
    );
    const tagIds = parseTagIds(request.query.tagIds);

    if (sourceId === null) {
      sendError(
        request,
        response,
        400,
        "profileId query parameter must be a positive integer.",
      );
      return;
    }

    if (tagIds === null) {
      sendError(
        request,
        response,
        400,
        "tagIds query parameter must be a comma-separated list of positive integers.",
      );
      return;
    }

    try {
      const news = await resolveRepository(request).listNews(sourceId, tagIds);
      response.json(news);
    } catch (error) {
      next(error);
    }
  });

  app.put("/api/news/:id/favorite", async (request, response, next) => {
    const newsId = parseProfileId(request.params.id);
    const sourceId = parseProfileId(
      request.body?.sourceId ?? request.body?.profileId,
    );
    const favorite = parseBoolean(request.body?.favorite);

    if (newsId === null) {
      sendError(request, response, 400, "News id must be a positive integer.");
      return;
    }

    if (sourceId === null) {
      sendError(
        request,
        response,
        400,
        "profileId in request body must be a positive integer.",
      );
      return;
    }

    if (favorite === null) {
      sendError(
        request,
        response,
        400,
        "favorite in request body must be a boolean.",
      );
      return;
    }

    try {
      const updatedNewsItem = await resolveRepository(
        request,
      ).updateNewsFavorite(sourceId, newsId, favorite);

      if (updatedNewsItem === null) {
        sendError(request, response, 404, "News item not found.");
        return;
      }

      response.json(updatedNewsItem);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/news", async (request, response, next) => {
    const validationResult = parseNewsInput(request.body);

    if (!validationResult.valid) {
      sendError(request, response, 400, validationResult.error);
      return;
    }

    if (typeof resolveRepository(request).createNewsItem !== "function") {
      sendError(
        request,
        response,
        501,
        "News seeding is not supported by the configured repository.",
      );
      return;
    }

    try {
      const createdNewsItem = await resolveRepository(request).createNewsItem(
        validationResult.value,
      );
      response.status(201).json(createdNewsItem);
    } catch (error) {
      if (isNewsIdConflictError(error)) {
        sendError(request, response, 409, "newsId must be unique.");
        return;
      }

      next(error);
    }
  });

  app.get("/api/errors", async (request, response, next) => {
    const hasProfileIdFilter =
      request.query.profileId !== undefined && request.query.profileId !== "";
    const parsedProfileId = hasProfileIdFilter
      ? parseProfileId(request.query.profileId)
      : null;

    if (hasProfileIdFilter && parsedProfileId === null) {
      sendError(
        request,
        response,
        400,
        "profileId query parameter must be a positive integer when provided.",
      );
      return;
    }

    const search =
      typeof request.query.search === "string" ? request.query.search : "";

    const timeFrame = ["lastHour", "lastDay", "lastWeek", "lastMonth", "all"].includes(
      String(request.query.timeFrame)
    )
      ? request.query.timeFrame
      : "lastHour";

    const externalRefId =
      typeof request.query.externalRefId === "string"
        ? request.query.externalRefId
        : null;

    try {
      const errors = await resolveRepository(request).listErrors(
        parsedProfileId,
        search,
        timeFrame,
        externalRefId,
      );
      response.json(errors);
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/errors/external-references", async (request, response, next) => {
    try {
      const references = await resolveRepository(request).listDistinctExternalReferences();
      response.json(references);
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/errors/:id", async (request, response, next) => {
    const hasProfileIdFilter =
      request.query.profileId !== undefined && request.query.profileId !== "";
    const parsedProfileId = hasProfileIdFilter
      ? parseProfileId(request.query.profileId)
      : null;
    const errorId = parseProfileId(request.params.id);

    if (hasProfileIdFilter && parsedProfileId === null) {
      sendError(
        request,
        response,
        400,
        "profileId query parameter must be a positive integer when provided.",
      );
      return;
    }

    if (errorId === null) {
      sendError(request, response, 400, "Error id must be a positive integer.");
      return;
    }

    try {
      const errorItem = await resolveRepository(request).getError(
        errorId,
        parsedProfileId,
      );

      if (!errorItem) {
        sendError(request, response, 404, "Error not found.");
        return;
      }

      response.json(errorItem);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/errors", async (request, response, next) => {
    const validationResult = parseErrorInput(request.body);

    if (!validationResult.valid) {
      sendError(request, response, 400, validationResult.error);
      return;
    }

    try {
      const createdError = await resolveRepository(request).createError(
        validationResult.value,
      );
      response.status(201).json(createdError);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/news/profile/scrape", async (request, response) => {
    const requestedEnvironment = getRequestedEnvironment(request);
    const environmentWebhookConfig =
      request.app.locals?.scrapWebhookByEnvironment?.[requestedEnvironment];

    const workflowUrl =
      environmentWebhookConfig?.webhookUrl ??
      request.app.locals?.scrapWebhookUrl;
    const basicAuthUser =
      environmentWebhookConfig?.basicAuthUser ??
      request.app.locals?.scrapWebhookBasicAuthUser;
    const basicAuthPassword =
      environmentWebhookConfig?.basicAuthPassword ??
      request.app.locals?.scrapWebhookBasicAuthPassword;

    if (!workflowUrl) {
      const traceCtx = getTraceContext(request);
      logEvent({
        level: "error",
        layer: "webhook",
        message: "scrape_webhook_not_configured",
        traceId: traceCtx.traceId,
        span_id: traceCtx.spanId,
        parent_span_id: traceCtx.parentSpanId,
        detail: `Webhook URL is not configured for environment '${requestedEnvironment}'. Set SCRAPE_WEB_WEBHOOK_URL (or SCRAPE_WEBHOOK_URL, or N8N_WORKFLOW_URL) in a matching *.${requestedEnvironment === "test" ? "test" : "prod"}.env file.`,
      });
      sendError(request, response, 503, "Scrape workflow is not configured.");
      return;
    }

    if (!basicAuthUser || !basicAuthPassword) {
      const traceCtx = getTraceContext(request);
      logEvent({
        level: "error",
        layer: "webhook",
        message: "scrape_webhook_credentials_not_configured",
        traceId: traceCtx.traceId,
        span_id: traceCtx.spanId,
        parent_span_id: traceCtx.parentSpanId,
        detail: !basicAuthUser
          ? `BASIC_AUTH_USER environment variable is not set in the selected *.${requestedEnvironment === "test" ? "test" : "prod"}.env file`
          : `BASIC_AUTH_PWD environment variable is not set in the selected *.${requestedEnvironment === "test" ? "test" : "prod"}.env file`,
      });
      sendError(
        request,
        response,
        503,
        "Scrape workflow credentials are not configured.",
      );
      return;
    }

    const profileId = parseProfileId(
      request.body?.id ?? request.body?.profileId,
    );

    if (profileId === null) {
      sendError(
        request,
        response,
        400,
        "profileId in request body must be a positive integer.",
      );
      return;
    }

    try {
      const traceContext = getTraceContext(request);
      const webhookOperation = "scrape_profile";
      const repositoryInstance = resolveRepository(request);
      const profiles = await repositoryInstance.listProfiles();
      const selectedProfile =
        profiles.find((profile) => profile.id === profileId) ?? null;

      if (!selectedProfile) {
        sendError(request, response, 404, "Profile not found.");
        return;
      }

      await repositoryInstance.clearErrors(profileId);

      const selectedNotificationChannelIds =
        Array.isArray(selectedProfile.notificationChannelIds) &&
        selectedProfile.notificationChannelIds.length > 0
          ? selectedProfile.notificationChannelIds
          : Number.isInteger(selectedProfile.notificationProfileId) &&
              selectedProfile.notificationProfileId > 0
            ? [selectedProfile.notificationProfileId]
            : [];

      let selectedInformationChannel = null;
      if (
        selectedNotificationChannelIds.length > 0 &&
        typeof repositoryInstance.listNotificationProfiles === "function"
      ) {
        const notificationProfiles =
          await repositoryInstance.listNotificationProfiles();
        selectedInformationChannel =
          notificationProfiles.find(
            (channel) => channel.id === selectedNotificationChannelIds[0],
          ) ?? null;
      }

      const webhookPayload = {
        id: selectedProfile.id,
        name: selectedProfile.name,
        scrape: {
          profile: selectedProfile,
          informationChannel: selectedInformationChannel
            ? {
                id: selectedInformationChannel.id,
                name: selectedInformationChannel.name,
                description: selectedInformationChannel.description,
                channels: selectedInformationChannel.channels,
              }
            : null,
        },
      };

      const webhookRequestStart = process.hrtime.bigint();
      logWebhookRequestStarted({
        traceContext,
        operation: webhookOperation,
        workflowUrl,
        requestedEnvironment,
      });

      const workflowResponse = await fetch(workflowUrl, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Basic ${encodeBasicAuth(
            basicAuthUser,
            basicAuthPassword,
          )}`,
          traceparent: traceContext.traceparent,
        },
        body: JSON.stringify(webhookPayload),
      });

      logWebhookRequestCompleted({
        traceContext,
        operation: webhookOperation,
        workflowUrl,
        workflowResponse,
        durationMs: getElapsedMilliseconds(webhookRequestStart),
      });

      if (!workflowResponse.ok) {
        let webhookResponseBody;
        try {
          webhookResponseBody = await workflowResponse.text();
        } catch {
          webhookResponseBody = "(could not read response body)";
        }

        logEvent({
          level: "error",
          layer: "webhook",
          message: "scrape_webhook_trigger_failed",
          traceId: traceContext.traceId,
          span_id: traceContext.spanId,
          parent_span_id: traceContext.parentSpanId,
          http_status_code: workflowResponse.status,
          http_status_text: workflowResponse.statusText,
          workflow_url: workflowUrl,
          webhook_response_excerpt:
            sanitizeWebhookResponseBodyForLog(webhookResponseBody),
        });

        sendError(request, response, 502, "Failed to trigger scrape workflow.");
        return;
      }

      response.status(202).json({ status: "accepted" });
    } catch (error) {
      const traceContext = getTraceContext(request);
      logWebhookRequestFailed({
        traceContext,
        operation: "scrape_profile",
        workflowUrl,
        durationMs: null,
        error,
      });

      logEvent({
        level: "error",
        layer: "webhook",
        message: "scrape_webhook_trigger_error",
        traceId: traceContext.traceId,
        span_id: traceContext.spanId,
        parent_span_id: traceContext.parentSpanId,
        workflow_url: workflowUrl,
        error_name: error instanceof Error ? error.name : "UnknownError",
        error_message: error instanceof Error ? error.message : String(error),
        error_stack: error instanceof Error ? error.stack : undefined,
      });

      sendError(request, response, 502, "Could not trigger scrape workflow.");
    }
  });

  // New endpoint: trigger scrape by source, send only source JSON to n8n
  app.post("/api/news/source/scrape", async (request, response) => {
    const requestedEnvironment = getRequestedEnvironment(request);
    const environmentWebhookConfig =
      request.app.locals?.scrapWebhookByEnvironment?.[requestedEnvironment];

    const workflowUrl =
      environmentWebhookConfig?.webhookUrl ??
      request.app.locals?.scrapWebhookUrl;
    const basicAuthUser =
      environmentWebhookConfig?.basicAuthUser ??
      request.app.locals?.scrapWebhookBasicAuthUser;
    const basicAuthPassword =
      environmentWebhookConfig?.basicAuthPassword ??
      request.app.locals?.scrapWebhookBasicAuthPassword;

    if (!workflowUrl) {
      const traceCtx = getTraceContext(request);
      logEvent({
        level: "error",
        layer: "webhook",
        message: "scrape_webhook_not_configured",
        traceId: traceCtx.traceId,
        span_id: traceCtx.spanId,
        parent_span_id: traceCtx.parentSpanId,
        detail: `Webhook URL is not configured for environment '${requestedEnvironment}'. Set SCRAPE_WEB_WEBHOOK_URL (or SCRAPE_WEBHOOK_URL, or N8N_WORKFLOW_URL) in a matching *.${requestedEnvironment === "test" ? "test" : "prod"}.env file.`,
      });
      sendError(request, response, 503, "Scrape workflow is not configured.");
      return;
    }

    if (!basicAuthUser || !basicAuthPassword) {
      const traceCtx = getTraceContext(request);
      logEvent({
        level: "error",
        layer: "webhook",
        message: "scrape_webhook_credentials_not_configured",
        traceId: traceCtx.traceId,
        span_id: traceCtx.spanId,
        parent_span_id: traceCtx.parentSpanId,
        detail: !basicAuthUser
          ? `BASIC_AUTH_USER environment variable is not set in the selected *.${requestedEnvironment === "test" ? "test" : "prod"}.env file`
          : `BASIC_AUTH_PWD environment variable is not set in the selected *.${requestedEnvironment === "test" ? "test" : "prod"}.env file`,
      });
      sendError(
        request,
        response,
        503,
        "Scrape workflow credentials are not configured.",
      );
      return;
    }

    const sourceId = parseProfileId(request.body?.sourceId);
    if (sourceId === null) {
      sendError(
        request,
        response,
        400,
        "sourceId in request body must be a positive integer.",
      );
      return;
    }

    try {
      const traceContext = getTraceContext(request);
      const webhookOperation = "scrape_source";
      const sources = await resolveRepository(request).listSources();
      const selectedSource =
        sources.find((source) => source.id === sourceId) ?? null;
      if (!selectedSource) {
        sendError(request, response, 404, "Source not found.");
        return;
      }

      // Send only the source snapshot JSON (sources_t.json) to n8n.
      const webhookPayload =
        selectedSource?.json &&
        typeof selectedSource.json === "object" &&
        !Array.isArray(selectedSource.json)
          ? selectedSource.json
          : {
              id: selectedSource.id,
              name: selectedSource.name,
              description: selectedSource.description,
              urls: selectedSource.urls,
              rssFeeds: selectedSource.rssFeeds,
            };

      const webhookRequestStart = process.hrtime.bigint();
      logWebhookRequestStarted({
        traceContext,
        operation: webhookOperation,
        workflowUrl,
        requestedEnvironment,
      });

      const workflowResponse = await fetch(workflowUrl, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Basic ${encodeBasicAuth(
            basicAuthUser,
            basicAuthPassword,
          )}`,
          traceparent: traceContext.traceparent,
        },
        body: JSON.stringify(webhookPayload),
      });

      logWebhookRequestCompleted({
        traceContext,
        operation: webhookOperation,
        workflowUrl,
        workflowResponse,
        durationMs: getElapsedMilliseconds(webhookRequestStart),
      });

      if (!workflowResponse.ok) {
        let webhookResponseBody;
        try {
          webhookResponseBody = await workflowResponse.text();
        } catch {
          webhookResponseBody = "(could not read response body)";
        }

        logEvent({
          level: "error",
          layer: "webhook",
          message: "scrape_webhook_trigger_failed",
          traceId: traceContext.traceId,
          span_id: traceContext.spanId,
          parent_span_id: traceContext.parentSpanId,
          http_status_code: workflowResponse.status,
          http_status_text: workflowResponse.statusText,
          workflow_url: workflowUrl,
          webhook_response_excerpt:
            sanitizeWebhookResponseBodyForLog(webhookResponseBody),
        });

        sendError(request, response, 502, "Failed to trigger scrape workflow.");
        return;
      }

      response.status(202).json({ status: "accepted" });
    } catch (error) {
      const traceContext = getTraceContext(request);
      logWebhookRequestFailed({
        traceContext,
        operation: "scrape_source",
        workflowUrl,
        durationMs: null,
        error,
      });
      logEvent({
        level: "error",
        layer: "webhook",
        message: "scrape_webhook_trigger_error",
        traceId: traceContext.traceId,
        span_id: traceContext.spanId,
        parent_span_id: traceContext.parentSpanId,
        workflow_url: workflowUrl,
        error_name: error instanceof Error ? error.name : "UnknownError",
        error_message: error instanceof Error ? error.message : String(error),
        error_stack: error instanceof Error ? error.stack : undefined,
      });
      sendError(request, response, 502, "Could not trigger scrape workflow.");
    }
  });

  app.get("/api/profiles/:id/chats", async (request, response, next) => {
    const profileId = parseProfileId(request.params.id);

    if (profileId === null) {
      sendError(
        request,
        response,
        400,
        "Profile id must be a positive integer.",
      );
      return;
    }

    try {
      const repositoryInstance = resolveRepository(request);
      const profiles = await repositoryInstance.listProfiles();
      const selectedProfile = profiles.find((profile) => profile.id === profileId);

      if (!selectedProfile) {
        sendError(request, response, 404, "Profile not found.");
        return;
      }

      if (!Number.isInteger(selectedProfile.sourceId) || selectedProfile.sourceId <= 0) {
        response.json([]);
        return;
      }

      const chats =
        await repositoryInstance.getChatsBySourceId(selectedProfile.sourceId);
      response.json(chats);
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/profiles/:id/chat-history", async (request, response, next) => {
    const profileId = parseProfileId(request.params.id);

    if (profileId === null) {
      sendError(
        request,
        response,
        400,
        "Profile id must be a positive integer.",
      );
      return;
    }

    const sessionIdQuery =
      typeof request.query.sessionId === "string"
        ? request.query.sessionId.trim()
        : "";
    const quality = parseOptionalInteger(request.query.quality);
    const timePeriod = parseChatHistoryTimePeriod(request.query.timePeriod);
    const role = parseChatHistoryRole(request.query.role);

    if (request.query.quality !== undefined && quality === null) {
      sendError(request, response, 400, "Quality must be an integer.");
      return;
    }

    if (quality !== null && (quality < 1 || quality > 10)) {
      sendError(request, response, 400, "Quality must be between 1 and 10.");
      return;
    }

    if (timePeriod === null) {
      sendError(
        request,
        response,
        400,
        "Time period must be one of: last_hour, last_day, last_week, last_month, all.",
      );
      return;
    }

    if (role === null) {
      sendError(
        request,
        response,
        400,
        "Role must be one of: user, assistant, all.",
      );
      return;
    }

    const sinceTs = getChatHistorySinceTimestamp(timePeriod);

    try {
      const repositoryInstance = resolveRepository(request);
      const profiles = await repositoryInstance.listProfiles();
      const selectedProfile = profiles.find((profile) => profile.id === profileId);

      if (!selectedProfile) {
        sendError(request, response, 404, "Profile not found.");
        return;
      }

      if (!Number.isInteger(selectedProfile.sourceId) || selectedProfile.sourceId <= 0) {
        response.json([]);
        return;
      }

      const chats = await repositoryInstance.listChatHistoryBySourceId(
        selectedProfile.sourceId,
        {
          sessionIdQuery,
          quality,
          role,
          sinceTs,
          limit: 1000,
        },
      );
      response.json(chats);
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/chats/quick-reply", (_request, response) => {
    response.json(QUICK_REPLY_CONFIG);
  });

  app.get("/api/chats/:id", async (request, response, next) => {
    const chatId = parseProfileId(request.params.id);

    if (chatId === null) {
      sendError(request, response, 400, "Chat id must be a positive integer.");
      return;
    }

    try {
      const chat = await resolveRepository(request).getChat(chatId);

      if (!chat) {
        sendError(request, response, 404, "Chat message not found.");
        return;
      }

      response.json(chat);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/chats/dispatch", async (request, response, next) => {
    const traceContext = getTraceContext(request);

    try {
      const validationResult = validateChatMessageInput(request.body);

      if (!validationResult.valid) {
        logEvent({
          level: "warn",
          layer: "api",
          message: "dispatch_validation_failed",
          traceId: traceContext.traceId,
          span_id: traceContext.spanId,
          parent_span_id: traceContext.parentSpanId,
          validation_error: validationResult.error,
        });
        sendError(request, response, 400, validationResult.error);
        return;
      }

      const requestedEnvironment = getRequestedEnvironment(request);
      const { workflowUrl, basicAuthUser, basicAuthPassword } =
        resolveChatbotWebhookConfig(request, requestedEnvironment);

      if (!workflowUrl) {
        logEvent({
          level: "error",
          layer: "webhook",
          message: "chatbot_webhook_not_configured",
          traceId: traceContext.traceId,
          span_id: traceContext.spanId,
          parent_span_id: traceContext.parentSpanId,
          detail: `Webhook URL is not configured for environment '${requestedEnvironment}'. Set SCRAPE_CHATBOT_WEBHOOK_URL in a matching *.${requestedEnvironment === "test" ? "test" : "prod"}.env file.`,
        });
        sendError(
          request,
          response,
          503,
          "Chatbot workflow is not configured.",
        );
        return;
      }

      const repositoryInstance = resolveRepository(request);
      const { selectedProfile, selectedSource } =
        await resolveChatProfileContext(
          repositoryInstance,
          validationResult.value.profileId,
        );

      if (!selectedProfile) {
        sendError(request, response, 404, "Profile not found.");
        return;
      }

      const webhookPayload = buildChatbotWebhookPayload(
        validationResult.value,
        selectedProfile,
        selectedSource,
      );

      const webhookHeaders = buildWebhookHeaders(
        traceContext.traceparent,
        basicAuthUser,
        basicAuthPassword,
      );

      const resolvedTimeoutMs = resolveChatbotWebhookTimeoutMs(request);
      const webhookOperation = "chat_dispatch";
      logWebhookRequestStarted({
        traceContext,
        operation: webhookOperation,
        workflowUrl,
        requestedEnvironment,
      });

      const webhookCall = await postWebhookWithTimeout({
        workflowUrl,
        headers: webhookHeaders,
        payload: webhookPayload,
        timeoutMs: resolvedTimeoutMs,
      });

      if (webhookCall.timedOut || !webhookCall.response) {
        logWebhookRequestFailed({
          traceContext,
          operation: webhookOperation,
          workflowUrl,
          durationMs: webhookCall.durationMs,
          error:
            webhookCall.error ??
            new Error("Chatbot workflow request timed out."),
        });

        logEvent({
          level: "error",
          layer: "webhook",
          message: "chatbot_webhook_timeout",
          traceId: traceContext.traceId,
          span_id: traceContext.spanId,
          parent_span_id: traceContext.parentSpanId,
          workflow_url: workflowUrl,
          timeout_ms: resolvedTimeoutMs,
        });

        sendError(
          request,
          response,
          504,
          `Chatbot workflow timed out after ${Math.ceil(resolvedTimeoutMs / 1000)} seconds.`,
        );
        return;
      }

      const workflowResponse = webhookCall.response;

      logWebhookRequestCompleted({
        traceContext,
        operation: webhookOperation,
        workflowUrl,
        workflowResponse,
        durationMs: webhookCall.durationMs,
      });

      logEvent({
        level: workflowResponse.status >= 400 ? "error" : workflowResponse.status >= 300 ? "warn" : "info",
        layer: "webhook",
        message: "chatbot_webhook_response_status",
        traceId: traceContext.traceId,
        span_id: traceContext.spanId,
        parent_span_id: traceContext.parentSpanId,
        http_status_code: workflowResponse.status,
        http_status_text: workflowResponse.statusText,
        is_ok: workflowResponse.ok,
        workflow_url: workflowUrl,
      });

      if (!workflowResponse.ok) {
        let webhookResponseBody;
        try {
          webhookResponseBody = await workflowResponse.text();
        } catch {
          webhookResponseBody = "(could not read response body)";
        }

        logEvent({
          level: "error",
          layer: "webhook",
          message: "chatbot_webhook_trigger_failed",
          traceId: traceContext.traceId,
          span_id: traceContext.spanId,
          parent_span_id: traceContext.parentSpanId,
          http_status_code: workflowResponse.status,
          http_status_text: workflowResponse.statusText,
          workflow_url: workflowUrl,
          webhook_response_excerpt:
            sanitizeWebhookResponseBodyForLog(webhookResponseBody),
        });

        sendError(
          request,
          response,
          502,
          "Failed to trigger chatbot workflow.",
        );
        return;
      }

      // Dispatch endpoint requires synchronous response with answer.
      // Accept both 200 OK and 202 Accepted as success (both can include response body).
      if (workflowResponse.status === 202) {
        logEvent({
          level: "info",
          layer: "webhook",
          message: "chatbot_dispatch_async_accepted",
          traceId: traceContext.traceId,
          span_id: traceContext.spanId,
          parent_span_id: traceContext.parentSpanId,
          detail:
            "Webhook returned 202 Accepted. Processing response body for synchronous answer.",
          http_status_code: workflowResponse.status,
          workflow_url: workflowUrl,
        });
      } else if (workflowResponse.status !== 200) {
        logEvent({
          level: "error",
          layer: "webhook",
          message: "chatbot_dispatch_unexpected_status",
          traceId: traceContext.traceId,
          span_id: traceContext.spanId,
          parent_span_id: traceContext.parentSpanId,
          detail: `Dispatch endpoint requires 200 or 202. Got ${workflowResponse.status} ${workflowResponse.statusText}`,
          http_status_code: workflowResponse.status,
          workflow_url: workflowUrl,
        });

        sendError(
          request,
          response,
          502,
          `Chatbot workflow returned unexpected status: ${workflowResponse.status} ${workflowResponse.statusText}`,
        );
        return;
      }

      const { normalizedWebhookBody, responseBody } =
        await readWebhookResponsePayload(workflowResponse);

      logEvent({
        level: "debug",
        layer: "webhook",
        message: "chatbot_webhook_response_received",
        traceId: traceContext.traceId,
        span_id: traceContext.spanId,
        parent_span_id: traceContext.parentSpanId,
        http_status_code: workflowResponse.status,
        response_excerpt: sanitizeWebhookResponseBodyForLog(normalizedWebhookBody),
      });

      const { agentResponse, executionId } = extractChatbotResponsePayload(
        responseBody,
        normalizedWebhookBody,
      );

      // Check if n8n response indicates an error
      const isErrorResponse =
        responseBody &&
        typeof responseBody === "object" &&
        (responseBody.error === true ||
          (typeof responseBody.httpStatus === "number" &&
            responseBody.httpStatus >= 400));

      logEvent({
        level: isErrorResponse ? "error" : "info",
        layer: "webhook",
        message: "chatbot_dispatch_response_extracted",
        traceId: traceContext.traceId,
        span_id: traceContext.spanId,
        parent_span_id: traceContext.parentSpanId,
        extracted_agent_response: agentResponse,
        extracted_execution_id: executionId,
        is_error_response: isErrorResponse,
        response_body_keys: responseBody
          ? Object.keys(responseBody)
          : undefined,
      });

      if (isErrorResponse) {
        logEvent({
          level: "error",
          layer: "webhook",
          message: "chatbot_webhook_error_response",
          traceId: traceContext.traceId,
          span_id: traceContext.spanId,
          parent_span_id: traceContext.parentSpanId,
          workflow_url: workflowUrl,
          error_type: responseBody.errorType,
          error_message: responseBody.message,
          http_status: responseBody.httpStatus,
          response_excerpt: sanitizeWebhookResponseBodyForLog(normalizedWebhookBody),
        });

        sendError(
          request,
          response,
          502,
          `Chatbot workflow error: ${responseBody.message || responseBody.errorType || "Unknown error"}`,
        );
        return;
      }

      if (!agentResponse || agentResponse.trim().length === 0) {
        logEvent({
          level: "error",
          layer: "webhook",
          message: "chatbot_webhook_missing_answer",
          traceId: traceContext.traceId,
          span_id: traceContext.spanId,
          parent_span_id: traceContext.parentSpanId,
          workflow_url: workflowUrl,
          execution_id: executionId,
          response_excerpt: sanitizeWebhookResponseBodyForLog(normalizedWebhookBody),
        });

        sendError(
          request,
          response,
          502,
          "Chatbot webhook did not return a synchronous answer.",
        );
        return;
      }

      logEvent({
        level: "info",
        layer: "api",
        message: "chatbot_dispatch_success",
        traceId: traceContext.traceId,
        span_id: traceContext.spanId,
        parent_span_id: traceContext.parentSpanId,
        session_id: validationResult.value.sessionId,
      });

      response.status(200).json({
        sessionId: validationResult.value.sessionId,
        message: validationResult.value.message,
        agentResponse,
        executionId,
        status: "completed",
      });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/chats", async (request, response, next) => {
    const validationResult = validateChatMessageInput(request.body);

    if (!validationResult.valid) {
      sendError(request, response, 400, validationResult.error);
      return;
    }

    const requestedEnvironment = getRequestedEnvironment(request);
    const { workflowUrl, basicAuthUser, basicAuthPassword } =
      resolveChatbotWebhookConfig(request, requestedEnvironment);

    if (!workflowUrl) {
      const traceCtx = getTraceContext(request);
      logEvent({
        level: "error",
        layer: "webhook",
        message: "chatbot_webhook_not_configured",
        traceId: traceCtx.traceId,
        span_id: traceCtx.spanId,
        parent_span_id: traceCtx.parentSpanId,
        detail: `Webhook URL is not configured for environment '${requestedEnvironment}'. Set SCRAPE_CHATBOT_WEBHOOK_URL in a matching *.${requestedEnvironment === "test" ? "test" : "prod"}.env file.`,
      });
      sendError(request, response, 503, "Chatbot workflow is not configured.");
      return;
    }

    try {
      const traceContext = getTraceContext(request);
      const repositoryInstance = resolveRepository(request);
      const { selectedProfile, selectedSource } =
        await resolveChatProfileContext(
          repositoryInstance,
          validationResult.value.profileId,
        );

      if (!selectedProfile) {
        sendError(request, response, 404, "Profile not found.");
        return;
      }

      const createdChat = await repositoryInstance.createChat(
        {
          ...validationResult.value,
          sourceId: selectedProfile.sourceId,
        },
        traceContext.traceId,
      );

      const webhookPayload = buildChatbotWebhookPayload(
        validationResult.value,
        selectedProfile,
        selectedSource,
      );

      const webhookHeaders = buildWebhookHeaders(
        traceContext.traceparent,
        basicAuthUser,
        basicAuthPassword,
      );

      const resolvedTimeoutMs = resolveChatbotWebhookTimeoutMs(request);
      const webhookOperation = "chat_create";
      logWebhookRequestStarted({
        traceContext,
        operation: webhookOperation,
        workflowUrl,
        requestedEnvironment,
      });

      const webhookCall = await postWebhookWithTimeout({
        workflowUrl,
        headers: webhookHeaders,
        payload: webhookPayload,
        timeoutMs: resolvedTimeoutMs,
      });

      if (webhookCall.timedOut || !webhookCall.response) {
        logWebhookRequestFailed({
          traceContext,
          operation: webhookOperation,
          workflowUrl,
          durationMs: webhookCall.durationMs,
          error:
            webhookCall.error ??
            new Error("Chatbot workflow request timed out."),
        });

        await repositoryInstance.updateChatResponse(
          createdChat.id,
          `Chatbot workflow timed out after ${Math.ceil(resolvedTimeoutMs / 1000)} seconds.`,
          null,
          "failed",
        );

        logEvent({
          level: "error",
          layer: "webhook",
          message: "chatbot_webhook_timeout",
          traceId: traceContext.traceId,
          span_id: traceContext.spanId,
          parent_span_id: traceContext.parentSpanId,
          workflow_url: workflowUrl,
          timeout_ms: resolvedTimeoutMs,
        });

        sendError(
          request,
          response,
          504,
          `Chatbot workflow timed out after ${Math.ceil(resolvedTimeoutMs / 1000)} seconds.`,
        );
        return;
      }

      const workflowResponse = webhookCall.response;

      logWebhookRequestCompleted({
        traceContext,
        operation: webhookOperation,
        workflowUrl,
        workflowResponse,
        durationMs: webhookCall.durationMs,
      });

      if (!workflowResponse.ok) {
        let webhookResponseBody;
        try {
          webhookResponseBody = await workflowResponse.text();
        } catch {
          webhookResponseBody = "(could not read response body)";
        }

        await repositoryInstance.updateChatResponse(
          createdChat.id,
          "Failed to trigger chatbot workflow.",
          null,
          "failed",
        );

        logEvent({
          level: "error",
          layer: "webhook",
          message: "chatbot_webhook_trigger_failed",
          traceId: traceContext.traceId,
          span_id: traceContext.spanId,
          parent_span_id: traceContext.parentSpanId,
          http_status_code: workflowResponse.status,
          http_status_text: workflowResponse.statusText,
          workflow_url: workflowUrl,
          webhook_response_excerpt:
            sanitizeWebhookResponseBodyForLog(webhookResponseBody),
        });

        sendError(
          request,
          response,
          502,
          "Failed to trigger chatbot workflow.",
        );
        return;
      }

      const { normalizedWebhookBody, responseBody } =
        await readWebhookResponsePayload(workflowResponse);
      const { agentResponse, executionId } = extractChatbotResponsePayload(
        responseBody,
        normalizedWebhookBody,
      );

      if (!agentResponse || agentResponse.trim().length === 0) {
        await repositoryInstance.updateChatResponse(
          createdChat.id,
          "Chatbot webhook did not return a synchronous answer.",
          executionId,
          "failed",
        );

        logEvent({
          level: "error",
          layer: "webhook",
          message: "chatbot_webhook_missing_answer",
          traceId: traceContext.traceId,
          span_id: traceContext.spanId,
          parent_span_id: traceContext.parentSpanId,
          workflow_url: workflowUrl,
          execution_id: executionId,
          response_excerpt: sanitizeWebhookResponseBodyForLog(normalizedWebhookBody),
        });

        sendError(
          request,
          response,
          502,
          "Chatbot webhook did not return a synchronous answer.",
        );
        return;
      }

      const updatedChat = await repositoryInstance.updateChatResponse(
        createdChat.id,
        agentResponse,
        executionId,
        "completed",
      );

      response.status(201).json(updatedChat ?? createdChat);
    } catch (error) {
      next(error);
    }
  });

  // Notification Profiles Endpoints
  app.get("/api/notification-profiles", async (request, response, next) => {
    try {
      const profiles =
        await resolveRepository(request).listNotificationProfiles();
      response.json(profiles);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/notification-profiles", async (request, response, next) => {
    const { name, description, channels } = request.body;

    if (!name || typeof name !== "string" || !name.trim()) {
      sendError(
        request,
        response,
        400,
        "Notification profile name is required.",
      );
      return;
    }

    const channelsValidation = validateNotificationChannels(channels);
    if (!channelsValidation.valid) {
      sendError(request, response, 400, channelsValidation.error);
      return;
    }

    try {
      const createdProfile = await resolveRepository(
        request,
      ).createNotificationProfile({
        name,
        description: description || "",
        channels,
      });
      response.status(201).json(createdProfile);
    } catch (error) {
      next(error);
    }
  });

  app.put("/api/notification-profiles/:id", async (request, response, next) => {
    const notificationProfileId = parseProfileId(request.params.id);

    if (notificationProfileId === null) {
      sendError(
        request,
        response,
        400,
        "Notification profile id must be a positive integer.",
      );
      return;
    }

    const { name, description, channels } = request.body;

    if (!name || typeof name !== "string" || !name.trim()) {
      sendError(
        request,
        response,
        400,
        "Notification profile name is required.",
      );
      return;
    }

    const channelsValidation = validateNotificationChannels(channels);
    if (!channelsValidation.valid) {
      sendError(request, response, 400, channelsValidation.error);
      return;
    }

    try {
      const updatedProfile = await resolveRepository(
        request,
      ).updateNotificationProfile(notificationProfileId, {
        name,
        description: description || "",
        channels,
      });

      if (updatedProfile === null) {
        sendError(request, response, 404, "Notification profile not found.");
        return;
      }

      response.json(updatedProfile);
    } catch (error) {
      next(error);
    }
  });

  app.delete(
    "/api/notification-profiles/:id",
    async (request, response, next) => {
      const notificationProfileId = parseProfileId(request.params.id);

      if (notificationProfileId === null) {
        sendError(
          request,
          response,
          400,
          "Notification profile id must be a positive integer.",
        );
        return;
      }

      try {
        const deleted = await resolveRepository(
          request,
        ).deleteNotificationProfile(notificationProfileId);

        if (!deleted) {
          sendError(request, response, 404, "Notification profile not found.");
          return;
        }

        response.status(204).end();
      } catch (error) {
        next(error);
      }
    },
  );

  app.use((error, request, response, _next) => {
    const traceContext = getTraceContext(request);
    const safeHeaders = sanitizeHeadersForLog(request.headers);

    // Build cause chain for nested errors
    const causesChain = [];
    let cursor = error?.cause;
    while (cursor instanceof Error && causesChain.length < 5) {
      causesChain.push({
        name: cursor.name,
        message: cursor.message,
        stack: cursor.stack,
      });
      cursor = cursor.cause;
    }

    logEvent({
      level: "error",
      layer: "api",
      message: "profiles_api_unhandled_error",
      traceId: traceContext.traceId,
      span_id: traceContext.spanId,
      parent_span_id: traceContext.parentSpanId,
      http_method: request.method,
      http_route: request.originalUrl,
      http_query:
        Object.keys(request.query).length > 0
          ? sanitizeForLog(request.query)
          : undefined,
      request_headers: safeHeaders,
      error_name: error instanceof Error ? error.name : "UnknownError",
      error_message: truncateForLog(
        error instanceof Error ? error.message : String(error),
      ),
      error_stack:
        error instanceof Error && typeof error.stack === "string"
          ? truncateForLog(error.stack)
          : undefined,
      error_causes: causesChain.length > 0 ? sanitizeForLog(causesChain) : undefined,
    });

    sendError(request, response, 500, "Internal server error.");
  });

  return app;
}
