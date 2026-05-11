export function createMemoryProfilesRepository() {
  let nextProfileId = 1;
  let nextNotificationProfileId = 1;
  let nextNewsId = 1;
  let nextErrorId = 1;
  const profiles = [];
  const notificationProfiles = [];
  const newsItems = [];
  const errorItems = [];

  return {
    async initialize() {
      // Seed with fixed test profile: AI LLM
      const aiLlmProfile = {
        id: nextProfileId++,
        name: "AI LLM",
        description: "A profile for testing with LLMs",
        useCustomSources: true,
        tags: ["llm", "anthropic", "claude"],
        roles: ["Solution Architect", "Software Engineer"],
        urls: [
          {
            id: 1,
            url: "https://www.technologyreview.com/topic/artificial-intelligence/",
            description: "MIT Technology Review AI Coverage",
          },
          {
            id: 2,
            url: "https://www.unite.ai/",
            description: "Unite AI News",
          },
          {
            id: 3,
            url: "https://aiuniverseexplorer.com/ai-news-aggregator/",
            description: "AI Universe Explorer",
          },
          {
            id: 4,
            url: "https://invalid/",
            description: "Invalid URL for validation testing",
          },
        ],
        rssFeeds: [
          {
            id: 1,
            feedUrl: "https://planet-ai.net/rss.xml",
            title: "Planet AI",
            refreshCadence: "Every 30 minutes",
            format: "RSS 2.0",
            category: "LLM Updates",
          },
          {
            id: 2,
            feedUrl: "https://invalid/rss.xml",
            title: "Invalid RSS",
            refreshCadence: "Every 30 minutes",
            format: "RSS 2.0",
            category: "Invalid Feed Testing",
          },
        ],
        notificationChannelIds: [1],
      };
      profiles.push(aiLlmProfile);

      // Seed with fixed test notification channel
      const testChannel = {
        id: nextNotificationProfileId++,
        name: "Test Channel",
        description: "Test notification channel for development",
        channels: [
          {
            id: 1,
            emailAddresses: ["robert.bernhard71@gmail.com"],
          },
        ],
      };
      notificationProfiles.push(testChannel);

      // Seed with sample LLM-related news items
      const sampleNewsData = [
        {
          profileId: aiLlmProfile.id,
          title: "Claude 4 demonstrates advanced reasoning in benchmark tests",
          summary:
            "Anthropic's latest Claude model shows significant improvements in complex reasoning, coding, and mathematical problem-solving tasks.",
          origin: "MIT Technology Review",
          link: "https://www.technologyreview.com/news/claude-4-reasoning",
          timestamp: new Date(Date.now() - 2 * 60000).toISOString(),
          favorite: true,
        },
        {
          profileId: aiLlmProfile.id,
          title: "Open-source LLM fine-tuning framework gains adoption",
          summary:
            "New tools make it easier for enterprises to customize open-source language models for domain-specific applications.",
          origin: "Unite AI",
          link: "https://www.unite.ai/open-source-llm-fine-tuning",
          timestamp: new Date(Date.now() - 45 * 60000).toISOString(),
          favorite: false,
        },
        {
          profileId: aiLlmProfile.id,
          title: "LLM inference optimization cuts costs by 60%",
          summary:
            "New quantization and caching techniques reduce inference latency and operational costs for large language model deployments.",
          origin: "AI Universe Explorer",
          link: "https://aiuniverseexplorer.com/llm-inference-optimization",
          timestamp: new Date(Date.now() - 2 * 60 * 60000).toISOString(),
          favorite: false,
        },
        {
          profileId: aiLlmProfile.id,
          title: "Multi-modal LLMs show promise for medical diagnostics",
          summary:
            "Recent research demonstrates that language models trained on both text and images can accurately analyze medical imaging data.",
          origin: "Planet AI",
          link: "https://planet-ai.net/multimodal-medical-llm",
          timestamp: new Date(Date.now() - 4 * 60 * 60000).toISOString(),
          favorite: true,
        },
        {
          profileId: aiLlmProfile.id,
          title: "Prompt engineering best practices for production systems",
          summary:
            "Comprehensive guide for optimizing LLM prompts, handling edge cases, and maintaining consistency in enterprise applications.",
          origin: "MIT Technology Review",
          link: "https://www.technologyreview.com/guides/prompt-engineering",
          timestamp: new Date(Date.now() - 6 * 60 * 60000).toISOString(),
          favorite: false,
        },
        {
          profileId: aiLlmProfile.id,
          title: "Context window expansion enables longer document analysis",
          summary:
            "Latest LLM models support extended context windows, allowing analysis of full documents, books, and code repositories.",
          origin: "Unite AI",
          link: "https://www.unite.ai/context-window-expansion",
          timestamp: new Date(Date.now() - 8 * 60 * 60000).toISOString(),
          favorite: true,
        },
      ];

      // Add sample news items
      for (const newsData of sampleNewsData) {
        const created = {
          ...newsData,
          id: nextNewsId++,
        };
        newsItems.unshift(created);
      }

      return undefined;
    },
    async listProfiles() {
      return structuredClone(profiles);
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

      for (let index = newsItems.length - 1; index >= 0; index -= 1) {
        if (newsItems[index].profileId === profileId) {
          newsItems.splice(index, 1);
        }
      }

      for (let index = errorItems.length - 1; index >= 0; index -= 1) {
        if (errorItems[index].profileId === profileId) {
          errorItems.splice(index, 1);
        }
      }

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
      const itemIndex = newsItems.findIndex(
        (item) => item.id === newsId && item.profileId === profileId,
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
    async close() {
      return undefined;
    },
  };
}
