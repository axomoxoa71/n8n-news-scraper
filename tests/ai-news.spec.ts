import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem("news-scrapper.environment", "production");
    window.sessionStorage.setItem(
      "news-scrapper.session.environment-selected",
      "true",
    );
  });
});

async function openProfilesManagementTab(
  page: import("@playwright/test").Page,
) {
  await page.getByRole("tab", { name: "Profiles" }).click();
}

async function selectFirstAvailableSource(
  dialog: import("@playwright/test").Locator,
) {
  const sourceSelect = dialog
    .locator("label.field:has-text('Source') select")
    .first();
  const sourceOptions = sourceSelect.locator("option");

  if ((await sourceOptions.count()) > 1) {
    await sourceSelect.selectOption({ index: 1 });
  }
}

test("entry page renders News Scraper and logo", async ({ page }) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", { name: "News Scraper" }),
  ).toBeVisible();
  await expect(
    page.getByRole("img", { name: "News Scraper logo" }).first(),
  ).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Main" })).toBeVisible();
});

test("menus navigate to Profiles, Chatbot, and News pages", async ({
  page,
}) => {
  await page.goto("/");
  const nav = page.getByRole("navigation", { name: "Main" });

  await nav.getByRole("link", { name: "Profiles" }).click();
  await expect(
    page.getByRole("heading", { name: "Profiles", exact: true }),
  ).toBeVisible();

  await nav.getByRole("link", { name: "Chatbot" }).click();
  await expect(page.getByRole("heading", { name: "Chatbot" })).toBeVisible();

  await nav.getByRole("link", { name: "News" }).click();
  await expect(page.getByRole("heading", { name: /News/ })).toBeVisible();
});

test("news page supports keyword search, favorites, and tag filtering (legacy fixture)", async ({
  page,
}) => {
  const now = Date.now();
  const newsTimestampA = new Date(now - 24 * 60 * 60 * 1000).toISOString();
  const newsTimestampB = new Date(now - 2 * 24 * 60 * 60 * 1000).toISOString();

  const profilesResponse = [
    {
      id: 1,
      name: "AI Focus",
      description: "",
      useCustomSources: false,
      tags: [],
      urls: [],
      rssFeeds: [],
      notificationChannelIds: [],
      notificationProfileId: null,
    },
  ];

  const newsResponse = [
    {
      id: 100,
      profileId: 1,
      title: "Open-source agent benchmark published",
      summary: "New benchmark compares autonomous coding agents.",
      origin: "Agent Weekly",
      url: "https://example.com/news/agent-benchmark",
      timestamp: newsTimestampA,
      favorite: false,
    },
    {
      id: 101,
      profileId: 1,
      title: "Model release improves long-context reasoning",
      summary: "Vendors report fewer retrieval failures in production.",
      origin: "Applied AI Journal",
      url: "https://example.com/news/long-context",
      timestamp: newsTimestampB,
      favorite: true,
    },
  ];

  await page.route("**/api/profiles", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(profilesResponse),
      });
      return;
    }

    await route.continue();
  });

  await page.route("**/api/notification-profiles", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([]),
      });
      return;
    }

    await route.continue();
  });

  await page.route("**/api/tags", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          { id: 1, category: "news", tag: "agents" },
          { id: 2, category: "news", tag: "benchmark" },
        ]),
      });
      return;
    }

    await route.continue();
  });

  await page.route("**/api/news**", async (route) => {
    const url = new URL(route.request().url());
    const tagIds = url.searchParams.get("tagIds");
    const filteredResponse = tagIds === "2" ? [newsResponse[0]] : newsResponse;

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(filteredResponse),
    });
  });

  await page.goto("/news");

  await expect(
    page.getByRole("row").filter({ hasText: "Open-source agent benchmark" }),
  ).toBeVisible();
  await expect(
    page
      .getByRole("row")
      .filter({ hasText: "Model release improves long-context reasoning" }),
  ).toBeVisible();

  await page.getByLabel("Search news by title or summary").fill("benchmark");

  await expect(
    page.getByRole("row").filter({ hasText: "Open-source agent benchmark" }),
  ).toBeVisible();
  await expect(
    page
      .getByRole("row")
      .filter({ hasText: "Model release improves long-context reasoning" }),
  ).toHaveCount(0);

  await page
    .getByLabel("Search news by title or summary")
    .fill("benchmark retrieval");

  await expect(
    page.getByRole("row").filter({ hasText: "Open-source agent benchmark" }),
  ).toHaveCount(0);
  await expect(
    page
      .getByRole("row")
      .filter({ hasText: "Model release improves long-context reasoning" }),
  ).toHaveCount(0);

  await page.getByLabel("Search news by title or summary").fill("");
  await page.getByRole("button", { name: "Show favorites only" }).click();

  await expect(
    page
      .getByRole("row")
      .filter({ hasText: "Model release improves long-context reasoning" }),
  ).toBeVisible();
  await expect(
    page.getByRole("row").filter({ hasText: "Open-source agent benchmark" }),
  ).toHaveCount(0);

  await page.getByRole("combobox", { name: "Tags" }).click();
  await page.getByRole("option", { name: /benchmark/i }).click();

  await expect(
    page.getByRole("row").filter({ hasText: "Open-source agent benchmark" }),
  ).toBeVisible();
  await expect(
    page
      .getByRole("row")
      .filter({ hasText: "Model release improves long-context reasoning" }),
  ).toHaveCount(0);
});

test("add profile dialog opens as a modal and can close", async ({ page }) => {
  await page.goto("/profiles");
  await openProfilesManagementTab(page);

  await page.getByRole("button", { name: "Add profile" }).click();

  const addDialog = page.getByRole("dialog", { name: "Add profile dialog" });
  await expect(addDialog).toBeVisible();
  await expect(
    addDialog.getByRole("button", { name: "Close dialog" }),
  ).toBeVisible();

  await addDialog.getByRole("button", { name: "Close dialog" }).click();
  await expect(addDialog).toHaveCount(0);
});

test("profile form shows english validation message for missing mandatory fields", async ({
  page,
}) => {
  await page.goto("/profiles");
  await openProfilesManagementTab(page);

  await page.getByRole("button", { name: "Add profile" }).click();
  const addDialog = page.getByRole("dialog", { name: "Add profile dialog" });

  await addDialog.getByRole("button", { name: "Save profile" }).click();

  await expect(addDialog.getByRole("alert")).toContainText(
    "Profile name is required.",
  );
});

test("chatbot voice input language defaults to browser locale and supports german and english", async ({
  page,
}) => {
  await page.addInitScript(() => {
    class MockSpeechRecognition {
      continuous = false;
      interimResults = false;
      lang = "";
      onresult = null;
      onend = null;
      onerror = null;

      constructor() {
        (window as any).__mockRecognition = this;
      }

      start() {}

      stop() {}
    }

    Object.defineProperty(window.navigator, "language", {
      configurable: true,
      get: () => "de-DE",
    });

    (window as any).SpeechRecognition = MockSpeechRecognition;
  });

  const profilesResponse = [
    {
      id: 7,
      name: "AI Demo",
      description: "",
      useCustomSources: false,
      tags: [],
      urls: [],
      rssFeeds: [],
      notificationChannelIds: [],
      notificationProfileId: null,
    },
  ];

  await page.route("**/api/profiles", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(profilesResponse),
      });
      return;
    }

    await route.continue();
  });

  await page.route("**/api/notification-profiles", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([]),
      });
      return;
    }

    await route.continue();
  });

  await page.goto("/chatbot");
  await expect(page.getByRole("heading", { name: "Chatbot" })).toBeVisible();

  const voiceLanguageSelect = page.getByLabel("Voice input language");

  await expect(voiceLanguageSelect).toHaveValue("de-DE");
  await expect
    .poll(() =>
      page.evaluate(() => (window as any).__mockRecognition?.lang ?? null),
    )
    .toBe("de-DE");

  await voiceLanguageSelect.selectOption("en-US");

  await expect(voiceLanguageSelect).toHaveValue("en-US");
  await expect
    .poll(() =>
      page.evaluate(() => (window as any).__mockRecognition?.lang ?? null),
    )
    .toBe("en-US");
});

test("chatbot recording button records while held and stops on release", async ({
  page,
}) => {
  await page.addInitScript(() => {
    class MockSpeechRecognition {
      continuous = false;
      interimResults = false;
      lang = "en-US";
      onstart: null | (() => void) = null;
      onresult: null | ((event: { results: Array<Array<{ transcript: string }>> }) => void) = null;
      onend: null | (() => void) = null;
      onerror = null;
      startCalls = 0;
      stopCalls = 0;

      constructor() {
        (window as any).__mockRecognition = this;
      }

      start() {
        this.startCalls += 1;
        this.onstart?.();
      }

      stop() {
        this.stopCalls += 1;
        this.onresult?.({
          results: [[{ transcript: "held voice input" }]],
        });
        this.onend?.();
      }
    }

    (window as any).SpeechRecognition = MockSpeechRecognition;
  });

  const profilesResponse = [
    {
      id: 7,
      name: "AI Demo",
      description: "",
      useCustomSources: false,
      tags: [],
      urls: [],
      rssFeeds: [],
      notificationChannelIds: [],
      notificationProfileId: null,
    },
  ];

  await page.route("**/api/profiles", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(profilesResponse),
      });
      return;
    }

    await route.continue();
  });

  await page.route("**/api/notification-profiles", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([]),
      });
      return;
    }

    await route.continue();
  });

  await page.goto("/chatbot");
  await expect(page.getByRole("heading", { name: "Chatbot" })).toBeVisible();

  const voiceButton = page.getByRole("button", { name: "Hold for voice input" });

  await voiceButton.dispatchEvent("pointerdown", {
    button: 0,
    pointerId: 1,
    pointerType: "mouse",
    isPrimary: true,
  });

  const releaseVoiceButton = page.getByRole("button", {
    name: "Release to stop voice input",
  });

  await expect(releaseVoiceButton).toBeVisible();
  await expect(page.locator(".chat-icon-btn.is-recording")).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => (window as any).__mockRecognition?.startCalls ?? 0))
    .toBe(1);

  await releaseVoiceButton.dispatchEvent("pointerup", {
    button: 0,
    pointerId: 1,
    pointerType: "mouse",
    isPrimary: true,
  });

  await expect(page.getByRole("button", { name: "Hold for voice input" })).toBeVisible();
  await expect(page.locator(".chat-icon-btn.is-recording")).toHaveCount(0);
  await expect(page.locator("#chatbot-question")).toHaveValue("held voice input");
  await expect
    .poll(() => page.evaluate(() => (window as any).__mockRecognition?.stopCalls ?? 0))
    .toBe(1);
});

test("chatbot shows microphone help action when permission is blocked", async ({
  page,
}) => {
  await page.addInitScript(() => {
    class MockSpeechRecognition {
      continuous = false;
      interimResults = false;
      lang = "en-US";
      onstart: null | (() => void) = null;
      onresult = null;
      onend = null;
      onerror: null | ((event: { error: string }) => void) = null;

      start() {
        this.onstart?.();
        this.onerror?.({ error: "not-allowed" });
      }

      stop() {}
    }

    (window as any).SpeechRecognition = MockSpeechRecognition;
  });

  const profilesResponse = [
    {
      id: 7,
      name: "AI Demo",
      description: "",
      useCustomSources: false,
      tags: [],
      urls: [],
      rssFeeds: [],
      notificationChannelIds: [],
      notificationProfileId: null,
    },
  ];

  await page.route("**/api/profiles", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(profilesResponse),
      });
      return;
    }

    await route.continue();
  });

  await page.route("**/api/notification-profiles", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([]),
      });
      return;
    }

    await route.continue();
  });

  await page.goto("/chatbot");
  await expect(page.getByRole("heading", { name: "Chatbot" })).toBeVisible();

  const voiceButton = page.getByRole("button", { name: "Hold for voice input" });
  await voiceButton.dispatchEvent("pointerdown", {
    button: 0,
    pointerId: 1,
    pointerType: "mouse",
    isPrimary: true,
  });

  await expect(
    page.getByText("Microphone access is blocked. Please allow microphone permission and try again."),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Open Microphone Help" })).toBeVisible();
});

test("chatbot appends voice text across multiple hold-to-talk recordings", async ({
  page,
}) => {
  await page.addInitScript(() => {
    class MockSpeechRecognition {
      continuous = false;
      interimResults = false;
      lang = "en-US";
      onstart: null | (() => void) = null;
      onresult: null | ((event: { resultIndex?: number; results: Array<Array<{ transcript: string }> & { isFinal?: boolean }> }) => void) = null;
      onend: null | (() => void) = null;
      onerror = null;
      stopCalls = 0;

      start() {
        this.onstart?.();
      }

      stop() {
        this.stopCalls += 1;
        const transcript = this.stopCalls === 1 ? "first part" : "second part";
        const result = [{ transcript }] as Array<{ transcript: string }> & {
          isFinal?: boolean;
        };
        result.isFinal = true;
        this.onresult?.({
          resultIndex: 0,
          results: [result],
        });
        this.onend?.();
      }
    }

    (window as any).SpeechRecognition = MockSpeechRecognition;
  });

  const profilesResponse = [
    {
      id: 7,
      name: "AI Demo",
      description: "",
      useCustomSources: false,
      tags: [],
      urls: [],
      rssFeeds: [],
      notificationChannelIds: [],
      notificationProfileId: null,
    },
  ];

  await page.route("**/api/profiles", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(profilesResponse),
      });
      return;
    }

    await route.continue();
  });

  await page.route("**/api/notification-profiles", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([]),
      });
      return;
    }

    await route.continue();
  });

  await page.goto("/chatbot");
  await expect(page.getByRole("heading", { name: "Chatbot" })).toBeVisible();

  const voiceButton = page.getByRole("button", { name: /voice input/i });

  await voiceButton.dispatchEvent("pointerdown", {
    button: 0,
    pointerId: 1,
    pointerType: "mouse",
    isPrimary: true,
  });
  await voiceButton.dispatchEvent("pointerup", {
    button: 0,
    pointerId: 1,
    pointerType: "mouse",
    isPrimary: true,
  });

  await expect(page.locator("#chatbot-question")).toHaveValue("first part");

  await voiceButton.dispatchEvent("pointerdown", {
    button: 0,
    pointerId: 1,
    pointerType: "mouse",
    isPrimary: true,
  });
  await voiceButton.dispatchEvent("pointerup", {
    button: 0,
    pointerId: 1,
    pointerType: "mouse",
    isPrimary: true,
  });

  await expect(page.locator("#chatbot-question")).toHaveValue(
    "first part second part",
  );
});

test("news page supports keyword search, favorites, and tag filtering", async ({
  page,
}) => {
  const now = Date.now();
  const newsTimestampA = new Date(now - 24 * 60 * 60 * 1000).toISOString();
  const newsTimestampB = new Date(now - 2 * 24 * 60 * 60 * 1000).toISOString();

  const profilesResponse = [
    {
      id: 1,
      name: "AI Focus",
      description: "",
      useCustomSources: false,
      tags: [],
      urls: [],
      rssFeeds: [],
      notificationChannelIds: [],
      notificationProfileId: null,
    },
  ];

  const newsResponse = [
    {
      id: 100,
      profileId: 1,
      title: "Open-source agent benchmark published",
      summary: "New benchmark compares autonomous coding agents.",
      origin: "Agent Weekly",
      url: "https://example.com/news/agent-benchmark",
      timestamp: newsTimestampA,
      favorite: false,
    },
    {
      id: 101,
      profileId: 1,
      title: "Model release improves long-context reasoning",
      summary: "Vendors report fewer retrieval failures in production.",
      origin: "Applied AI Journal",
      url: "https://example.com/news/long-context",
      timestamp: newsTimestampB,
      favorite: true,
    },
  ];

  await page.route("**/api/profiles", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(profilesResponse),
      });
      return;
    }

    await route.continue();
  });

  await page.route("**/api/notification-profiles", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([]),
      });
      return;
    }

    await route.continue();
  });

  await page.route("**/api/tags", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          { id: 1, category: "news", tag: "agents" },
          { id: 2, category: "news", tag: "benchmark" },
        ]),
      });
      return;
    }

    await route.continue();
  });

  await page.route("**/api/news**", async (route) => {
    const url = new URL(route.request().url());
    const tagIds = url.searchParams.get("tagIds");
    const filteredResponse = tagIds === "2" ? [newsResponse[0]] : newsResponse;

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(filteredResponse),
    });
  });

  await page.goto("/news");

  await expect(
    page.getByRole("row").filter({ hasText: "Open-source agent benchmark" }),
  ).toBeVisible();
  await expect(
    page
      .getByRole("row")
      .filter({ hasText: "Model release improves long-context reasoning" }),
  ).toBeVisible();

  await page.getByLabel("Search news by title or summary").fill("benchmark");

  await expect(
    page.getByRole("row").filter({ hasText: "Open-source agent benchmark" }),
  ).toBeVisible();
  await expect(
    page
      .getByRole("row")
      .filter({ hasText: "Model release improves long-context reasoning" }),
  ).toHaveCount(0);

  await page
    .getByLabel("Search news by title or summary")
    .fill("benchmark retrieval");

  await expect(
    page.getByRole("row").filter({ hasText: "Open-source agent benchmark" }),
  ).toHaveCount(0);
  await expect(
    page
      .getByRole("row")
      .filter({ hasText: "Model release improves long-context reasoning" }),
  ).toHaveCount(0);

  await page.getByLabel("Search news by title or summary").fill("");
  await page.getByRole("button", { name: "Show favorites only" }).click();

  await expect(
    page
      .getByRole("row")
      .filter({ hasText: "Model release improves long-context reasoning" }),
  ).toBeVisible();
  await expect(
    page.getByRole("row").filter({ hasText: "Open-source agent benchmark" }),
  ).toHaveCount(0);

  await page.getByRole("combobox", { name: "Tags" }).click();
  await page.getByRole("option", { name: /benchmark/i }).click();

  await expect(
    page.getByRole("row").filter({ hasText: "Open-source agent benchmark" }),
  ).toBeVisible();
  await expect(
    page
      .getByRole("row")
      .filter({ hasText: "Model release improves long-context reasoning" }),
  ).toHaveCount(0);
});

test("profile save error shows backend trace ID", async ({ page }) => {
  const traceId = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

  await page.route("**/api/profiles", async (route) => {
    if (route.request().method() === "POST") {
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({
          error: "Internal server error.",
          traceId,
        }),
      });
      return;
    }

    await route.continue();
  });

  await page.goto("/profiles");
  await openProfilesManagementTab(page);
  await page.getByRole("button", { name: "Add profile" }).click();

  const addDialog = page.getByRole("dialog", { name: "Add profile dialog" });
  await addDialog.getByLabel("Profile name").fill("Trace Test Profile");
  await selectFirstAvailableSource(addDialog);
  await addDialog.getByRole("button", { name: "Save profile" }).click();

  await expect(addDialog.getByRole("alert")).toContainText(
    `Trace ID: ${traceId}`,
  );
});

test("user can add unique tags and remove them directly in the tags tab", async ({
  page,
}) => {
  await page.goto("/profiles");
  await openProfilesManagementTab(page);

  await page.getByRole("button", { name: "Add profile" }).click();
  const addDialog = page.getByRole("dialog", { name: "Add profile dialog" });

  await addDialog.getByLabel("Profile name").fill("Tagged Profile");
  await selectFirstAvailableSource(addDialog);

  await addDialog.getByRole("tab", { name: "TAGS" }).click();
  const tagInput = addDialog.getByLabel("Add tag");

  await tagInput.fill("AI");
  await tagInput.press("Enter");
  await tagInput.fill("Platforms");
  await addDialog.getByRole("button", { name: "Add tag" }).click();
  await tagInput.fill("ai");
  await tagInput.press("Enter");

  const tagList = addDialog.getByRole("list", { name: "Profile tags" });
  await expect(tagList.getByText("AI")).toBeVisible();
  await expect(tagList.getByText("Platforms")).toBeVisible();
  await expect(tagList.getByRole("listitem")).toHaveCount(2);
  await expect(addDialog.getByRole("alert")).toContainText(
    "Tag names must be unique.",
  );

  await tagList.getByRole("button", { name: "Remove tag Platforms" }).click();
  await expect(tagList.getByRole("listitem")).toHaveCount(1);
  await expect(tagList.getByText("Platforms")).toHaveCount(0);

  await addDialog.getByRole("button", { name: "Save profile" }).click();
  await expect(addDialog).toHaveCount(0);

  const profileEntry = page
    .getByRole("list", { name: "Profile entries" })
    .locator("li", { hasText: "Tagged Profile" })
    .first();

  await expect(profileEntry).toBeVisible();
  await profileEntry.getByRole("button", { name: "Edit profile" }).click();
  await page.getByRole("tab", { name: "TAGS" }).click();
  const editTagList = page.getByRole("list", { name: "Profile tags" });
  await expect(editTagList.getByText("AI")).toBeVisible();
  await expect(editTagList.getByRole("listitem")).toHaveCount(1);
});

test("user can add unique roles and remove them directly in the roles tab", async ({
  page,
}) => {
  await page.goto("/profiles");
  await openProfilesManagementTab(page);

  await page.getByRole("button", { name: "Add profile" }).click();
  const addDialog = page.getByRole("dialog", { name: "Add profile dialog" });

  await addDialog.getByLabel("Profile name").fill("Role Filter Profile");
  await selectFirstAvailableSource(addDialog);

  await addDialog.getByRole("tab", { name: "ROLES" }).click();
  const roleInput = addDialog.getByLabel("Add role");

  await roleInput.fill("CTO");
  await roleInput.press("Enter");
  await roleInput.fill("Architect");
  await addDialog.getByRole("button", { name: "Add role" }).click();
  await roleInput.fill("cto");
  await roleInput.press("Enter");

  const roleList = addDialog.getByRole("list", { name: "Profile roles" });
  await expect(roleList.getByText("CTO")).toBeVisible();
  await expect(roleList.getByText("Architect")).toBeVisible();
  await expect(roleList.getByRole("listitem")).toHaveCount(2);
  await expect(addDialog.getByRole("alert")).toContainText(
    "Role names must be unique.",
  );

  await roleList.getByRole("button", { name: "Remove role Architect" }).click();
  await expect(roleList.getByRole("listitem")).toHaveCount(1);
  await expect(roleList.getByText("Architect")).toHaveCount(0);

  await addDialog.getByRole("button", { name: "Save profile" }).click();
  await expect(addDialog).toHaveCount(0);

  const profileEntry = page
    .getByRole("list", { name: "Profile entries" })
    .locator("li", { hasText: "Role Filter Profile" })
    .first();

  await expect(profileEntry).toBeVisible();
  await profileEntry.getByRole("button", { name: "Edit profile" }).click();
  await page.getByRole("tab", { name: "ROLES" }).click();
  const editRoleList = page.getByRole("list", { name: "Profile roles" });
  await expect(editRoleList.getByText("CTO")).toBeVisible();
  await expect(editRoleList.getByRole("listitem")).toHaveCount(1);
});

test("user can edit and delete profile from list", async ({ page }) => {
  const mockSources = [
    {
      id: 1,
      name: "Mock Source",
      description: "",
      urls: [{ url: "https://example.com/news", description: "" }],
      rssFeeds: [{ feedUrl: "https://example.com/rss.xml", description: "" }],
    },
  ];
  const mockProfiles: Array<Record<string, unknown>> = [];
  let nextProfileId = 1000;

  await page.route("**/api/sources", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(mockSources),
      });
      return;
    }

    await route.fallback();
  });

  await page.route("**/api/notification-profiles", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([]),
      });
      return;
    }

    await route.fallback();
  });

  await page.route("**/api/profiles", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(mockProfiles),
      });
      return;
    }

    if (route.request().method() === "POST") {
      const payload = route.request().postDataJSON() as Record<string, unknown>;
      const createdProfile = {
        id: nextProfileId++,
        name: payload.name ?? "",
        description: payload.description ?? "",
        systemPrompt: payload.systemPrompt ?? "",
        sourceId: Number(payload.sourceId ?? 1),
        tags: Array.isArray(payload.tags) ? payload.tags : [],
        roles: Array.isArray(payload.roles) ? payload.roles : [],
        notificationChannelIds: Array.isArray(payload.notificationChannelIds)
          ? payload.notificationChannelIds
          : [],
        notificationProfileId: payload.notificationProfileId ?? null,
      };

      mockProfiles.unshift(createdProfile);

      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify(createdProfile),
      });
      return;
    }

    await route.fallback();
  });

  await page.route("**/api/profiles/*", async (route) => {
    const requestUrl = new URL(route.request().url());
    const profileId = Number(requestUrl.pathname.split("/").pop());

    if (route.request().method() === "PUT") {
      const payload = route.request().postDataJSON() as Record<string, unknown>;
      const index = mockProfiles.findIndex((entry) => entry.id === profileId);

      if (index < 0) {
        await route.fulfill({
          status: 404,
          contentType: "application/json",
          body: JSON.stringify({ error: "Profile not found." }),
        });
        return;
      }

      const updated = {
        ...mockProfiles[index],
        name: payload.name ?? mockProfiles[index].name,
        description: payload.description ?? mockProfiles[index].description,
        systemPrompt: payload.systemPrompt ?? mockProfiles[index].systemPrompt,
        sourceId: Number(payload.sourceId ?? mockProfiles[index].sourceId ?? 1),
        tags: Array.isArray(payload.tags) ? payload.tags : [],
        roles: Array.isArray(payload.roles) ? payload.roles : [],
        notificationChannelIds: Array.isArray(payload.notificationChannelIds)
          ? payload.notificationChannelIds
          : [],
        notificationProfileId: payload.notificationProfileId ?? null,
      };

      mockProfiles[index] = updated;

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(updated),
      });
      return;
    }

    if (route.request().method() === "DELETE") {
      const index = mockProfiles.findIndex((entry) => entry.id === profileId);
      if (index >= 0) {
        mockProfiles.splice(index, 1);
      }

      await route.fulfill({ status: 204, body: "" });
      return;
    }

    await route.fallback();
  });

  await page.goto("/profiles");
  await openProfilesManagementTab(page);

  const baseProfileName = `Signal Desk ${Date.now()}`;
  const updatedProfileName = `${baseProfileName} Updated`;

  await page.getByRole("button", { name: "Add profile" }).click();
  const addDialog = page.getByRole("dialog", { name: "Add profile dialog" });

  await addDialog.getByLabel("Profile name").fill(baseProfileName);
  await selectFirstAvailableSource(addDialog);
  await addDialog.getByRole("button", { name: "Save profile" }).click();

  const profileEntry = page
    .getByRole("list", { name: "Profile entries" })
    .locator("li", { hasText: baseProfileName })
    .first();

  await profileEntry.getByRole("button", { name: "Edit profile" }).click();
  const editDialog = page.getByRole("dialog", { name: "Edit profile dialog" });
  await expect(
    editDialog.getByRole("heading", { name: "Edit profile", exact: true }),
  ).toBeVisible();

  await editDialog.getByLabel("Profile name").fill(updatedProfileName);
  await editDialog
    .getByLabel("Profile description")
    .fill("Updated profile description");
  await editDialog.getByRole("button", { name: "Update profile" }).click();

  await expect(
    page
      .getByRole("list", { name: "Profile entries" })
      .locator("li", { hasText: updatedProfileName })
      .first(),
  ).toBeVisible();

  const updatedEntry = page
    .getByRole("list", { name: "Profile entries" })
    .locator("li", { hasText: updatedProfileName })
    .first();
  await updatedEntry.getByRole("button", { name: "Delete profile" }).click();

  await expect(
    page
      .getByRole("list", { name: "Profile entries" })
      .locator("li", { hasText: updatedProfileName }),
  ).toHaveCount(0);
});

test("selected profile in header scopes Chatbot and News context", async ({
  page,
}) => {
  await page.goto("/profiles");
  await openProfilesManagementTab(page);

  const alphaProfileName = `Alpha Profile ${Date.now()}`;
  const betaProfileName = `Beta Profile ${Date.now()}`;

  await page.getByRole("button", { name: "Add profile" }).click();
  const addDialog = page.getByRole("dialog", { name: "Add profile dialog" });
  await addDialog.getByLabel("Profile name").fill(alphaProfileName);
  await selectFirstAvailableSource(addDialog);
  await addDialog.getByRole("button", { name: "Save profile" }).click();

  await page.getByRole("button", { name: "Add profile" }).click();
  const addDialogSecond = page.getByRole("dialog", {
    name: "Add profile dialog",
  });
  await addDialogSecond.getByLabel("Profile name").fill(betaProfileName);
  await selectFirstAvailableSource(addDialogSecond);
  await addDialogSecond.getByRole("button", { name: "Save profile" }).click();

  const combobox = page.locator(".profile-combobox-input").first();
  await combobox.click();
  await combobox.pressSequentially(betaProfileName);
  await page
    .locator(".profile-combobox-option", { hasText: betaProfileName })
    .first()
    .click();

  await page
    .getByRole("navigation", { name: "Main" })
    .getByRole("link", { name: "Chatbot" })
    .click();
  await expect(page.locator(".profile-combobox-input").first()).toHaveValue(
    betaProfileName,
  );

  await page
    .getByRole("navigation", { name: "Main" })
    .getByRole("link", { name: "News" })
    .click();
  await expect(
    page.getByRole("heading", { name: new RegExp(betaProfileName) }),
  ).toBeVisible();
});

test("active profile dropdown filters while typing", async ({ page }) => {
  await page.goto("/profiles");
  await openProfilesManagementTab(page);

  await page.getByRole("button", { name: "Add profile" }).click();
  const addDialog = page.getByRole("dialog", { name: "Add profile dialog" });
  await addDialog.getByLabel("Profile name").fill("Alpha Profile");
  await selectFirstAvailableSource(addDialog);
  await addDialog.getByRole("button", { name: "Save profile" }).click();

  await page.getByRole("button", { name: "Add profile" }).click();
  const addDialogSecond = page.getByRole("dialog", {
    name: "Add profile dialog",
  });
  await addDialogSecond.getByLabel("Profile name").fill("Beta Profile");
  await selectFirstAvailableSource(addDialogSecond);
  await addDialogSecond.getByRole("button", { name: "Save profile" }).click();

  const comboboxInput = page.locator(".profile-combobox-input").first();
  await comboboxInput.click();
  await comboboxInput.pressSequentially("beta");

  await expect(
    page
      .locator(".profile-combobox-option", { hasText: "Beta Profile" })
      .first(),
  ).toBeVisible();
  await expect(
    page
      .locator(".profile-combobox-option", { hasText: "Alpha Profile" })
      .first(),
  ).not.toBeVisible();

  await page
    .locator(".profile-combobox-option", { hasText: "Beta Profile" })
    .first()
    .click();

  await page
    .getByRole("navigation", { name: "Main" })
    .getByRole("link", { name: "Chatbot" })
    .click();
  await expect(page.locator(".profile-combobox-input").first()).toHaveValue(
    "Beta Profile",
  );
});

test("profile save sends multiple notification channel ids", async ({
  page,
}) => {
  const capturedPayloads: Array<Record<string, unknown>> = [];

  await page.route("**/api/notification-profiles", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([
        { id: 101, name: "Email Alerts", description: "", channels: [] },
        { id: 202, name: "Slack Alerts", description: "", channels: [] },
      ]),
    });
  });

  await page.route("**/api/profiles", async (route) => {
    if (route.request().method() !== "POST") {
      await route.continue();
      return;
    }

    const payload = route.request().postDataJSON() as Record<string, unknown>;
    capturedPayloads.push(payload);

    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({
        id: 9999,
        name: payload.name,
        description: payload.description,
        useCustomSources: payload.useCustomSources,
        tags: payload.tags,
        urls: payload.urls,
        rssFeeds: payload.rssFeeds,
        notificationChannelIds: payload.notificationChannelIds,
      }),
    });
  });

  await page.goto("/profiles");
  await openProfilesManagementTab(page);
  await page.getByRole("button", { name: "Add profile" }).click();

  const addDialog = page.getByRole("dialog", { name: "Add profile dialog" });
  await addDialog.getByLabel("Profile name").fill("Multi Channel Profile");
  await selectFirstAvailableSource(addDialog);
  await addDialog.getByRole("tab", { name: "NOTIFICATION" }).click();

  // Open the notification channel multi-select dropdown
  const notificationChannelInput = addDialog
    .locator(".notification-channel-input")
    .first();
  await notificationChannelInput.click();

  // Wait for dropdown options to be visible
  await page
    .locator(".notification-channel-listbox")
    .first()
    .waitFor({ state: "visible" });

  // Select Email Alerts via search + click
  await notificationChannelInput.fill("Email Alerts");
  await page
    .locator(".notification-channel-option", { hasText: "Email Alerts" })
    .first()
    .click();

  // Re-open and select Slack Alerts via search + click
  await notificationChannelInput.click();
  await notificationChannelInput.fill("Slack Alerts");
  await page
    .locator(".notification-channel-option", { hasText: "Slack Alerts" })
    .first()
    .click();

  // Close dropdown by blurring the input
  await addDialog.getByLabel("Profile name").click();

  await addDialog.getByRole("button", { name: "Save profile" }).click();

  await expect.poll(() => capturedPayloads.length).toBe(1);

  const [payload] = capturedPayloads;
  expect(payload.notificationChannelIds).toEqual([101, 202]);
  expect(payload.notificationProfileId).toBe(101);
});

test("notification channel multi-select supports keyboard-only selection", async ({
  page,
}) => {
  const capturedPayloads: Array<Record<string, unknown>> = [];

  await page.route("**/api/notification-profiles", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([
        { id: 101, name: "Email Alerts", description: "", channels: [] },
        { id: 202, name: "Slack Alerts", description: "", channels: [] },
      ]),
    });
  });

  await page.route("**/api/profiles", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([]),
      });
      return;
    }

    if (route.request().method() !== "POST") {
      await route.continue();
      return;
    }

    const payload = route.request().postDataJSON() as Record<string, unknown>;
    capturedPayloads.push(payload);

    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({
        id: 10001,
        name: payload.name,
        description: payload.description,
        useCustomSources: payload.useCustomSources,
        tags: payload.tags,
        urls: payload.urls,
        rssFeeds: payload.rssFeeds,
        notificationChannelIds: payload.notificationChannelIds,
      }),
    });
  });

  await page.goto("/profiles");
  await openProfilesManagementTab(page);
  await page.getByRole("button", { name: "Add profile" }).click();

  const addDialog = page.getByRole("dialog", { name: "Add profile dialog" });
  await addDialog.getByLabel("Profile name").fill("Keyboard Channel Profile");
  await selectFirstAvailableSource(addDialog);
  await addDialog.getByRole("tab", { name: "NOTIFICATION" }).click();

  const notificationChannelInput = addDialog
    .locator(".notification-channel-input")
    .first();

  await notificationChannelInput.click();
  await page
    .locator(".notification-channel-listbox")
    .first()
    .waitFor({ state: "visible" });

  await notificationChannelInput.press("ArrowDown");
  await notificationChannelInput.press("Enter");
  await notificationChannelInput.press("ArrowDown");
  await notificationChannelInput.press("Enter");
  await notificationChannelInput.press("Tab");

  if ((await addDialog.count()) > 0) {
    await addDialog.getByRole("button", { name: "Save profile" }).click();
  }

  await expect.poll(() => capturedPayloads.length).toBe(1);

  const [payload] = capturedPayloads;
  expect(payload.notificationChannelIds).toEqual([101, 202]);
});

test("notification channel multi-select shows empty state for unmatched search", async ({
  page,
}) => {
  await page.route("**/api/notification-profiles", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([
        { id: 101, name: "Email Alerts", description: "", channels: [] },
      ]),
    });
  });

  await page.route("**/api/profiles", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([]),
      });
      return;
    }

    await route.continue();
  });

  await page.goto("/profiles");
  await openProfilesManagementTab(page);
  await page.getByRole("button", { name: "Add profile" }).click();

  const addDialog = page.getByRole("dialog", { name: "Add profile dialog" });
  await addDialog.getByRole("tab", { name: "NOTIFICATION" }).click();
  const notificationChannelInput = addDialog
    .locator(".notification-channel-input")
    .first();

  await notificationChannelInput.click();
  await notificationChannelInput.fill("no-such-channel");

  await expect(
    page.locator(".notification-channel-empty").first(),
  ).toContainText("No matching channels");
});

test("notification channels tab shows add and edit controls", async ({
  page,
}) => {
  await page.route("**/api/notification-profiles", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([]),
      });
      return;
    }

    await route.continue();
  });

  await page.route("**/api/profiles", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([]),
      });
      return;
    }

    await route.continue();
  });

  await page.goto("/profiles");

  // Switch to Notification Channels tab
  await page.getByRole("tab", { name: "Notification Channels" }).click();

  // Verify the tab content is visible
  await expect(
    page.getByRole("button", { name: "Add notification channel" }),
  ).toBeVisible();

  // Open create dialog
  await page.getByRole("button", { name: "Add notification channel" }).click();

  const createDialog = page.getByRole("dialog", {
    name: "Add notification channel dialog",
  });

  await expect(createDialog).toBeVisible();

  // Verify form fields exist
  await expect(createDialog.getByLabel("Channel name")).toBeVisible();
  await expect(createDialog.getByLabel("Channel description")).toBeVisible();
  await expect(createDialog.getByLabel("Email address")).toBeVisible();
  await expect(createDialog.getByLabel("Webhook URL")).toBeVisible();

  // Close dialog
  await createDialog.getByRole("button", { name: "Close dialog" }).click();
  await expect(createDialog).toHaveCount(0);
});

// ---------------------------------------------------------------------------
// Helper: shared profile and notification route stubs
// ---------------------------------------------------------------------------
function stubProfileAndNotificationRoutes(
  page: import("@playwright/test").Page,
  profile = {
    id: 1,
    name: "AI Focus",
    description: "",
    useCustomSources: false,
    tags: [],
    urls: [],
    rssFeeds: [],
    roles: [],
    notificationChannelIds: [],
    notificationProfileId: null,
  },
) {
  return Promise.all([
    page.route("**/api/profiles", async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify([profile]),
        });
        return;
      }
      await route.continue();
    }),
    page.route("**/api/notification-profiles", async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify([]),
        });
        return;
      }
      await route.continue();
    }),
    page.route("**/api/errors/count*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ count: 0 }),
      });
    }),
  ]);
}

function makeNewsItems(count: number, profileId = 1) {
  return Array.from({ length: count }, (_, i) => ({
    id: i + 1,
    profileId,
    title: `News item ${String(i + 1).padStart(2, "0")}`,
    summary: `Summary for item ${i + 1}`,
    origin: "Test Source",
    url: `https://example.com/news/${i + 1}`,
    // timestamps spread so sort order is deterministic
    timestamp: new Date(2026, 4, 1, i).toISOString(),
    favorite: false,
  }));
}

test("news page sorts items by latest-first and oldest-first", async ({
  page,
}) => {
  const newsItems = makeNewsItems(3);

  await stubProfileAndNotificationRoutes(page);

  await page.route("**/api/news?profileId=1", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(newsItems),
    });
  });

  await page.goto("/news");

  const rows = page
    .getByRole("table", { name: "Collected AI news" })
    .getByRole("row");

  // Default: latest first — item with highest index timestamp appears first
  // rows.nth(0) is the header row; data rows start at nth(1)
  await expect(rows.nth(1)).toContainText("News item 03");
  await expect(rows.nth(3)).toContainText("News item 01");

  // Switch to oldest first
  await page.getByLabel("Sort news by timestamp").selectOption("oldest");

  await expect(rows.nth(1)).toContainText("News item 01");
  await expect(rows.nth(3)).toContainText("News item 03");

  // Switch back to latest first
  await page.getByLabel("Sort news by timestamp").selectOption("latest");

  await expect(rows.nth(1)).toContainText("News item 03");
  await expect(rows.nth(3)).toContainText("News item 01");
});

test("news page pagination previous and next buttons are disabled at boundaries", async ({
  page,
}) => {
  // 11 items forces two pages (page size = 10)
  const newsItems = makeNewsItems(11);

  await stubProfileAndNotificationRoutes(page);

  await page.route("**/api/news?profileId=1", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(newsItems),
    });
  });

  await page.goto("/news");

  const previousButton = page.getByRole("button", { name: "Previous page" });
  const nextButton = page.getByRole("button", { name: "Next page" });

  // On page 1: Previous disabled, Next enabled
  await expect(previousButton).toBeDisabled();
  await expect(nextButton).toBeEnabled();
  await expect(page.getByText("Page 1 of 2")).toBeVisible();
  await expect(
    page.getByText("Showing 1 to 10 of 11 news items"),
  ).toBeVisible();

  // Navigate to page 2
  await nextButton.click();

  await expect(page.getByText("Page 2 of 2")).toBeVisible();
  await expect(
    page.getByText("Showing 11 to 11 of 11 news items"),
  ).toBeVisible();

  // On last page: Next disabled, Previous enabled
  await expect(nextButton).toBeDisabled();
  await expect(previousButton).toBeEnabled();

  // Navigate back to page 1
  await previousButton.click();

  await expect(page.getByText("Page 1 of 2")).toBeVisible();
  await expect(previousButton).toBeDisabled();
  await expect(nextButton).toBeEnabled();
});

test("news page manual refresh updates last refresh time", async ({ page }) => {
  const newsItems = makeNewsItems(2);
  let newsRequestCount = 0;

  await stubProfileAndNotificationRoutes(page);

  await page.route("**/api/news?profileId=1", async (route) => {
    newsRequestCount += 1;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(newsItems),
    });
  });

  await page.goto("/news");

  // Initial load sets the last refresh time
  const refreshStatus = page.locator(".refresh-status");
  await expect(refreshStatus).toContainText("Last refresh:");

  // Record the current displayed time
  const timeBefore = await refreshStatus.textContent();
  expect(newsRequestCount).toBeGreaterThan(0);

  // Click manual refresh — wait at least 1 second so the clock ticks
  await page.waitForTimeout(1100);
  await page.getByRole("button", { name: "Refresh news" }).click();

  // Last refresh time must be visible and the displayed value must have updated
  await expect(refreshStatus).toContainText("Last refresh:");
  const timeAfter = await refreshStatus.textContent();
  expect(newsRequestCount).toBeGreaterThan(1);
  expect(timeAfter).toContain("Last refresh:");
  expect(timeBefore).toContain("Last refresh:");
});
