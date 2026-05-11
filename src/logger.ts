import pino from "pino";

type WebLogLevel = "debug" | "info" | "warn" | "error";

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

  webLogger[level](
    {
      log_prefix: prefix,
      layer: normalizedLayer,
      trace_id: normalizedTraceId,
      ...fields,
    },
    message,
  );
}
