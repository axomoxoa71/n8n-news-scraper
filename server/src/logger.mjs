import pino from "pino";

const REDACTED_VALUE = "[REDACTED]";
const SENSITIVE_KEY_PATTERN =
  /(authorization|api[-_]?key|token|secret|password|passwd|cookie|set-cookie|session|credential|x-api-key)/i;
const SENSITIVE_VALUE_PATTERN =
  /(bearer\s+[a-z0-9\-._~+/]+=*|basic\s+[a-z0-9\-._~+/]+=*|sk_[a-z0-9]+)/i;

const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  base: null,
  messageKey: "message",
  timestamp: () => `,"timestamp":"${new Date().toISOString()}"`,
  formatters: {
    level(label) {
      return { level: label };
    },
  },
});

function normalizeLevel(level) {
  if (level === "debug" || level === "info" || level === "warn") {
    return level;
  }

  return "error";
}

function sanitizeLogValue(value, seen = new WeakSet()) {
  if (typeof value === "string") {
    return SENSITIVE_VALUE_PATTERN.test(value) ? REDACTED_VALUE : value;
  }

  if (Array.isArray(value)) {
    return value.map((entry) => sanitizeLogValue(entry, seen));
  }

  if (value && typeof value === "object") {
    if (seen.has(value)) {
      return "[Circular]";
    }

    seen.add(value);

    const sanitizedObject = {};
    for (const [key, nestedValue] of Object.entries(value)) {
      if (SENSITIVE_KEY_PATTERN.test(key)) {
        sanitizedObject[key] = REDACTED_VALUE;
      } else {
        sanitizedObject[key] = sanitizeLogValue(nestedValue, seen);
      }
    }

    seen.delete(value);
    return sanitizedObject;
  }

  return value;
}

export function logEvent({
  level = "info",
  layer = "api",
  message,
  traceId,
  ...fields
}) {
  const timestamp = new Date().toISOString();
  const normalizedLayer =
    typeof layer === "string" && layer.trim()
      ? layer.trim().toLowerCase()
      : "api";
  const normalizedTraceId =
    typeof traceId === "string" && traceId.trim()
      ? traceId.trim().toLowerCase()
      : "no-trace";

  const normalizedLevel = normalizeLevel(level);
  const prefix = `[${normalizedLayer}-${normalizedLevel}-${timestamp}-${normalizedTraceId}]`;
  const sanitizedFields = sanitizeLogValue(fields);

  logger[normalizedLevel](
    {
      log_prefix: prefix,
      layer: normalizedLayer,
      trace_id: normalizedTraceId,
      ...sanitizedFields,
    },
    message,
  );
}
