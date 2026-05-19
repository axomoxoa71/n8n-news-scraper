#!/usr/bin/env node
/**
 * Seed profiles via API
 *
 * Usage:
 *   node server/scripts/seed-profiles.mjs                     # Strict reset mode (default)
 *   node server/scripts/seed-profiles.mjs --append            # Append/idempotent mode
 *   node server/scripts/seed-profiles.mjs --file path/to.json # Uses custom seed file
 *   SEED_PROFILES_FILE=path/to.json node server/scripts/seed-profiles.mjs
 */

import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, "../..");

// Parse command line arguments
const args = process.argv.slice(2);
let seedFilePath = process.env.SEED_PROFILES_FILE;
let strictMode = process.env.SEED_APPEND !== "true";

if (args.includes("--append")) {
  strictMode = false;
}

if (args.includes("--strict")) {
  strictMode = true;
}

if (args.includes("--file") && args.length > args.indexOf("--file") + 1) {
  seedFilePath = args[args.indexOf("--file") + 1];
}

if (!seedFilePath) {
  seedFilePath = join(projectRoot, "server/sql/seed-profiles.json");
}

// Read seed data
let seedProfiles;
try {
  const seedContent = readFileSync(seedFilePath, "utf8");
  seedProfiles = JSON.parse(seedContent);
} catch (error) {
  console.error(`Failed to read seed file: ${seedFilePath}`);
  console.error(error.message);
  process.exit(1);
}

if (!Array.isArray(seedProfiles)) {
  console.error("Seed file must contain a JSON array of profile objects.");
  process.exit(1);
}

// Get API URL from environment or use default
const apiBaseUrl = process.env.API_BASE_URL || "http://127.0.0.1:4300";

function slugifyProfileName(profileName) {
  return String(profileName)
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function createNewsHash(link, title) {
  return createHash("sha256").update(`${link}${title}`, "utf8").digest("hex");
}

function createDefaultSeedNews(profileName) {
  const slug = slugifyProfileName(profileName) || "profile";
  const now = Date.now();

  const firstLink = `https://example.com/news/${slug}-1`;
  const firstTitle = `${profileName}: Daily Briefing 1`;
  const secondLink = `https://example.com/news/${slug}-2`;
  const secondTitle = `${profileName}: Daily Briefing 2`;
  const thirdLink = `https://example.com/news/${slug}-3`;
  const thirdTitle = `${profileName}: Daily Briefing 3`;

  return [
    {
      newsId: createNewsHash(firstLink, firstTitle),
      title: firstTitle,
      summary: `Seeded sample news item 1 for ${profileName}.`,
      origin: "Seed Runner",
      link: firstLink,
      timestamp: new Date(now - 15 * 60 * 1000).toISOString(),
      favorite: false,
    },
    {
      newsId: createNewsHash(secondLink, secondTitle),
      title: secondTitle,
      summary: `Seeded sample news item 2 for ${profileName}.`,
      origin: "Seed Runner",
      link: secondLink,
      timestamp: new Date(now - 60 * 60 * 1000).toISOString(),
      favorite: true,
    },
    {
      newsId: createNewsHash(thirdLink, thirdTitle),
      title: thirdTitle,
      summary: `Seeded sample news item 3 for ${profileName}.`,
      origin: "Seed Runner",
      link: thirdLink,
      timestamp: new Date(now - 3 * 60 * 60 * 1000).toISOString(),
      favorite: false,
    },
  ];
}

async function fetchJson(url) {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Request failed (${response.status}) for ${url}`);
  }

  return response.json();
}

function getExpectedSourcePayload(profile) {
  if (
    profile &&
    typeof profile._source === "object" &&
    profile._source !== null
  ) {
    return profile._source;
  }

  return {
    name: `${profile.name}`,
    description: `Auto-generated source for ${profile.name}.`,
    urls: Array.isArray(profile.urls) ? profile.urls : [],
    rssFeeds: Array.isArray(profile.rssFeeds) ? profile.rssFeeds : [],
  };
}

async function verifySeedState(expectedProfiles) {
  const actualProfiles = await fetchJson(`${apiBaseUrl}/api/profiles`);

  if (actualProfiles.length !== expectedProfiles.length) {
    throw new Error(
      `Verification failed: expected ${expectedProfiles.length} profiles, got ${actualProfiles.length}.`,
    );
  }

  for (const expectedProfile of expectedProfiles) {
    const actualProfile = actualProfiles.find(
      (entry) => entry.name === expectedProfile.name,
    );

    if (!actualProfile) {
      throw new Error(
        `Verification failed: profile "${expectedProfile.name}" is missing.`,
      );
    }

    const expectedSource = getExpectedSourcePayload(expectedProfile);

    const actualUrls = new Set((actualProfile.urls ?? []).map((u) => u.url));
    for (const expectedUrl of expectedSource.urls ?? []) {
      if (!actualUrls.has(expectedUrl.url)) {
        throw new Error(
          `Verification failed: profile "${expectedProfile.name}" is missing URL "${expectedUrl.url}".`,
        );
      }
    }

    const actualRss = new Set(
      (actualProfile.rssFeeds ?? []).map((feed) => feed.feedUrl),
    );
    for (const expectedFeed of expectedSource.rssFeeds ?? []) {
      if (!actualRss.has(expectedFeed.feedUrl)) {
        throw new Error(
          `Verification failed: profile "${expectedProfile.name}" is missing RSS "${expectedFeed.feedUrl}".`,
        );
      }
    }

    const actualTagCount = (actualProfile.tags ?? []).length;
    if (actualTagCount < 3) {
      throw new Error(
        `Verification failed: profile "${expectedProfile.name}" expected >= 3 tags, got ${actualTagCount}.`,
      );
    }

    const actualRoleCount = (actualProfile.roles ?? []).length;
    if (actualRoleCount < 3) {
      throw new Error(
        `Verification failed: profile "${expectedProfile.name}" expected >= 3 roles, got ${actualRoleCount}.`,
      );
    }

    const expectedUrlCount = (expectedSource.urls ?? []).length;
    const actualUrlCount = (actualProfile.urls ?? []).length;
    if (actualUrlCount !== expectedUrlCount) {
      throw new Error(
        `Verification failed: profile "${expectedProfile.name}" expected ${expectedUrlCount} URLs, got ${actualUrlCount}.`,
      );
    }

    const expectedRssCount = (expectedSource.rssFeeds ?? []).length;
    const actualRssCount = (actualProfile.rssFeeds ?? []).length;
    if (actualRssCount !== expectedRssCount) {
      throw new Error(
        `Verification failed: profile "${expectedProfile.name}" expected ${expectedRssCount} RSS feeds, got ${actualRssCount}.`,
      );
    }

    const profileNews = await fetchJson(
      `${apiBaseUrl}/api/news?sourceId=${actualProfile.sourceId}`,
    );

    if (profileNews.length !== 3) {
      throw new Error(
        `Verification failed: profile "${expectedProfile.name}" expected 3 news items, got ${profileNews.length}.`,
      );
    }

    const expectedErrors = Array.isArray(expectedProfile._seedErrors)
      ? expectedProfile._seedErrors.length
      : 0;

    if (expectedErrors > 0) {
      const profileErrors = (await fetchJson(`${apiBaseUrl}/api/errors`)).filter(
        (errorItem) =>
          errorItem.externalRefType === "source" &&
          errorItem.externalRefId === String(actualProfile.sourceId),
      );

      if (profileErrors.length !== expectedErrors) {
        throw new Error(
          `Verification failed: profile "${expectedProfile.name}" expected ${expectedErrors} errors, got ${profileErrors.length}.`,
        );
      }
    }
  }
}

// Initialize each profile
async function initializeProfiles() {
  let successCount = 0;
  let skipCount = 0;
  let deleteCount = 0;
  let errorCount = 0;

  const listResponse = await fetch(`${apiBaseUrl}/api/profiles`);
  if (!listResponse.ok) {
    throw new Error(`Failed to list profiles: ${listResponse.statusText}`);
  }

  const existingProfiles = await listResponse.json();

  if (strictMode) {
    for (const existing of existingProfiles) {
      const deleteResponse = await fetch(
        `${apiBaseUrl}/api/profiles/${existing.id}`,
        {
          method: "DELETE",
        },
      );

      if (!deleteResponse.ok) {
        throw new Error(
          `Failed to delete existing profile ${existing.id}: ${deleteResponse.statusText}`,
        );
      }

      console.log(
        `⊘ Deleted existing profile: "${existing.name}" (ID: ${existing.id})`,
      );
      deleteCount += 1;
    }

    const existingSourcesResponse = await fetch(`${apiBaseUrl}/api/sources`);
    if (!existingSourcesResponse.ok) {
      throw new Error(
        `Failed to list sources for strict reset: ${existingSourcesResponse.statusText}`,
      );
    }

    const existingSources = await existingSourcesResponse.json();
    for (const source of existingSources) {
      const deleteSourceResponse = await fetch(
        `${apiBaseUrl}/api/sources/${source.id}`,
        {
          method: "DELETE",
        },
      );

      if (!deleteSourceResponse.ok) {
        throw new Error(
          `Failed to delete existing source ${source.id}: ${deleteSourceResponse.statusText}`,
        );
      }

      console.log(
        `⊘ Deleted existing source: "${source.name}" (ID: ${source.id})`,
      );
    }
  }

  const existingNames = new Set(
    strictMode
      ? []
      : existingProfiles.map((profile) =>
          String(profile.name).toLocaleLowerCase(),
        ),
  );

  for (const profile of seedProfiles) {
    try {
      const profileName = String(profile.name ?? "").trim();
      const alreadyExists = existingNames.has(profileName.toLocaleLowerCase());

      if (!strictMode && alreadyExists) {
        console.log(`⊘ Skipped: Profile "${profile.name}" already exists.`);
        skipCount += 1;
        continue;
      }

      // If profile has a _notificationProfile, create it first
      let profileToCreate = { ...profile };
      if (profile._notificationProfile) {
        const notifProfile = profile._notificationProfile;
        const notifResponse = await fetch(
          `${apiBaseUrl}/api/notification-profiles`,
          {
            method: "POST",
            headers: {
              "content-type": "application/json",
            },
            body: JSON.stringify(notifProfile),
          },
        );

        if (!notifResponse.ok) {
          const errorBody = await notifResponse.json();
          throw new Error(
            `Failed to create notification profile: ${errorBody.error || notifResponse.statusText}`,
          );
        }

        const createdNotifProfile = await notifResponse.json();
        console.log(
          `  ✓ Created notification profile: "${createdNotifProfile.name}" (ID: ${createdNotifProfile.id})`,
        );

        profileToCreate.notificationProfileId = createdNotifProfile.id;
        delete profileToCreate._notificationProfile;
      }

      const seedErrors = Array.isArray(profileToCreate._seedErrors)
        ? profileToCreate._seedErrors
        : [];
      delete profileToCreate._seedErrors;

      const sourcePayload = getExpectedSourcePayload(profileToCreate);
      const sourceResponse = await fetch(`${apiBaseUrl}/api/sources`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify(sourcePayload),
      });

      if (!sourceResponse.ok) {
        const errorBody = await sourceResponse.json();
        throw new Error(
          errorBody.error ||
            `Failed to create source for profile "${profileName}": ${sourceResponse.statusText}`,
        );
      }

      const createdSource = await sourceResponse.json();
      console.log(
        `  ✓ Created source: "${createdSource.name}" (ID: ${createdSource.id})`,
      );

      profileToCreate.sourceId = createdSource.id;
      delete profileToCreate.urls;
      delete profileToCreate.rssFeeds;
      delete profileToCreate._source;

      // Create the profile
      const createResponse = await fetch(`${apiBaseUrl}/api/profiles`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify(profileToCreate),
      });

      if (!createResponse.ok) {
        const errorBody = await createResponse.json();
        throw new Error(
          errorBody.error ||
            `Failed to create profile: ${createResponse.statusText}`,
        );
      }

      const createdProfile = await createResponse.json();
      console.log(
        `✓ Created: Profile "${createdProfile.name}" (ID: ${createdProfile.id})`,
      );

      if (seedErrors.length > 0) {
        for (const seedError of seedErrors) {
          const createErrorResponse = await fetch(`${apiBaseUrl}/api/errors`, {
            method: "POST",
            headers: {
              "content-type": "application/json",
            },
            body: JSON.stringify({
              ...seedError,
              profileId: createdProfile.id,
            }),
          });

          if (!createErrorResponse.ok) {
            const errorBody = await createErrorResponse.json();
            throw new Error(
              `Failed to create seeded error for profile "${createdProfile.name}": ${errorBody.error || createErrorResponse.statusText}`,
            );
          }
        }

        console.log(
          `  ✓ Created ${seedErrors.length} seeded error record(s) for "${createdProfile.name}"`,
        );
      }

      const seedNews = createDefaultSeedNews(createdProfile.name);

      for (const seedNewsItem of seedNews) {
        const createNewsResponse = await fetch(`${apiBaseUrl}/api/news`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({
            ...seedNewsItem,
            sourceId: createdProfile.sourceId,
          }),
        });

        if (!createNewsResponse.ok) {
          const errorBody = await createNewsResponse.json();
          throw new Error(
            `Failed to create seeded news for profile "${createdProfile.name}": ${errorBody.error || createNewsResponse.statusText}`,
          );
        }
      }

      console.log(
        `  ✓ Created ${seedNews.length} seeded news item(s) for "${createdProfile.name}"`,
      );

      existingNames.add(String(createdProfile.name).toLocaleLowerCase());
      successCount += 1;
    } catch (error) {
      console.error(
        `✗ Error: Failed to initialize profile "${profile.name}": ${error.message}`,
      );
      errorCount += 1;
    }
  }

  // Summary
  console.log("");
  console.log("Initialization summary:");
  console.log(`  Mode:     ${strictMode ? "strict-reset" : "append"}`);
  console.log(`  Deleted:  ${deleteCount}`);
  console.log(`  Created:  ${successCount}`);
  console.log(`  Skipped:  ${skipCount}`);
  console.log(`  Errors:   ${errorCount}`);

  if (errorCount === 0) {
    try {
      await verifySeedState(seedProfiles);
      console.log("  Verify:  passed");
    } catch (error) {
      console.error(`✗ Verification failed: ${error.message}`);
      errorCount += 1;
    }
  }

  process.exitCode = errorCount > 0 ? 1 : 0;
}

// Run initialization
initializeProfiles().catch((error) => {
  console.error("Fatal error during initialization:", error.message);
  process.exitCode = 1;
});
