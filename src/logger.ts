import pino from "pino";

type WebLogLevel = "debug" | "info" | "warn" | "error";

const REDACTED_VALUE = "[REDACTED]";
const SENSITIVE_KEY_PATTERN =
  /(authorization|api[-_]?key|token|secret|password|passwd|cookie|set-cookie|session|credential|x-api-key)/i;
const SENSITIVE_VALUE_PATTERN =
  /(bearer\s+[a-z0-9\-._~+/]+=*|basic\s+[a-z0-9\-._~+/]+=*|sk_[a-z0-9]+)/i;

const webLogger = pino({
  level: import.meta.env.DEV ? "debug" : "info",
  base: null,
  messageKey: "message",
  browser: {
    asObject: true,
  },
  timestamp: () => `,"timestamp":"${new Date().toISOString()}"`,
});

export function logWebEvent({
  level = "info",
  layer = "web",
  message,
  traceId,
  ...fields
}: {
  level?: WebLogLevel;
  layer?: string;
  message: string;
  traceId?: string | null;
  [key: string]: unknown;
}) {
  const timestamp = new Date().toISOString();
  const normalizedLayer = layer.trim().toLowerCase() || "web";
  const normalizedTraceId = traceId?.trim().toLowerCase() || "no-trace";
  const prefix = `[${normalizedLayer}-${level}-${timestamp}-${normalizedTraceId}]`;
  const sanitizedFields = sanitizeLogValue(fields);
  const logFields =
    sanitizedFields && typeof sanitizedFields === "object" && !Array.isArray(sanitizedFields)
      ? sanitizedFields
      : {};

  webLogger[level](
    {
      log_prefix: prefix,
      layer: normalizedLayer,
      trace_id: normalizedTraceId,
      ...logFields,
    },
    message,
  );
}

function sanitizeLogValue(value: unknown, seen = new WeakSet<object>()): unknown {
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
    const sanitizedObject: Record<string, unknown> = {};

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
