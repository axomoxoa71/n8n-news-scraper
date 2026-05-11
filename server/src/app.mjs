import express from "express";
import { randomBytes } from "node:crypto";
import { logEvent } from "./logger.mjs";
import { validateProfileInput } from "./validation.mjs";

const TRACEPARENT_PATTERN =
  /^([0-9a-f]{2})-([0-9a-f]{32})-([0-9a-f]{16})-([0-9a-f]{2})(?:-.+)?$/i;

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

function parseProfileId(value) {
  const profileId = Number(value);
  return Number.isInteger(profileId) && profileId > 0 ? profileId : null;
}

function parseBoolean(value) {
  return typeof value === "boolean" ? value : null;
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
      json:
        body?.json && typeof body.json === "object" && !Array.isArray(body.json)
          ? body.json
          : null,
    },
  };
}

function parseNewsInput(body) {
  const profileId = parseProfileId(body?.profileId);
  const title = typeof body?.title === "string" ? body.title.trim() : "";
  const summary = typeof body?.summary === "string" ? body.summary.trim() : "";
  const origin = typeof body?.origin === "string" ? body.origin.trim() : "";
  const link = typeof body?.link === "string" ? body.link.trim() : "";
  const favorite = typeof body?.favorite === "boolean" ? body.favorite : false;
  const timestamp =
    typeof body?.timestamp === "string" && body.timestamp.trim()
      ? body.timestamp.trim()
      : new Date().toISOString();

  if (profileId === null) {
    return { valid: false, error: "profileId must be a positive integer." };
  }

  if (!title) {
    return { valid: false, error: "title is required." };
  }

  if (!summary) {
    return { valid: false, error: "summary is required." };
  }

  if (!origin) {
    return { valid: false, error: "origin is required." };
  }

  if (!link) {
    return { valid: false, error: "link is required." };
  }

  const parsedTimestamp = new Date(timestamp);
  if (Number.isNaN(parsedTimestamp.getTime())) {
    return { valid: false, error: "timestamp must be a valid ISO datetime." };
  }

  return {
    valid: true,
    value: {
      profileId,
      title,
      summary,
      origin,
      link,
      timestamp: parsedTimestamp.toISOString(),
      favorite,
    },
  };
}

function encodeBasicAuth(user, password) {
  return Buffer.from(`${user}:${password}`, "utf8").toString("base64");
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

export function createNewsScraperApi({
  repository,
  repositoryByEnvironment,
  scrapWebhookUrl,
  scrapWebhookBasicAuthUser,
  scrapWebhookBasicAuthPassword,
  scrapWebhookByEnvironment,
}) {
  function resolveRepository(request) {
    if (repositoryByEnvironment) {
      const env = getRequestedEnvironment(request);
      return repositoryByEnvironment[env] ?? repository;
    }
    return repository;
  }

  const app = express();
  app.locals.scrapWebhookUrl = scrapWebhookUrl;
  app.locals.scrapWebhookBasicAuthUser = scrapWebhookBasicAuthUser;
  app.locals.scrapWebhookBasicAuthPassword = scrapWebhookBasicAuthPassword;
  app.locals.scrapWebhookByEnvironment = scrapWebhookByEnvironment;

  app.use(express.json({ limit: "1mb" }));

  app.use((request, response, next) => {
    const traceContext = createTraceContext(request);
    request.traceContext = traceContext;
    response.setHeader("traceparent", traceContext.traceparent);

    const startTime = process.hrtime.bigint();

    response.on("finish", () => {
      const durationMs =
        Number(process.hrtime.bigint() - startTime) / 1_000_000;

      logEvent({
        level: "info",
        layer: "api",
        message: "http_request_completed",
        traceId: traceContext.traceId,
        span_id: traceContext.spanId,
        parent_span_id: traceContext.parentSpanId,
        http_method: request.method,
        http_route: request.originalUrl,
        http_status_code: response.statusCode,
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

      const createdProfile = await resolveRepository(request).createProfile(
        validationResult.value,
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

      const updatedProfile = await resolveRepository(request).updateProfile(
        profileId,
        validationResult.value,
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

  app.get("/api/news", async (request, response, next) => {
    const profileId = parseProfileId(request.query.profileId);

    if (profileId === null) {
      sendError(
        request,
        response,
        400,
        "profileId query parameter must be a positive integer.",
      );
      return;
    }

    try {
      const news = await resolveRepository(request).listNews(profileId);
      response.json(news);
    } catch (error) {
      next(error);
    }
  });

  app.put("/api/news/:id/favorite", async (request, response, next) => {
    const newsId = parseProfileId(request.params.id);
    const profileId = parseProfileId(request.body?.profileId);
    const favorite = parseBoolean(request.body?.favorite);

    if (newsId === null) {
      sendError(request, response, 400, "News id must be a positive integer.");
      return;
    }

    if (profileId === null) {
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
      ).updateNewsFavorite(profileId, newsId, favorite);

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
      next(error);
    }
  });

  app.get("/api/errors", async (request, response, next) => {
    const profileId = parseProfileId(request.query.profileId);

    if (profileId === null) {
      sendError(
        request,
        response,
        400,
        "profileId query parameter must be a positive integer.",
      );
      return;
    }

    const search =
      typeof request.query.search === "string" ? request.query.search : "";

    try {
      const errors = await resolveRepository(request).listErrors(
        profileId,
        search,
      );
      response.json(errors);
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/errors/:id", async (request, response, next) => {
    const profileId = parseProfileId(request.query.profileId);
    const errorId = parseProfileId(request.params.id);

    if (profileId === null) {
      sendError(
        request,
        response,
        400,
        "profileId query parameter must be a positive integer.",
      );
      return;
    }

    if (errorId === null) {
      sendError(request, response, 400, "Error id must be a positive integer.");
      return;
    }

    try {
      const errorItem = await resolveRepository(request).getError(
        profileId,
        errorId,
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
        message: "scrap_webhook_not_configured",
        traceId: traceCtx.traceId,
        span_id: traceCtx.spanId,
        parent_span_id: traceCtx.parentSpanId,
        detail: `Webhook URL is not configured for environment '${requestedEnvironment}'. Set SCRAP_WEBHOOK_URL (or N8N_WORKFLOW_URL) in a matching *.${requestedEnvironment === "test" ? "test" : "prod"}.env file.`,
      });
      sendError(request, response, 503, "Scrape workflow is not configured.");
      return;
    }

    if (!basicAuthUser || !basicAuthPassword) {
      const traceCtx = getTraceContext(request);
      logEvent({
        level: "error",
        layer: "webhook",
        message: "scrap_webhook_credentials_not_configured",
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

    const profileId = parseProfileId(request.body?.profileId);

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
      const profiles = await resolveRepository(request).listProfiles();
      const selectedProfile =
        profiles.find((profile) => profile.id === profileId) ?? null;

      if (!selectedProfile) {
        sendError(request, response, 404, "Profile not found.");
        return;
      }

      const informationChannelId =
        selectedProfile.notificationChannelIds?.[0] ??
        selectedProfile.notificationProfileId ??
        null;

      if (informationChannelId === null) {
        sendError(
          request,
          response,
          400,
          "Selected profile is not linked to an information channel.",
        );
        return;
      }

      const informationChannels =
        await resolveRepository(request).listNotificationProfiles();
      const selectedInformationChannel =
        informationChannels.find(
          (channel) => channel.id === informationChannelId,
        ) ?? null;

      if (!selectedInformationChannel) {
        sendError(request, response, 404, "Information channel not found.");
        return;
      }

      await resolveRepository(request).clearErrors(profileId);

      const webhookPayload = {
        scrape: {
          profile: selectedProfile,
          informationChannel: selectedInformationChannel,
        },
      };

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
          message: "scrap_webhook_trigger_failed",
          traceId: traceContext.traceId,
          span_id: traceContext.spanId,
          parent_span_id: traceContext.parentSpanId,
          http_status_code: workflowResponse.status,
          http_status_text: workflowResponse.statusText,
          workflow_url: workflowUrl,
          webhook_response_body: webhookResponseBody,
        });

        sendError(request, response, 502, "Failed to trigger scrape workflow.");
        return;
      }

      response.status(202).json({ status: "accepted" });
    } catch (error) {
      const traceContext = getTraceContext(request);

      logEvent({
        level: "error",
        layer: "webhook",
        message: "scrap_webhook_trigger_error",
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

    if (!Array.isArray(channels)) {
      sendError(request, response, 400, "Channels must be an array.");
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

    if (!Array.isArray(channels)) {
      sendError(request, response, 400, "Channels must be an array.");
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

    // Collect safe request headers — strip Authorization to avoid leaking secrets
    const safeHeaders = Object.fromEntries(
      Object.entries(request.headers).filter(
        ([key]) => key.toLowerCase() !== "authorization",
      ),
    );

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
        Object.keys(request.query).length > 0 ? request.query : undefined,
      request_headers: safeHeaders,
      error_name: error instanceof Error ? error.name : "UnknownError",
      error_message: error instanceof Error ? error.message : String(error),
      error_stack: error instanceof Error ? error.stack : undefined,
      error_causes: causesChain.length > 0 ? causesChain : undefined,
    });

    sendError(request, response, 500, "Internal server error.");
  });

  return app;
}
