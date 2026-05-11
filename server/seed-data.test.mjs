/**
 * Seed Data Integration Tests
 *
 * Verifies that the seeded data matches the requirements defined in
 * the project copilot instructions (Test Data section).
 *
 * Prerequisites: API must be running and seed:profiles must have been executed.
 *
 * Usage:
 *   node --test server/seed-data.test.mjs
 *   API_BASE_URL=http://127.0.0.1:4300 node --test server/seed-data.test.mjs
 */

import assert from "node:assert/strict";
import test from "node:test";

const apiBaseUrl = process.env.API_BASE_URL || "http://127.0.0.1:4300";

async function fetchJson(url) {
  const response = await fetch(url);
  assert.ok(response.ok, `Request failed (${response.status}) for ${url}`);
  return response.json();
}

// ---------------------------------------------------------------------------
// Profile baseline
// ---------------------------------------------------------------------------

test("exactly 4 profiles are seeded", async () => {
  const profiles = await fetchJson(`${apiBaseUrl}/api/profiles`);
  assert.equal(
    profiles.length,
    4,
    `Expected 4 profiles, got ${profiles.length}`,
  );
});

test("AI LLM profile exists", async () => {
  const profiles = await fetchJson(`${apiBaseUrl}/api/profiles`);
  const profile = profiles.find((p) => p.name === "AI LLM");
  assert.ok(profile, 'Profile "AI LLM" not found');
});

test("Error Test Profile exists", async () => {
  const profiles = await fetchJson(`${apiBaseUrl}/api/profiles`);
  const profile = profiles.find((p) => p.name === "Error Test Profile");
  assert.ok(profile, 'Profile "Error Test Profile" not found');
});

test("Agent Ecosystem profile exists", async () => {
  const profiles = await fetchJson(`${apiBaseUrl}/api/profiles`);
  const profile = profiles.find((p) => p.name === "Agent Ecosystem");
  assert.ok(profile, 'Profile "Agent Ecosystem" not found');
});

test("Model Releases profile exists", async () => {
  const profiles = await fetchJson(`${apiBaseUrl}/api/profiles`);
  const profile = profiles.find((p) => p.name === "Model Releases");
  assert.ok(profile, 'Profile "Model Releases" not found');
});

// ---------------------------------------------------------------------------
// Per-profile: URLs, RSS, tags, roles counts (each must have >= 3)
// ---------------------------------------------------------------------------

// URL and RSS counts only apply to profiles with useCustomSources=true
for (const profileName of ["AI LLM", "Agent Ecosystem", "Model Releases"]) {
  test(`${profileName}: has at least 3 URLs`, async () => {
    const profiles = await fetchJson(`${apiBaseUrl}/api/profiles`);
    const profile = profiles.find((p) => p.name === profileName);
    assert.ok(profile, `Profile "${profileName}" not found`);
    assert.ok(
      (profile.urls ?? []).length >= 3,
      `"${profileName}" expected >= 3 URLs, got ${(profile.urls ?? []).length}`,
    );
  });

  test(`${profileName}: has at least 3 RSS feeds`, async () => {
    const profiles = await fetchJson(`${apiBaseUrl}/api/profiles`);
    const profile = profiles.find((p) => p.name === profileName);
    assert.ok(profile, `Profile "${profileName}" not found`);
    assert.ok(
      (profile.rssFeeds ?? []).length >= 3,
      `"${profileName}" expected >= 3 RSS feeds, got ${(profile.rssFeeds ?? []).length}`,
    );
  });

  test(`${profileName}: has at least 3 tags`, async () => {
    const profiles = await fetchJson(`${apiBaseUrl}/api/profiles`);
    const profile = profiles.find((p) => p.name === profileName);
    assert.ok(profile, `Profile "${profileName}" not found`);
    assert.ok(
      (profile.tags ?? []).length >= 3,
      `"${profileName}" expected >= 3 tags, got ${(profile.tags ?? []).length}`,
    );
  });

  test(`${profileName}: has at least 3 roles`, async () => {
    const profiles = await fetchJson(`${apiBaseUrl}/api/profiles`);
    const profile = profiles.find((p) => p.name === profileName);
    assert.ok(profile, `Profile "${profileName}" not found`);
    assert.ok(
      (profile.roles ?? []).length >= 3,
      `"${profileName}" expected >= 3 roles, got ${(profile.roles ?? []).length}`,
    );
  });

  test(`${profileName}: has exactly 3 news items`, async () => {
    const profiles = await fetchJson(`${apiBaseUrl}/api/profiles`);
    const profile = profiles.find((p) => p.name === profileName);
    assert.ok(profile, `Profile "${profileName}" not found`);
    const news = await fetchJson(
      `${apiBaseUrl}/api/news?profileId=${profile.id}`,
    );
    assert.equal(
      news.length,
      3,
      `"${profileName}" expected 3 news items, got ${news.length}`,
    );
  });
}

// Error Test Profile has no custom sources so no URL/RSS checks, but still needs tags, roles, and news
for (const check of ["tags", "roles"]) {
  test(`Error Test Profile: has at least 3 ${check}`, async () => {
    const profiles = await fetchJson(`${apiBaseUrl}/api/profiles`);
    const profile = profiles.find((p) => p.name === "Error Test Profile");
    assert.ok(profile, 'Profile "Error Test Profile" not found');
    assert.ok(
      (profile[check] ?? []).length >= 3,
      `"Error Test Profile" expected >= 3 ${check}, got ${(profile[check] ?? []).length}`,
    );
  });
}

test("Error Test Profile: has exactly 3 news items", async () => {
  const profiles = await fetchJson(`${apiBaseUrl}/api/profiles`);
  const profile = profiles.find((p) => p.name === "Error Test Profile");
  assert.ok(profile, 'Profile "Error Test Profile" not found');
  const news = await fetchJson(
    `${apiBaseUrl}/api/news?profileId=${profile.id}`,
  );
  assert.equal(
    news.length,
    3,
    `"Error Test Profile" expected 3 news items, got ${news.length}`,
  );
});

// ---------------------------------------------------------------------------
// AI LLM profile: specific URLs and RSS required by copilot instructions
// ---------------------------------------------------------------------------

test("AI LLM profile contains https://invalid/ URL", async () => {
  const profiles = await fetchJson(`${apiBaseUrl}/api/profiles`);
  const profile = profiles.find((p) => p.name === "AI LLM");
  assert.ok(profile, 'Profile "AI LLM" not found');
  const urls = (profile.urls ?? []).map((u) => u.url);
  assert.ok(
    urls.includes("https://invalid/"),
    `AI LLM expected URL "https://invalid/", found: ${JSON.stringify(urls)}`,
  );
});

test("AI LLM profile contains https://www.technologyreview.com/topic/artificial-intelligence/ URL", async () => {
  const profiles = await fetchJson(`${apiBaseUrl}/api/profiles`);
  const profile = profiles.find((p) => p.name === "AI LLM");
  assert.ok(profile, 'Profile "AI LLM" not found');
  const urls = (profile.urls ?? []).map((u) => u.url);
  assert.ok(
    urls.includes(
      "https://www.technologyreview.com/topic/artificial-intelligence/",
    ),
    `AI LLM missing MIT Technology Review URL, found: ${JSON.stringify(urls)}`,
  );
});

test("AI LLM profile contains https://www.unite.ai/ URL", async () => {
  const profiles = await fetchJson(`${apiBaseUrl}/api/profiles`);
  const profile = profiles.find((p) => p.name === "AI LLM");
  assert.ok(profile, 'Profile "AI LLM" not found');
  const urls = (profile.urls ?? []).map((u) => u.url);
  assert.ok(
    urls.includes("https://www.unite.ai/"),
    `AI LLM missing unite.ai URL, found: ${JSON.stringify(urls)}`,
  );
});

test("AI LLM profile contains https://aiuniverseexplorer.com/ai-news-aggregator/ URL", async () => {
  const profiles = await fetchJson(`${apiBaseUrl}/api/profiles`);
  const profile = profiles.find((p) => p.name === "AI LLM");
  assert.ok(profile, 'Profile "AI LLM" not found');
  const urls = (profile.urls ?? []).map((u) => u.url);
  assert.ok(
    urls.includes("https://aiuniverseexplorer.com/ai-news-aggregator/"),
    `AI LLM missing aiuniverseexplorer URL, found: ${JSON.stringify(urls)}`,
  );
});

test("AI LLM profile contains https://invalid/rss.xml RSS feed", async () => {
  const profiles = await fetchJson(`${apiBaseUrl}/api/profiles`);
  const profile = profiles.find((p) => p.name === "AI LLM");
  assert.ok(profile, 'Profile "AI LLM" not found');
  const feeds = (profile.rssFeeds ?? []).map((f) => f.feedUrl);
  assert.ok(
    feeds.includes("https://invalid/rss.xml"),
    `AI LLM expected RSS "https://invalid/rss.xml", found: ${JSON.stringify(feeds)}`,
  );
});

test("AI LLM profile contains https://planet-ai.net/rss.xml RSS feed", async () => {
  const profiles = await fetchJson(`${apiBaseUrl}/api/profiles`);
  const profile = profiles.find((p) => p.name === "AI LLM");
  assert.ok(profile, 'Profile "AI LLM" not found');
  const feeds = (profile.rssFeeds ?? []).map((f) => f.feedUrl);
  assert.ok(
    feeds.includes("https://planet-ai.net/rss.xml"),
    `AI LLM missing Planet AI RSS feed, found: ${JSON.stringify(feeds)}`,
  );
});

test("AI LLM profile tags include llm, anthropic, claude", async () => {
  const profiles = await fetchJson(`${apiBaseUrl}/api/profiles`);
  const profile = profiles.find((p) => p.name === "AI LLM");
  assert.ok(profile, 'Profile "AI LLM" not found');
  const tags = profile.tags ?? [];
  for (const expected of ["llm", "anthropic", "claude"]) {
    assert.ok(
      tags.includes(expected),
      `AI LLM missing tag "${expected}", found: ${JSON.stringify(tags)}`,
    );
  }
});

test("AI LLM profile roles include Solution Architect and Software Engineer", async () => {
  const profiles = await fetchJson(`${apiBaseUrl}/api/profiles`);
  const profile = profiles.find((p) => p.name === "AI LLM");
  assert.ok(profile, 'Profile "AI LLM" not found');
  const roles = profile.roles ?? [];
  for (const expected of ["Solution Architect", "Software Engineer"]) {
    assert.ok(
      roles.includes(expected),
      `AI LLM missing role "${expected}", found: ${JSON.stringify(roles)}`,
    );
  }
});

// ---------------------------------------------------------------------------
// Error Test Profile: 3 deterministic errors
// ---------------------------------------------------------------------------

test("Error Test Profile has exactly 3 seeded errors", async () => {
  const profiles = await fetchJson(`${apiBaseUrl}/api/profiles`);
  const profile = profiles.find((p) => p.name === "Error Test Profile");
  assert.ok(profile, 'Profile "Error Test Profile" not found');
  const errors = await fetchJson(
    `${apiBaseUrl}/api/errors?profileId=${profile.id}`,
  );
  assert.equal(
    errors.length,
    3,
    `Error Test Profile expected 3 errors, got ${errors.length}`,
  );
});

test("Error Test Profile errors have deterministic trace IDs", async () => {
  const profiles = await fetchJson(`${apiBaseUrl}/api/profiles`);
  const profile = profiles.find((p) => p.name === "Error Test Profile");
  assert.ok(profile, 'Profile "Error Test Profile" not found');
  const errors = await fetchJson(
    `${apiBaseUrl}/api/errors?profileId=${profile.id}`,
  );
  const traceIds = errors.map((e) => e.traceId);
  const expected = [
    "e4e4f6dd2df74f34b7746e72e5f67011",
    "e4e4f6dd2df74f34b7746e72e5f67012",
    "e4e4f6dd2df74f34b7746e72e5f67013",
  ];
  for (const traceId of expected) {
    assert.ok(
      traceIds.includes(traceId),
      `Error Test Profile missing error with traceId "${traceId}", found: ${JSON.stringify(traceIds)}`,
    );
  }
});

// ---------------------------------------------------------------------------
// Notification channel
// ---------------------------------------------------------------------------

test("Test Channel notification profile exists with correct email", async () => {
  const notifProfiles = await fetchJson(
    `${apiBaseUrl}/api/notification-profiles`,
  );
  const channel = notifProfiles.find((n) => n.name === "Test Channel");
  assert.ok(channel, '"Test Channel" notification profile not found');
  const emails = (channel.channels ?? [])
    .filter((c) => c.channelType === "email")
    .flatMap((c) => c.emailAddresses ?? []);
  assert.ok(
    emails.includes("robert.bernhard71@gmail.com"),
    `Test Channel missing expected email address, found: ${JSON.stringify(emails)}`,
  );
});
