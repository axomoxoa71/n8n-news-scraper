import { readdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const { Pool } = pg;
const currentDirectory = dirname(fileURLToPath(import.meta.url));

async function loadInitSql() {
  const sqlDir = join(currentDirectory, "..", "sql");
  const ddlDir = join(sqlDir, "ddl");
  const fkDir = join(sqlDir, "fk");
  const cleanupSql = await readFile(join(sqlDir, "cleanup.sql"), "utf8");

  const ddlFiles = (await readdir(ddlDir))
    .filter((f) => f.endsWith(".sql"))
    .sort();

  const ddlSqls = await Promise.all(
    ddlFiles.map((f) => readFile(join(ddlDir, f), "utf8")),
  );

  const fkSql = await readFile(join(fkDir, "foreign_keys.sql"), "utf8");

  return [cleanupSql, ...ddlSqls, fkSql].join("\n\n");
}

async function loadSeedSql() {
  const sqlDir = join(currentDirectory, "..", "sql");
  return readFile(join(sqlDir, "seed.sql"), "utf8");
}

export function serializeProfileSnapshot(profileInput) {
  return JSON.stringify(profileInput);
}

export function serializeNotificationChannelSnapshot(channelInput) {
  if (channelInput.emailAddresses !== undefined) {
    return JSON.stringify({
      channelType: "email",
      emailAddresses: channelInput.emailAddresses,
    });
  }

  if (channelInput.slackWebhookUrl !== undefined) {
    return JSON.stringify({
      channelType: "slack",
      slackWebhookUrl: channelInput.slackWebhookUrl,
    });
  }

  return JSON.stringify(channelInput);
}

function mapProfileRows(profileRows, urlRows, rssRows, tagRows, roleRows) {
  const urlsByProfileId = new Map();
  const rssByProfileId = new Map();
  const tagsByProfileId = new Map();
  const rolesByProfileId = new Map();

  for (const row of urlRows) {
    const currentUrls = urlsByProfileId.get(row.profile_id) ?? [];
    currentUrls.push({
      url: row.url,
      description: row.description ?? "",
    });
    urlsByProfileId.set(row.profile_id, currentUrls);
  }

  for (const row of rssRows) {
    const currentFeeds = rssByProfileId.get(row.profile_id) ?? [];
    currentFeeds.push({
      feedUrl: row.feed_url,
      title: row.title ?? "",
      refreshCadence: row.refresh_cadence,
      format: row.format,
      category: row.category ?? "",
    });
    rssByProfileId.set(row.profile_id, currentFeeds);
  }

  for (const row of tagRows) {
    const currentTags = tagsByProfileId.get(row.profile_id) ?? [];
    currentTags.push(row.tag_name);
    tagsByProfileId.set(row.profile_id, currentTags);
  }

  for (const row of roleRows) {
    const currentRoles = rolesByProfileId.get(row.profile_id) ?? [];
    currentRoles.push(row.role_name);
    rolesByProfileId.set(row.profile_id, currentRoles);
  }

  return profileRows.map((row) => {
    const snapshot = row.json && typeof row.json === "object" ? row.json : null;
    const snapshotChannelIds = Array.isArray(snapshot?.notificationChannelIds)
      ? snapshot.notificationChannelIds
          .map((entry) => Number(entry))
          .filter((entry) => Number.isInteger(entry) && entry > 0)
      : [];

    const notificationProfileId =
      row.notification_profile_id !== null
        ? Number(row.notification_profile_id)
        : null;

    const notificationChannelIds =
      snapshotChannelIds.length > 0
        ? snapshotChannelIds
        : notificationProfileId
          ? [notificationProfileId]
          : [];

    return {
      id: row.id,
      name: row.name,
      description: row.description ?? "",
      useCustomSources: row.use_custom_sources,
      tags: tagsByProfileId.get(row.id) ?? [],
      roles: rolesByProfileId.get(row.id) ?? [],
      urls: urlsByProfileId.get(row.id) ?? [],
      rssFeeds: rssByProfileId.get(row.id) ?? [],
      notificationProfileId,
      notificationChannelIds,
    };
  });
}

function mapNewsRows(newsRows) {
  return newsRows.map((row) => ({
    id: row.id,
    profileId: row.profile_id,
    title: row.title,
    summary: row.summary,
    origin: row.origin,
    link: row.link,
    timestamp: (row.published_ts ?? row.created_ts).toISOString(),
    favorite: row.favorite,
  }));
}

function mapErrorRows(errorRows) {
  return errorRows.map((row) => ({
    id: row.id,
    profileId: row.profile_id,
    traceId: row.trace_id,
    executionId: row.instance_id,
    errorMessage: row.error_message,
    errorDescription: row.error_description ?? null,
    errorStack: row.error_stack ?? null,
    errorHttpCode: row.error_http_code ?? null,
    nodeName: row.node_name,
    nodeType: row.node_type,
    workflowName: row.workflow_name,
    workflowId: row.workflow_id,
    json: row.json ?? null,
    createdTs: row.created_ts.toISOString(),
    updatedTs: row.updated_ts.toISOString(),
  }));
}

async function listProfilesWithClient(client, profileId) {
  const profileQuery =
    profileId === undefined
      ? `
        SELECT
          id,
          name,
          description,
          use_custom_sources,
          notification_profile_id,
          json
        FROM profiles_t
        ORDER BY created_ts DESC, id DESC
      `
      : `
        SELECT
          id,
          name,
          description,
          use_custom_sources,
          notification_profile_id,
          json
        FROM profiles_t
        WHERE id = $1
        ORDER BY created_ts DESC, id DESC
      `;

  const profileResult = await client.query(
    profileQuery,
    profileId === undefined ? [] : [profileId],
  );

  if (profileResult.rows.length === 0) {
    return [];
  }

  const profileIds = profileResult.rows.map((row) => row.id);
  const urlResult = await client.query(
    `
      SELECT profile_id, url, description
      FROM profile_urls_t
      WHERE profile_id = ANY($1::int[])
      ORDER BY profile_id ASC, position ASC, id ASC
    `,
    [profileIds],
  );

  const rssResult = await client.query(
    `
      SELECT
        profile_id,
        feed_url,
        title,
        refresh_cadence,
        format,
        category
      FROM rss_feeds_t
      WHERE profile_id = ANY($1::int[])
      ORDER BY profile_id ASC, position ASC, id ASC
    `,
    [profileIds],
  );

  const tagResult = await client.query(
    `
      SELECT profile_id, tag_name
      FROM profile_tags_t
      WHERE profile_id = ANY($1::int[])
      ORDER BY profile_id ASC, position ASC, id ASC
    `,
    [profileIds],
  );

  const roleResult = await client.query(
    `
      SELECT profile_id, role_name
      FROM profile_roles_t
      WHERE profile_id = ANY($1::int[])
      ORDER BY profile_id ASC, position ASC, id ASC
    `,
    [profileIds],
  );

  return mapProfileRows(
    profileResult.rows,
    urlResult.rows,
    rssResult.rows,
    tagResult.rows,
    roleResult.rows,
  );
}

async function getProfileById(client, profileId) {
  const profiles = await listProfilesWithClient(client, profileId);
  return profiles[0] ?? null;
}

async function listNotificationProfilesWithClient(client, profileId) {
  const profileQuery =
    profileId === undefined
      ? `
        SELECT id, name, description
        FROM notification_profiles_t
        ORDER BY created_ts DESC, id DESC
      `
      : `
        SELECT id, name, description
        FROM notification_profiles_t
        WHERE id = $1
        ORDER BY created_ts DESC, id DESC
      `;

  const profileResult = await client.query(
    profileQuery,
    profileId === undefined ? [] : [profileId],
  );

  if (profileResult.rows.length === 0) {
    return [];
  }

  const profileIds = profileResult.rows.map((row) => row.id);
  const channelResult = await client.query(
    `
      SELECT
        id,
        notification_profile_id,
        channel_type,
        email_addresses,
        slack_webhook_url
      FROM notification_channels_t
      WHERE notification_profile_id = ANY($1::int[])
      ORDER BY notification_profile_id ASC, position ASC, id ASC
    `,
    [profileIds],
  );

  const channelsByProfileId = new Map();

  for (const row of channelResult.rows) {
    const currentChannels =
      channelsByProfileId.get(row.notification_profile_id) ?? [];
    if (row.channel_type === "email") {
      currentChannels.push({
        id: row.id,
        emailAddresses: row.email_addresses
          ? JSON.parse(row.email_addresses)
          : [],
      });
    } else if (row.channel_type === "slack") {
      currentChannels.push({
        id: row.id,
        slackWebhookUrl: row.slack_webhook_url || "",
      });
    }
    channelsByProfileId.set(row.notification_profile_id, currentChannels);
  }

  return profileResult.rows.map((row) => ({
    id: row.id,
    name: row.name,
    description: row.description || "",
    channels: channelsByProfileId.get(row.id) ?? [],
  }));
}

async function getNotificationProfileById(client, profileId) {
  const profiles = await listNotificationProfilesWithClient(client, profileId);
  return profiles[0] ?? null;
}

export function createPostgresProfilesRepository(options) {
  const pool = new Pool(options.connection);
  const shouldInitialize = options.initialize !== false;

  return {
    async initialize() {
      const initSql = await loadInitSql();
      await pool.query(initSql);

      if (shouldInitialize) {
        const seedSql = await loadSeedSql();
        await pool.query(seedSql);
      }
    },
    async listProfiles() {
      const client = await pool.connect();

      try {
        return await listProfilesWithClient(client);
      } finally {
        client.release();
      }
    },
    async createProfile(profileInput) {
      const client = await pool.connect();
      const profileSnapshot = serializeProfileSnapshot(profileInput);

      try {
        await client.query("BEGIN");
        const insertedProfile = await client.query(
          `
            INSERT INTO profiles_t (
              name,
              description,
              use_custom_sources,
              notification_profile_id,
              json
            )
            VALUES ($1, $2, $3, $4, $5::jsonb)
            RETURNING id
          `,
          [
            profileInput.name,
            profileInput.description || null,
            profileInput.useCustomSources,
            profileInput.notificationProfileId ?? null,
            profileSnapshot,
          ],
        );

        const profileId = insertedProfile.rows[0].id;

        for (const [index, entry] of profileInput.tags.entries()) {
          await client.query(
            `
              INSERT INTO profile_tags_t (profile_id, position, tag_name)
              VALUES ($1, $2, $3)
            `,
            [profileId, index, entry],
          );
        }

        for (const [index, entry] of profileInput.roles.entries()) {
          await client.query(
            `
              INSERT INTO profile_roles_t (profile_id, position, role_name)
              VALUES ($1, $2, $3)
            `,
            [profileId, index, entry],
          );
        }

        for (const [index, entry] of profileInput.urls.entries()) {
          await client.query(
            `
              INSERT INTO profile_urls_t (profile_id, position, url, description)
              VALUES ($1, $2, $3, $4)
            `,
            [profileId, index, entry.url, entry.description || null],
          );
        }

        for (const [index, entry] of profileInput.rssFeeds.entries()) {
          await client.query(
            `
              INSERT INTO rss_feeds_t (
                profile_id,
                position,
                feed_url,
                title,
                refresh_cadence,
                format,
                category
              )
              VALUES ($1, $2, $3, $4, $5, $6, $7)
            `,
            [
              profileId,
              index,
              entry.feedUrl,
              entry.title || null,
              entry.refreshCadence,
              entry.format,
              entry.category || null,
            ],
          );
        }

        await client.query("COMMIT");
        return await getProfileById(client, profileId);
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    },
    async updateProfile(profileId, profileInput) {
      const client = await pool.connect();
      const profileSnapshot = serializeProfileSnapshot(profileInput);

      try {
        await client.query("BEGIN");
        const updateResult = await client.query(
          `
            UPDATE profiles_t
            SET
              name = $2,
              description = $3,
              use_custom_sources = $4,
              notification_profile_id = $5,
              json = $6::jsonb,
              updated_ts = CURRENT_TIMESTAMP
            WHERE id = $1
            RETURNING id
          `,
          [
            profileId,
            profileInput.name,
            profileInput.description || null,
            profileInput.useCustomSources,
            profileInput.notificationProfileId ?? null,
            profileSnapshot,
          ],
        );

        if (updateResult.rowCount === 0) {
          await client.query("ROLLBACK");
          return null;
        }

        await client.query("DELETE FROM profile_urls_t WHERE profile_id = $1", [
          profileId,
        ]);
        await client.query("DELETE FROM profile_tags_t WHERE profile_id = $1", [
          profileId,
        ]);
        await client.query(
          "DELETE FROM profile_roles_t WHERE profile_id = $1",
          [profileId],
        );
        await client.query("DELETE FROM rss_feeds_t WHERE profile_id = $1", [
          profileId,
        ]);

        for (const [index, entry] of profileInput.tags.entries()) {
          await client.query(
            `
              INSERT INTO profile_tags_t (profile_id, position, tag_name)
              VALUES ($1, $2, $3)
            `,
            [profileId, index, entry],
          );
        }

        for (const [index, entry] of profileInput.roles.entries()) {
          await client.query(
            `
              INSERT INTO profile_roles_t (profile_id, position, role_name)
              VALUES ($1, $2, $3)
            `,
            [profileId, index, entry],
          );
        }

        for (const [index, entry] of profileInput.urls.entries()) {
          await client.query(
            `
              INSERT INTO profile_urls_t (profile_id, position, url, description)
              VALUES ($1, $2, $3, $4)
            `,
            [profileId, index, entry.url, entry.description || null],
          );
        }

        for (const [index, entry] of profileInput.rssFeeds.entries()) {
          await client.query(
            `
              INSERT INTO rss_feeds_t (
                profile_id,
                position,
                feed_url,
                title,
                refresh_cadence,
                format,
                category
              )
              VALUES ($1, $2, $3, $4, $5, $6, $7)
            `,
            [
              profileId,
              index,
              entry.feedUrl,
              entry.title || null,
              entry.refreshCadence,
              entry.format,
              entry.category || null,
            ],
          );
        }

        await client.query("COMMIT");
        return await getProfileById(client, profileId);
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    },
    async deleteProfile(profileId) {
      const result = await pool.query("DELETE FROM profiles_t WHERE id = $1", [
        profileId,
      ]);
      return result.rowCount > 0;
    },
    async listNews(profileId) {
      const result = await pool.query(
        `
          SELECT
            id,
            profile_id,
            title,
            summary,
            origin,
            link,
            published_ts,
            created_ts,
            favorite
          FROM news_t
          WHERE profile_id = $1
          ORDER BY published_ts DESC, id DESC
        `,
        [profileId],
      );

      return mapNewsRows(result.rows);
    },
    async updateNewsFavorite(profileId, newsId, favorite) {
      const result = await pool.query(
        `
          UPDATE news_t
          SET
            favorite = $3,
            updated_ts = CURRENT_TIMESTAMP
          WHERE id = $1 AND profile_id = $2
          RETURNING
            id,
            profile_id,
            title,
            summary,
            origin,
            link,
            published_ts,
            created_ts,
            favorite
        `,
        [newsId, profileId, favorite],
      );

      if (result.rowCount === 0) {
        return null;
      }

      return mapNewsRows(result.rows)[0];
    },
    async createNewsItem(newsInput) {
      const publishedTimestamp = newsInput.timestamp
        ? new Date(newsInput.timestamp)
        : new Date();

      const result = await pool.query(
        `
          INSERT INTO news_t (
            profile_id,
            title,
            summary,
            origin,
            link,
            published_ts,
            favorite
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7)
          RETURNING
            id,
            profile_id,
            title,
            summary,
            origin,
            link,
            published_ts,
            created_ts,
            favorite
        `,
        [
          newsInput.profileId,
          newsInput.title,
          newsInput.summary,
          newsInput.origin,
          newsInput.link,
          publishedTimestamp,
          newsInput.favorite === true,
        ],
      );

      return mapNewsRows(result.rows)[0];
    },
    async listErrors(profileId, searchTerm = "") {
      const normalizedSearchTerms = String(searchTerm ?? "")
        .trim()
        .split(/\s+/)
        .filter(Boolean);

      const result = await pool.query(
        `
          SELECT
            id,
            profile_id,
            trace_id,
            instance_id,
            error_message,
            error_description,
            error_stack,
            error_http_code,
            node_name,
            node_type,
            workflow_name,
            workflow_id,
            json,
            created_ts,
            updated_ts
          FROM error_t
          WHERE profile_id = $1
            AND (
              cardinality($2::text[]) = 0
              OR NOT EXISTS (
                SELECT 1
                FROM unnest($2::text[]) AS term
                WHERE NOT (
                  CAST(id AS TEXT) ILIKE '%' || term || '%'
                  OR trace_id ILIKE '%' || term || '%'
                  OR instance_id ILIKE '%' || term || '%'
                  OR error_message ILIKE '%' || term || '%'
                  OR error_description ILIKE '%' || term || '%'
                  OR error_stack ILIKE '%' || term || '%'
                  OR CAST(error_http_code AS TEXT) ILIKE '%' || term || '%'
                  OR node_name ILIKE '%' || term || '%'
                  OR node_type ILIKE '%' || term || '%'
                  OR workflow_name ILIKE '%' || term || '%'
                  OR workflow_id ILIKE '%' || term || '%'
                  OR CAST(json AS TEXT) ILIKE '%' || term || '%'
                  OR CAST(created_ts AS TEXT) ILIKE '%' || term || '%'
                  OR CAST(updated_ts AS TEXT) ILIKE '%' || term || '%'
                )
              )
            )
          ORDER BY created_ts DESC, id DESC
        `,
        [profileId, normalizedSearchTerms],
      );

      return mapErrorRows(result.rows);
    },
    async getError(profileId, errorId) {
      const result = await pool.query(
        `
          SELECT
            id,
            profile_id,
            trace_id,
            instance_id,
            error_message,
            error_description,
            error_stack,
            error_http_code,
            node_name,
            node_type,
            workflow_name,
            workflow_id,
            json,
            created_ts,
            updated_ts
          FROM error_t
          WHERE profile_id = $1 AND id = $2
          LIMIT 1
        `,
        [profileId, errorId],
      );

      return result.rowCount === 0 ? null : mapErrorRows(result.rows)[0];
    },
    async createError(errorInput) {
      const snapshot = JSON.stringify(errorInput.json ?? {});
      const result = await pool.query(
        `
          INSERT INTO error_t (
            profile_id,
            trace_id,
            instance_id,
            error_message,
            error_description,
            error_stack,
            error_http_code,
            node_name,
            node_type,
            workflow_name,
            workflow_id,
            json
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb)
          RETURNING
            id,
            profile_id,
            trace_id,
            instance_id,
            error_message,
            error_description,
            error_stack,
            error_http_code,
            node_name,
            node_type,
            workflow_name,
            workflow_id,
            json,
            created_ts,
            updated_ts
        `,
        [
          errorInput.profileId,
          errorInput.traceId,
          errorInput.executionId,
          errorInput.errorMessage,
          errorInput.errorDescription,
          errorInput.errorStack,
          errorInput.errorHttpCode,
          errorInput.nodeName,
          errorInput.nodeType,
          errorInput.workflowName,
          errorInput.workflowId,
          snapshot,
        ],
      );

      return mapErrorRows(result.rows)[0];
    },
    async clearErrors(profileId) {
      await pool.query("DELETE FROM error_t WHERE profile_id = $1", [
        profileId,
      ]);
    },
    async listNotificationProfiles() {
      const client = await pool.connect();

      try {
        return await listNotificationProfilesWithClient(client);
      } finally {
        client.release();
      }
    },
    async createNotificationProfile(profileInput) {
      const client = await pool.connect();

      try {
        await client.query("BEGIN");
        const insertedProfile = await client.query(
          `
            INSERT INTO notification_profiles_t (name, description)
            VALUES ($1, $2)
            RETURNING id
          `,
          [profileInput.name, profileInput.description || null],
        );

        const profileId = insertedProfile.rows[0].id;

        for (const [index, channel] of profileInput.channels.entries()) {
          const channelSnapshot = serializeNotificationChannelSnapshot(channel);

          if (channel.emailAddresses !== undefined) {
            await client.query(
              `
                INSERT INTO notification_channels_t (
                  notification_profile_id,
                  position,
                  channel_type,
                  email_addresses,
                  json
                )
                VALUES ($1, $2, $3, $4, $5::jsonb)
              `,
              [
                profileId,
                index,
                "email",
                JSON.stringify(channel.emailAddresses),
                channelSnapshot,
              ],
            );
          } else if (channel.slackWebhookUrl !== undefined) {
            await client.query(
              `
                INSERT INTO notification_channels_t (
                  notification_profile_id,
                  position,
                  channel_type,
                  slack_webhook_url,
                  json
                )
                VALUES ($1, $2, $3, $4, $5::jsonb)
              `,
              [
                profileId,
                index,
                "slack",
                channel.slackWebhookUrl,
                channelSnapshot,
              ],
            );
          }
        }

        await client.query("COMMIT");

        return await getNotificationProfileById(client, profileId);
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    },
    async updateNotificationProfile(profileId, profileInput) {
      const client = await pool.connect();

      try {
        await client.query("BEGIN");
        const updateResult = await client.query(
          `
            UPDATE notification_profiles_t
            SET
              name = $2,
              description = $3,
              updated_ts = CURRENT_TIMESTAMP
            WHERE id = $1
            RETURNING id
          `,
          [profileId, profileInput.name, profileInput.description || null],
        );

        if (updateResult.rowCount === 0) {
          await client.query("ROLLBACK");
          return null;
        }

        await client.query(
          "DELETE FROM notification_channels_t WHERE notification_profile_id = $1",
          [profileId],
        );

        for (const [index, channel] of profileInput.channels.entries()) {
          const channelSnapshot = serializeNotificationChannelSnapshot(channel);

          if (channel.emailAddresses !== undefined) {
            await client.query(
              `
                INSERT INTO notification_channels_t (
                  notification_profile_id,
                  position,
                  channel_type,
                  email_addresses,
                  json
                )
                VALUES ($1, $2, $3, $4, $5::jsonb)
              `,
              [
                profileId,
                index,
                "email",
                JSON.stringify(channel.emailAddresses),
                channelSnapshot,
              ],
            );
          } else if (channel.slackWebhookUrl !== undefined) {
            await client.query(
              `
                INSERT INTO notification_channels_t (
                  notification_profile_id,
                  position,
                  channel_type,
                  slack_webhook_url,
                  json
                )
                VALUES ($1, $2, $3, $4, $5::jsonb)
              `,
              [
                profileId,
                index,
                "slack",
                channel.slackWebhookUrl,
                channelSnapshot,
              ],
            );
          }
        }

        await client.query("COMMIT");

        return await getNotificationProfileById(client, profileId);
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    },
    async deleteNotificationProfile(profileId) {
      const result = await pool.query(
        "DELETE FROM notification_profiles_t WHERE id = $1",
        [profileId],
      );
      return result.rowCount > 0;
    },
    async close() {
      await pool.end();
    },
  };
}
