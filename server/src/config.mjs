function toNumber(value, fallbackValue) {
  const parsedValue = Number(value);
  return Number.isFinite(parsedValue) ? parsedValue : fallbackValue;
}

function toBoolean(value, fallbackValue) {
  if (typeof value !== "string") {
    return fallbackValue;
  }

  const normalized = value.trim().toLocaleLowerCase();

  if (["true", "1", "yes", "on"].includes(normalized)) {
    return true;
  }

  if (["false", "0", "no", "off"].includes(normalized)) {
    return false;
  }

  return fallbackValue;
}

function toNonEmptyString(value) {
  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.trim();
  return normalized ? normalized : undefined;
}

function resolveEnvironmentPostgresConfig(env, environmentScopedEnv = {}) {
  const sslMode =
    toNonEmptyString(environmentScopedEnv.PGSSLMODE) ||
    toNonEmptyString(env.PGSSLMODE);
  return {
    connectionString:
      toNonEmptyString(environmentScopedEnv.DATABASE_URL) ||
      toNonEmptyString(env.DATABASE_URL),
    host:
      toNonEmptyString(environmentScopedEnv.PGHOST) ||
      toNonEmptyString(env.PGHOST),
    port: environmentScopedEnv.PGPORT
      ? toNumber(environmentScopedEnv.PGPORT, 5432)
      : env.PGPORT
        ? toNumber(env.PGPORT, 5432)
        : undefined,
    database:
      toNonEmptyString(environmentScopedEnv.PGDATABASE) ||
      toNonEmptyString(env.PGDATABASE),
    user:
      toNonEmptyString(environmentScopedEnv.PGUSER) ||
      toNonEmptyString(env.PGUSER),
    password:
      toNonEmptyString(environmentScopedEnv.PGPASSWORD) ||
      toNonEmptyString(env.PGPASSWORD),
    ssl: sslMode === "require" ? { rejectUnauthorized: false } : undefined,
  };
}

function resolveEnvironmentWebhookConfig(env, environmentScopedEnv = {}) {
  const webhookUrl =
    toNonEmptyString(environmentScopedEnv.SCRAP_WEBHOOK_URL) ||
    toNonEmptyString(environmentScopedEnv.N8N_WORKFLOW_URL) ||
    toNonEmptyString(env.SCRAP_WEBHOOK_URL) ||
    toNonEmptyString(env.N8N_WORKFLOW_URL);
  const basicAuthUser =
    toNonEmptyString(environmentScopedEnv.BASIC_AUTH_USER) ||
    toNonEmptyString(env.BASIC_AUTH_USER);
  const basicAuthPassword =
    toNonEmptyString(environmentScopedEnv.BASIC_AUTH_PWD) ||
    toNonEmptyString(env.BASIC_AUTH_PWD);

  return {
    webhookUrl,
    basicAuthUser,
    basicAuthPassword,
  };
}

export function loadServerConfig(env = process.env, options = {}) {
  const environmentScopedEnv = options.environmentScopedEnv ?? {};
  const productionPostgres = resolveEnvironmentPostgresConfig(
    env,
    environmentScopedEnv.production ?? {},
  );
  const testPostgres = resolveEnvironmentPostgresConfig(
    env,
    environmentScopedEnv.test ?? {},
  );
  const hasDatabaseConfig = Boolean(
    productionPostgres.connectionString ||
    productionPostgres.host ||
    testPostgres.connectionString ||
    testPostgres.host ||
    env.DATABASE_URL ||
    env.PGHOST,
  );
  const profileStore =
    env.PROFILE_STORE ?? (hasDatabaseConfig ? "postgres" : "memory");
  const initialize = toBoolean(env.INITIALIZE ?? env.initialize, true);
  const productionWebhook = resolveEnvironmentWebhookConfig(
    env,
    environmentScopedEnv.production,
  );
  const testWebhook = resolveEnvironmentWebhookConfig(
    env,
    environmentScopedEnv.test,
  );

  return {
    port: toNumber(env.PORT, 4300),
    profileStore,
    initialize,
    scrapWebhookUrl: productionWebhook.webhookUrl,
    scrapWebhookBasicAuthUser: productionWebhook.basicAuthUser,
    scrapWebhookBasicAuthPassword: productionWebhook.basicAuthPassword,
    scrapWebhookByEnvironment: {
      production: productionWebhook,
      test: testWebhook,
    },
    postgresByEnvironment: {
      production: productionPostgres,
      test: testPostgres,
    },
    // Kept for backward compatibility
    postgres: productionPostgres,
  };
}
