import { createHash, randomUUID } from "node:crypto";

export function createMemoryProfilesRepository() {
  let nextProfileId = 1;
  let nextSourceId = 1;
  let nextNotificationProfileId = 1;
  let nextNewsId = 1;
  let nextErrorId = 1;
  let nextChatId = 1;
  const sessionProfileMap = new Map();
  const profiles = [];
  const sources = [];
  const notificationProfiles = [];
  const newsItems = [];
  const errorItems = [];
  const chats = [];

  function createNewsIdConflictError() {
    const error = new Error("newsId must be unique.");
    error.code = "23505";
    error.constraint = "news_t_news_id_uk";
    return error;
  }

  function createNewsHash(link, title) {
    return createHash("sha256").update(`${link}${title}`, "utf8").digest("hex");
  }

  function toLegacyChat(userChat, assistantChat, profileId = null) {
    const status =
      assistantChat?.quality === 0
        ? "failed"
        : assistantChat
          ? "completed"
          : "pending";

    return {
      id: userChat.id,
      profileId,
      sessionId: userChat.sessionId,
      message: userChat.message,
      agentResponse: assistantChat?.message ?? null,
      n8nExecutionId: null,
      traceId: "",
      status,
      createdTs: userChat.createdTs,
      updatedTs: assistantChat?.updatedTs ?? userChat.updatedTs,
    };
  }

  return {
    async initialize() {
      const testChannel = {
        id: nextNotificationProfileId++,
        name: "AI Demo",
        description: "AI Demo notification channel for development.",
        channels: [
          {
            id: 1,
            emailAddresses: ["robert.bernhard71@gmail.com"],
          },
        ],
      };
      notificationProfiles.push(testChannel);

      const seededProfiles = [
        {
          id: nextProfileId++,
          name: "AI Demo",
          description: "A profile AI news demonstration",
          systemPrompt:
            "You are an AI news assistant who focuses on news related to the tags and for the roles provided in this profile. You provide concise and informative summaries of the latest developments in the AI field, tailored to the interests of the users linked to this profile.",
          sourceId: 1,
          tags: [
            "llm",
            "openai",
            "claude",
            "anthropic",
            "meta",
            "agentic AI",
            "MCP",
            "RAG",
          ],
          roles: ["Solution Architect", "Software Engineer", "Product Manager"],
          notificationChannelIds: [testChannel.id],
        },
        {
          id: nextProfileId++,
          name: "Error Test Profile",
          description: "Profile used for deterministic error testing",
          systemPrompt: "Used for error handling validation.",
          sourceId: 2,
          tags: ["error", "trace", "debug"],
          roles: ["QA Engineer", "Support Engineer", "Developer"],
          notificationChannelIds: [testChannel.id],
        },
        {
          id: nextProfileId++,
          name: "Agent Ecosystem",
          description: "Tracks agent platforms, orchestration, and tooling.",
          systemPrompt: "Focus on agent ecosystems and orchestration.",
          sourceId: 3,
          tags: ["agent", "tooling", "workflow"],
          roles: ["Architect", "Engineer", "Researcher"],
          notificationChannelIds: [testChannel.id],
        },
        {
          id: nextProfileId++,
          name: "Model Releases",
          description: "Tracks model launches and benchmark updates.",
          systemPrompt: "Focus on model releases and benchmarks.",
          sourceId: 4,
          tags: ["model", "release", "benchmark"],
          roles: ["Analyst", "Engineer", "Tech Lead"],
          notificationChannelIds: [testChannel.id],
        },
      ];

      const seededSources = [
        {
          id: nextSourceId++,
          name: "AI Demo",
          description: "A source for AI news demonstration.",
          urls: [
            {
              id: 1,
              url: "https://ai.meta.com/blog/",
              description: "Meta AI Blog",
            },
            {
              id: 2,
              url: "https://openai.com/news/",
              description: "OpenAI News",
            },
            {
              id: 3,
              url: "https://www.anthropic.com/news",
              description: "Anthropic News",
            },
          ],
          rssFeeds: [
            {
              id: 1,
              feedUrl: "https://openai.com/news/rss.xml",
              description: "OpenAI News",
            },
            {
              id: 2,
              feedUrl: "https://huggingface.co/blog/feed.xml",
              description: "Hugging Face Blog",
            },
            {
              id: 3,
              feedUrl:
                "https://raw.githubusercontent.com/taobojlen/anthropic-rss-feed/main/anthropic_news_rss.xml",
              description: "Anthropic News RSS",
            },
          ],
        },
        {
          id: nextSourceId++,
          name: "Error Test Source",
          description: "Sources for deterministic error testing",
          urls: [
            {
              id: 1,
              url: "https://example.com/errors/one",
              description: "Error source one",
            },
            {
              id: 2,
              url: "https://example.com/errors/two",
              description: "Error source two",
            },
            {
              id: 3,
              url: "https://example.com/errors/three",
              description: "Error source three",
            },
          ],
          rssFeeds: [
            {
              id: 1,
              feedUrl: "https://example.com/errors/feed-1.xml",
              description: "Error diagnostics feed 1",
            },
            {
              id: 2,
              feedUrl: "https://example.com/errors/feed-2.xml",
              description: "Error diagnostics feed 2",
            },
            {
              id: 3,
              feedUrl: "https://example.com/errors/feed-3.xml",
              description: "Error diagnostics feed 3",
            },
          ],
        },
        {
          id: nextSourceId++,
          name: "Agent Ecosystem Source",
          description: "Agent platform and tooling sources",
          urls: [
            {
              id: 1,
              url: "https://example.com/agents/one",
              description: "Agent ecosystem source one",
            },
            {
              id: 2,
              url: "https://example.com/agents/two",
              description: "Agent ecosystem source two",
            },
            {
              id: 3,
              url: "https://example.com/agents/three",
              description: "Agent ecosystem source three",
            },
          ],
          rssFeeds: [
            {
              id: 1,
              feedUrl: "https://example.com/agents/feed-1.xml",
              description: "Agent ecosystem feed 1",
            },
            {
              id: 2,
              feedUrl: "https://example.com/agents/feed-2.xml",
              description: "Agent ecosystem feed 2",
            },
            {
              id: 3,
              feedUrl: "https://example.com/agents/feed-3.xml",
              description: "Agent ecosystem feed 3",
            },
          ],
        },
        {
          id: nextSourceId++,
          name: "Model Releases Source",
          description: "Model release news sources",
          urls: [
            {
              id: 1,
              url: "https://example.com/models/one",
              description: "Model release source one",
            },
            {
              id: 2,
              url: "https://example.com/models/two",
              description: "Model release source two",
            },
            {
              id: 3,
              url: "https://example.com/models/three",
              description: "Model release source three",
            },
          ],
          rssFeeds: [
            {
              id: 1,
              feedUrl: "https://example.com/models/feed-1.xml",
              description: "Model releases feed 1",
            },
            {
              id: 2,
              feedUrl: "https://example.com/models/feed-2.xml",
              description: "Model releases feed 2",
            },
            {
              id: 3,
              feedUrl: "https://example.com/models/feed-3.xml",
              description: "Model releases feed 3",
            },
          ],
        },
      ];

      profiles.push(...seededProfiles);
      sources.push(...seededSources);

      const seededNewsItems = [
        {
          profileName: "AI Demo",
          items: [
            {
              title:
                "Claude 4 demonstrates advanced reasoning in benchmark tests",
              summary:
                "Anthropic's latest Claude model shows significant improvements in complex reasoning, coding, and mathematical problem-solving tasks.",
              origin: "MIT Technology Review",
              link: "https://www.technologyreview.com/news/claude-4-reasoning",
              favorite: true,
            },
            {
              title: "Open-source LLM fine-tuning framework gains adoption",
              summary:
                "New tools make it easier for enterprises to customize open-source language models for domain-specific applications.",
              origin: "Unite AI",
              link: "https://www.unite.ai/open-source-llm-fine-tuning",
              favorite: false,
            },
            {
              title:
                "Context window expansion enables longer document analysis",
              summary:
                "Latest LLM models support extended context windows for large research and code corpora.",
              origin: "AI Universe Explorer",
              link: "https://aiuniverseexplorer.com/context-window-expansion",
              favorite: false,
            },
          ],
        },
        {
          profileName: "Error Test Profile",
          items: [
            {
              title: "Retry strategy regression detected",
              summary:
                "A seeded error scenario highlights regression handling for downstream webhook retries.",
              origin: "QA Feed",
              link: "https://example.com/errors/news-1",
              favorite: false,
            },
            {
              title: "Trace correlation dashboard updated",
              summary:
                "Support tooling now links seeded failures to trace identifiers for UI verification.",
              origin: "Support Bulletin",
              link: "https://example.com/errors/news-2",
              favorite: false,
            },
            {
              title: "Synthetic failure pack refreshed",
              summary:
                "The deterministic failure pack has been refreshed for automated validation.",
              origin: "Test Ops",
              link: "https://example.com/errors/news-3",
              favorite: true,
            },
          ],
        },
        {
          profileName: "Agent Ecosystem",
          items: [
            {
              title: "Open-source agent benchmark published",
              summary:
                "A new benchmark compares autonomous coding and research agents across common tasks.",
              origin: "Agent Weekly",
              link: "https://example.com/news/agent-benchmark",
              favorite: false,
            },
            {
              title: "Workflow engines add multi-agent orchestration",
              summary:
                "Teams can now coordinate planner, executor, and reviewer agents in one pipeline.",
              origin: "Applied Automation",
              link: "https://example.com/news/agent-workflows",
              favorite: true,
            },
            {
              title: "Tool-calling reliability improves in agent stacks",
              summary:
                "Vendors report more stable tool-routing and less conversation drift.",
              origin: "Systems Journal",
              link: "https://example.com/news/tool-calling",
              favorite: false,
            },
          ],
        },
        {
          profileName: "Model Releases",
          items: [
            {
              title: "Model release improves long-context reasoning",
              summary: "Vendors report fewer retrieval failures in production.",
              origin: "Applied AI Journal",
              link: "https://example.com/news/long-context",
              favorite: true,
            },
            {
              title: "New benchmark suite focuses on agentic evaluation",
              summary:
                "Release teams are using broader eval sets to compare model readiness.",
              origin: "Benchmark Daily",
              link: "https://example.com/news/benchmark-suite",
              favorite: false,
            },
            {
              title: "Frontier model update reduces inference cost",
              summary:
                "New deployment profiles lower serving cost while preserving quality.",
              origin: "Model Ops Weekly",
              link: "https://example.com/news/inference-cost",
              favorite: false,
            },
          ],
        },
      ];

      for (const collection of seededNewsItems) {
        const profile = seededProfiles.find(
          (entry) => entry.name === collection.profileName,
        );

        if (!profile) {
          continue;
        }

        collection.items.forEach((item, index) => {
          newsItems.unshift({
            id: nextNewsId++,
            newsId: createNewsHash(item.link, item.title),
            sourceId: profile.sourceId,
            title: item.title,
            summary: item.summary,
            origin: item.origin,
            link: item.link,
            timestamp: new Date(
              Date.now() - (index + 1) * 60_000,
            ).toISOString(),
            favorite: item.favorite,
          });
        });
      }

      const errorTestProfile = seededProfiles.find(
        (profile) => profile.name === "Error Test Profile",
      );

      if (errorTestProfile) {
        [
          {
            traceId: "e4e4f6dd2df74f34b7746e72e5f67011",
            executionId: "exec-error-11",
            errorMessage: "Seeded error 1",
          },
          {
            traceId: "e4e4f6dd2df74f34b7746e72e5f67012",
            executionId: "exec-error-12",
            errorMessage: "Seeded error 2",
          },
          {
            traceId: "e4e4f6dd2df74f34b7746e72e5f67013",
            executionId: "exec-error-13",
            errorMessage: "Seeded error 3",
          },
        ].forEach((item, index) => {
          const timestamp = new Date(
            Date.now() - (index + 1) * 90_000,
          ).toISOString();

          errorItems.unshift({
            id: nextErrorId++,
            profileId: errorTestProfile.id,
            traceId: item.traceId,
            executionId: item.executionId,
            errorMessage: item.errorMessage,
            errorDescription: "Deterministic seeded error for UI validation.",
            errorStack: `Error: ${item.errorMessage}`,
            errorHttpCode: 500,
            nodeName: `Error Node ${index + 1}`,
            nodeType: "code",
            workflowName: "Seeded Error Workflow",
            workflowId: `workflow-error-${index + 1}`,
            json: { seeded: true, ordinal: index + 1 },
            createdTs: timestamp,
            updatedTs: timestamp,
          });
        });
      }

      return undefined;
    },
    async listProfiles() {
      const profilesWithSources = profiles.map((profile) => {
        const source = sources.find((entry) => entry.id === profile.sourceId);
        return {
          ...profile,
          useCustomSources: true,
          urls: source?.urls ?? [],
          rssFeeds: source?.rssFeeds ?? [],
        };
      });

      return structuredClone(profilesWithSources);
    },
    async listSources() {
      return structuredClone(sources);
    },
    async createSource(sourceInput) {
      const createdSource = {
        ...structuredClone(sourceInput),
        id: nextSourceId++,
      };

      sources.unshift(createdSource);
      return structuredClone(createdSource);
    },
    async updateSource(sourceId, sourceInput) {
      const sourceIndex = sources.findIndex((source) => source.id === sourceId);

      if (sourceIndex === -1) {
        return null;
      }

      const updatedSource = {
        ...structuredClone(sourceInput),
        id: sourceId,
      };

      sources[sourceIndex] = updatedSource;
      return structuredClone(updatedSource);
    },
    async deleteSource(sourceId) {
      const sourceIndex = sources.findIndex((source) => source.id === sourceId);

      if (sourceIndex === -1) {
        return false;
      }

      if (profiles.some((profile) => profile.sourceId === sourceId)) {
        return false;
      }

      sources.splice(sourceIndex, 1);

      for (let index = newsItems.length - 1; index >= 0; index -= 1) {
        if (newsItems[index].sourceId === sourceId) {
          newsItems.splice(index, 1);
        }
      }

      return true;
    },
    async createProfile(profileInput) {
      const createdProfile = {
        ...structuredClone(profileInput),
        id: nextProfileId++,
      };

      profiles.unshift(createdProfile);
      return structuredClone(createdProfile);
    },
    async updateProfile(profileId, profileInput) {
      const profileIndex = profiles.findIndex(
        (profile) => profile.id === profileId,
      );

      if (profileIndex === -1) {
        return null;
      }

      const updatedProfile = {
        ...structuredClone(profileInput),
        id: profileId,
      };

      profiles[profileIndex] = updatedProfile;
      return structuredClone(updatedProfile);
    },
    async deleteProfile(profileId) {
      const profileIndex = profiles.findIndex(
        (profile) => profile.id === profileId,
      );

      if (profileIndex === -1) {
        return false;
      }

      profiles.splice(profileIndex, 1);

      for (let index = errorItems.length - 1; index >= 0; index -= 1) {
        if (errorItems[index].profileId === profileId) {
          errorItems.splice(index, 1);
        }
      }

      return true;
    },
    async listNews(sourceId) {
      const matching = newsItems
        .filter((item) => item.sourceId === sourceId)
        .sort(
          (left, right) =>
            new Date(right.timestamp).getTime() -
            new Date(left.timestamp).getTime(),
        );

      return structuredClone(matching);
    },
    async updateNewsFavorite(sourceId, newsId, favorite) {
      const itemIndex = newsItems.findIndex(
        (item) => item.id === newsId && item.sourceId === sourceId,
      );

      if (itemIndex === -1) {
        return null;
      }

      newsItems[itemIndex] = {
        ...newsItems[itemIndex],
        favorite,
      };

      return structuredClone(newsItems[itemIndex]);
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
            item.executionId,
            item.errorMessage,
            item.errorDescription ?? "",
            item.errorStack ?? "",
            item.errorHttpCode !== null ? String(item.errorHttpCode) : "",
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
        (item) => item.profileId === profileId && item.id === errorId,
      );

      return entry ? structuredClone(entry) : null;
    },
    async createError(errorInput) {
      const now = new Date().toISOString();
      const createdError = {
        ...structuredClone(errorInput),
        id: nextErrorId++,
        createdTs: now,
        updatedTs: now,
      };

      errorItems.unshift(createdError);
      return structuredClone(createdError);
    },
    async clearErrors(profileId) {
      for (let index = errorItems.length - 1; index >= 0; index -= 1) {
        if (errorItems[index].profileId === profileId) {
          errorItems.splice(index, 1);
        }
      }
    },
    // Helper for tests and local development flows that want in-memory news.
    async createNewsItem(newsInput) {
      const newsId =
        newsInput.newsId ??
        (typeof newsInput.link === "string" &&
        typeof newsInput.title === "string"
          ? createNewsHash(newsInput.link, newsInput.title)
          : randomUUID());

      if (newsItems.some((item) => item.newsId === newsId)) {
        throw createNewsIdConflictError();
      }

      const created = {
        ...structuredClone(newsInput),
        id: nextNewsId++,
        newsId,
      };

      newsItems.unshift(created);
      return structuredClone(created);
    },
    async listNotificationProfiles() {
      return structuredClone(notificationProfiles);
    },
    async createNotificationProfile(profileInput) {
      const createdProfile = {
        ...structuredClone(profileInput),
        id: nextNotificationProfileId++,
      };

      notificationProfiles.unshift(createdProfile);
      return structuredClone(createdProfile);
    },
    async updateNotificationProfile(profileId, profileInput) {
      const profileIndex = notificationProfiles.findIndex(
        (profile) => profile.id === profileId,
      );

      if (profileIndex === -1) {
        return null;
      }

      const updatedProfile = {
        ...structuredClone(profileInput),
        id: profileId,
      };

      notificationProfiles[profileIndex] = updatedProfile;
      return structuredClone(updatedProfile);
    },
    async deleteNotificationProfile(profileId) {
      const profileIndex = notificationProfiles.findIndex(
        (profile) => profile.id === profileId,
      );

      if (profileIndex === -1) {
        return false;
      }

      notificationProfiles.splice(profileIndex, 1);
      return true;
    },
    async createChat(chatMessageInput, _traceId) {
      const now = new Date().toISOString();
      sessionProfileMap.set(
        chatMessageInput.sessionId,
        chatMessageInput.profileId,
      );

      const chat = {
        id: nextChatId++,
        sessionId: chatMessageInput.sessionId,
        message: chatMessageInput.message,
        role: "user",
        quality: null,
        createdTs: now,
        updatedTs: now,
      };

      chats.unshift(chat);
      return structuredClone(
        toLegacyChat(chat, null, chatMessageInput.profileId),
      );
    },
    async getChatsByProfileId(profileId) {
      const chatsForProfile = chats
        .filter(
          (chat) =>
            chat.role === "user" &&
            sessionProfileMap.get(chat.sessionId) === profileId,
        )
        .map((userChat) => {
          const assistantChat = chats.find(
            (candidate) =>
              candidate.role === "assistant" &&
              candidate.sessionId === userChat.sessionId &&
              new Date(candidate.createdTs).getTime() >=
                new Date(userChat.createdTs).getTime(),
          );

          return toLegacyChat(userChat, assistantChat ?? null, profileId);
        });

      return structuredClone(chatsForProfile);
    },
    async listChatHistoryByProfileId(profileId, options = {}) {
      const normalizedSessionIdQuery =
        typeof options.sessionIdQuery === "string"
          ? options.sessionIdQuery.trim().toLocaleLowerCase()
          : "";
      const requestedQuality =
        typeof options.quality === "number" && Number.isInteger(options.quality)
          ? options.quality
          : null;
      const requestedRole =
        options.role === "user" || options.role === "assistant"
          ? options.role
          : "all";
      const requestedSinceTs =
        typeof options.sinceTs === "string" && options.sinceTs.trim().length > 0
          ? Date.parse(options.sinceTs.trim())
          : null;
      const effectiveLimit =
        typeof options.limit === "number" && Number.isInteger(options.limit)
          ? Math.max(1, options.limit)
          : 1000;

      const filtered = chats
        .filter((chat) => sessionProfileMap.get(chat.sessionId) === profileId)
        .filter((chat) => {
          if (!normalizedSessionIdQuery) {
            return true;
          }

          return chat.sessionId
            .toLocaleLowerCase()
            .includes(normalizedSessionIdQuery);
        })
        .filter((chat) => {
          if (requestedQuality === null) {
            return true;
          }

          return (
            typeof chat.quality === "number" && chat.quality <= requestedQuality
          );
        })
        .filter((chat) => {
          if (requestedRole === "all") {
            return true;
          }

          return chat.role === requestedRole;
        })
        .filter((chat) => {
          if (requestedSinceTs === null || Number.isNaN(requestedSinceTs)) {
            return true;
          }

          return new Date(chat.createdTs).getTime() >= requestedSinceTs;
        })
        .sort(
          (a, b) =>
            new Date(b.createdTs).getTime() - new Date(a.createdTs).getTime(),
        )
        .slice(0, effectiveLimit)
        .map((chat) => ({
          id: chat.id,
          profileId,
          sessionId: chat.sessionId,
          message: chat.message,
          role: chat.role,
          quality: chat.quality,
          createdTs: chat.createdTs,
        }));

      return structuredClone(filtered);
    },
    async getChat(chatId) {
      const userChat = chats.find(
        (chat) => chat.id === chatId && chat.role === "user",
      );

      if (!userChat) {
        return null;
      }

      const assistantChat = chats.find(
        (candidate) =>
          candidate.role === "assistant" &&
          candidate.sessionId === userChat.sessionId &&
          new Date(candidate.createdTs).getTime() >=
            new Date(userChat.createdTs).getTime(),
      );

      return structuredClone(
        toLegacyChat(
          userChat,
          assistantChat ?? null,
          sessionProfileMap.get(userChat.sessionId) ?? null,
        ),
      );
    },
    async updateChatResponse(chatId, agentResponse, _n8nExecutionId, status) {
      const userChat = chats.find(
        (chat) => chat.id === chatId && chat.role === "user",
      );

      if (!userChat) {
        return null;
      }

      const now = new Date().toISOString();
      const assistantChat = {
        id: nextChatId++,
        sessionId: userChat.sessionId,
        message: agentResponse,
        role: "assistant",
        quality: status === "failed" ? 0 : status === "completed" ? 1 : null,
        createdTs: now,
        updatedTs: now,
      };

      chats.unshift(assistantChat);

      return structuredClone(
        toLegacyChat(
          userChat,
          assistantChat,
          sessionProfileMap.get(userChat.sessionId) ?? null,
        ),
      );
    },
    async close() {
      return undefined;
    },
  };
}
