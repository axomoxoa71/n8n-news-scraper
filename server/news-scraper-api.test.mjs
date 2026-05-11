import assert from "node:assert/strict";
import test from "node:test";
import { createServer } from "node:http";
import { createNewsScraperApi } from "./src/app.mjs";
import { createMemoryProfilesRepository } from "./src/memory-repository.mjs";
import {
  serializeNotificationChannelSnapshot,
  serializeProfileSnapshot,
} from "./src/postgres-repository.mjs";

function createMemoryRepository() {
  let nextId = 1;
  let nextNewsId = 1;
  let nextErrorId = 1;
  const profiles = [];
  const newsItems = [];
  const errorItems = [];
  const notificationProfiles = [
    {
      id: 11,
      name: "Email Alerts",
      description: "",
      channels: [],
    },
    {
      id: 22,
      name: "Slack Alerts",
      description: "",
      channels: [],
    },
  ];

  return {
    async listProfiles() {
      return structuredClone(profiles);
    },
    async createProfile(profileInput) {
      const createdProfile = {
        ...structuredClone(profileInput),
        id: nextId++,
      };

      profiles.unshift(createdProfile);
      return structuredClone(createdProfile);
    },
    async updateProfile(profileId, profileInput) {
      const index = profiles.findIndex((profile) => profile.id === profileId);

      if (index === -1) {
        return null;
      }

      const updatedProfile = {
        ...structuredClone(profileInput),
        id: profileId,
      };

      profiles[index] = updatedProfile;
      return structuredClone(updatedProfile);
    },
    async deleteProfile(profileId) {
      const index = profiles.findIndex((profile) => profile.id === profileId);

      if (index === -1) {
        return false;
      }

      profiles.splice(index, 1);
      return true;
    },
    async listNews(profileId) {
      const matching = newsItems
        .filter((item) => item.profileId === profileId)
        .sort(
          (left, right) =>
            new Date(right.timestamp).getTime() -
            new Date(left.timestamp).getTime(),
        );

      return structuredClone(matching);
    },
    async updateNewsFavorite(profileId, newsId, favorite) {
      const index = newsItems.findIndex(
        (item) => item.id === newsId && item.profileId === profileId,
      );

      if (index === -1) {
        return null;
      }

      newsItems[index] = {
        ...newsItems[index],
        favorite,
      };

      return structuredClone(newsItems[index]);
    },
    async listErrors(profileId, searchTerm = "") {
      const normalizedSearchTerms = String(searchTerm ?? "")
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .map((term) => term.toLocaleLowerCase());

      const matching = errorItems
        .filter((item) => {
          if (item.profileId !== profileId) {
            return false;
          }

          if (normalizedSearchTerms.length === 0) {
            return true;
          }

          const searchableText = [
            String(item.id),
            item.traceId,
            item.errorMessage,
            item.errorDescription,
            item.errorStack,
            String(item.errorHttpCode),
            item.nodeName,
            item.nodeType,
            item.workflowName,
            item.workflowId,
            JSON.stringify(item.json ?? {}),
            item.createdTs,
            item.updatedTs,
          ]
            .join(" ")
            .toLocaleLowerCase();

          return normalizedSearchTerms.every((term) =>
            searchableText.includes(term),
          );
        })
        .sort(
          (left, right) =>
            new Date(right.createdTs).getTime() -
            new Date(left.createdTs).getTime(),
        );

      return structuredClone(matching);
    },
    async getError(profileId, errorId) {
      const entry = errorItems.find(
        (item) => item.id === errorId && item.profileId === profileId,
      );

      return entry ? structuredClone(entry) : null;
    },
    async createError(errorInput) {
      const now = new Date().toISOString();
      const created = {
        ...structuredClone(errorInput),
        id: nextErrorId++,
        createdTs: now,
        updatedTs: now,
      };

      errorItems.unshift(created);
      return structuredClone(created);
    },
    async clearErrors(profileId) {
      for (let index = errorItems.length - 1; index >= 0; index -= 1) {
        if (errorItems[index].profileId === profileId) {
          errorItems.splice(index, 1);
        }
      }
    },
    async createNewsItem(newsInput) {
      const created = {
        ...structuredClone(newsInput),
        id: nextNewsId++,
      };

      newsItems.unshift(created);
      return structuredClone(created);
    },
    async listNotificationProfiles() {
      return structuredClone(notificationProfiles);
    },
  };
}

async function startTestServer(apiOptions = createMemoryRepository()) {
  const config =
    apiOptions && typeof apiOptions === "object" && "repository" in apiOptions
      ? apiOptions
      : { repository: apiOptions };

  const api = createNewsScraperApi(config);
  const server = createServer(api);

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));

  const address = server.address();

  if (address === null || typeof address === "string") {
    throw new Error("Could not determine test server address.");
  }

  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    close: async () =>
      new Promise((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }

          resolve();
        });
      }),
  };
}

function createApiConfig(overrides = {}) {
  return {
    repository: createMemoryRepository(),
    ...overrides,
  };
}

test("news scraper API supports list, create, update, and delete", async () => {
  const testServer = await startTestServer(createApiConfig());

  try {
    const listResponse = await fetch(`${testServer.baseUrl}/api/profiles`);
    assert.equal(listResponse.status, 200);
    assert.deepEqual(await listResponse.json(), []);

    const createResponse = await fetch(`${testServer.baseUrl}/api/profiles`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        name: "Backend Watch",
        description: "Tracks backend changes",
        useCustomSources: true,
        tags: ["backend", "platform"],
        roles: ["Engineer", "Architect"],
        urls: [
          {
            url: "https://example.com/backend",
            description: "Primary source",
          },
        ],
        rssFeeds: [
          {
            feedUrl: "https://example.com/backend.xml",
            title: "Backend Feed",
            refreshCadence: "Hourly",
            format: "RSS 2.0",
            category: "Engineering",
          },
          {
            feedUrl: "https://example.com/backend-alt.xml",
            title: "Alt Feed",
            refreshCadence: "Twice daily",
            format: "Atom",
            category: "Secondary",
          },
        ],
      }),
    });

    assert.equal(createResponse.status, 201);
    const createdProfile = await createResponse.json();
    assert.equal(createdProfile.id, 1);
    assert.equal(createdProfile.name, "Backend Watch");
    assert.equal(createdProfile.useCustomSources, true);
    assert.deepEqual(createdProfile.tags, ["backend", "platform"]);
    assert.deepEqual(createdProfile.roles, ["Engineer", "Architect"]);

    const updateResponse = await fetch(
      `${testServer.baseUrl}/api/profiles/${createdProfile.id}`,
      {
        method: "PUT",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          name: "Backend Watch Updated",
          description: "Tracks service changes",
          useCustomSources: true,
          tags: ["platform", "services"],
          roles: ["CTO"],
          urls: [
            {
              url: "https://example.com/backend-updated",
              description: "Updated source",
            },
          ],
          rssFeeds: [
            {
              feedUrl: "https://example.com/backend-updated.xml",
              title: "Updated Feed",
              refreshCadence: "Every 30 minutes",
              format: "Atom",
              category: "Platform",
            },
          ],
        }),
      },
    );

    assert.equal(updateResponse.status, 200);
    const updatedProfile = await updateResponse.json();
    assert.equal(updatedProfile.name, "Backend Watch Updated");
    assert.equal(updatedProfile.useCustomSources, true);
    assert.equal(updatedProfile.rssFeeds[0].format, "Atom");
    assert.deepEqual(updatedProfile.tags, ["platform", "services"]);
    assert.deepEqual(updatedProfile.roles, ["CTO"]);

    const afterUpdateResponse = await fetch(
      `${testServer.baseUrl}/api/profiles`,
    );
    assert.equal(afterUpdateResponse.status, 200);
    const profilesAfterUpdate = await afterUpdateResponse.json();
    assert.equal(profilesAfterUpdate.length, 1);
    assert.equal(profilesAfterUpdate[0].name, "Backend Watch Updated");

    const deleteResponse = await fetch(
      `${testServer.baseUrl}/api/profiles/${createdProfile.id}`,
      {
        method: "DELETE",
      },
    );

    assert.equal(deleteResponse.status, 204);

    const afterDeleteResponse = await fetch(
      `${testServer.baseUrl}/api/profiles`,
    );
    assert.equal(afterDeleteResponse.status, 200);
    assert.deepEqual(await afterDeleteResponse.json(), []);
  } finally {
    await testServer.close();
  }
});

test("news scraper API rejects duplicate tag names within the same profile", async () => {
  const testServer = await startTestServer(createApiConfig());

  try {
    const createResponse = await fetch(`${testServer.baseUrl}/api/profiles`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        name: "Duplicate Tag Check",
        description: "",
        useCustomSources: true,
        tags: ["ai", "AI"],
        urls: [
          {
            url: "https://example.com/duplicate-tags",
            description: "",
          },
        ],
        rssFeeds: [
          {
            feedUrl: "https://example.com/duplicate-tags.xml",
            title: "",
            refreshCadence: "Hourly",
            format: "RSS 2.0",
            category: "",
          },
        ],
      }),
    });

    assert.equal(createResponse.status, 400);
    const body = await createResponse.json();
    assert.equal(
      body.error,
      "Each tag name must be unique within the profile.",
    );
    assert.match(body.traceId, /^[0-9a-f]{32}$/);
  } finally {
    await testServer.close();
  }
});

test("news scraper API rejects duplicate role names within the same profile", async () => {
  const testServer = await startTestServer(createApiConfig());

  try {
    const createResponse = await fetch(`${testServer.baseUrl}/api/profiles`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        name: "Duplicate Role Check",
        description: "",
        useCustomSources: true,
        tags: ["ai"],
        roles: ["Engineer", "engineer"],
        urls: [
          {
            url: "https://example.com/duplicate-roles",
            description: "",
          },
        ],
        rssFeeds: [
          {
            feedUrl: "https://example.com/duplicate-roles.xml",
            title: "",
            refreshCadence: "Hourly",
            format: "RSS 2.0",
            category: "",
          },
        ],
      }),
    });

    assert.equal(createResponse.status, 400);
    const body = await createResponse.json();
    assert.equal(
      body.error,
      "Each role name must be unique within the profile.",
    );
    assert.match(body.traceId, /^[0-9a-f]{32}$/);
  } finally {
    await testServer.close();
  }
});

test("news scraper API propagates traceparent and returns traceId in 500 responses", async () => {
  const failingRepository = {
    async listProfiles() {
      return [];
    },
    async createProfile() {
      throw new Error("Simulated repository failure");
    },
    async updateProfile() {
      return null;
    },
    async deleteProfile() {
      return false;
    },
  };

  const testServer = await startTestServer(failingRepository);

  try {
    const traceId = "11111111111111111111111111111111";
    const incomingTraceparent = `00-${traceId}-2222222222222222-01`;

    const createResponse = await fetch(`${testServer.baseUrl}/api/profiles`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        traceparent: incomingTraceparent,
      },
      body: JSON.stringify({
        name: "Failing Create",
        description: "",
        useCustomSources: false,
        tags: [],
        urls: [],
        rssFeeds: [],
      }),
    });

    assert.equal(createResponse.status, 500);

    const body = await createResponse.json();
    assert.equal(body.error, "Internal server error.");
    assert.equal(body.traceId, traceId);

    const responseTraceparent = createResponse.headers.get("traceparent");
    assert.match(
      responseTraceparent ?? "",
      /^00-[0-9a-f]{32}-[0-9a-f]{16}-[0-9a-f]{2}$/i,
    );
    assert.ok(responseTraceparent?.startsWith(`00-${traceId}-`));
  } finally {
    await testServer.close();
  }
});

test("news scraper API accepts default AI sources mode without custom URL and RSS input", async () => {
  const testServer = await startTestServer();

  try {
    const createResponse = await fetch(`${testServer.baseUrl}/api/profiles`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        name: "AI Recommended Sources",
        description: "Use platform recommended feeds",
        tags: [],
      }),
    });

    assert.equal(createResponse.status, 201);
    const createdProfile = await createResponse.json();
    assert.equal(createdProfile.useCustomSources, false);
    assert.deepEqual(createdProfile.urls, []);
    assert.deepEqual(createdProfile.rssFeeds, []);
  } finally {
    await testServer.close();
  }
});

test("news scraper API accepts and returns notification channel ids", async () => {
  const testServer = await startTestServer();

  try {
    const createResponse = await fetch(`${testServer.baseUrl}/api/profiles`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        name: "Multi Notification Profile",
        description: "",
        useCustomSources: false,
        tags: [],
        notificationChannelIds: [11, 22],
      }),
    });

    assert.equal(createResponse.status, 201);
    const createdProfile = await createResponse.json();
    assert.deepEqual(createdProfile.notificationChannelIds, [11, 22]);
    assert.equal(createdProfile.notificationProfileId, 11);

    const listResponse = await fetch(`${testServer.baseUrl}/api/profiles`);
    assert.equal(listResponse.status, 200);
    const listedProfiles = await listResponse.json();

    assert.equal(listedProfiles.length, 1);
    assert.deepEqual(listedProfiles[0].notificationChannelIds, [11, 22]);
    assert.equal(listedProfiles[0].notificationProfileId, 11);
  } finally {
    await testServer.close();
  }
});

test("news scraper API rejects invalid notification channel id values", async () => {
  const testServer = await startTestServer();

  try {
    const createResponse = await fetch(`${testServer.baseUrl}/api/profiles`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        name: "Invalid Notification Id Profile",
        description: "",
        useCustomSources: false,
        tags: [],
        notificationChannelIds: [0, 2],
      }),
    });

    assert.equal(createResponse.status, 400);
    const body = await createResponse.json();
    assert.equal(
      body.error,
      "Each notification channel id must be a positive integer.",
    );
    assert.match(body.traceId, /^[0-9a-f]{32}$/);
  } finally {
    await testServer.close();
  }
});

test("news scraper API rejects unknown notification channel id references", async () => {
  const testServer = await startTestServer();

  try {
    const createResponse = await fetch(`${testServer.baseUrl}/api/profiles`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        name: "Unknown Notification Id Profile",
        description: "",
        useCustomSources: false,
        tags: [],
        notificationChannelIds: [11, 999],
      }),
    });

    assert.equal(createResponse.status, 400);
    const body = await createResponse.json();
    assert.equal(body.error, "Unknown notification channel id(s): 999.");
    assert.match(body.traceId, /^[0-9a-f]{32}$/);
  } finally {
    await testServer.close();
  }
});

test("news API returns profile-scoped news and persists favorite flag", async () => {
  const repository = createMemoryRepository();
  const testServer = await startTestServer(repository);

  try {
    const createProfileResponse = await fetch(
      `${testServer.baseUrl}/api/profiles`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          name: "News Profile",
          description: "",
          useCustomSources: false,
          tags: [],
          roles: [],
        }),
      },
    );

    assert.equal(createProfileResponse.status, 201);
    const createdProfile = await createProfileResponse.json();

    const olderTimestamp = new Date(Date.now() - 60_000).toISOString();
    const newerTimestamp = new Date().toISOString();

    await repository.createNewsItem({
      profileId: createdProfile.id,
      title: "Older item",
      summary: "Older summary",
      origin: "Origin A",
      link: "https://example.com/older",
      timestamp: olderTimestamp,
      favorite: false,
    });

    const newerItem = await repository.createNewsItem({
      profileId: createdProfile.id,
      title: "Newer item",
      summary: "Newer summary",
      origin: "Origin B",
      link: "https://example.com/newer",
      timestamp: newerTimestamp,
      favorite: false,
    });

    await repository.createNewsItem({
      profileId: createdProfile.id + 1,
      title: "Other profile item",
      summary: "Should not be returned",
      origin: "Origin C",
      link: "https://example.com/other",
      timestamp: newerTimestamp,
      favorite: false,
    });

    const listResponse = await fetch(
      `${testServer.baseUrl}/api/news?profileId=${createdProfile.id}`,
    );

    assert.equal(listResponse.status, 200);
    const listedItems = await listResponse.json();
    assert.equal(listedItems.length, 2);
    assert.equal(listedItems[0].title, "Newer item");
    assert.equal(listedItems[1].title, "Older item");

    const favoriteResponse = await fetch(
      `${testServer.baseUrl}/api/news/${newerItem.id}/favorite`,
      {
        method: "PUT",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          profileId: createdProfile.id,
          favorite: true,
        }),
      },
    );

    assert.equal(favoriteResponse.status, 200);
    const updatedNewsItem = await favoriteResponse.json();
    assert.equal(updatedNewsItem.favorite, true);

    const afterFavoriteResponse = await fetch(
      `${testServer.baseUrl}/api/news?profileId=${createdProfile.id}`,
    );
    const afterFavorite = await afterFavoriteResponse.json();
    assert.equal(afterFavorite[0].favorite, true);
  } finally {
    await testServer.close();
  }
});

test("errors API supports create, list, search, and fetch-by-id", async () => {
  const repository = createMemoryRepository();
  const testServer = await startTestServer({ repository });

  try {
    const createProfileResponse = await fetch(
      `${testServer.baseUrl}/api/profiles`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          name: "Errors Profile",
          description: "",
          useCustomSources: false,
          tags: [],
          roles: [],
          urls: [],
          rssFeeds: [],
          notificationChannelIds: [11],
        }),
      },
    );

    assert.equal(createProfileResponse.status, 201);
    const createdProfile = await createProfileResponse.json();

    const createErrorResponse = await fetch(
      `${testServer.baseUrl}/api/errors`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          profileId: createdProfile.id,
          traceId: "trace-errors-1",
          executionId: "exec-test-001",
          errorMessage: "Failed scrape parse",
          errorDescription: "Parser failed while normalizing source payload",
          errorStack: "TypeError: Cannot read properties of undefined",
          errorHttpCode: 502,
          nodeName: "Normalize Source",
          nodeType: "code",
          workflowName: "news-scrape-workflow",
          workflowId: "wf-errors-1",
          json: { phase: "normalize", marker: "json-only-token" },
        }),
      },
    );

    assert.equal(createErrorResponse.status, 201);
    const createdError = await createErrorResponse.json();
    assert.equal(createdError.profileId, createdProfile.id);
    assert.equal(createdError.traceId, "trace-errors-1");
    assert.equal(createdError.errorHttpCode, 502);

    const listErrorsResponse = await fetch(
      `${testServer.baseUrl}/api/errors?profileId=${createdProfile.id}`,
    );
    assert.equal(listErrorsResponse.status, 200);
    const listedErrors = await listErrorsResponse.json();
    assert.equal(listedErrors.length, 1);
    assert.equal(listedErrors[0].id, createdError.id);

    const searchErrorsResponse = await fetch(
      `${testServer.baseUrl}/api/errors?profileId=${createdProfile.id}&search=normalize`,
    );
    assert.equal(searchErrorsResponse.status, 200);
    const searchedErrors = await searchErrorsResponse.json();
    assert.equal(searchedErrors.length, 1);

    const searchByTraceResponse = await fetch(
      `${testServer.baseUrl}/api/errors?profileId=${createdProfile.id}&search=trace-errors-1`,
    );
    assert.equal(searchByTraceResponse.status, 200);
    const traceSearchedErrors = await searchByTraceResponse.json();
    assert.equal(traceSearchedErrors.length, 1);

    const searchByStackResponse = await fetch(
      `${testServer.baseUrl}/api/errors?profileId=${createdProfile.id}&search=Cannot%20read%20properties`,
    );
    assert.equal(searchByStackResponse.status, 200);
    const stackSearchedErrors = await searchByStackResponse.json();
    assert.equal(stackSearchedErrors.length, 1);

    const searchByJsonResponse = await fetch(
      `${testServer.baseUrl}/api/errors?profileId=${createdProfile.id}&search=json-only-token`,
    );
    assert.equal(searchByJsonResponse.status, 200);
    const jsonSearchedErrors = await searchByJsonResponse.json();
    assert.equal(jsonSearchedErrors.length, 1);

    const searchByAndTermsResponse = await fetch(
      `${testServer.baseUrl}/api/errors?profileId=${createdProfile.id}&search=trace-errors-1%20normalize`,
    );
    assert.equal(searchByAndTermsResponse.status, 200);
    const andTermSearchedErrors = await searchByAndTermsResponse.json();
    assert.equal(andTermSearchedErrors.length, 1);

    const searchByAndTermsNoMatchResponse = await fetch(
      `${testServer.baseUrl}/api/errors?profileId=${createdProfile.id}&search=trace-errors-1%20missing-token`,
    );
    assert.equal(searchByAndTermsNoMatchResponse.status, 200);
    const andNoMatchErrors = await searchByAndTermsNoMatchResponse.json();
    assert.equal(andNoMatchErrors.length, 0);

    const getErrorResponse = await fetch(
      `${testServer.baseUrl}/api/errors/${createdError.id}?profileId=${createdProfile.id}`,
    );
    assert.equal(getErrorResponse.status, 200);
    const fetchedError = await getErrorResponse.json();
    assert.equal(fetchedError.traceId, "trace-errors-1");
    assert.equal(fetchedError.workflowId, "wf-errors-1");
  } finally {
    await testServer.close();
  }
});

test("scrape trigger clears existing profile errors before triggering workflow", async () => {
  const repository = createMemoryRepository();
  const webhookServer = createServer((_req, res) => {
    res.statusCode = 200;
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({ status: "ok" }));
  });

  await new Promise((resolve) => webhookServer.listen(0, "127.0.0.1", resolve));
  const webhookAddress = webhookServer.address();

  if (webhookAddress === null || typeof webhookAddress === "string") {
    throw new Error("Could not determine webhook test server address.");
  }

  const testServer = await startTestServer({
    repository,
    scrapWebhookUrl: `http://127.0.0.1:${webhookAddress.port}/workflow`,
    scrapWebhookBasicAuthUser: "test-user",
    scrapWebhookBasicAuthPassword: "test-password",
  });

  try {
    const createProfileResponse = await fetch(
      `${testServer.baseUrl}/api/profiles`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          name: "Scrape Error Cleanup",
          description: "",
          useCustomSources: false,
          tags: [],
          roles: [],
          urls: [],
          rssFeeds: [],
          notificationChannelIds: [11],
        }),
      },
    );

    assert.equal(createProfileResponse.status, 201);
    const createdProfile = await createProfileResponse.json();

    const createErrorResponse = await fetch(
      `${testServer.baseUrl}/api/errors`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          profileId: createdProfile.id,
          executionId: "exec-cleanup-001",
          errorMessage: "Stale error",
          errorDescription: "Should be removed on next scrape",
          errorStack: "Error: stale",
          errorHttpCode: 500,
          nodeName: "Old Node",
          nodeType: "code",
          workflowName: "news-scrape-workflow",
          workflowId: "wf-cleanup-1",
          json: {},
        }),
      },
    );
    assert.equal(createErrorResponse.status, 201);

    const scrapeResponse = await fetch(
      `${testServer.baseUrl}/api/news/profile/scrape`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ profileId: createdProfile.id }),
      },
    );

    assert.equal(scrapeResponse.status, 202);

    const listErrorsResponse = await fetch(
      `${testServer.baseUrl}/api/errors?profileId=${createdProfile.id}`,
    );
    assert.equal(listErrorsResponse.status, 200);
    const listedErrors = await listErrorsResponse.json();
    assert.equal(listedErrors.length, 0);
  } finally {
    await testServer.close();
    await new Promise((resolve, reject) => {
      webhookServer.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
  }
});

test("news API returns all profile-scoped rows even when roles are configured", async () => {
  const repository = createMemoryProfilesRepository();
  const testServer = await startTestServer(repository);

  try {
    const createProfileResponse = await fetch(
      `${testServer.baseUrl}/api/profiles`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          name: "Role Focused Profile",
          description: "",
          useCustomSources: false,
          tags: [],
          roles: ["CTO"],
        }),
      },
    );

    assert.equal(createProfileResponse.status, 201);
    const createdProfile = await createProfileResponse.json();

    await repository.createNewsItem({
      profileId: createdProfile.id,
      title: "Executive technology strategy update",
      summary: "Platform innovation and architecture roadmap.",
      origin: "Leadership Brief",
      link: "https://example.com/cto-relevant",
      timestamp: new Date().toISOString(),
      favorite: false,
    });

    await repository.createNewsItem({
      profileId: createdProfile.id,
      title: "Local meetup recap",
      summary: "General event highlights without role-specific context.",
      origin: "Community Digest",
      link: "https://example.com/not-cto-relevant",
      timestamp: new Date().toISOString(),
      favorite: false,
    });

    const listResponse = await fetch(
      `${testServer.baseUrl}/api/news?profileId=${createdProfile.id}`,
    );

    assert.equal(listResponse.status, 200);
    const listedItems = await listResponse.json();
    assert.equal(listedItems.length, 2);
    assert.match(
      listedItems.map((item) => item.title).join("\n"),
      /Executive technology strategy update/,
    );
    assert.match(
      listedItems.map((item) => item.title).join("\n"),
      /Local meetup recap/,
    );
  } finally {
    await testServer.close();
  }
});

test("news API validates required profileId query parameter", async () => {
  const testServer = await startTestServer();

  try {
    const response = await fetch(`${testServer.baseUrl}/api/news`);

    assert.equal(response.status, 400);
    const body = await response.json();
    assert.equal(
      body.error,
      "profileId query parameter must be a positive integer.",
    );
    assert.match(body.traceId, /^[0-9a-f]{32}$/);
  } finally {
    await testServer.close();
  }
});

test("news favorite API validates profileId and favorite payload", async () => {
  const testServer = await startTestServer();

  try {
    const invalidProfileIdResponse = await fetch(
      `${testServer.baseUrl}/api/news/1/favorite`,
      {
        method: "PUT",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          profileId: "abc",
          favorite: true,
        }),
      },
    );

    assert.equal(invalidProfileIdResponse.status, 400);
    const invalidProfileIdBody = await invalidProfileIdResponse.json();
    assert.equal(
      invalidProfileIdBody.error,
      "profileId in request body must be a positive integer.",
    );
    assert.match(invalidProfileIdBody.traceId, /^[0-9a-f]{32}$/);

    const invalidFavoriteTypeResponse = await fetch(
      `${testServer.baseUrl}/api/news/1/favorite`,
      {
        method: "PUT",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          profileId: 1,
          favorite: "yes",
        }),
      },
    );

    assert.equal(invalidFavoriteTypeResponse.status, 400);
    const invalidFavoriteTypeBody = await invalidFavoriteTypeResponse.json();
    assert.equal(
      invalidFavoriteTypeBody.error,
      "favorite in request body must be a boolean.",
    );
    assert.match(invalidFavoriteTypeBody.traceId, /^[0-9a-f]{32}$/);
  } finally {
    await testServer.close();
  }
});

test("news favorite API validates news id path parameter", async () => {
  const testServer = await startTestServer();

  try {
    const response = await fetch(
      `${testServer.baseUrl}/api/news/abc/favorite`,
      {
        method: "PUT",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          profileId: 1,
          favorite: false,
        }),
      },
    );

    assert.equal(response.status, 400);
    const body = await response.json();
    assert.equal(body.error, "News id must be a positive integer.");
    assert.match(body.traceId, /^[0-9a-f]{32}$/);
  } finally {
    await testServer.close();
  }
});

test("scrap trigger API returns 503 when workflow URL is not configured", async () => {
  const testServer = await startTestServer();

  try {
    const response = await fetch(
      `${testServer.baseUrl}/api/news/profile/scrape`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          profileId: 1,
        }),
      },
    );

    assert.equal(response.status, 503);
    const body = await response.json();
    assert.equal(body.error, "Scrape workflow is not configured.");
    assert.match(body.traceId, /^[0-9a-f]{32}$/);
  } finally {
    await testServer.close();
  }
});

test("scrap trigger API validates profileId request body", async () => {
  const api = createNewsScraperApi({
    repository: createMemoryRepository(),
    scrapWebhookUrl: "https://example.com/webhook/scrape",
    scrapWebhookBasicAuthUser: "user",
    scrapWebhookBasicAuthPassword: "password",
  });
  const server = createServer(api);

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();

  if (address === null || typeof address === "string") {
    throw new Error("Could not determine test server address.");
  }

  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    const response = await fetch(`${baseUrl}/api/news/profile/scrape`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        profileId: "abc",
      }),
    });

    assert.equal(response.status, 400);
    const body = await response.json();
    assert.equal(
      body.error,
      "profileId in request body must be a positive integer.",
    );
    assert.match(body.traceId, /^[0-9a-f]{32}$/);
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    });
  }
});

test("scrap trigger API forwards traceparent and returns accepted status", async () => {
  const workflowCalls = [];
  const upstreamServer = createServer((request, response) => {
    let rawBody = "";
    request.on("data", (chunk) => {
      rawBody += chunk;
    });
    request.on("end", () => {
      workflowCalls.push({
        method: request.method,
        headers: request.headers,
        body: rawBody,
      });
      response.statusCode = 204;
      response.end();
    });
  });

  await new Promise((resolve) =>
    upstreamServer.listen(0, "127.0.0.1", resolve),
  );
  const upstreamAddress = upstreamServer.address();

  if (upstreamAddress === null || typeof upstreamAddress === "string") {
    throw new Error("Could not determine upstream server address.");
  }

  const workflowUrl = `http://127.0.0.1:${upstreamAddress.port}/webhook/scrape`;

  const repository = createMemoryRepository();
  const createdProfile = await repository.createProfile({
    name: "Webhook Profile",
    description: "",
    useCustomSources: false,
    tags: [],
    roles: [],
    urls: [],
    rssFeeds: [],
    notificationChannelIds: [11],
    notificationProfileId: 11,
  });

  const api = createNewsScraperApi({
    repository,
    scrapWebhookUrl: workflowUrl,
    scrapWebhookBasicAuthUser: "user",
    scrapWebhookBasicAuthPassword: "password",
  });
  const server = createServer(api);

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();

  if (address === null || typeof address === "string") {
    throw new Error("Could not determine test server address.");
  }

  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    const traceId = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
    const response = await fetch(`${baseUrl}/api/news/profile/scrape`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        traceparent: `00-${traceId}-bbbbbbbbbbbbbbbb-01`,
      },
      body: JSON.stringify({
        profileId: createdProfile.id,
      }),
    });

    assert.equal(response.status, 202);
    assert.equal(workflowCalls.length, 1);
    assert.equal(workflowCalls[0].method, "POST");

    const forwardedTraceparent = workflowCalls[0].headers.traceparent;
    const forwardedAuthorization = workflowCalls[0].headers.authorization;
    assert.match(
      forwardedTraceparent ?? "",
      /^00-[0-9a-f]{32}-[0-9a-f]{16}-[0-9a-f]{2}$/i,
    );
    assert.ok(forwardedTraceparent?.startsWith(`00-${traceId}-`));
    assert.equal(
      forwardedAuthorization,
      `Basic ${Buffer.from("user:password", "utf8").toString("base64")}`,
    );

    const requestBody = JSON.parse(workflowCalls[0].body);
    assert.equal(requestBody.scrape.profile.id, createdProfile.id);
    assert.equal(requestBody.scrape.profile.name, "Webhook Profile");
    assert.equal(requestBody.scrape.informationChannel.id, 11);
    assert.equal(requestBody.scrape.informationChannel.name, "Email Alerts");
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    });

    await new Promise((resolve, reject) => {
      upstreamServer.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    });
  }
});

test("scrap trigger API requires configured credentials", async () => {
  const api = createNewsScraperApi({
    repository: createMemoryRepository(),
    scrapWebhookUrl: "https://example.com/webhook/scrape",
  });
  const server = createServer(api);

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();

  if (address === null || typeof address === "string") {
    throw new Error("Could not determine test server address.");
  }

  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    const response = await fetch(`${baseUrl}/api/news/profile/scrape`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        profileId: 1,
      }),
    });

    assert.equal(response.status, 503);
    const body = await response.json();
    assert.equal(body.error, "Scrape workflow credentials are not configured.");
    assert.match(body.traceId, /^[0-9a-f]{32}$/);
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    });
  }
});

test("serializeProfileSnapshot returns the full normalized profile JSON", () => {
  const profileInput = {
    name: "Backend Watch",
    description: "Tracks backend changes",
    useCustomSources: true,
    tags: ["backend", "platform"],
    roles: ["Engineer"],
    urls: [
      {
        url: "https://example.com/backend",
        description: "Primary source",
      },
    ],
    rssFeeds: [
      {
        feedUrl: "https://example.com/backend.xml",
        title: "Backend Feed",
        refreshCadence: "Hourly",
        format: "RSS 2.0",
        category: "Engineering",
      },
    ],
  };

  assert.equal(
    serializeProfileSnapshot(profileInput),
    JSON.stringify(profileInput),
  );
});

test("serializeNotificationChannelSnapshot returns normalized channel JSON", () => {
  const emailChannelInput = {
    emailAddresses: ["alerts@example.com", "team@example.com"],
  };
  const slackChannelInput = {
    slackWebhookUrl: "https://hooks.slack.com/services/T000/B000/XXXX",
  };

  assert.equal(
    serializeNotificationChannelSnapshot(emailChannelInput),
    JSON.stringify({
      channelType: "email",
      emailAddresses: ["alerts@example.com", "team@example.com"],
    }),
  );

  assert.equal(
    serializeNotificationChannelSnapshot(slackChannelInput),
    JSON.stringify({
      channelType: "slack",
      slackWebhookUrl: "https://hooks.slack.com/services/T000/B000/XXXX",
    }),
  );
});
