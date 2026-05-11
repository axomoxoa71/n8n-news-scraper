import { Buffer } from "node:buffer";
import { NodeSDK } from "@opentelemetry/sdk-node";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { resourceFromAttributes } from "@opentelemetry/resources";

let sdk = null;

function trimTrailingSlash(value) {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

function parseOtlpHeaders(rawHeaders) {
  if (!rawHeaders) {
    return {};
  }

  return rawHeaders
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .reduce((headers, entry) => {
      const separatorIndex = entry.indexOf("=");

      if (separatorIndex === -1) {
        return headers;
      }

      const key = entry.slice(0, separatorIndex).trim();
      const value = entry.slice(separatorIndex + 1).trim();

      if (key && value) {
        headers[key] = value;
      }

      return headers;
    }, {});
}

function getTraceExporterConfig() {
  const grafanaOtlpEndpoint = process.env.GRAFANA_OTLP_ENDPOINT;
  const explicitTraceEndpoint = process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT;
  const explicitOtlpEndpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;

  let url = explicitTraceEndpoint;

  if (!url && explicitOtlpEndpoint) {
    url = `${trimTrailingSlash(explicitOtlpEndpoint)}/v1/traces`;
  }

  if (!url && grafanaOtlpEndpoint) {
    url = `${trimTrailingSlash(grafanaOtlpEndpoint)}/v1/traces`;
  }

  const explicitHeaders = parseOtlpHeaders(
    process.env.OTEL_EXPORTER_OTLP_HEADERS,
  );

  if (Object.keys(explicitHeaders).length > 0) {
    return { url, headers: explicitHeaders };
  }

  const grafanaOtlpUsername = process.env.GRAFANA_OTLP_USERNAME;
  const grafanaOtlpApiKey = process.env.GRAFANA_OTLP_API_KEY;

  if (!grafanaOtlpUsername || !grafanaOtlpApiKey) {
    return { url, headers: {} };
  }

  return {
    url,
    headers: {
      Authorization: `Basic ${Buffer.from(
        `${grafanaOtlpUsername}:${grafanaOtlpApiKey}`,
      ).toString("base64")}`,
    },
  };
}

function getServiceResource() {
  const serviceName =
    process.env.OTEL_SERVICE_NAME ?? process.env.OTEL_RESOURCE_SERVICE_NAME;

  const serviceVersion = process.env.OTEL_SERVICE_VERSION;
  const deploymentEnvironment = process.env.OTEL_DEPLOYMENT_ENVIRONMENT;

  const attributes = {
    "service.name": serviceName || "news-scrapper-api",
  };

  if (serviceVersion) {
    attributes["service.version"] = serviceVersion;
  }

  if (deploymentEnvironment) {
    attributes["deployment.environment.name"] = deploymentEnvironment;
  }

  return resourceFromAttributes(attributes);
}

export async function startOtelSdk() {
  if (sdk) {
    return;
  }

  const traceExporterConfig = getTraceExporterConfig();

  sdk = new NodeSDK({
    resource: getServiceResource(),
    traceExporter: new OTLPTraceExporter(traceExporterConfig),
    instrumentations: [
      getNodeAutoInstrumentations({
        "@opentelemetry/instrumentation-fs": {
          enabled: false,
        },
      }),
    ],
  });

  await sdk.start();
}

export async function stopOtelSdk() {
  if (!sdk) {
    return;
  }

  await sdk.shutdown();
  sdk = null;
}
