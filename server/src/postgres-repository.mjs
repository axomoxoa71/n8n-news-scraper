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

export function serializeNotificationProfileSnapshot(profileInput) {
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

export function serializeSourceSnapshot(sourceInput) {
  return JSON.stringify(sourceInput);
}

function addIdToSnapshot(id, snapshot) {
  if (typeof snapshot === "string") {
    try {
      const parsed = JSON.parse(snapshot);
      return JSON.stringify({ ...parsed, id });
    } catch {
      return JSON.stringify({ id });
    }
  }
  if (snapshot && typeof snapshot === "object") {
    return JSON.stringify({ ...snapshot, id });
  }
  return JSON.stringify({ id });
}

function mapSourceRows(sourceRows, urlRows, rssRows) {
  const urlsBySourceId = new Map();
  const rssBySourceId = new Map();

  for (const row of urlRows) {
    const currentUrls = urlsBySourceId.get(row.source_id) ?? [];
    currentUrls.push({
      url: row.url,
      description: row.description ?? "",
    });
    urlsBySourceId.set(row.source_id, currentUrls);
  }

  for (const row of rssRows) {
    const currentFeeds = rssBySourceId.get(row.source_id) ?? [];
    currentFeeds.push({
      feedUrl: row.feed_url,
      description: row.description ?? undefined,
    });
    rssBySourceId.set(row.source_id, currentFeeds);
  }

  return sourceRows.map((row) => {
    const snapshot = row.json && typeof row.json === "object" ? row.json : null;
    return {
      id: row.id,
      name: row.name,
      description: row.description ?? "",
      urls: urlsBySourceId.get(row.id) ?? [],
      rssFeeds: rssBySourceId.get(row.id) ?? [],
      json: snapshot,
    };
  });
}

function mapProfileRows(
  profileRows,
  tagRows,
  roleRows,
  sourcesById = new Map(),
) {
  const tagsByProfileId = new Map();
  const rolesByProfileId = new Map();

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

    const source =
      row.source_id !== null ? sourcesById.get(Number(row.source_id)) : null;

    return {
      id: row.id,
      name: row.name,
      description: row.description ?? "",
      systemPrompt:
        typeof snapshot?.systemPrompt === "string" ? snapshot.systemPrompt : "",
      sourceId: row.source_id !== null ? Number(row.source_id) : null,
      useCustomSources: true,
      tags: tagsByProfileId.get(row.id) ?? [],
      roles: rolesByProfileId.get(row.id) ?? [],
      urls: source?.urls ?? [],
      rssFeeds: source?.rssFeeds ?? [],
      notificationProfileId,
      notificationChannelIds,
    };
  });
}

function mapNewsRows(newsRows) {
  return newsRows.map((row) => ({
    id: row.id,
    newsId: row.newsId,
    sourceId: row.source_id,
    title: row.title,
    summary: row.summary,
    origin: row.origin,
    link: row.link,
    timestamp: (row.published_ts ?? row.created_ts).toISOString(),
    favorite: row.favorite,
    ragStatus: row.rag_status ?? 'NEW',
  }));
}

function mapErrorRows(errorRows) {
  return errorRows.map((row) => ({
    id: row.id,
    profileId:
      row.external_ref_type === "profile" && row.external_ref_id !== null
        ? Number(row.external_ref_id)
        : null,
    externalRefId: row.external_ref_id ?? null,
    externalRefType: row.external_ref_type ?? null,
    externalRefName: row.external_ref_name ?? null,
    traceId: row.trace_id,
    executionId: row.execution_id,
    errorMessage: row.error_message,
    errorDescription: row.error_details ?? null,
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
          source_id,
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
          source_id,
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

  const sourceIds = [
    ...new Set(
      profileResult.rows
        .map((row) => Number(row.source_id))
        .filter(
          (sourceIdValue) =>
            Number.isInteger(sourceIdValue) && sourceIdValue > 0,
        ),
    ),
  ];

  const sourcesById = new Map();
  if (sourceIds.length > 0) {
    const sourceResult = await client.query(
      `
        SELECT id, name, description, json
        FROM sources_t
        WHERE id = ANY($1::int[])
      `,
      [sourceIds],
    );

    const sourceUrlResult = await client.query(
      `
        SELECT source_id, url, description
        FROM source_urls_t
        WHERE source_id = ANY($1::int[])
        ORDER BY source_id ASC, position ASC, id ASC
      `,
      [sourceIds],
    );

    const sourceRssResult = await client.query(
      `
        SELECT source_id, feed_url, description
        FROM source_rss_feeds_t
        WHERE source_id = ANY($1::int[])
        ORDER BY source_id ASC, position ASC, id ASC
      `,
      [sourceIds],
    );

    for (const source of mapSourceRows(
      sourceResult.rows,
      sourceUrlResult.rows,
      sourceRssResult.rows,
    )) {
      sourcesById.set(source.id, source);
    }
  }

  return mapProfileRows(
    profileResult.rows,
    tagResult.rows,
    roleResult.rows,
    sourcesById,
  );
}

async function listSourcesWithClient(client, sourceId) {
  const sourceQuery =
    sourceId === undefined
      ? `
        SELECT id, name, description, json
        FROM sources_t
        ORDER BY created_ts DESC, id DESC
      `
      : `
        SELECT id, name, description, json
        FROM sources_t
        WHERE id = $1
        ORDER BY created_ts DESC, id DESC
      `;

  const sourceResult = await client.query(
    sourceQuery,
    sourceId === undefined ? [] : [sourceId],
  );

  if (sourceResult.rows.length === 0) {
    return [];
  }

  const sourceIds = sourceResult.rows.map((row) => row.id);

  const urlResult = await client.query(
    `
      SELECT source_id, url, description
      FROM source_urls_t
      WHERE source_id = ANY($1::int[])
      ORDER BY source_id ASC, position ASC, id ASC
    `,
    [sourceIds],
  );

  const rssResult = await client.query(
    `
      SELECT
        source_id,
        feed_url,
        description
      FROM source_rss_feeds_t
      WHERE source_id = ANY($1::int[])
      ORDER BY source_id ASC, position ASC, id ASC
    `,
    [sourceIds],
  );

  return mapSourceRows(sourceResult.rows, urlResult.rows, rssResult.rows);
}

async function getSourceById(client, sourceId) {
  const sources = await listSourcesWithClient(client, sourceId);
  return sources[0] ?? null;
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
        slack_webhook_url,
        json
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
    const snapshot = row.json && typeof row.json === "object" ? row.json : null;
    if (row.channel_type === "email") {
      currentChannels.push({
        id: row.id,
        emailAddresses: row.email_addresses
          ? JSON.parse(row.email_addresses)
          : [],
        json: snapshot,
      });
    } else if (row.channel_type === "slack") {
      currentChannels.push({
        id: row.id,
        slackWebhookUrl: row.slack_webhook_url || "",
        json: snapshot,
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
  const sessionProfileMap = new Map();

  function toLegacyChat(userRow, assistantRow, profileId = null) {
    const status =
      assistantRow?.quality === 0
        ? "failed"
        : assistantRow
          ? "completed"
          : "pending";

    return {
      id: userRow.id,
      profileId,
      sessionId: userRow.session_id,
      message: userRow.message,
      agentResponse: assistantRow?.message ?? null,
      n8nExecutionId: null,
      traceId: "",
      status,
      createdTs: userRow.created_ts,
      updatedTs: assistantRow?.created_ts ?? userRow.created_ts,
    };
  }

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
              source_id,
              notification_profile_id,
              json
            )
            VALUES ($1, $2, $3, $4, $5::jsonb)
            RETURNING id
          `,
          [
            profileInput.name,
            profileInput.description || null,
            profileInput.sourceId,
            profileInput.notificationProfileId ?? null,
            profileSnapshot,
          ],
        );

        const profileId = insertedProfile.rows[0].id;

        // Update json to include id
        const profileSnapshotWithId = addIdToSnapshot(
          profileId,
          profileSnapshot,
        );
        await client.query(
          `
            UPDATE profiles_t
            SET json = $1::jsonb
            WHERE id = $2
          `,
          [profileSnapshotWithId, profileId],
        );

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
      const profileSnapshotWithId = addIdToSnapshot(
        profileId,
        serializeProfileSnapshot(profileInput),
      );

      try {
        await client.query("BEGIN");
        const updateResult = await client.query(
          `
            UPDATE profiles_t
            SET
              name = $2,
              description = $3,
              source_id = $4,
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
            profileInput.sourceId,
            profileInput.notificationProfileId ?? null,
            profileSnapshotWithId,
          ],
        );

        if (updateResult.rowCount === 0) {
          await client.query("ROLLBACK");
          return null;
        }

        await client.query("DELETE FROM profile_tags_t WHERE profile_id = $1", [
          profileId,
        ]);
        await client.query(
          "DELETE FROM profile_roles_t WHERE profile_id = $1",
          [profileId],
        );

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
    async listSources() {
      const client = await pool.connect();

      try {
        return await listSourcesWithClient(client);
      } finally {
        client.release();
      }
    },
    async createSource(sourceInput) {
      const client = await pool.connect();
      const sourceSnapshot = serializeSourceSnapshot(sourceInput);

      try {
        await client.query("BEGIN");
        const insertedSource = await client.query(
          `
            INSERT INTO sources_t (name, description, json)
            VALUES ($1, $2, $3::jsonb)
            RETURNING id
          `,
          [sourceInput.name, sourceInput.description || null, sourceSnapshot],
        );

        const sourceId = insertedSource.rows[0].id;

        // Update json to include id
        const sourceSnapshotWithId = addIdToSnapshot(sourceId, sourceSnapshot);
        await client.query(
          `
            UPDATE sources_t
            SET json = $1::jsonb
            WHERE id = $2
          `,
          [sourceSnapshotWithId, sourceId],
        );

        for (const [index, entry] of sourceInput.urls.entries()) {
          await client.query(
            `
              INSERT INTO source_urls_t (source_id, position, url, description)
              VALUES ($1, $2, $3, $4)
            `,
            [sourceId, index, entry.url, entry.description || null],
          );
        }

        for (const [index, entry] of sourceInput.rssFeeds.entries()) {
          await client.query(
            `
              INSERT INTO source_rss_feeds_t (
                source_id,
                position,
                feed_url,
                description
              )
              VALUES ($1, $2, $3, $4)
            `,
            [sourceId, index, entry.feedUrl, entry.description || null],
          );
        }

        await client.query("COMMIT");
        return await getSourceById(client, sourceId);
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    },
    async updateSource(sourceId, sourceInput) {
      const client = await pool.connect();
      const sourceSnapshotWithId = addIdToSnapshot(
        sourceId,
        serializeSourceSnapshot(sourceInput),
      );

      try {
        await client.query("BEGIN");
        const updateResult = await client.query(
          `
            UPDATE sources_t
            SET
              name = $2,
              description = $3,
              json = $4::jsonb,
              updated_ts = CURRENT_TIMESTAMP
            WHERE id = $1
            RETURNING id
          `,
          [
            sourceId,
            sourceInput.name,
            sourceInput.description || null,
            sourceSnapshotWithId,
          ],
        );

        if (updateResult.rowCount === 0) {
          await client.query("ROLLBACK");
          return null;
        }

        await client.query("DELETE FROM source_urls_t WHERE source_id = $1", [
          sourceId,
        ]);
        await client.query(
          "DELETE FROM source_rss_feeds_t WHERE source_id = $1",
          [sourceId],
        );

        for (const [index, entry] of sourceInput.urls.entries()) {
          await client.query(
            `
              INSERT INTO source_urls_t (source_id, position, url, description)
              VALUES ($1, $2, $3, $4)
            `,
            [sourceId, index, entry.url, entry.description || null],
          );
        }

        for (const [index, entry] of sourceInput.rssFeeds.entries()) {
          await client.query(
            `
              INSERT INTO source_rss_feeds_t (
                source_id,
                position,
                feed_url,
                description
              )
              VALUES ($1, $2, $3, $4)
            `,
            [sourceId, index, entry.feedUrl, entry.description || null],
          );
        }

        await client.query("COMMIT");
        return await getSourceById(client, sourceId);
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    },
    async deleteSource(sourceId) {
      const result = await pool.query("DELETE FROM sources_t WHERE id = $1", [
        sourceId,
      ]);
      return result.rowCount > 0;
    },
    async listNews(sourceId) {
      const result = await pool.query(
        `
          SELECT
            id,
            news_id AS "newsId",
            source_id,
            title,
            summary,
            origin,
            link,
            published_ts,
            created_ts,
            favorite,
            rag_status
          FROM news_t
          WHERE source_id = $1
          ORDER BY published_ts DESC, id DESC
        `,
        [sourceId],
      );

      return mapNewsRows(result.rows);
    },
    async updateNewsFavorite(sourceId, newsId, favorite) {
      const result = await pool.query(
        `
          UPDATE news_t
          SET
            favorite = $3,
            updated_ts = CURRENT_TIMESTAMP
          WHERE id = $1 AND source_id = $2
          RETURNING
            id,
            news_id AS "newsId",
            source_id,
            title,
            summary,
            origin,
            link,
            published_ts,
            created_ts,
            favorite,
            rag_status
        `,
        [newsId, sourceId, favorite],
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
            news_id,
            source_id,
            title,
            summary,
            origin,
            link,
            published_ts,
            favorite
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          RETURNING
            id,
            news_id AS "newsId",
            source_id,
            title,
            summary,
            origin,
            link,
            published_ts,
            created_ts,
            favorite,
            rag_status
        `,
        [
          newsInput.newsId,
          newsInput.sourceId,
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
    async listErrors(
      profileId = null,
      searchTerm = "",
      timeFrame = "lastHour",
      externalRefId = null,
    ) {
      const normalizedSearchTerms = String(searchTerm ?? "")
        .trim()
        .split(/\s+/)
        .filter(Boolean);

      // Calculate timestamp for time frame filtering
      let timeframeCondition = "";
      const now = new Date();
      let cutoffDate = new Date();

      switch (timeFrame) {
        case "lastHour":
          cutoffDate.setHours(cutoffDate.getHours() - 1);
          break;
        case "lastDay":
          cutoffDate.setDate(cutoffDate.getDate() - 1);
          break;
        case "lastWeek":
          cutoffDate.setDate(cutoffDate.getDate() - 7);
          break;
        case "lastMonth":
          cutoffDate.setMonth(cutoffDate.getMonth() - 1);
          break;
        case "all":
        default:
          // No time frame filtering
          break;
      }

      const params = [normalizedSearchTerms];
      let profileCondition = "";

      if (Number.isInteger(profileId) && profileId > 0) {
        profileCondition =
          "AND e.external_ref_type = 'profile' AND e.external_ref_id = $2::text";
        params.push(String(profileId));
      }

      if (timeFrame !== "all") {
        timeframeCondition = `AND e.created_ts >= $${params.length + 1}::timestamptz`;
        params.push(cutoffDate.toISOString());
      }

      let externalRefCondition = "";
      if (externalRefId) {
        externalRefCondition = `AND e.external_ref_id = $${params.length + 1}::text`;
        params.push(externalRefId);
      }

      const result = await pool.query(
        `
          SELECT
            e.id,
            e.external_ref_id,
            e.external_ref_type,
            COALESCE(e.external_ref_name, profile_ref.name) AS external_ref_name,
            e.trace_id,
            e.execution_id,
            e.error_message,
            e.error_details,
            e.error_stack,
            e.error_http_code,
            e.node_name,
            e.node_type,
            e.workflow_name,
            e.workflow_id,
            e.json,
            e.created_ts,
            e.updated_ts
          FROM error_t AS e
          LEFT JOIN profiles_t AS profile_ref
            ON e.external_ref_type = 'profile'
            AND e.external_ref_id ~ '^[0-9]+$'
            AND profile_ref.id = e.external_ref_id::int
          WHERE 1=1
            ${profileCondition}
            ${timeframeCondition}
            ${externalRefCondition}
            AND (
              cardinality($1::text[]) = 0
              OR NOT EXISTS (
                SELECT 1
                FROM unnest($1::text[]) AS term
                WHERE NOT (
                  CAST(e.id AS TEXT) ILIKE '%' || term || '%'
                  OR e.external_ref_id ILIKE '%' || term || '%'
                  OR e.external_ref_type ILIKE '%' || term || '%'
                  OR COALESCE(e.external_ref_name, profile_ref.name, '') ILIKE '%' || term || '%'
                  OR e.trace_id ILIKE '%' || term || '%'
                  OR e.execution_id ILIKE '%' || term || '%'
                  OR e.error_message ILIKE '%' || term || '%'
                  OR e.error_details ILIKE '%' || term || '%'
                  OR e.error_stack ILIKE '%' || term || '%'
                  OR CAST(e.error_http_code AS TEXT) ILIKE '%' || term || '%'
                  OR e.node_name ILIKE '%' || term || '%'
                  OR e.node_type ILIKE '%' || term || '%'
                  OR e.workflow_name ILIKE '%' || term || '%'
                  OR e.workflow_id ILIKE '%' || term || '%'
                  OR CAST(e.json AS TEXT) ILIKE '%' || term || '%'
                  OR CAST(e.created_ts AS TEXT) ILIKE '%' || term || '%'
                  OR CAST(e.updated_ts AS TEXT) ILIKE '%' || term || '%'
                )
              )
            )
          ORDER BY e.created_ts DESC, e.id DESC
        `,
        params,
      );

      return mapErrorRows(result.rows);
    },
    
    async listDistinctExternalReferences() {
      const result = await pool.query(
        `
          SELECT DISTINCT
            external_ref_type,
            external_ref_id
          FROM error_t
          WHERE external_ref_type IS NOT NULL
            AND external_ref_id IS NOT NULL
          ORDER BY external_ref_type, external_ref_id
        `,
      );

      return result.rows.map((row) => ({
        type: row.external_ref_type,
        id: row.external_ref_id,
      }));
    },
    async getError(errorId, profileId = null) {
      const hasProfileFilter = Number.isInteger(profileId) && profileId > 0;
      const result = await pool.query(
        `
          SELECT
            e.id,
            e.external_ref_id,
            e.external_ref_type,
            COALESCE(e.external_ref_name, profile_ref.name) AS external_ref_name,
            e.trace_id,
            e.execution_id,
            e.error_message,
            e.error_details,
            e.error_stack,
            e.error_http_code,
            e.node_name,
            e.node_type,
            e.workflow_name,
            e.workflow_id,
            e.json,
            e.created_ts,
            e.updated_ts
          FROM error_t AS e
          LEFT JOIN profiles_t AS profile_ref
            ON e.external_ref_type = 'profile'
            AND e.external_ref_id ~ '^[0-9]+$'
            AND profile_ref.id = e.external_ref_id::int
          WHERE e.id = $1
            AND (
              $2::text IS NULL
              OR (
                e.external_ref_type = 'profile'
                AND e.external_ref_id = $2::text
              )
            )
          LIMIT 1
        `,
        [errorId, hasProfileFilter ? String(profileId) : null],
      );

      return result.rowCount === 0 ? null : mapErrorRows(result.rows)[0];
    },
    async createError(errorInput) {
      const snapshot = JSON.stringify(errorInput.json ?? {});
      const result = await pool.query(
        `
          INSERT INTO error_t (
            external_ref_id,
            external_ref_type,
            external_ref_name,
            trace_id,
            execution_id,
            error_message,
            error_details,
            error_stack,
            error_http_code,
            node_name,
            node_type,
            workflow_name,
            workflow_id,
            json
          )
          VALUES ($1::text, 'profile', $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb)
          RETURNING
            id,
            external_ref_id,
            external_ref_type,
            external_ref_name,
            trace_id,
            execution_id,
            error_message,
            error_details,
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
          errorInput.externalRefName ?? null,
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
      await pool.query("DELETE FROM error_t WHERE external_ref_type = 'profile' AND external_ref_id = $1::text", [
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
            const channelResult = await client.query(
              `
                INSERT INTO notification_channels_t (
                  notification_profile_id,
                  position,
                  channel_type,
                  email_addresses,
                  json
                )
                VALUES ($1, $2, $3, $4, $5::jsonb)
                RETURNING id
              `,
              [
                profileId,
                index,
                "email",
                JSON.stringify(channel.emailAddresses),
                channelSnapshot,
              ],
            );

            const channelId = channelResult.rows[0].id;
            const channelSnapshotWithId = addIdToSnapshot(
              channelId,
              channelSnapshot,
            );
            await client.query(
              `
                UPDATE notification_channels_t
                SET json = $1::jsonb
                WHERE id = $2
              `,
              [channelSnapshotWithId, channelId],
            );
          } else if (channel.slackWebhookUrl !== undefined) {
            const channelResult = await client.query(
              `
                INSERT INTO notification_channels_t (
                  notification_profile_id,
                  position,
                  channel_type,
                  slack_webhook_url,
                  json
                )
                VALUES ($1, $2, $3, $4, $5::jsonb)
                RETURNING id
              `,
              [
                profileId,
                index,
                "slack",
                channel.slackWebhookUrl,
                channelSnapshot,
              ],
            );

            const channelId = channelResult.rows[0].id;
            const channelSnapshotWithId = addIdToSnapshot(
              channelId,
              channelSnapshot,
            );
            await client.query(
              `
                UPDATE notification_channels_t
                SET json = $1::jsonb
                WHERE id = $2
              `,
              [channelSnapshotWithId, channelId],
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
            const channelResult = await client.query(
              `
                INSERT INTO notification_channels_t (
                  notification_profile_id,
                  position,
                  channel_type,
                  email_addresses,
                  json
                )
                VALUES ($1, $2, $3, $4, $5::jsonb)
                RETURNING id
              `,
              [
                profileId,
                index,
                "email",
                JSON.stringify(channel.emailAddresses),
                channelSnapshot,
              ],
            );

            const channelId = channelResult.rows[0].id;
            const channelSnapshotWithId = addIdToSnapshot(
              channelId,
              channelSnapshot,
            );
            await client.query(
              `
                UPDATE notification_channels_t
                SET json = $1::jsonb
                WHERE id = $2
              `,
              [channelSnapshotWithId, channelId],
            );
          } else if (channel.slackWebhookUrl !== undefined) {
            const channelResult = await client.query(
              `
                INSERT INTO notification_channels_t (
                  notification_profile_id,
                  position,
                  channel_type,
                  slack_webhook_url,
                  json
                )
                VALUES ($1, $2, $3, $4, $5::jsonb)
                RETURNING id
              `,
              [
                profileId,
                index,
                "slack",
                channel.slackWebhookUrl,
                channelSnapshot,
              ],
            );

            const channelId = channelResult.rows[0].id;
            const channelSnapshotWithId = addIdToSnapshot(
              channelId,
              channelSnapshot,
            );
            await client.query(
              `
                UPDATE notification_channels_t
                SET json = $1::jsonb
                WHERE id = $2
              `,
              [channelSnapshotWithId, channelId],
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
    async createChat(chatMessageInput, _traceId) {
      let resolvedSourceId =
        Number.isInteger(chatMessageInput.sourceId) && chatMessageInput.sourceId > 0
          ? chatMessageInput.sourceId
          : null;

      if (resolvedSourceId === null && Number.isInteger(chatMessageInput.profileId)) {
        const sourceResult = await pool.query(
          `
            SELECT source_id
            FROM profiles_t
            WHERE id = $1
            LIMIT 1
          `,
          [chatMessageInput.profileId],
        );

        if (sourceResult.rowCount > 0) {
          const sourceId = sourceResult.rows[0]?.source_id;
          if (Number.isInteger(sourceId) && sourceId > 0) {
            resolvedSourceId = sourceId;
          }
        }
      }

      sessionProfileMap.set(
        chatMessageInput.sessionId,
        chatMessageInput.profileId,
      );

      const result = await pool.query(
        `
          INSERT INTO chats_t (
            session_id,
            source_id,
            message,
            role,
            quality
          )
          VALUES ($1, $2, $3, $4, $5)
          RETURNING
            id,
            session_id,
            source_id,
            message,
            role,
            quality,
            created_ts
        `,
        [
          chatMessageInput.sessionId,
          resolvedSourceId,
          chatMessageInput.message,
          "user",
          null,
        ],
      );

      if (result.rowCount === 0) {
        throw new Error("Failed to create chat message.");
      }

      const row = result.rows[0];
      return toLegacyChat(row, null, chatMessageInput.profileId);
    },
    async getChatsBySourceId(sourceId) {
      const result = await pool.query(
        `
          SELECT
            id,
            session_id,
            source_id,
            message,
            role,
            quality,
            created_ts
          FROM chats_t
          WHERE role = 'user' AND source_id = $1
          ORDER BY created_ts DESC
        `,
        [sourceId],
      );

      const legacyChats = [];
      for (const row of result.rows) {
        const assistantResult = await pool.query(
          `
            SELECT id, session_id, message, role, quality, created_ts
            FROM chats_t
            WHERE session_id = $1 AND role = 'assistant' AND created_ts >= $2
            ORDER BY created_ts DESC
            LIMIT 1
          `,
          [row.session_id, row.created_ts],
        );

        legacyChats.push(
          toLegacyChat(row, assistantResult.rows[0] ?? null, null),
        );
      }

      return legacyChats;
    },
    async listChatHistoryBySourceId(sourceId, options = {}) {
      const queryParts = [
        `
          SELECT
            id,
            session_id,
            source_id,
            message,
            role,
            quality,
            created_ts
          FROM chats_t
          WHERE source_id = $1
        `,
      ];
      const queryParams = [sourceId];
      let paramIndex = 2;

      const limitValue =
        typeof options.limit === "number" && Number.isInteger(options.limit)
          ? Math.max(1, options.limit)
          : 1000;

      if (
        typeof options.sessionIdQuery === "string" &&
        options.sessionIdQuery.trim().length > 0
      ) {
        queryParts.push(`AND session_id ILIKE $${paramIndex}`);
        queryParams.push(`%${options.sessionIdQuery.trim()}%`);
        paramIndex += 1;
      }

      if (
        typeof options.quality === "number" &&
        Number.isInteger(options.quality)
      ) {
        queryParts.push(
          `AND quality IS NOT NULL AND quality <= $${paramIndex}`,
        );
        queryParams.push(options.quality);
        paramIndex += 1;
      }

      if (options.role === "user" || options.role === "assistant") {
        queryParts.push(`AND role = $${paramIndex}`);
        queryParams.push(options.role);
        paramIndex += 1;
      }

      if (
        typeof options.sinceTs === "string" &&
        options.sinceTs.trim().length > 0
      ) {
        queryParts.push(`AND created_ts >= $${paramIndex}::timestamptz`);
        queryParams.push(options.sinceTs.trim());
        paramIndex += 1;
      }

      queryParts.push(`ORDER BY created_ts DESC LIMIT $${paramIndex}`);
      queryParams.push(limitValue);

      const result = await pool.query(queryParts.join("\n"), queryParams);

      return result.rows.map((row) => ({
        id: row.id,
        profileId: null,
        sessionId: row.session_id,
        message: row.message,
        role: row.role,
        quality: row.quality,
        createdTs: row.created_ts,
      }));
    },
    async getChat(chatId) {
      const result = await pool.query(
        `
          SELECT
            id,
            session_id,
            source_id,
            message,
            role,
            quality,
            created_ts
          FROM chats_t
          WHERE id = $1 AND role = 'user'
          LIMIT 1
        `,
        [chatId],
      );

      if (result.rowCount === 0) {
        return null;
      }

      const row = result.rows[0];
      const assistantResult = await pool.query(
        `
          SELECT id, session_id, source_id, message, role, quality, created_ts
          FROM chats_t
          WHERE session_id = $1 AND role = 'assistant' AND created_ts >= $2
          ORDER BY created_ts DESC
          LIMIT 1
        `,
        [row.session_id, row.created_ts],
      );

      return toLegacyChat(
        row,
        assistantResult.rows[0] ?? null,
        null,
      );
    },
    async updateChatResponse(chatId, agentResponse, _n8nExecutionId, status) {
      const userChatResult = await pool.query(
        `
          SELECT id, session_id, source_id, message, role, quality, created_ts
          FROM chats_t
          WHERE id = $1 AND role = 'user'
          LIMIT 1
        `,
        [chatId],
      );

      if (userChatResult.rowCount === 0) {
        return null;
      }

      const userChat = userChatResult.rows[0];
      const assistantInsertResult = await pool.query(
        `
          INSERT INTO chats_t (session_id, source_id, message, role, quality)
          VALUES ($1, $2, $3, $4, $5)
          RETURNING id, session_id, source_id, message, role, quality, created_ts
        `,
        [
          userChat.session_id,
          userChat.source_id ?? null,
          agentResponse,
          "assistant",
          status === "failed" ? 0 : status === "completed" ? 1 : null,
        ],
      );

      const assistantRow = assistantInsertResult.rows[0] ?? null;

      return toLegacyChat(
        userChat,
        assistantRow,
        null,
      );
    },
    async close() {
      await pool.end();
    },
  };
}
