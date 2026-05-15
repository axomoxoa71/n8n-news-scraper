function isObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeOptionalText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function toPositiveInteger(value) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function normalizeTagName(value) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
}

function normalizeRoleName(value) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
}

function isUuid(value) {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value.trim(),
    )
  );
}

export function validateProfileInput(input) {
  if (!isObject(input)) {
    return { valid: false, error: "Profile payload must be a JSON object." };
  }

  const name = normalizeOptionalText(input.name);
  const description = normalizeOptionalText(input.description);
  const systemPrompt = normalizeOptionalText(input.systemPrompt);
  const sourceId = toPositiveInteger(input.sourceId);

  if (!name) {
    return { valid: false, error: "Profile name is required." };
  }

  // Backward compatibility: allow legacy profile payloads that do not yet send sourceId.
  // New clients should always provide sourceId.

  if (input.tags !== undefined && !Array.isArray(input.tags)) {
    return { valid: false, error: "Profile tags must be an array." };
  }

  if (input.roles !== undefined && !Array.isArray(input.roles)) {
    return { valid: false, error: "Profile roles must be an array." };
  }

  const tags = [];
  const normalizedTagNames = new Set();
  const roles = [];
  const normalizedRoleNames = new Set();

  for (const entry of input.tags ?? []) {
    const tagName = normalizeTagName(entry);

    if (!tagName) {
      return { valid: false, error: "Each tag entry requires a tag name." };
    }

    const normalizedTagKey = tagName.toLocaleLowerCase();

    if (normalizedTagNames.has(normalizedTagKey)) {
      return {
        valid: false,
        error: "Each tag name must be unique within the profile.",
      };
    }

    normalizedTagNames.add(normalizedTagKey);
    tags.push(tagName);
  }

  for (const entry of input.roles ?? []) {
    const roleName = normalizeRoleName(entry);

    if (!roleName) {
      return { valid: false, error: "Each role entry requires a role name." };
    }

    const normalizedRoleKey = roleName.toLocaleLowerCase();

    if (normalizedRoleNames.has(normalizedRoleKey)) {
      return {
        valid: false,
        error: "Each role name must be unique within the profile.",
      };
    }

    normalizedRoleNames.add(normalizedRoleKey);
    roles.push(roleName);
  }

  if (
    input.notificationChannelIds !== undefined &&
    !Array.isArray(input.notificationChannelIds)
  ) {
    return {
      valid: false,
      error: "Notification channel ids must be an array.",
    };
  }

  const notificationChannelIds = [];
  const seenNotificationChannelIds = new Set();

  for (const entry of input.notificationChannelIds ?? []) {
    const channelId = Number(entry);

    if (!Number.isInteger(channelId) || channelId <= 0) {
      return {
        valid: false,
        error: "Each notification channel id must be a positive integer.",
      };
    }

    if (seenNotificationChannelIds.has(channelId)) {
      continue;
    }

    seenNotificationChannelIds.add(channelId);
    notificationChannelIds.push(channelId);
  }

  let notificationProfileId = null;
  if (
    input.notificationProfileId !== undefined &&
    input.notificationProfileId !== null
  ) {
    const parsedNotificationProfileId = Number(input.notificationProfileId);

    if (
      !Number.isInteger(parsedNotificationProfileId) ||
      parsedNotificationProfileId <= 0
    ) {
      return {
        valid: false,
        error: "Notification profile id must be a positive integer.",
      };
    }

    notificationProfileId = parsedNotificationProfileId;
  }

  if (notificationChannelIds.length > 0) {
    notificationProfileId = notificationChannelIds[0];
  }

  return {
    valid: true,
    value: {
      name,
      description,
      systemPrompt,
      sourceId,
      useCustomSources: true,
      tags,
      roles,
      notificationProfileId,
      notificationChannelIds,
    },
  };
}

export function validateSourceInput(input) {
  if (!isObject(input)) {
    return { valid: false, error: "Source payload must be a JSON object." };
  }

  const name = normalizeOptionalText(input.name);
  const description = normalizeOptionalText(input.description);

  if (!name) {
    return { valid: false, error: "Source name is required." };
  }

  if (!Array.isArray(input.urls) || input.urls.length === 0) {
    return { valid: false, error: "At least one source URL is required." };
  }

  if (!Array.isArray(input.rssFeeds) || input.rssFeeds.length === 0) {
    return { valid: false, error: "At least one source RSS feed is required." };
  }

  const urls = [];
  for (const entry of input.urls) {
    if (!isObject(entry)) {
      return {
        valid: false,
        error: "Each source URL entry must be a JSON object.",
      };
    }

    const url = normalizeOptionalText(entry.url);
    if (!url) {
      return { valid: false, error: "Each source URL entry requires a URL." };
    }

    urls.push({
      url,
      description: normalizeOptionalText(entry.description),
    });
  }

  const rssFeeds = [];
  for (const entry of input.rssFeeds) {
    if (!isObject(entry)) {
      return {
        valid: false,
        error: "Each source RSS entry must be a JSON object.",
      };
    }

    const rssFeed = {
      feedUrl: normalizeOptionalText(entry.feedUrl),
      description: normalizeOptionalText(entry.description),
    };

    if (!rssFeed.feedUrl) {
      return {
        valid: false,
        error: "Each source RSS entry requires a feed URL.",
      };
    }

    rssFeeds.push(rssFeed);
  }

  return {
    valid: true,
    value: {
      name,
      description,
      urls,
      rssFeeds,
    },
  };
}

export function validateChatMessageInput(input) {
  if (!isObject(input)) {
    return {
      valid: false,
      error: "Chat message payload must be a JSON object.",
    };
  }

  const profileId = input.profileId;
  const sessionId = normalizeOptionalText(input.sessionId);
  const message = normalizeOptionalText(input.message);

  if (typeof profileId !== "number" || profileId < 1) {
    return { valid: false, error: "Profile id must be a positive integer." };
  }

  if (!isUuid(sessionId)) {
    return { valid: false, error: "Session id must be a valid UUID." };
  }

  if (!message) {
    return { valid: false, error: "Message is required." };
  }

  if (message.length > 2000) {
    return {
      valid: false,
      error: "Message cannot exceed 2000 characters.",
    };
  }

  return {
    valid: true,
    value: {
      profileId,
      sessionId,
      message,
    },
  };
}
