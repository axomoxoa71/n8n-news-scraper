import { createMemoryProfilesRepository } from "./memory-repository.mjs";
import { createPostgresProfilesRepository } from "./postgres-repository.mjs";

function hasPostgresConfig(postgresConfig) {
  return Boolean(postgresConfig?.connectionString || postgresConfig?.host);
}

export function createProfilesRepository(config) {
  if (
    config.profileStore === "postgres" &&
    hasPostgresConfig(config.postgres)
  ) {
    return createPostgresProfilesRepository({
      connection: config.postgres,
      initialize: config.initialize,
    });
  }

  return createMemoryProfilesRepository();
}
