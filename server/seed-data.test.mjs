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
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import { dirname, join } from "node:path";
import test, { after, before } from "node:test";
import { fileURLToPath } from "node:url";
import { createNewsScraperApi } from "./src/app.mjs";
import { createMemoryProfilesRepository } from "./src/memory-repository.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const seedFilePath = join(__dirname, "sql/seed-profiles.json");
const seedProfiles = JSON.parse(readFileSync(seedFilePath, "utf8"));

function sha256Hex(value) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function createNewsHash(url, title) {
  return sha256Hex(`${url}${title}`);
}

let apiBaseUrl = process.env.API_BASE_URL || "";
let testServer;

async function seedRepository(repository) {
  for (const profile of seedProfiles) {
    const notificationProfilePayload = profile._notificationProfile;
    let notificationChannelIds = [];

    if (notificationProfilePayload) {
      const createdNotificationProfile =
        await repository.createNotificationProfile(notificationProfilePayload);
      notificationChannelIds = [createdNotificationProfile.id];
    }

    const createdSource = await repository.createSource({
      name: profile.name,
      description: "A source for AI news demonstration.",
      urls: profile.urls ?? [],
      rssFeeds: profile.rssFeeds ?? [],
    });

    const createdProfile = await repository.createProfile({
      name: profile.name,
      description: profile.description,
      systemPrompt: profile.systemPrompt,
      useCustomSources: true,
      tags: profile.tags ?? [],
      roles: profile.roles ?? [],
      sourceId: createdSource.id,
      notificationChannelIds,
      notificationProfileId: notificationChannelIds[0] ?? null,
    });

    for (const seedError of profile._seedErrors ?? []) {
      await repository.createError({
        ...seedError,
        profileId: createdProfile.id,
      });
    }

    const expectedSeedNewsCount = Number.isInteger(profile._seedNewsCount)
      ? profile._seedNewsCount
      : createdProfile.name === "AI Demo"
        ? 0
        : 3;

    if (expectedSeedNewsCount > 0) {
      const now = Date.now();
      const slug = String(createdProfile.name)
        .toLocaleLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");

      for (let sequence = 1; sequence <= expectedSeedNewsCount; sequence += 1) {
        const url = `https://example.com/news/${slug}-${sequence}`;
        const title = `${createdProfile.name}: Daily Briefing ${sequence}`;

        await repository.createNewsItem({
          newsId: createNewsHash(url, title),
          sourceId: createdProfile.sourceId,
          title,
          summary: `Seeded sample news item ${sequence} for ${createdProfile.name}.`,
          origin: "Seed Runner",
          url,
          timestamp: new Date(now - sequence * 15 * 60 * 1000).toISOString(),
          favorite: sequence === 2,
        });
      }
    }
  }
}

before(async () => {
  if (apiBaseUrl) {
    return;
  }

  const repository = createMemoryProfilesRepository({ seedBaseline: false });
  await repository.initialize();
  await seedRepository(repository);

  const api = createNewsScraperApi({ repository });
  testServer = createServer(api);

  await new Promise((resolve) => testServer.listen(0, "127.0.0.1", resolve));

  const address = testServer.address();

  if (address === null || typeof address === "string") {
    throw new Error("Could not determine seed test server address.");
  }

  apiBaseUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  if (!testServer) {
    return;
  }

  await new Promise((resolve, reject) => {
    testServer.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
});

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

test("AI Demo profile exists", async () => {
  const profiles = await fetchJson(`${apiBaseUrl}/api/profiles`);
  const profile = profiles.find((p) => p.name === "AI Demo");
  assert.ok(profile, 'Profile "AI Demo" not found');
  assert.equal(
    profile.description,
    "A profile AI news demonstration",
    "AI Demo description does not match the instruction-defined seed baseline",
  );
  assert.equal(
    profile.systemPrompt,
    "You are an AI news assistant who focuses on news related to the tags and for the roles provided in this profile. You provide concise and informative summaries of the latest developments in the AI field, tailored to the interests of the users linked to this profile.",
    "AI Demo systemPrompt does not match the instruction-defined seed baseline",
  );
  assert.deepEqual(profile.roles, [
    "Solution Architect",
    "Software Engineer",
    "Product Manager",
  ]);
  for (const requiredTag of [
    "llm",
    "openai",
    "claude",
    "anthropic",
    "meta",
    "agentic AI",
    "MCP",
    "RAG",
  ]) {
    assert.ok(
      (profile.tags ?? []).includes(requiredTag),
      `AI Demo missing tag "${requiredTag}", found: ${JSON.stringify(profile.tags ?? [])}`,
    );
  }
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
// Source baseline
// ---------------------------------------------------------------------------

test("exactly 4 sources are seeded", async () => {
  const sources = await fetchJson(`${apiBaseUrl}/api/sources`);
  assert.equal(sources.length, 4, `Expected 4 sources, got ${sources.length}`);
});

test("AI Demo source exists with required RSS set", async () => {
  const sources = await fetchJson(`${apiBaseUrl}/api/sources`);
  const source = sources.find((entry) => entry.name === "AI Demo");
  assert.ok(source, 'Source "AI Demo" not found');
  assert.equal(
    source.description,
    "A source for AI news demonstration.",
    "AI Demo source description does not match the instruction-defined seed baseline",
  );
  assert.deepEqual(
    (source.urls ?? []).map((entry) => entry.url),
    ["https://ai.meta.com/blog/"],
    `"AI Demo" URLs do not match instruction-defined baseline`,
  );

  const feeds = new Set((source.rssFeeds ?? []).map((f) => f.feedUrl));
  for (const requiredFeed of [
    "https://openai.com/news/rss.xml",
    "https://huggingface.co/blog/feed.xml",
    "https://github.com/axomoxoa71/news-scrapper/blob/main/news/ai-news.opml",
  ]) {
    assert.ok(
      feeds.has(requiredFeed),
      `AI Demo source missing RSS "${requiredFeed}", found: ${JSON.stringify(Array.from(feeds))}`,
    );
  }
});

test("AI Demo notification profile exists with configured email channel", async () => {
  const notificationProfiles = await fetchJson(
    `${apiBaseUrl}/api/notification-profiles`,
  );
  const profile = notificationProfiles.find(
    (entry) => entry.name === "AI Demo",
  );
  assert.ok(profile, 'Notification profile "AI Demo" not found');
  assert.equal(
    profile.description,
    "AI Demo notification channel for development.",
    "AI Demo notification profile description does not match the instruction-defined seed baseline",
  );
  assert.equal(
    (profile.channels ?? []).length,
    1,
    `AI Demo notification profile expected 1 channel, got ${(profile.channels ?? []).length}`,
  );
  assert.deepEqual(profile.channels[0]?.emailAddresses ?? [], [
    "robert.bernhard71@gmail.com",
  ]);
});

test("tags endpoint returns seeded tags", async () => {
  const tags = await fetchJson(`${apiBaseUrl}/api/tags`);
  assert.ok(tags.length > 0, "Expected at least one seeded tag");

  for (const requiredTag of ["agents", "benchmark", "llm", "errors"]) {
    assert.ok(
      tags.some((entry) => entry.tag === requiredTag),
      `Expected seeded tag "${requiredTag}" to exist`,
    );
  }
});

// ---------------------------------------------------------------------------
// Per-profile: URLs, RSS, tags, roles counts
// ---------------------------------------------------------------------------

const expectedUrlCountByProfile = Object.fromEntries(
  seedProfiles.map((profile) => [profile.name, (profile.urls ?? []).length]),
);

const expectedNewsCountByProfile = Object.fromEntries(
  seedProfiles.map((profile) => [
    profile.name,
    Number.isInteger(profile._seedNewsCount)
      ? profile._seedNewsCount
      : profile.name === "AI Demo"
        ? 0
        : 3,
  ]),
);

for (const profileName of [
  "AI Demo",
  "Agent Ecosystem",
  "Model Releases",
  "Error Test Profile",
]) {
  test(`${profileName}: has expected URL count`, async () => {
    const profiles = await fetchJson(`${apiBaseUrl}/api/profiles`);
    const profile = profiles.find((p) => p.name === profileName);
    assert.ok(profile, `Profile "${profileName}" not found`);
    assert.equal(
      (profile.urls ?? []).length,
      expectedUrlCountByProfile[profileName],
      `"${profileName}" expected ${expectedUrlCountByProfile[profileName]} URLs, got ${(profile.urls ?? []).length}`,
    );
  });

  test(`news endpoint supports tag filtering (${profileName})`, async () => {
    const profiles = await fetchJson(`${apiBaseUrl}/api/profiles`);
    const profileWithNews = profiles.find(
      (entry) => expectedNewsCountByProfile[entry.name] > 0,
    );
    assert.ok(profileWithNews, "Expected at least one seeded profile with news");

    const allNews = await fetchJson(
      `${apiBaseUrl}/api/news?profileId=${profileWithNews.id}`,
    );
    const tags = await fetchJson(`${apiBaseUrl}/api/tags`);
    const seededTag = tags.find((entry) => {
      const profileTags = Array.isArray(profileWithNews.tags)
        ? profileWithNews.tags
        : [];
      return profileTags.includes(entry.tag);
    });

    assert.ok(seededTag, "No seeded tag found for selected profile");

    const filteredNews = await fetchJson(
      `${apiBaseUrl}/api/news?profileId=${profileWithNews.id}&tagIds=${seededTag.id}`,
    );

    assert.ok(
      Array.isArray(filteredNews),
      "Filtered news response should be an array",
    );
    assert.ok(
      filteredNews.length <= allNews.length,
      "Filtered news should not exceed unfiltered news",
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

  test(`${profileName}: has expected seeded news count`, async () => {
    const profiles = await fetchJson(`${apiBaseUrl}/api/profiles`);
    const profile = profiles.find((p) => p.name === profileName);
    assert.ok(profile, `Profile "${profileName}" not found`);
    const news = await fetchJson(
      `${apiBaseUrl}/api/news?sourceId=${profile.sourceId}`,
    );
    assert.equal(
      news.length,
      expectedNewsCountByProfile[profileName],
      `"${profileName}" expected ${expectedNewsCountByProfile[profileName]} news items, got ${news.length}`,
    );

    for (const item of news) {
      assert.match(
        item.newsId,
        /^[0-9a-f]{64}$/,
        `"${profileName}" expected SHA-256 newsId, got ${item.newsId}`,
      );
      assert.equal(
        item.newsId,
        sha256Hex(`${item.url}${item.title}`),
        `"${profileName}" newsId does not match SHA-256(url + title) for "${item.title}"`,
      );
    }
  });
}

// ---------------------------------------------------------------------------
// AI Demo profile: specific URLs and RSS required by copilot instructions
// ---------------------------------------------------------------------------

test("AI Demo profile contains https://ai.meta.com/blog/ URL", async () => {
  const profiles = await fetchJson(`${apiBaseUrl}/api/profiles`);
  const profile = profiles.find((p) => p.name === "AI Demo");
  assert.ok(profile, 'Profile "AI Demo" not found');
  const urls = (profile.urls ?? []).map((u) => u.url);
  assert.equal(urls.length, 1, `AI Demo expected 1 URL, found: ${JSON.stringify(urls)}`);
  assert.ok(
    urls.includes("https://ai.meta.com/blog/"),
    `AI Demo missing Meta AI blog URL, found: ${JSON.stringify(urls)}`,
  );
});

test("AI Demo profile contains https://openai.com/news/rss.xml RSS feed", async () => {
  const profiles = await fetchJson(`${apiBaseUrl}/api/profiles`);
  const profile = profiles.find((p) => p.name === "AI Demo");
  assert.ok(profile, 'Profile "AI Demo" not found');
  const feeds = (profile.rssFeeds ?? []).map((f) => f.feedUrl);
  assert.ok(
    feeds.includes("https://openai.com/news/rss.xml"),
    `AI Demo missing OpenAI RSS feed, found: ${JSON.stringify(feeds)}`,
  );
});

test("AI Demo profile contains https://huggingface.co/blog/feed.xml RSS feed", async () => {
  const profiles = await fetchJson(`${apiBaseUrl}/api/profiles`);
  const profile = profiles.find((p) => p.name === "AI Demo");
  assert.ok(profile, 'Profile "AI Demo" not found');
  const feeds = (profile.rssFeeds ?? []).map((f) => f.feedUrl);
  assert.ok(
    feeds.includes("https://huggingface.co/blog/feed.xml"),
    `AI Demo missing Hugging Face RSS feed, found: ${JSON.stringify(feeds)}`,
  );
});

test("AI Demo profile contains GitHub OPML RSS feed reference", async () => {
  const profiles = await fetchJson(`${apiBaseUrl}/api/profiles`);
  const profile = profiles.find((p) => p.name === "AI Demo");
  assert.ok(profile, 'Profile "AI Demo" not found');
  const feeds = (profile.rssFeeds ?? []).map((f) => f.feedUrl);
  assert.ok(
    feeds.includes(
      "https://github.com/axomoxoa71/news-scrapper/blob/main/news/ai-news.opml",
    ),
    `AI Demo missing OPML feed reference, found: ${JSON.stringify(feeds)}`,
  );
});

test("AI Demo profile tags include llm, openai, claude", async () => {
  const profiles = await fetchJson(`${apiBaseUrl}/api/profiles`);
  const profile = profiles.find((p) => p.name === "AI Demo");
  assert.ok(profile, 'Profile "AI Demo" not found');
  const tags = profile.tags ?? [];
  for (const expected of ["llm", "openai", "claude"]) {
    assert.ok(
      tags.includes(expected),
      `AI Demo missing tag "${expected}", found: ${JSON.stringify(tags)}`,
    );
  }
});

test("AI Demo profile roles include Solution Architect and Software Engineer", async () => {
  const profiles = await fetchJson(`${apiBaseUrl}/api/profiles`);
  const profile = profiles.find((p) => p.name === "AI Demo");
  assert.ok(profile, 'Profile "AI Demo" not found');
  const roles = profile.roles ?? [];
  for (const expected of ["Solution Architect", "Software Engineer"]) {
    assert.ok(
      roles.includes(expected),
      `AI Demo missing role "${expected}", found: ${JSON.stringify(roles)}`,
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
  const errors = (await fetchJson(`${apiBaseUrl}/api/errors`)).filter(
    (errorItem) => Number(errorItem.profileId) === profile.id,
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
  const errors = (await fetchJson(`${apiBaseUrl}/api/errors`)).filter(
    (errorItem) => Number(errorItem.profileId) === profile.id,
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

test("AI Demo notification profile exists with correct email", async () => {
  const notifProfiles = await fetchJson(
    `${apiBaseUrl}/api/notification-profiles`,
  );
  const channel = notifProfiles.find((n) => n.name === "AI Demo");
  assert.ok(channel, '"AI Demo" notification profile not found');
  const emails = (channel.channels ?? []).flatMap((c) =>
    Array.isArray(c.emailAddresses) ? c.emailAddresses : [],
  );
  assert.ok(
    emails.includes("robert.bernhard71@gmail.com"),
    `AI Demo notification profile missing expected email address, found: ${JSON.stringify(emails)}`,
  );
});
