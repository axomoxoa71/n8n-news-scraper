import dotenv from "dotenv";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadServerConfig } from "./config.mjs";
import { createNewsScraperApi } from "./app.mjs";
import { logEvent } from "./logger.mjs";
import { startOtelSdk, stopOtelSdk } from "./otel.mjs";
import { createProfilesRepository } from "./repository.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));

const defaultSharedEnvPath = "C:\\Users\\rober15\\.newsscraper";
const configuredSharedEnvPath =
  process.env.NEWS_SCRAPER_ENV_FILE ?? defaultSharedEnvPath;

function resolveSharedEnvFiles(envPath) {
  if (!envPath || !existsSync(envPath)) {
    return [];
  }

  if (statSync(envPath).isDirectory()) {
    const candidateFiles = ["postgres.env", "n8n.env"];
    return candidateFiles
      .map((candidate) => join(envPath, candidate))
      .filter((candidatePath) => existsSync(candidatePath));
  }

  return [envPath];
}

function resolveEnvironmentScopedEnvFiles(envPath) {
  const files = {
    production: [],
    test: [],
  };

  if (!envPath || !existsSync(envPath)) {
    return files;
  }

  if (statSync(envPath).isDirectory()) {
    const directoryEntries = readdirSync(envPath, { withFileTypes: true })
      .filter((entry) => entry.isFile())
      .map((entry) => entry.name)
      .sort((left, right) => left.localeCompare(right));

    for (const entryName of directoryEntries) {
      const candidatePath = join(envPath, entryName);

      if (entryName.endsWith(".prod.env")) {
        files.production.push(candidatePath);
      } else if (entryName.endsWith(".test.env")) {
        files.test.push(candidatePath);
      }
    }

    return files;
  }

  if (envPath.endsWith(".prod.env")) {
    files.production.push(envPath);
  } else if (envPath.endsWith(".test.env")) {
    files.test.push(envPath);
  }

  return files;
}

function readEnvironmentFileValues(filePaths) {
  const mergedValues = {};

  for (const filePath of filePaths) {
    const parsed = dotenv.parse(readFileSync(filePath));
    Object.assign(mergedValues, parsed);
  }

  return mergedValues;
}

dotenv.config({ quiet: true });

const sharedEnvFilePaths = resolveSharedEnvFiles(configuredSharedEnvPath);
const environmentScopedEnvFiles = resolveEnvironmentScopedEnvFiles(
  configuredSharedEnvPath,
);
const environmentScopedEnv = {
  production: readEnvironmentFileValues(environmentScopedEnvFiles.production),
  test: readEnvironmentFileValues(environmentScopedEnvFiles.test),
};

for (const sharedEnvFilePath of sharedEnvFilePaths) {
  dotenv.config({ path: sharedEnvFilePath, quiet: true });
}

const isOtelDisabled = process.env.OTEL_SDK_DISABLED === "true";
const hasOtelTarget =
  Boolean(process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT) ||
  Boolean(process.env.OTEL_EXPORTER_OTLP_ENDPOINT) ||
  Boolean(process.env.GRAFANA_OTLP_ENDPOINT);

if (!isOtelDisabled && hasOtelTarget) {
  try {
    await startOtelSdk();
    logEvent({
      level: "info",
      layer: "api",
      message: "otel_sdk_enabled",
    });
  } catch (error) {
    logEvent({
      level: "warn",
      layer: "api",
      message: "otel_sdk_start_failed_continuing_without_export",
      error_name: error instanceof Error ? error.name : "UnknownError",
      error_message:
        error instanceof Error
          ? error.message
          : "OpenTelemetry SDK could not be started",
      error_stack: error instanceof Error ? error.stack : undefined,
    });
  }
} else if (isOtelDisabled) {
  logEvent({
    level: "info",
    layer: "api",
    message: "otel_sdk_disabled_by_env",
  });
} else {
  logEvent({
    level: "info",
    layer: "api",
    message: "otel_exporter_not_configured_terminal_logs_only",
  });
}

const config = loadServerConfig(process.env, { environmentScopedEnv });

logEvent({
  level: "info",
  layer: "api",
  message: "news_scraper_config_resolved",
  env_files_loaded: sharedEnvFilePaths,
  env_files_loaded_production: environmentScopedEnvFiles.production,
  env_files_loaded_test: environmentScopedEnvFiles.test,
  scrap_webhook_url_production:
    config.scrapWebhookByEnvironment.production.webhookUrl ?? "(not set)",
  scrap_webhook_url_test:
    config.scrapWebhookByEnvironment.test.webhookUrl ?? "(not set)",
  scrap_webhook_basic_auth_user_production: config.scrapWebhookByEnvironment
    .production.basicAuthUser
    ? "(set)"
    : "(not set)",
  scrap_webhook_basic_auth_user_test: config.scrapWebhookByEnvironment.test
    .basicAuthUser
    ? "(set)"
    : "(not set)",
  scrap_webhook_basic_auth_password_production: config.scrapWebhookByEnvironment
    .production.basicAuthPassword
    ? "(set)"
    : "(not set)",
  scrap_webhook_basic_auth_password_test: config.scrapWebhookByEnvironment.test
    .basicAuthPassword
    ? "(set)"
    : "(not set)",
  profile_store: config.profileStore,
  profile_store_production:
    config.postgresByEnvironment.production.connectionString ||
    config.postgresByEnvironment.production.host
      ? "postgres"
      : "memory",
  profile_store_test:
    config.postgresByEnvironment.test.connectionString ||
    config.postgresByEnvironment.test.host
      ? "postgres"
      : "memory",
  port: config.port,
});

const seedFilePath = join(__dirname, "../../server/sql/seed-profiles.json");

async function autoSeedIfEmpty(repo, environmentLabel) {
  try {
    const profiles = await repo.listProfiles();
    if (profiles.length > 0) {
      logEvent({
        level: "info",
        layer: "api",
        message: "auto_seed_skipped_data_exists",
        environment: environmentLabel,
        profile_count: profiles.length,
      });
      return;
    }

    logEvent({
      level: "info",
      layer: "api",
      message: "auto_seed_starting",
      environment: environmentLabel,
    });

    const seedProfiles = JSON.parse(readFileSync(seedFilePath, "utf8"));
    let seededCount = 0;

    for (const profile of seedProfiles) {
      const seedErrors = Array.isArray(profile._seedErrors)
        ? profile._seedErrors
        : [];

      let profileToCreate = { ...profile };
      delete profileToCreate._seedErrors;

      // Create notification profile first if embedded
      if (profileToCreate._notificationProfile) {
        const notifData = profileToCreate._notificationProfile;
        delete profileToCreate._notificationProfile;
        const createdNotif = await repo.createNotificationProfile(notifData);
        profileToCreate.notificationProfileId = createdNotif.id;
        profileToCreate.notificationChannelIds = [createdNotif.id];
      }

      const createdProfile = await repo.createProfile(profileToCreate);

      // Seed errors
      for (const seedError of seedErrors) {
        await repo.createError({ ...seedError, profileId: createdProfile.id });
      }

      // Seed 3 news items
      const slug = String(createdProfile.name)
        .toLocaleLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
      const now = Date.now();
      const newsItems = [
        {
          title: `${createdProfile.name}: Daily Briefing 1`,
          summary: `Seeded sample news item 1 for ${createdProfile.name}.`,
          origin: "Seed Runner",
          link: `https://example.com/news/${slug}-1`,
          timestamp: new Date(now - 15 * 60 * 1000).toISOString(),
          favorite: false,
          profileId: createdProfile.id,
        },
        {
          title: `${createdProfile.name}: Daily Briefing 2`,
          summary: `Seeded sample news item 2 for ${createdProfile.name}.`,
          origin: "Seed Runner",
          link: `https://example.com/news/${slug}-2`,
          timestamp: new Date(now - 60 * 60 * 1000).toISOString(),
          favorite: true,
          profileId: createdProfile.id,
        },
        {
          title: `${createdProfile.name}: Daily Briefing 3`,
          summary: `Seeded sample news item 3 for ${createdProfile.name}.`,
          origin: "Seed Runner",
          link: `https://example.com/news/${slug}-3`,
          timestamp: new Date(now - 3 * 60 * 60 * 1000).toISOString(),
          favorite: false,
          profileId: createdProfile.id,
        },
      ];
      for (const newsItem of newsItems) {
        await repo.createNewsItem(newsItem);
      }

      seededCount += 1;
    }

    logEvent({
      level: "info",
      layer: "api",
      message: "auto_seed_completed",
      environment: environmentLabel,
      profiles_seeded: seededCount,
    });
  } catch (error) {
    logEvent({
      level: "warn",
      layer: "api",
      message: "auto_seed_failed",
      environment: environmentLabel,
      error_name: error instanceof Error ? error.name : "UnknownError",
      error_message: error instanceof Error ? error.message : String(error),
    });
  }
}

const repository = createProfilesRepository(config);
const testRepository = createProfilesRepository({
  profileStore: config.profileStore,
  initialize: config.initialize,
  postgres: config.postgresByEnvironment.test,
});
const app = createNewsScraperApi({
  repository,
  repositoryByEnvironment: {
    production: repository,
    test: testRepository,
  },
  scrapWebhookUrl: config.scrapWebhookUrl,
  scrapWebhookBasicAuthUser: config.scrapWebhookBasicAuthUser,
  scrapWebhookBasicAuthPassword: config.scrapWebhookBasicAuthPassword,
  scrapWebhookByEnvironment: config.scrapWebhookByEnvironment,
});
const server = createServer(app);

try {
  await repository.initialize();
  await testRepository.initialize();

  await autoSeedIfEmpty(repository, "production");
  await autoSeedIfEmpty(testRepository, "test");

  server.listen(config.port, () => {
    logEvent({
      level: "info",
      layer: "api",
      message: "news_scraper_api_listening",
      server_url: `http://127.0.0.1:${config.port}`,
      storage_type: config.profileStore,
    });
  });
} catch (error) {
  logEvent({
    level: "error",
    layer: "api",
    message: "news_scraper_api_start_failed",
    error_name: error instanceof Error ? error.name : "UnknownError",
    error_message:
      error instanceof Error
        ? error.message
        : "Could not start the News Scraper API",
    error_stack: error instanceof Error ? error.stack : undefined,
  });
  try {
    await stopOtelSdk();
  } catch (stopError) {
    logEvent({
      level: "warn",
      layer: "api",
      message: "otel_sdk_shutdown_error",
      error_name: stopError instanceof Error ? stopError.name : "UnknownError",
      error_message:
        stopError instanceof Error
          ? stopError.message
          : "OpenTelemetry SDK shutdown reported an error",
      error_stack: stopError instanceof Error ? stopError.stack : undefined,
    });
  }
  await repository.close();
  await testRepository.close();
  process.exit(1);
}

async function shutdown(exitCode) {
  server.close();
  try {
    await stopOtelSdk();
  } catch (error) {
    logEvent({
      level: "warn",
      layer: "api",
      message: "otel_sdk_shutdown_error",
      error_name: error instanceof Error ? error.name : "UnknownError",
      error_message:
        error instanceof Error
          ? error.message
          : "OpenTelemetry SDK shutdown reported an error",
      error_stack: error instanceof Error ? error.stack : undefined,
    });
  }
  await repository.close();
  await testRepository.close();
  process.exit(exitCode);
}

process.on("SIGINT", () => {
  void shutdown(0);
});

process.on("SIGTERM", () => {
  void shutdown(0);
});
