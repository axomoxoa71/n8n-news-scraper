function isObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeOptionalText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeTagName(value) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
}

function normalizeRoleName(value) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
}

export function validateProfileInput(input) {
  if (!isObject(input)) {
    return { valid: false, error: "Profile payload must be a JSON object." };
  }

  const name = normalizeOptionalText(input.name);
  const description = normalizeOptionalText(input.description);
  const useCustomSources = input.useCustomSources === true;

  if (!name) {
    return { valid: false, error: "Profile name is required." };
  }

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

  const urls = [];
  if (useCustomSources) {
    if (!Array.isArray(input.urls) || input.urls.length === 0) {
      return { valid: false, error: "At least one profile URL is required." };
    }

    for (const entry of input.urls) {
      if (!isObject(entry)) {
        return { valid: false, error: "Each URL entry must be a JSON object." };
      }

      const url = normalizeOptionalText(entry.url);

      if (!url) {
        return { valid: false, error: "Each URL entry requires a URL." };
      }

      urls.push({
        url,
        description: normalizeOptionalText(entry.description),
      });
    }
  }

  const rssFeeds = [];
  if (useCustomSources) {
    if (!Array.isArray(input.rssFeeds) || input.rssFeeds.length === 0) {
      return {
        valid: false,
        error: "At least one RSS feed entry is required.",
      };
    }

    for (const entry of input.rssFeeds) {
      if (!isObject(entry)) {
        return { valid: false, error: "Each RSS entry must be a JSON object." };
      }

      const rssFeed = {
        feedUrl: normalizeOptionalText(entry.feedUrl),
        title: normalizeOptionalText(entry.title),
        refreshCadence: normalizeOptionalText(entry.refreshCadence),
        format: normalizeOptionalText(entry.format),
        category: normalizeOptionalText(entry.category),
      };

      if (!rssFeed.feedUrl) {
        return { valid: false, error: "Each RSS entry requires a feed URL." };
      }

      if (!rssFeed.refreshCadence) {
        return {
          valid: false,
          error: "Each RSS entry requires a refresh cadence.",
        };
      }

      if (!rssFeed.format) {
        return { valid: false, error: "Each RSS entry requires a format." };
      }

      rssFeeds.push(rssFeed);
    }
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
      useCustomSources,
      tags,
      roles,
      urls,
      rssFeeds,
      notificationProfileId,
      notificationChannelIds,
    },
  };
}
