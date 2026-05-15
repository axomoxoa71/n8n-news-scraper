export type ProfileUrl = {
  id: number;
  url: string;
  description: string;
};

export type RssFeed = {
  id: number;
  feedUrl: string;
  description?: string;
};

export type ProfileTag = {
  id: number;
  name: string;
};

export type SourceInput = {
  name: string;
  description: string;
  urls: Array<Omit<ProfileUrl, "id">>;
  rssFeeds: Array<Omit<RssFeed, "id">>;
};

export type Source = SourceInput & {
  id: number;
};

export type EmailChannel = {
  id: number;
  emailAddresses: string[];
};

export type SlackChannel = {
  id: number;
  slackWebhookUrl: string;
};

export type ChannelConfig = EmailChannel | SlackChannel;

export type NotificationChannel = {
  id: number;
  name: string;
  description: string;
  channels: ChannelConfig[];
};

export type NotificationChannelInput = {
  name: string;
  description: string;
  channels: Array<Omit<ChannelConfig, "id">>;
};

export type ProfileInput = {
  name: string;
  description: string;
  systemPrompt: string;
  sourceId: number;
  tags: string[];
  roles?: string[];
  notificationProfileId?: number | null;
  notificationChannelIds?: number[];
};

export type SavedProfile = ProfileInput & {
  id: number;
};

export type SavedNewsItem = {
  id: number;
  newsId: string;
  sourceId: number;
  title: string;
  summary: string;
  origin?: string;
  link: string;
  timestamp: string;
  favorite: boolean;
};

export type ErrorInput = {
  profileId: number;
  traceId: string;
  executionId: string;
  errorMessage: string;
  errorDescription: string | null;
  errorStack: string | null;
  errorHttpCode: number | null;
  nodeName: string;
  nodeType: string;
  workflowName: string;
  workflowId: string;
  json: Record<string, unknown> | null;
};

export type SavedErrorItem = ErrorInput & {
  id: number;
  createdTs: string;
  updatedTs: string;
};

const defaultRssFeed: RssFeed = {
  id: 1,
  feedUrl: "",
  description: "",
};

export function createEmptyUrl(id: number): ProfileUrl {
  return {
    id,
    url: "",
    description: "",
  };
}

export function createEmptyRssFeed(id: number): RssFeed {
  return {
    ...defaultRssFeed,
    id,
  };
}

export function createEmptyEmailChannel(id: number): EmailChannel {
  return {
    id,
    emailAddresses: [],
  };
}

export function createEmptySlackChannel(id: number): SlackChannel {
  return {
    id,
    slackWebhookUrl: "",
  };
}
