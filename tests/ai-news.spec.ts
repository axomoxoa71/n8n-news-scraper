import { expect, test } from "@playwright/test";

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

test("AI LLM profile is selected by default when available", async ({
  page,
}) => {
  const profilesResponse = [
    {
      id: 9,
      name: "Backend Watch",
      description: "",
      useCustomSources: false,
      tags: [],
      urls: [],
      rssFeeds: [],
      notificationChannelIds: [],
      notificationProfileId: null,
    },
    {
      id: 7,
      name: "AI LLM",
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

  await page.goto("/");

  await expect(page.locator(".profile-combobox-input").first()).toHaveValue(
    "AI LLM",
  );
});

test("news page supports keyword search and favorites filtering", async ({
  page,
}) => {
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
      link: "https://example.com/news/agent-benchmark",
      timestamp: "2026-05-06T10:30:00.000Z",
      favorite: false,
    },
    {
      id: 101,
      profileId: 1,
      title: "Model release improves long-context reasoning",
      summary: "Vendors report fewer retrieval failures in production.",
      origin: "Applied AI Journal",
      link: "https://example.com/news/long-context",
      timestamp: "2026-05-06T08:00:00.000Z",
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

  await page.route("**/api/news?profileId=1", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(newsResponse),
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
});

test("add profile dialog opens as a modal and can close", async ({ page }) => {
  await page.goto("/profiles");

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

  await page.getByRole("button", { name: "Add profile" }).click();
  const addDialog = page.getByRole("dialog", { name: "Add profile dialog" });

  await addDialog.getByRole("button", { name: "Save profile" }).click();

  await expect(addDialog.getByRole("alert")).toContainText(
    "Profile name is required.",
  );
});

test("user can add profile in dialog with URL and multiple RSS entries", async ({
  page,
}) => {
  const profiles: Array<Record<string, unknown>> = [];

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
    const method = route.request().method();

    if (method === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(profiles),
      });
      return;
    }

    if (method === "POST") {
      const payload = route.request().postDataJSON() as Record<string, unknown>;
      const createdProfile = {
        ...payload,
        id: profiles.length + 1,
      };
      profiles.unshift(createdProfile);

      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify(createdProfile),
      });
      return;
    }

    await route.continue();
  });

  await page.goto("/profiles");

  await page.getByRole("button", { name: "Add profile" }).click();
  const addDialog = page.getByRole("dialog", { name: "Add profile dialog" });

  await addDialog.getByLabel("Profile name").fill("Agent Watch");
  await addDialog
    .getByLabel("Profile description")
    .fill("Tracks agent platform and model release updates.");

  await addDialog.getByLabel("Custom").check();

  await addDialog.getByLabel("Source URL 1").fill("https://example.com/agents");
  await addDialog
    .getByLabel("Source URL description 1")
    .fill("Vendor announcements");

  await addDialog.getByRole("tab", { name: "RSS" }).click();
  await addDialog
    .getByLabel("RSS feed URL 1")
    .fill("https://example.com/feed.xml");
  await addDialog.getByLabel("RSS title 1").fill("Agent Feed");
  await addDialog.getByRole("button", { name: "Add RSS" }).click();
  await addDialog
    .getByLabel("RSS feed URL 2")
    .fill("https://example.com/feed-2.xml");
  await addDialog.getByLabel("RSS title 2").fill("Agent Feed Secondary");

  await addDialog.getByRole("button", { name: "Save profile" }).click();

  await expect(
    page
      .getByRole("list", { name: "Profile entries" })
      .locator("li", { hasText: "Agent Watch" })
      .first(),
  ).toBeVisible();
  await expect(
    page.getByRole("dialog", { name: "Add profile dialog" }),
  ).toHaveCount(0);
});

test("default AI mode hides URL and RSS editors and allows save", async ({
  page,
}) => {
  const profiles: Array<Record<string, unknown>> = [];

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
    const method = route.request().method();

    if (method === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(profiles),
      });
      return;
    }

    if (method === "POST") {
      const payload = route.request().postDataJSON() as Record<string, unknown>;
      const createdProfile = {
        ...payload,
        id: profiles.length + 1,
      };
      profiles.unshift(createdProfile);

      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify(createdProfile),
      });
      return;
    }

    await route.continue();
  });

  await page.goto("/profiles");

  await page.getByRole("button", { name: "Add profile" }).click();
  const addDialog = page.getByRole("dialog", { name: "Add profile dialog" });

  await addDialog.getByLabel("Profile name").fill("AI Suggested Sources");
  await expect(addDialog.getByLabel("Custom")).not.toBeChecked();
  await expect(addDialog.getByRole("button", { name: "Add URL" })).toHaveCount(
    0,
  );
  await expect(addDialog.getByLabel("Source URL 1")).toHaveCount(0);

  await addDialog.getByLabel("Custom").check();
  await expect(
    addDialog.getByRole("button", { name: "Add URL" }),
  ).toBeVisible();
  await expect(addDialog.getByLabel("Source URL 1")).toBeVisible();

  await addDialog.getByRole("tab", { name: "RSS" }).click();
  await addDialog.getByLabel("Custom").uncheck();
  await expect(addDialog.getByRole("button", { name: "Add RSS" })).toHaveCount(
    0,
  );
  await expect(addDialog.getByLabel("RSS feed URL 1")).toHaveCount(0);

  await addDialog.getByLabel("Custom").check();
  await expect(
    addDialog.getByRole("button", { name: "Add RSS" }),
  ).toBeVisible();
  await expect(addDialog.getByLabel("RSS feed URL 1")).toBeVisible();

  // Uncheck custom mode before saving (verify default AI mode allows save)
  await addDialog.getByLabel("Custom").uncheck();

  await addDialog.getByRole("button", { name: "Save profile" }).click();

  // Wait for dialog to close (indicates save completed)
  await expect(addDialog).not.toBeVisible();

  // Now verify profile appears in list
  await expect(
    page
      .getByRole("list", { name: "Profile entries" })
      .locator("li", { hasText: "AI Suggested Sources" })
      .first(),
  ).toBeVisible();
});

test("disabling custom mode confirms and clears URL and RSS entries", async ({
  page,
}) => {
  await page.goto("/profiles");

  await page.getByRole("button", { name: "Add profile" }).click();
  const addDialog = page.getByRole("dialog", { name: "Add profile dialog" });

  await addDialog.getByLabel("Profile name").fill("Clear Sources On Disable");
  await addDialog.getByLabel("Custom").check();
  await addDialog
    .getByLabel("Source URL 1")
    .fill("https://example.com/preserved-before-disable");

  await addDialog.getByRole("tab", { name: "RSS" }).click();
  await addDialog
    .getByLabel("RSS feed URL 1")
    .fill("https://example.com/preserved-before-disable.xml");

  page.once("dialog", (dialog) => dialog.accept());
  await addDialog.getByLabel("Custom").uncheck();

  await expect(addDialog.getByRole("button", { name: "Add RSS" })).toHaveCount(
    0,
  );
  await expect(addDialog.getByLabel("RSS feed URL 1")).toHaveCount(0);

  await addDialog.getByRole("tab", { name: "URLS" }).click();
  await expect(addDialog.getByRole("button", { name: "Add URL" })).toHaveCount(
    0,
  );
  await expect(addDialog.getByLabel("Source URL 1")).toHaveCount(0);

  await addDialog.getByLabel("Custom").check();
  await expect(addDialog.getByLabel("Source URL 1")).toHaveValue("");

  await addDialog.getByRole("tab", { name: "RSS" }).click();
  await expect(addDialog.getByLabel("RSS feed URL 1")).toHaveValue("");
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
  await page.getByRole("button", { name: "Add profile" }).click();

  const addDialog = page.getByRole("dialog", { name: "Add profile dialog" });
  await addDialog.getByLabel("Profile name").fill("Trace Test Profile");
  await addDialog.getByRole("button", { name: "Save profile" }).click();

  await expect(addDialog.getByRole("alert")).toContainText(
    `Trace ID: ${traceId}`,
  );
});

test("user can add unique tags and remove them directly in the tags tab", async ({
  page,
}) => {
  await page.goto("/profiles");

  await page.getByRole("button", { name: "Add profile" }).click();
  const addDialog = page.getByRole("dialog", { name: "Add profile dialog" });

  await addDialog.getByLabel("Profile name").fill("Tagged Profile");
  await addDialog.getByLabel("Custom").check();
  await addDialog
    .getByLabel("Source URL 1")
    .fill("https://example.com/tagged-profile");

  await addDialog.getByRole("tab", { name: "RSS" }).click();
  await addDialog
    .getByLabel("RSS feed URL 1")
    .fill("https://example.com/tagged-profile.xml");

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

  await page.getByRole("button", { name: "Add profile" }).click();
  const addDialog = page.getByRole("dialog", { name: "Add profile dialog" });

  await addDialog.getByLabel("Profile name").fill("Role Filter Profile");
  await addDialog.getByLabel("Custom").check();
  await addDialog
    .getByLabel("Source URL 1")
    .fill("https://example.com/role-filter-profile");

  await addDialog.getByRole("tab", { name: "RSS" }).click();
  await addDialog
    .getByLabel("RSS feed URL 1")
    .fill("https://example.com/role-filter-profile.xml");

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
  await page.goto("/profiles");

  const baseProfileName = `Signal Desk ${Date.now()}`;
  const updatedProfileName = `${baseProfileName} Updated`;

  await page.getByRole("button", { name: "Add profile" }).click();
  const addDialog = page.getByRole("dialog", { name: "Add profile dialog" });

  await addDialog.getByLabel("Profile name").fill(baseProfileName);
  await addDialog.getByLabel("Custom").check();
  await addDialog
    .getByLabel("Source URL 1")
    .fill("https://example.com/signals");
  await addDialog.getByRole("tab", { name: "RSS" }).click();
  await addDialog
    .getByLabel("RSS feed URL 1")
    .fill("https://example.com/signals.xml");
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
  await editDialog.getByRole("tab", { name: "RSS" }).click();
  await editDialog.getByLabel("RSS title 1").fill("Signal Feed");
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

  const alphaProfileName = `Alpha Profile ${Date.now()}`;
  const betaProfileName = `Beta Profile ${Date.now()}`;

  await page.getByRole("button", { name: "Add profile" }).click();
  const addDialog = page.getByRole("dialog", { name: "Add profile dialog" });
  await addDialog.getByLabel("Profile name").fill(alphaProfileName);
  await addDialog.getByLabel("Custom").check();
  await addDialog.getByLabel("Source URL 1").fill("https://example.com/a");
  await addDialog.getByRole("tab", { name: "RSS" }).click();
  await addDialog
    .getByLabel("RSS feed URL 1")
    .fill("https://example.com/a.xml");
  await addDialog.getByRole("button", { name: "Save profile" }).click();

  await page.getByRole("button", { name: "Add profile" }).click();
  const addDialogSecond = page.getByRole("dialog", {
    name: "Add profile dialog",
  });
  await addDialogSecond.getByLabel("Profile name").fill(betaProfileName);
  await addDialogSecond.getByLabel("Custom").check();
  await addDialogSecond
    .getByLabel("Source URL 1")
    .fill("https://example.com/b");
  await addDialogSecond.getByRole("tab", { name: "RSS" }).click();
  await addDialogSecond
    .getByLabel("RSS feed URL 1")
    .fill("https://example.com/b.xml");
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
  await expect(page.getByText("Active profile:")).toContainText(
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

  await page.getByRole("button", { name: "Add profile" }).click();
  const addDialog = page.getByRole("dialog", { name: "Add profile dialog" });
  await addDialog.getByLabel("Profile name").fill("Alpha Profile");
  await addDialog.getByLabel("Custom").check();
  await addDialog.getByLabel("Source URL 1").fill("https://example.com/a");
  await addDialog.getByRole("tab", { name: "RSS" }).click();
  await addDialog
    .getByLabel("RSS feed URL 1")
    .fill("https://example.com/a.xml");
  await addDialog.getByRole("button", { name: "Save profile" }).click();

  await page.getByRole("button", { name: "Add profile" }).click();
  const addDialogSecond = page.getByRole("dialog", {
    name: "Add profile dialog",
  });
  await addDialogSecond.getByLabel("Profile name").fill("Beta Profile");
  await addDialogSecond.getByLabel("Custom").check();
  await addDialogSecond
    .getByLabel("Source URL 1")
    .fill("https://example.com/b");
  await addDialogSecond.getByRole("tab", { name: "RSS" }).click();
  await addDialogSecond
    .getByLabel("RSS feed URL 1")
    .fill("https://example.com/b.xml");
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
  await expect(page.getByText("Active profile:")).toContainText("Beta Profile");
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
  await page.getByRole("button", { name: "Add profile" }).click();

  const addDialog = page.getByRole("dialog", { name: "Add profile dialog" });
  await addDialog.getByLabel("Profile name").fill("Multi Channel Profile");
  await addDialog.getByLabel("Custom").check();
  await addDialog
    .getByLabel("Source URL 1")
    .fill("https://example.com/multi-channel");

  await addDialog.getByRole("tab", { name: "RSS" }).click();
  await addDialog
    .getByLabel("RSS feed URL 1")
    .fill("https://example.com/multi-channel.xml");
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
  await page.getByRole("button", { name: "Add profile" }).click();

  const addDialog = page.getByRole("dialog", { name: "Add profile dialog" });
  await addDialog.getByLabel("Profile name").fill("Keyboard Channel Profile");
  await addDialog.getByLabel("Custom").check();
  await addDialog
    .getByLabel("Source URL 1")
    .fill("https://example.com/keyboard-channel");
  await addDialog.getByRole("tab", { name: "RSS" }).click();
  await addDialog
    .getByLabel("RSS feed URL 1")
    .fill("https://example.com/keyboard-channel.xml");
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
