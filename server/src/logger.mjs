import pino from "pino";

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

  logger[normalizedLevel](
    {
      log_prefix: prefix,
      layer: normalizedLayer,
      trace_id: normalizedTraceId,
      ...fields,
    },
    message,
  );
}
