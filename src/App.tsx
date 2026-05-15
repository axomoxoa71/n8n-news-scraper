import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import {
  Link,
  Navigate,
  Route,
  Routes,
  useNavigate,
  useLocation,
} from "react-router-dom";
import {
  ApiRequestError,
  createProfile,
  deleteProfile as deleteProfileRequest,
  type ApiEnvironment,
  generateActionTraceId,
  setApiEnvironment,
  listNews,
  listProfiles,
  listSources,
  createSource,
  updateSource,
  deleteSource as deleteSourceRequest,
  updateProfile,
  updateNewsFavorite,
  listNotificationChannels,
  createNotificationChannel,
  updateNotificationChannel,
  triggerScrapeWorkflow,
  listErrors,
  deleteNotificationChannel as deleteNotificationChannelRequest,
} from "./api/profiles";
import {
  dispatchChatbotMessage,
  listChatHistoryMessages,
  listChatQuickReplies,
  type ChatHistoryRoleFilter,
  type ChatHistoryTimePeriod,
  setApiEnvironment as setChatbotApiEnvironment,
} from "./api/chatbot";
import type { ChatHistoryMessage, ChatQuickReply } from "./chatbot";
import { EnglishValidatedForm } from "./components/EnglishValidatedForm";
import {
  createEmptyRssFeed,
  createEmptyUrl,
  createEmptyEmailChannel,
  createEmptySlackChannel,
  type ProfileTag,
  type ProfileInput,
  type ProfileUrl,
  type RssFeed,
  type SavedProfile,
  type Source,
  type SourceInput,
  type SavedNewsItem,
  type SavedErrorItem,
  type NotificationChannel,
  type NotificationChannelInput,
  type EmailChannel,
  type SlackChannel,
} from "./profiles";
import aiNewsLogo from "./resources/logo.png";
import "./App.css";

type NotificationChannelMultiSelectProps = {
  channels: NotificationChannel[];
  selectedIds: number[];
  onChange: (ids: number[]) => void;
};

const CHATBOT_VOICE_LANGUAGE_OPTIONS = [
  { value: "en-US", label: "English" },
  { value: "de-DE", label: "German" },
] as const;

const CHAT_HISTORY_TIME_PERIOD_OPTIONS: {
  value: ChatHistoryTimePeriod;
  label: string;
}[] = [
  { value: "last_hour", label: "Last Hour" },
  { value: "last_day", label: "Last Day" },
  { value: "last_week", label: "Last Week" },
  { value: "last_month", label: "Last Month" },
  { value: "all", label: "All" },
];

const CHAT_HISTORY_ROLE_OPTIONS: {
  value: ChatHistoryRoleFilter;
  label: string;
}[] = [
  { value: "all", label: "All" },
  { value: "user", label: "User" },
  { value: "assistant", label: "Assistant" },
];

type ChatbotVoiceLanguage =
  (typeof CHATBOT_VOICE_LANGUAGE_OPTIONS)[number]["value"];

function resolveChatbotVoiceLanguage(
  rawLanguage: string | null | undefined,
): ChatbotVoiceLanguage {
  const normalizedLanguage =
    typeof rawLanguage === "string"
      ? rawLanguage.trim().toLocaleLowerCase()
      : "";

  if (normalizedLanguage.startsWith("de")) {
    return "de-DE";
  }

  return "en-US";
}

function NotificationChannelMultiSelect({
  channels,
  selectedIds,
  onChange,
}: NotificationChannelMultiSelectProps) {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const controlRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [listPosition, setListPosition] = useState({
    left: 0,
    top: 0,
    width: 220,
  });

  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase();
    if (!q) return channels;
    return channels.filter((c) => c.name.toLocaleLowerCase().includes(q));
  }, [channels, query]);

  // Calculate dropdown position when opening
  useEffect(() => {
    if (isOpen && controlRef.current) {
      const rect = controlRef.current.getBoundingClientRect();
      setListPosition({
        left: rect.left,
        top: rect.bottom + 4,
        width: rect.width,
      });
    }
  }, [isOpen]);

  // Close when clicking outside
  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
        setQuery("");
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, []);

  function openDropdown() {
    setQuery("");
    setActiveIndex(-1);
    setIsOpen(true);
    setTimeout(() => inputRef.current?.select(), 0);
  }

  function toggleChannel(channelId: number) {
    const isSelected = selectedIds.includes(channelId);
    const nextIds = isSelected
      ? selectedIds.filter((id) => id !== channelId)
      : [...selectedIds, channelId];
    onChange(nextIds);
  }

  function handleInputKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      const next = Math.min(activeIndex + 1, filtered.length - 1);
      setActiveIndex(next);
      listRef.current?.children[next]?.scrollIntoView({ block: "nearest" });
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      const prev = Math.max(activeIndex - 1, 0);
      setActiveIndex(prev);
      listRef.current?.children[prev]?.scrollIntoView({ block: "nearest" });
    } else if (event.key === "Enter") {
      event.preventDefault();
      const target = activeIndex >= 0 ? filtered[activeIndex] : null;
      if (target) {
        toggleChannel(target.id);
      }
    } else if (event.key === "Escape") {
      setIsOpen(false);
      setQuery("");
    }
  }

  const selectedCount = selectedIds.length;
  const selectedChannels = selectedIds
    .map((id) => channels.find((channel) => channel.id === id))
    .filter((channel): channel is NotificationChannel => Boolean(channel));

  const maxVisibleNames = 3;
  const visibleNames = selectedChannels
    .slice(0, maxVisibleNames)
    .map((channel) => channel.name);
  const hiddenCount = selectedCount - visibleNames.length;
  const displayValue =
    selectedCount === 0
      ? "Select channels"
      : `${visibleNames.join(", ")}${hiddenCount > 0 ? ` +${hiddenCount}` : ""}`;

  const listboxId = "notification-channel-multi-select-listbox";

  return (
    <fieldset className="field notification-channel-multi-select">
      <legend>Notification channels (optional)</legend>
      <p className="section-caption">
        {channels.length > 0
          ? "Select one or more channels for this profile."
          : "No notification channels available. Add one in Notification Channels tab."}
      </p>
      <div
        className="notification-channel-multi-select-control"
        ref={containerRef}
        role="group"
      >
        <div
          className={`notification-channel-control${isOpen ? " is-open" : ""}`}
          ref={controlRef}
          role="combobox"
          aria-expanded={isOpen}
          aria-haspopup="listbox"
          aria-owns={listboxId}
        >
          <input
            ref={inputRef}
            type="text"
            className="notification-channel-input"
            value={isOpen ? query : displayValue}
            placeholder={isOpen ? "Type to filter…" : displayValue}
            readOnly={!isOpen}
            disabled={channels.length === 0}
            aria-autocomplete="list"
            aria-controls={listboxId}
            aria-activedescendant={
              activeIndex >= 0
                ? `notification-channel-option-${filtered[activeIndex]?.id}`
                : undefined
            }
            onChange={(e) => {
              setQuery(e.target.value);
              setActiveIndex(-1);
            }}
            onClick={() => {
              if (!isOpen) openDropdown();
            }}
            onFocus={() => {
              if (!isOpen) openDropdown();
            }}
            onKeyDown={handleInputKeyDown}
          />
          <span className="notification-channel-chevron" aria-hidden="true">
            <svg viewBox="0 0 24 24" focusable="false" aria-hidden="true">
              <path
                d="M9 6L15 12L9 18"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
        </div>

        {isOpen &&
          createPortal(
            <ul
              id={listboxId}
              ref={listRef}
              className="notification-channel-listbox"
              style={{
                left: `${listPosition.left}px`,
                top: `${listPosition.top}px`,
                width: `${listPosition.width}px`,
              }}
              role="listbox"
              aria-label="Notification channels"
            >
              {filtered.length === 0 ? (
                <li
                  className="notification-channel-empty"
                  role="option"
                  aria-selected={false}
                >
                  No matching channels
                </li>
              ) : (
                filtered.map((channel, index) => {
                  const isSelected = selectedIds.includes(channel.id);
                  return (
                    <li
                      key={channel.id}
                      id={`notification-channel-option-${channel.id}`}
                      role="option"
                      aria-selected={isSelected}
                      className={[
                        "notification-channel-option",
                        isSelected ? "is-selected" : "",
                        index === activeIndex ? "is-active" : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        toggleChannel(channel.id);
                      }}
                      onMouseEnter={() => setActiveIndex(index)}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        readOnly
                        tabIndex={-1}
                        aria-hidden="true"
                      />
                      <span>{channel.name}</span>
                    </li>
                  );
                })
              )}
            </ul>,
            document.body,
          )}
      </div>
    </fieldset>
  );
}

type EditorTab = "source" | "notification" | "tags" | "roles";
type SourceEditorTab = "urls" | "rss";

const APP_ENVIRONMENT_STORAGE_KEY = "news-scrapper.environment";
const SESSION_ENVIRONMENT_STORAGE_KEY =
  "news-scrapper.session.environment-selected";

function parseStoredAppEnvironment(
  value: string | null,
): ApiEnvironment | null {
  if (value === "production" || value === "test") {
    return value;
  }

  return null;
}

function getInitialAppEnvironment(): ApiEnvironment | null {
  try {
    return parseStoredAppEnvironment(
      window.localStorage.getItem(APP_ENVIRONMENT_STORAGE_KEY),
    );
  } catch {
    return null;
  }
}

function isSessionEnvironmentSelected(): boolean {
  try {
    return sessionStorage.getItem(SESSION_ENVIRONMENT_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

type ProfileDraft = {
  name: string;
  description: string;
  systemPrompt: string;
  sourceId: number | null;
  tags: ProfileTag[];
  roles: ProfileTag[];
  notificationChannelIds: number[];
  notificationProfileId?: number | null;
};

type SourceDraft = {
  name: string;
  description: string;
  urls: ProfileUrl[];
  rssFeeds: RssFeed[];
};

type NotificationChannelDraft = {
  name: string;
  description: string;
  emailChannels: (EmailChannel & { _tempId?: number })[];
  slackChannels: (SlackChannel & { _tempId?: number })[];
};

function createDefaultNotificationChannelDraft(): NotificationChannelDraft {
  return {
    name: "",
    description: "",
    emailChannels: [],
    slackChannels: [],
  };
}

function mapNotificationChannelToDraft(
  channel: NotificationChannel,
): NotificationChannelDraft {
  const emailChannels: (EmailChannel & { _tempId?: number })[] = [];
  const slackChannels: (SlackChannel & { _tempId?: number })[] = [];

  for (const config of channel.channels) {
    if ("emailAddresses" in config) {
      emailChannels.push(config);
    } else if ("slackWebhookUrl" in config) {
      slackChannels.push(config);
    }
  }

  return {
    name: channel.name,
    description: channel.description,
    emailChannels,
    slackChannels,
  };
}

function toNotificationChannelInput(
  draft: NotificationChannelDraft,
): NotificationChannelInput {
  return {
    name: draft.name.trim(),
    description: draft.description.trim(),
    channels: [
      ...draft.emailChannels.map((channel) => ({
        emailAddresses: channel.emailAddresses,
      })),
      ...draft.slackChannels.map((channel) => ({
        slackWebhookUrl: channel.slackWebhookUrl,
      })),
    ],
  };
}

function validateNotificationChannelDraft(draft: NotificationChannelDraft) {
  if (!draft.name.trim()) {
    return "Channel name is required.";
  }

  const hasChannels =
    draft.emailChannels.length > 0 || draft.slackChannels.length > 0;
  if (!hasChannels) {
    return "At least one email or Slack channel is required.";
  }

  for (const channel of draft.emailChannels) {
    if (channel.emailAddresses.length === 0) {
      return "Each email channel must have at least one email address.";
    }
    for (const email of channel.emailAddresses) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
        return `Invalid email address: ${email}`;
      }
    }
  }

  for (const channel of draft.slackChannels) {
    if (!channel.slackWebhookUrl.trim()) {
      return "Slack webhook URL is required.";
    }
    if (!channel.slackWebhookUrl.trim().startsWith("https://")) {
      return "Slack webhook URL must start with https://";
    }
  }

  return "";
}

function normalizeTagName(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function hasDuplicateTagNames(tags: string[]) {
  const seenTags = new Set<string>();

  for (const tag of tags) {
    const normalizedTag = normalizeTagName(tag).toLocaleLowerCase();

    if (!normalizedTag) {
      continue;
    }

    if (seenTags.has(normalizedTag)) {
      return true;
    }

    seenTags.add(normalizedTag);
  }

  return false;
}

function hasDuplicateRoleNames(roles: string[]) {
  const seenRoles = new Set<string>();

  for (const role of roles) {
    const normalizedRole = normalizeTagName(role).toLocaleLowerCase();

    if (!normalizedRole) {
      continue;
    }

    if (seenRoles.has(normalizedRole)) {
      return true;
    }

    seenRoles.add(normalizedRole);
  }

  return false;
}

type ProfileFormProps = {
  mode: "create" | "edit";
  initialDraft: ProfileDraft;
  isSaving: boolean;
  formError: string;
  headingId?: string;
  sources: Source[];
  notificationChannels?: NotificationChannel[];
  onSubmit: (input: ProfileInput) => Promise<void>;
  onCancel: () => void;
};

type SourceFormProps = {
  mode: "create" | "edit";
  initialDraft: SourceDraft;
  isSaving: boolean;
  formError: string;
  headingId?: string;
  onSubmit: (input: SourceInput) => Promise<void>;
  onCancel: () => void;
};

type NotificationChannelFormProps = {
  mode: "create" | "edit";
  initialDraft: NotificationChannelDraft;
  isSaving: boolean;
  formError: string;
  headingId?: string;
  onSubmit: (input: NotificationChannelInput) => Promise<void>;
  onCancel: () => void;
};

function createDefaultProfileDraft(): ProfileDraft {
  return {
    name: "",
    description: "",
    systemPrompt: "",
    sourceId: null,
    tags: [],
    roles: [],
    notificationChannelIds: [],
    notificationProfileId: null,
  };
}

function createDefaultSourceDraft(): SourceDraft {
  return {
    name: "",
    description: "",
    urls: [createEmptyUrl(1)],
    rssFeeds: [createEmptyRssFeed(1)],
  };
}

function mapSourceToDraft(source: Source): SourceDraft {
  return {
    name: source.name,
    description: source.description,
    urls: source.urls.map((entry, index) => ({
      id: index + 1,
      url: entry.url,
      description: entry.description,
    })),
    rssFeeds: source.rssFeeds.map((entry, index) => ({
      id: index + 1,
      feedUrl: entry.feedUrl,
      description: entry.description,
    })),
  };
}

function toSourceInput(draft: SourceDraft): SourceInput {
  return {
    name: draft.name.trim(),
    description: draft.description.trim(),
    urls: draft.urls.map((entry) => ({
      url: entry.url.trim(),
      description: entry.description.trim(),
    })),
    rssFeeds: draft.rssFeeds.map((entry) => ({
      feedUrl: entry.feedUrl.trim(),
      description: entry.description?.trim(),
    })),
  };
}

function mapProfileToDraft(profile: SavedProfile): ProfileDraft {
  return {
    name: profile.name,
    description: profile.description,
    systemPrompt: profile.systemPrompt ?? "",
    sourceId: profile.sourceId,
    tags: profile.tags.map((entry, index) => ({
      id: index + 1,
      name: entry,
    })),
    roles: (profile.roles ?? []).map((entry, index) => ({
      id: index + 1,
      name: entry,
    })),
    notificationChannelIds:
      profile.notificationChannelIds ??
      (profile.notificationProfileId ? [profile.notificationProfileId] : []),
    notificationProfileId: profile.notificationProfileId,
  };
}

function getNextId<T extends { id: number }>(entries: T[]) {
  return Math.max(...entries.map((entry) => entry.id), 0) + 1;
}

function toProfileInput(draft: ProfileDraft): ProfileInput {
  return {
    name: draft.name.trim(),
    description: draft.description.trim(),
    systemPrompt: draft.systemPrompt.trim(),
    sourceId: draft.sourceId ?? 0,
    tags: draft.tags
      .map((entry) => normalizeTagName(entry.name))
      .filter(Boolean),
    roles: draft.roles
      .map((entry) => normalizeTagName(entry.name))
      .filter(Boolean),
    notificationChannelIds: draft.notificationChannelIds,
    // Keep legacy field until backend persistence is upgraded for multi-select.
    notificationProfileId: draft.notificationChannelIds[0] ?? null,
  };
}

function validateProfileDraft(input: ProfileInput) {
  if (!input.name) {
    return "Profile name is required.";
  }

  if (!Number.isInteger(input.sourceId) || input.sourceId <= 0) {
    return "Please select a source.";
  }

  if (hasDuplicateTagNames(input.tags)) {
    return "Tag names must be unique.";
  }

  if (hasDuplicateRoleNames(input.roles ?? [])) {
    return "Role names must be unique.";
  }

  return "";
}

function validateSourceDraft(input: SourceInput) {
  if (!input.name) {
    return "Source name is required.";
  }

  if (input.urls.length === 0 || input.urls.some((entry) => !entry.url)) {
    return "Each URL entry needs a source URL.";
  }

  if (
    input.rssFeeds.length === 0 ||
    input.rssFeeds.some((entry) => !entry.feedUrl)
  ) {
    return "Each RSS entry requires a feed URL.";
  }

  return "";
}

function resolveTraceId(error: unknown, fallbackTraceId?: string) {
  if (error instanceof ApiRequestError && error.traceId) {
    return error.traceId;
  }

  if (fallbackTraceId) {
    return fallbackTraceId;
  }

  return generateActionTraceId();
}

function withTraceId(
  message: string,
  error: unknown,
  fallbackTraceId?: string,
) {
  const traceId = resolveTraceId(error, fallbackTraceId);
  return `${message} Trace ID: ${traceId}`;
}

function withChatbotFailureDetails(
  message: string,
  error: unknown,
  fallbackTraceId?: string,
) {
  if (error instanceof ApiRequestError) {
    const traceId = resolveTraceId(error, fallbackTraceId);
    return `${message} Reason: ${error.message}. Trace ID: ${traceId}`;
  }

  return withTraceId(message, error, fallbackTraceId);
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function findDispatchResponseText(value: unknown): string | null {
  if (!isObjectRecord(value)) {
    return null;
  }

  // Check for API error response (when backend returns error status)
  if (typeof value.error === "string") {
    const msg = value.error.trim();
    if (msg.length > 0) {
      return msg;
    }
  }

  // Check for n8n error response format
  if (value.error === true && typeof value.message === "string") {
    const msg = value.message.trim();
    if (msg.length > 0) {
      return msg;
    }
  }

  const queue: unknown[] = [value];
  const preferredKeys = [
    "agentResponse",
    "response",
    "answer",
    "output",
    "text",
    "message",
  ];

  while (queue.length > 0) {
    const current = queue.shift();

    if (Array.isArray(current)) {
      for (const entry of current) {
        queue.push(entry);
      }
      continue;
    }

    if (!isObjectRecord(current)) {
      continue;
    }

    for (const key of preferredKeys) {
      const preferred = current[key];
      if (typeof preferred === "string" && preferred.trim().length > 0) {
        return preferred.trim();
      }
    }

    for (const entry of Object.values(current)) {
      queue.push(entry);
    }
  }

  return null;
}

const NEWS_REFRESH_INTERVAL_MS = 5 * 60 * 1000;

function formatNewsTimestamp(value: string) {
  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleString();
}

type FavoriteStarButtonProps = {
  isActive: boolean;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  className?: string;
};

function FavoriteStarButton({
  isActive,
  label,
  onClick,
  disabled = false,
  className = "",
}: FavoriteStarButtonProps) {
  const classes = [
    "favorite-star-button",
    isActive ? "is-active" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      type="button"
      className={classes}
      onClick={onClick}
      disabled={disabled}
      aria-pressed={isActive}
      aria-label={label}
      title={label}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M12 2.75l2.86 5.8 6.4.93-4.63 4.51 1.09 6.37L12 17.36l-5.72 3 1.09-6.37-4.63-4.51 6.4-.93L12 2.75z" />
      </svg>
    </button>
  );
}

function Home() {
  return (
    <section className="page home-page" aria-labelledby="entry-title">
      <div className="hero-card">
        <img src={aiNewsLogo} className="hero-logo" alt="News Scraper logo" />
        <p className="eyebrow">Entry Page</p>
        <h1 id="entry-title">News Scraper</h1>
        <p>
          Scrape and filter news from predefined trusted sources (URL, RSS) via
          help of AI and predefined profiles.
        </p>
      </div>
      <div className="menu-grid" role="list" aria-label="Main menus">
        <article role="listitem" className="menu-card">
          <h2>Profiles</h2>
          <p>
            Configure source URLs and RSS feeds, then choose the profile you
            want to use for News and Chatbot views.
          </p>
          <Link to="/profiles" className="menu-link">
            Open Profiles
          </Link>
        </article>
        <article role="listitem" className="menu-card">
          <h2>Chatbot</h2>
          <p>
            Ask questions about collected news and get fast summaries for the
            currently selected profile.
          </p>
          <Link to="/chatbot" className="menu-link">
            Open Chatbot
          </Link>
        </article>
        <article role="listitem" className="menu-card">
          <h2>News</h2>
          <p>
            Review collected entries tied to your selected profile with title,
            summary, origin, and source link.
          </p>
          <Link to="/news" className="menu-link">
            Open News
          </Link>
        </article>
      </div>
    </section>
  );
}

function ProfileForm({
  mode,
  initialDraft,
  isSaving,
  formError,
  headingId,
  sources,
  notificationChannels,
  onSubmit,
  onCancel,
}: ProfileFormProps) {
  const [draft, setDraft] = useState<ProfileDraft>(initialDraft);
  const [activeTab, setActiveTab] = useState<EditorTab>("source");
  const [tagInput, setTagInput] = useState("");
  const [roleInput, setRoleInput] = useState("");
  const [localError, setLocalError] = useState("");

  useEffect(() => {
    setDraft(initialDraft);
    setActiveTab("source");
    setTagInput("");
    setRoleInput("");
    setLocalError("");
  }, [initialDraft]);

  function addTag(rawValue: string) {
    const normalizedTag = normalizeTagName(rawValue);

    if (!normalizedTag) {
      setTagInput("");
      return;
    }

    const duplicateExists = draft.tags.some(
      (entry) =>
        entry.name.toLocaleLowerCase() === normalizedTag.toLocaleLowerCase(),
    );

    if (duplicateExists) {
      setLocalError("Tag names must be unique.");
      return;
    }

    setDraft((currentDraft) => ({
      ...currentDraft,
      tags: [
        ...currentDraft.tags,
        { id: getNextId(currentDraft.tags), name: normalizedTag },
      ],
    }));
    setTagInput("");
    setLocalError("");
  }

  function removeTag(tagId: number) {
    setDraft((currentDraft) => ({
      ...currentDraft,
      tags: currentDraft.tags.filter((entry) => entry.id !== tagId),
    }));

    if (localError === "Tag names must be unique.") {
      setLocalError("");
    }
  }

  function addRole(rawValue: string) {
    const normalizedRole = normalizeTagName(rawValue);

    if (!normalizedRole) {
      setRoleInput("");
      return;
    }

    const duplicateExists = draft.roles.some(
      (entry) =>
        entry.name.toLocaleLowerCase() === normalizedRole.toLocaleLowerCase(),
    );

    if (duplicateExists) {
      setLocalError("Role names must be unique.");
      return;
    }

    setDraft((currentDraft) => ({
      ...currentDraft,
      roles: [
        ...currentDraft.roles,
        { id: getNextId(currentDraft.roles), name: normalizedRole },
      ],
    }));
    setRoleInput("");
    setLocalError("");
  }

  function removeRole(roleId: number) {
    setDraft((currentDraft) => ({
      ...currentDraft,
      roles: currentDraft.roles.filter((entry) => entry.id !== roleId),
    }));

    if (localError === "Role names must be unique.") {
      setLocalError("");
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const profileInput = toProfileInput(draft);
    const validationError = validateProfileDraft(profileInput);

    if (validationError) {
      setLocalError(validationError);
      return;
    }

    setLocalError("");
    await onSubmit(profileInput);
  }

  const errorToShow = localError || formError;

  return (
    <EnglishValidatedForm
      className="panel profile-form"
      onSubmit={handleSubmit}
    >
      <div className="profile-form-header">
        <h2 id={headingId}>
          {mode === "create" ? "Create profile" : "Edit profile"}
        </h2>
        <p>
          {mode === "create"
            ? "Select source and notification channels, then define profile roles and tags."
            : "Update the selected profile settings and save changes."}
        </p>
      </div>

      <label className="field">
        <span>Profile name</span>
        <input
          type="text"
          value={draft.name}
          onChange={(event) =>
            setDraft((currentDraft) => ({
              ...currentDraft,
              name: event.target.value,
            }))
          }
          placeholder="Daily AI Movers"
          required
        />
      </label>

      <label className="field">
        <span>Profile description</span>
        <textarea
          value={draft.description}
          onChange={(event) =>
            setDraft((currentDraft) => ({
              ...currentDraft,
              description: event.target.value,
            }))
          }
          placeholder="Optional context for what this profile should watch."
          rows={3}
        />
      </label>

      <label className="field">
        <span>System Prompt</span>
        <textarea
          value={draft.systemPrompt}
          onChange={(event) =>
            setDraft((currentDraft) => ({
              ...currentDraft,
              systemPrompt: event.target.value,
            }))
          }
          placeholder="Optional system prompt for this profile context."
          rows={4}
        />
      </label>

      <div
        className="profile-tabs"
        role="tablist"
        aria-label="Profile sections"
      >
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "source"}
          className={`tab-button ${activeTab === "source" ? "is-active" : ""}`}
          onClick={() => setActiveTab("source")}
        >
          SOURCE
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "tags"}
          className={`tab-button ${activeTab === "tags" ? "is-active" : ""}`}
          onClick={() => setActiveTab("tags")}
        >
          TAGS
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "roles"}
          className={`tab-button ${activeTab === "roles" ? "is-active" : ""}`}
          onClick={() => setActiveTab("roles")}
        >
          ROLES
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "notification"}
          className={`tab-button ${activeTab === "notification" ? "is-active" : ""}`}
          onClick={() => setActiveTab("notification")}
        >
          NOTIFICATION
        </button>
      </div>

      {activeTab === "source" ? (
        <section
          className="profile-section"
          aria-labelledby="profile-source-title"
        >
          <div className="section-heading-row">
            <div>
              <p className="section-kicker">Section</p>
              <h3 id="profile-source-title">SOURCE</h3>
            </div>
          </div>

          <p className="section-caption">
            Select a source that contains URLs and RSS feeds to scrape.
          </p>

          <label className="field">
            <span>Source</span>
            <select
              value={draft.sourceId ?? ""}
              onChange={(event) => {
                const nextSourceId = Number(event.target.value);
                setDraft((currentDraft) => ({
                  ...currentDraft,
                  sourceId: Number.isInteger(nextSourceId)
                    ? nextSourceId
                    : null,
                }));
              }}
              required
            >
              <option value="">Select source</option>
              {sources.map((source) => (
                <option key={source.id} value={source.id}>
                  {source.name}
                </option>
              ))}
            </select>
          </label>

          {sources.length === 0 ? (
            <p className="section-caption">
              No sources available. Add one in the Sources tab.
            </p>
          ) : null}
        </section>
      ) : activeTab === "roles" ? (
        <section
          className="profile-section"
          aria-labelledby="profile-roles-title"
        >
          <div className="section-heading-row">
            <div>
              <p className="section-kicker">Section</p>
              <h3 id="profile-roles-title">ROLES</h3>
            </div>
          </div>

          <div className="tag-entry-row">
            <label className="field tag-entry-field">
              <span>Add role</span>
              <input
                type="text"
                value={roleInput}
                onChange={(event) => {
                  setRoleInput(event.target.value);
                  if (localError === "Role names must be unique.") {
                    setLocalError("");
                  }
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === ",") {
                    event.preventDefault();
                    addRole(roleInput);
                  }
                }}
                placeholder="Type a role and press Enter"
              />
            </label>
            <button
              type="button"
              className="ghost-button compact-button"
              onClick={() => addRole(roleInput)}
            >
              Add role
            </button>
          </div>

          <p className="section-caption">
            Roles are optional and describe profile context for background news
            scraping.
          </p>

          {draft.roles.length > 0 ? (
            <ul className="tag-chip-list" aria-label="Profile roles">
              {draft.roles.map((entry) => (
                <li key={entry.id} className="tag-chip-item">
                  <span className="tag-chip-label">{entry.name}</span>
                  <button
                    type="button"
                    className="tag-chip-remove"
                    aria-label={`Remove role ${entry.name}`}
                    onClick={() => removeRole(entry.id)}
                  >
                    x
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="section-caption">No roles added yet.</p>
          )}
        </section>
      ) : activeTab === "notification" ? (
        <section
          className="profile-section"
          aria-labelledby="profile-notification-title"
        >
          <div className="section-heading-row">
            <div>
              <p className="section-kicker">Section</p>
              <h3 id="profile-notification-title">NOTIFICATION</h3>
            </div>
          </div>

          <NotificationChannelMultiSelect
            channels={notificationChannels ?? []}
            selectedIds={draft.notificationChannelIds}
            onChange={(ids) =>
              setDraft((currentDraft) => ({
                ...currentDraft,
                notificationChannelIds: ids,
              }))
            }
          />
        </section>
      ) : (
        <section
          className="profile-section"
          aria-labelledby="profile-tags-title"
        >
          <div className="section-heading-row">
            <div>
              <p className="section-kicker">Section</p>
              <h3 id="profile-tags-title">TAGS</h3>
            </div>
          </div>

          <div className="tag-entry-row">
            <label className="field tag-entry-field">
              <span>Add tag</span>
              <input
                type="text"
                value={tagInput}
                onChange={(event) => {
                  setTagInput(event.target.value);
                  if (
                    localError === "Tag names must be unique." ||
                    localError === "Role names must be unique."
                  ) {
                    setLocalError("");
                  }
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === ",") {
                    event.preventDefault();
                    addTag(tagInput);
                  }
                }}
                placeholder="Type a tag and press Enter"
              />
            </label>
            <button
              type="button"
              className="ghost-button compact-button"
              onClick={() => addTag(tagInput)}
            >
              Add tag
            </button>
          </div>

          <p className="section-caption">
            Tags are stored per profile and duplicate names are blocked.
          </p>

          {draft.tags.length > 0 ? (
            <ul className="tag-chip-list" aria-label="Profile tags">
              {draft.tags.map((entry) => (
                <li key={entry.id} className="tag-chip-item">
                  <span className="tag-chip-label">{entry.name}</span>
                  <button
                    type="button"
                    className="tag-chip-remove"
                    aria-label={`Remove tag ${entry.name}`}
                    onClick={() => removeTag(entry.id)}
                  >
                    x
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="section-caption">No tags added yet.</p>
          )}
        </section>
      )}

      {errorToShow ? (
        <p className="form-error" role="alert">
          {errorToShow}
        </p>
      ) : null}

      <div className="form-actions">
        <button type="submit" className="primary-button" disabled={isSaving}>
          {isSaving
            ? mode === "create"
              ? "Saving..."
              : "Updating..."
            : mode === "create"
              ? "Save profile"
              : "Update profile"}
        </button>
        <button type="button" className="ghost-button" onClick={onCancel}>
          {mode === "create" ? "Cancel" : "Cancel edit"}
        </button>
      </div>
    </EnglishValidatedForm>
  );
}

function SourceForm({
  mode,
  initialDraft,
  isSaving,
  formError,
  headingId,
  onSubmit,
  onCancel,
}: SourceFormProps) {
  const [draft, setDraft] = useState<SourceDraft>(initialDraft);
  const [activeTab, setActiveTab] = useState<SourceEditorTab>("urls");
  const [localError, setLocalError] = useState("");

  useEffect(() => {
    setDraft(initialDraft);
    setActiveTab("urls");
    setLocalError("");
  }, [initialDraft]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const input = toSourceInput(draft);
    const validationError = validateSourceDraft(input);

    if (validationError) {
      setLocalError(validationError);
      return;
    }

    setLocalError("");
    await onSubmit(input);
  }

  const errorToShow = localError || formError;

  return (
    <EnglishValidatedForm
      className="panel profile-form"
      onSubmit={handleSubmit}
    >
      <div className="profile-form-header">
        <h2 id={headingId}>
          {mode === "create" ? "Create source" : "Edit source"}
        </h2>
        <p>
          {mode === "create"
            ? "Define URLs and RSS feeds for scraping."
            : "Update source URLs and RSS feeds."}
        </p>
      </div>

      <label className="field">
        <span>Source name</span>
        <input
          type="text"
          value={draft.name}
          onChange={(event) =>
            setDraft((currentDraft) => ({
              ...currentDraft,
              name: event.target.value,
            }))
          }
          placeholder="AI Demo Source"
          required
        />
      </label>

      <label className="field">
        <span>Source description</span>
        <textarea
          value={draft.description}
          onChange={(event) =>
            setDraft((currentDraft) => ({
              ...currentDraft,
              description: event.target.value,
            }))
          }
          placeholder="Optional context for this source"
          rows={3}
        />
      </label>

      <div className="profile-tabs" role="tablist" aria-label="Source sections">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "urls"}
          className={`tab-button ${activeTab === "urls" ? "is-active" : ""}`}
          onClick={() => setActiveTab("urls")}
        >
          URLS
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "rss"}
          className={`tab-button ${activeTab === "rss" ? "is-active" : ""}`}
          onClick={() => setActiveTab("rss")}
        >
          RSS
        </button>
      </div>

      {activeTab === "urls" ? (
        <section className="profile-section" aria-labelledby="source-urls-title">
          <div className="section-heading-row">
            <div>
              <p className="section-kicker">Section</p>
              <h3 id="source-urls-title">URLS</h3>
            </div>
            <button
              type="button"
              className="ghost-button"
              onClick={() => {
                setDraft((currentDraft) => ({
                  ...currentDraft,
                  urls: [
                    ...currentDraft.urls,
                    createEmptyUrl(getNextId(currentDraft.urls)),
                  ],
                }));
              }}
            >
              Add URL
            </button>
          </div>

          <div className="stacked-fields stacked-fields-scrollable">
            {draft.urls.map((entry, index) => (
              <div className="url-card" key={entry.id}>
                <div className="url-card-header">
                  <h4>
                    {entry.description.trim() ||
                      entry.url.trim() ||
                      `URL ${index + 1}`}
                  </h4>
                  <button
                    type="button"
                    className="text-button"
                    onClick={() =>
                      setDraft((currentDraft) => ({
                        ...currentDraft,
                        urls: currentDraft.urls.filter(
                          (urlEntry) => urlEntry.id !== entry.id,
                        ),
                      }))
                    }
                    disabled={draft.urls.length === 1}
                  >
                    Remove
                  </button>
                </div>

                <label className="field">
                  <span>{`Source URL ${index + 1}`}</span>
                  <input
                    type="url"
                    value={entry.url}
                    onChange={(event) =>
                      setDraft((currentDraft) => ({
                        ...currentDraft,
                        urls: currentDraft.urls.map((urlEntry) =>
                          urlEntry.id === entry.id
                            ? { ...urlEntry, url: event.target.value }
                            : urlEntry,
                        ),
                      }))
                    }
                    placeholder="https://example.com/feed"
                    required
                  />
                </label>

                <label className="field">
                  <span>{`URL description ${index + 1}`}</span>
                  <input
                    type="text"
                    value={entry.description}
                    onChange={(event) =>
                      setDraft((currentDraft) => ({
                        ...currentDraft,
                        urls: currentDraft.urls.map((urlEntry) =>
                          urlEntry.id === entry.id
                            ? { ...urlEntry, description: event.target.value }
                            : urlEntry,
                        ),
                      }))
                    }
                    placeholder="Optional note"
                  />
                </label>
              </div>
            ))}
          </div>
        </section>
      ) : (
        <section className="profile-section" aria-labelledby="source-rss-title">
          <div className="section-heading-row">
            <div>
              <p className="section-kicker">Section</p>
              <h3 id="source-rss-title">RSS</h3>
            </div>
            <button
              type="button"
              className="ghost-button"
              onClick={() => {
                setDraft((currentDraft) => ({
                  ...currentDraft,
                  rssFeeds: [
                    ...currentDraft.rssFeeds,
                    createEmptyRssFeed(getNextId(currentDraft.rssFeeds)),
                  ],
                }));
              }}
            >
              Add RSS
            </button>
          </div>

          <div className="stacked-fields stacked-fields-scrollable">
            {draft.rssFeeds.map((entry, index) => (
              <div className="url-card" key={entry.id}>
                <div className="url-card-header">
                  <h4>
                    {entry.description?.trim() ||
                      entry.feedUrl.trim() ||
                      `RSS ${index + 1}`}
                  </h4>
                  <button
                    type="button"
                    className="text-button"
                    onClick={() =>
                      setDraft((currentDraft) => ({
                        ...currentDraft,
                        rssFeeds: currentDraft.rssFeeds.filter(
                          (rssEntry) => rssEntry.id !== entry.id,
                        ),
                      }))
                    }
                    disabled={draft.rssFeeds.length === 1}
                  >
                    Remove
                  </button>
                </div>

                <div className="rss-grid">
                  <label className="field field-wide">
                    <span>{`RSS feed URL ${index + 1}`}</span>
                    <input
                      type="url"
                      value={entry.feedUrl}
                      onChange={(event) =>
                        setDraft((currentDraft) => ({
                          ...currentDraft,
                          rssFeeds: currentDraft.rssFeeds.map((rssEntry) =>
                            rssEntry.id === entry.id
                              ? { ...rssEntry, feedUrl: event.target.value }
                              : rssEntry,
                          ),
                        }))
                      }
                      placeholder="https://example.com/feed.xml"
                      required
                    />
                  </label>

                  <label className="field field-wide">
                    <span>{`Description ${index + 1} (optional)`}</span>
                    <input
                      type="text"
                      value={entry.description ?? ""}
                      onChange={(event) =>
                        setDraft((currentDraft) => ({
                          ...currentDraft,
                          rssFeeds: currentDraft.rssFeeds.map((rssEntry) =>
                            rssEntry.id === entry.id
                              ? {
                                  ...rssEntry,
                                  description: event.target.value,
                                }
                              : rssEntry,
                          ),
                        }))
                      }
                      placeholder="Brief description of this feed"
                    />
                  </label>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {errorToShow ? (
        <p className="form-error" role="alert">
          {errorToShow}
        </p>
      ) : null}

      <div className="form-actions">
        <button type="submit" className="primary-button" disabled={isSaving}>
          {isSaving
            ? mode === "create"
              ? "Saving..."
              : "Updating..."
            : mode === "create"
              ? "Save source"
              : "Update source"}
        </button>
        <button type="button" className="ghost-button" onClick={onCancel}>
          {mode === "create" ? "Cancel" : "Cancel edit"}
        </button>
      </div>
    </EnglishValidatedForm>
  );
}

function NotificationChannelForm({
  mode,
  initialDraft,
  isSaving,
  formError,
  headingId,
  onSubmit,
  onCancel,
}: NotificationChannelFormProps) {
  const [draft, setDraft] = useState<NotificationChannelDraft>(initialDraft);
  const [localError, setLocalError] = useState("");
  const [emailInput, setEmailInput] = useState("");
  const [slackInput, setSlackInput] = useState("");
  const nextTempId = useRef(1);

  useEffect(() => {
    setDraft(initialDraft);
    setEmailInput("");
    setSlackInput("");
    setLocalError("");
    nextTempId.current = 1;
  }, [initialDraft]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const validationError = validateNotificationChannelDraft(draft);
    if (validationError) {
      setLocalError(validationError);
      return;
    }

    setLocalError("");
    const input = toNotificationChannelInput(draft);
    await onSubmit(input);
  }

  function addEmailChannel() {
    if (!emailInput.trim()) {
      return;
    }

    const newChannel: EmailChannel & { _tempId?: number } = {
      id: 0,
      emailAddresses: [emailInput.trim()],
      _tempId: nextTempId.current++,
    };

    setDraft((current) => ({
      ...current,
      emailChannels: [...current.emailChannels, newChannel],
    }));
    setEmailInput("");
  }

  function addSlackChannel() {
    if (!slackInput.trim()) {
      return;
    }

    const newChannel: SlackChannel & { _tempId?: number } = {
      id: 0,
      slackWebhookUrl: slackInput.trim(),
      _tempId: nextTempId.current++,
    };

    setDraft((current) => ({
      ...current,
      slackChannels: [...current.slackChannels, newChannel],
    }));
    setSlackInput("");
  }

  function removeEmailChannel(tempId: number | undefined) {
    setDraft((current) => ({
      ...current,
      emailChannels: current.emailChannels.filter(
        (ch) => ch._tempId !== tempId,
      ),
    }));
  }

  function removeSlackChannel(tempId: number | undefined) {
    setDraft((current) => ({
      ...current,
      slackChannels: current.slackChannels.filter(
        (ch) => ch._tempId !== tempId,
      ),
    }));
  }

  const errorToShow = localError || formError;

  return (
    <EnglishValidatedForm
      className="panel profile-form"
      onSubmit={handleSubmit}
    >
      <div className="profile-form-header">
        <h2 id={headingId}>
          {mode === "create"
            ? "Create notification channel"
            : "Edit notification channel"}
        </h2>
        <p>
          {mode === "create"
            ? "Define a channel name and add email or Slack delivery endpoints."
            : "Update the notification channel settings and delivery endpoints."}
        </p>
      </div>

      <label className="field">
        <span>Channel name</span>
        <input
          type="text"
          value={draft.name}
          onChange={(event) =>
            setDraft((current) => ({
              ...current,
              name: event.target.value,
            }))
          }
          placeholder="Email Alerts"
          required
        />
      </label>

      <label className="field">
        <span>Channel description</span>
        <textarea
          value={draft.description}
          onChange={(event) =>
            setDraft((current) => ({
              ...current,
              description: event.target.value,
            }))
          }
          placeholder="Optional context for this notification channel."
          rows={3}
        />
      </label>

      <div className="channel-config-section">
        <h3>Email Delivery</h3>
        <div className="channel-entry-row">
          <label className="field channel-entry-field">
            <span>Email address</span>
            <input
              type="email"
              value={emailInput}
              onChange={(event) => setEmailInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  addEmailChannel();
                }
              }}
              placeholder="alerts@example.com"
            />
          </label>
          <button
            type="button"
            className="ghost-button compact-button"
            onClick={addEmailChannel}
          >
            Add email
          </button>
        </div>

        {draft.emailChannels.length > 0 ? (
          <ul className="channel-list" aria-label="Email addresses">
            {draft.emailChannels.map((channel, index) =>
              channel.emailAddresses.map((email, emailIndex) => (
                <li key={`${channel._tempId}-${emailIndex}`}>
                  <span>{email}</span>
                  <button
                    type="button"
                    className="ghost-button compact-button compact-button-danger compact-button-micro"
                    onClick={() => {
                      if (channel.emailAddresses.length === 1) {
                        removeEmailChannel(channel._tempId);
                      } else {
                        setDraft((current) => ({
                          ...current,
                          emailChannels: current.emailChannels.map((ch) =>
                            ch._tempId === channel._tempId
                              ? {
                                  ...ch,
                                  emailAddresses: ch.emailAddresses.filter(
                                    (_, idx) => idx !== emailIndex,
                                  ),
                                }
                              : ch,
                          ),
                        }));
                      }
                    }}
                  >
                    Remove
                  </button>
                </li>
              )),
            )}
          </ul>
        ) : null}
      </div>

      <div className="channel-config-section">
        <h3>Slack Delivery</h3>
        <div className="channel-entry-row">
          <label className="field channel-entry-field">
            <span>Webhook URL</span>
            <input
              type="url"
              value={slackInput}
              onChange={(event) => setSlackInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  addSlackChannel();
                }
              }}
              placeholder="https://hooks.slack.com/services/..."
            />
          </label>
          <button
            type="button"
            className="ghost-button compact-button"
            onClick={addSlackChannel}
          >
            Add webhook
          </button>
        </div>

        {draft.slackChannels.length > 0 ? (
          <ul className="channel-list" aria-label="Slack webhooks">
            {draft.slackChannels.map((channel) => (
              <li key={channel._tempId}>
                <span className="webhook-url-display">
                  {channel.slackWebhookUrl.substring(0, 50)}...
                </span>
                <button
                  type="button"
                  className="ghost-button compact-button compact-button-danger compact-button-micro"
                  onClick={() => removeSlackChannel(channel._tempId)}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      {errorToShow ? (
        <p className="form-error" role="alert">
          {errorToShow}
        </p>
      ) : null}

      <div className="form-actions">
        <button type="submit" className="primary-button" disabled={isSaving}>
          {isSaving
            ? mode === "create"
              ? "Creating..."
              : "Updating..."
            : mode === "create"
              ? "Create channel"
              : "Update channel"}
        </button>
        <button type="button" className="ghost-button" onClick={onCancel}>
          {mode === "create" ? "Cancel" : "Cancel edit"}
        </button>
      </div>
    </EnglishValidatedForm>
  );
}

type ModalDialogProps = {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  className?: string;
};

type StartupEnvironmentDialogProps = {
  selectedEnvironment: ApiEnvironment;
  onChangeEnvironment: (value: ApiEnvironment) => void;
  onConnect: () => void;
};

// ---------------------------------------------------------------------------
// ProfileCombobox – single searchable dropdown for selecting the active profile
// ---------------------------------------------------------------------------
type ProfileComboboxProps = {
  profiles: SavedProfile[];
  selectedProfileId: number | null;
  isLoading: boolean;
  onSelect: (id: number | null) => void;
};

function ProfileCombobox({
  profiles,
  selectedProfileId,
  isLoading,
  onSelect,
}: ProfileComboboxProps) {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const controlRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [listPosition, setListPosition] = useState({
    left: 0,
    top: 0,
    width: 220,
  });

  const selectedProfile =
    profiles.find((p) => p.id === selectedProfileId) ?? null;

  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase();
    if (!q) return profiles;
    return profiles.filter((p) => p.name.toLocaleLowerCase().includes(q));
  }, [profiles, query]);

  // Calculate dropdown position when opening
  useEffect(() => {
    if (isOpen && controlRef.current) {
      const rect = controlRef.current.getBoundingClientRect();
      setListPosition({
        left: rect.left,
        top: rect.bottom + 4,
        width: rect.width,
      });
    }
  }, [isOpen]);

  // Close when clicking outside
  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
        setQuery("");
      }
    }
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, []);

  function openDropdown() {
    setQuery("");
    setActiveIndex(-1);
    setIsOpen(true);
    setTimeout(() => inputRef.current?.select(), 0);
  }

  function selectProfile(profile: SavedProfile) {
    onSelect(profile.id);
    setIsOpen(false);
    setQuery("");
  }

  function handleInputKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      const next = Math.min(activeIndex + 1, filtered.length - 1);
      setActiveIndex(next);
      listRef.current?.children[next]?.scrollIntoView({ block: "nearest" });
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      const prev = Math.max(activeIndex - 1, 0);
      setActiveIndex(prev);
      listRef.current?.children[prev]?.scrollIntoView({ block: "nearest" });
    } else if (event.key === "Enter") {
      event.preventDefault();
      const target = activeIndex >= 0 ? filtered[activeIndex] : filtered[0];
      if (target) selectProfile(target);
    } else if (event.key === "Escape") {
      setIsOpen(false);
      setQuery("");
    }
  }

  const displayValue = isLoading
    ? "Loading profiles..."
    : profiles.length === 0
      ? "No profiles available"
      : (selectedProfile?.name ?? "Select a profile");

  const listboxId = "profile-combobox-listbox";

  return (
    <div
      className="profile-combobox"
      ref={containerRef}
      aria-label="Active profile"
    >
      <span className="profile-combobox-label">Active profile</span>
      <div
        className={`profile-combobox-control${isOpen ? " is-open" : ""}`}
        ref={controlRef}
        role="combobox"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-owns={listboxId}
      >
        <input
          ref={inputRef}
          type="text"
          className="profile-combobox-input"
          value={isOpen ? query : displayValue}
          placeholder={isOpen ? "Type to filter…" : displayValue}
          readOnly={!isOpen}
          disabled={isLoading || profiles.length === 0}
          aria-autocomplete="list"
          aria-controls={listboxId}
          aria-activedescendant={
            activeIndex >= 0
              ? `profile-combobox-option-${filtered[activeIndex]?.id}`
              : undefined
          }
          onChange={(e) => {
            setQuery(e.target.value);
            setActiveIndex(-1);
          }}
          onClick={() => {
            if (!isOpen) openDropdown();
          }}
          onFocus={() => {
            if (!isOpen) openDropdown();
          }}
          onKeyDown={handleInputKeyDown}
        />
        <span className="profile-combobox-chevron" aria-hidden="true">
          <svg viewBox="0 0 24 24" focusable="false" aria-hidden="true">
            <path
              d="M9 6L15 12L9 18"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      </div>

      {isOpen &&
        createPortal(
          <ul
            id={listboxId}
            ref={listRef}
            className="profile-combobox-listbox"
            style={{
              left: `${listPosition.left}px`,
              top: `${listPosition.top}px`,
              width: `${listPosition.width}px`,
            }}
            role="listbox"
            aria-label="Profiles"
          >
            {filtered.length === 0 ? (
              <li
                className="profile-combobox-empty"
                role="option"
                aria-selected={false}
              >
                No matching profiles
              </li>
            ) : (
              filtered.map((profile, index) => (
                <li
                  key={profile.id}
                  id={`profile-combobox-option-${profile.id}`}
                  role="option"
                  aria-selected={profile.id === selectedProfileId}
                  className={[
                    "profile-combobox-option",
                    profile.id === selectedProfileId ? "is-selected" : "",
                    index === activeIndex ? "is-active" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  onMouseDown={(e) => {
                    e.preventDefault(); // keep focus on input
                    selectProfile(profile);
                  }}
                  onMouseEnter={() => setActiveIndex(index)}
                >
                  {profile.name}
                </li>
              ))
            )}
          </ul>,
          document.body,
        )}
    </div>
  );
}
// ---------------------------------------------------------------------------

function ModalDialog({
  title,
  children,
  onClose,
  className,
}: ModalDialogProps) {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  return createPortal(
    <div className="dialog-overlay">
      <div
        className={["dialog-card", className].filter(Boolean).join(" ")}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="dialog-header">
          <h2 className="dialog-title">{title}</h2>
          <button
            type="button"
            className="ghost-button compact-button dialog-close"
            aria-label="Close dialog"
            onClick={onClose}
          >
            Close
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}

function StartupEnvironmentScene() {
  return (
    <motion.div
      className="startup-environment-scene"
      initial={{ opacity: 0, y: 16, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.55, ease: "easeOut" }}
      aria-hidden="true"
    >
      <iframe
        title="AI News Scraper startup hero"
        className="startup-hero-frame"
        src="/startup-hero.html"
      />
      <div className="startup-environment-glow" />
    </motion.div>
  );
}

function StartupEnvironmentDialog({
  selectedEnvironment,
  onChangeEnvironment,
  onConnect,
}: StartupEnvironmentDialogProps) {
  return createPortal(
    <div className="dialog-overlay startup-environment-overlay">
      <motion.div
        className={`dialog-card startup-environment-card startup-environment-card--${selectedEnvironment ?? "none"}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="startup-environment-title"
        initial={{ opacity: 0, y: 20, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.45, ease: "easeOut" }}
      >
        <StartupEnvironmentScene />
        <div className="dialog-header">
          <h2 id="startup-environment-title" className="dialog-title">
            Select Environment
          </h2>
        </div>
        <p className="startup-environment-intro">
          Choose which backend environment to connect to before loading
          profiles.
        </p>
        <fieldset className="startup-environment-options">
          <legend className="sr-only">Environment</legend>
          <label className="startup-environment-option startup-environment-option--production">
            <input
              type="radio"
              name="startup-environment"
              value="production"
              checked={selectedEnvironment === "production"}
              onChange={() => onChangeEnvironment("production")}
            />
            <span>
              <strong className="startup-environment-label startup-environment-label--production">
                Production
              </strong>
            </span>
          </label>
          <label className="startup-environment-option startup-environment-option--test">
            <input
              type="radio"
              name="startup-environment"
              value="test"
              checked={selectedEnvironment === "test"}
              onChange={() => onChangeEnvironment("test")}
            />
            <span>
              <strong className="startup-environment-label startup-environment-label--test">
                Test
              </strong>
            </span>
          </label>
        </fieldset>
        <div className="form-actions startup-environment-actions">
          <button type="button" className="primary-button" onClick={onConnect}>
            Connect
          </button>
        </div>
      </motion.div>
    </div>,
    document.body,
  );
}

type ProfilesPageProps = {
  profiles: SavedProfile[];
  sources: Source[];
  isLoadingProfiles: boolean;
  profilesError: string;
  notificationChannels: NotificationChannel[];
  onProfilesChanged: (profiles: SavedProfile[]) => void;
  onSourcesChanged: (sources: Source[]) => void;
  onReloadProfiles: () => Promise<void>;
  onNotificationChannelsChanged: (profiles: NotificationChannel[]) => void;
};

function ProfilesPage({
  profiles,
  sources,
  isLoadingProfiles,
  profilesError,
  notificationChannels,
  onProfilesChanged,
  onSourcesChanged,
  onReloadProfiles,
  onNotificationChannelsChanged,
}: ProfilesPageProps) {
  const [activeTab, setActiveTab] = useState<
    "sources" | "notifications" | "profiles"
  >("sources");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [createDraft, setCreateDraft] = useState<ProfileDraft>(
    createDefaultProfileDraft(),
  );
  const [editingProfileId, setEditingProfileId] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState<ProfileDraft>(
    createDefaultProfileDraft(),
  );
  const [formError, setFormError] = useState("");
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [deletingProfileId, setDeletingProfileId] = useState<number | null>(
    null,
  );
  const [isCreateSourceDialogOpen, setIsCreateSourceDialogOpen] =
    useState(false);
  const [sourceFormError, setSourceFormError] = useState("");
  const [isSavingSource, setIsSavingSource] = useState(false);
  const [editingSourceId, setEditingSourceId] = useState<number | null>(null);
  const [deletingSourceId, setDeletingSourceId] = useState<number | null>(null);
  const [isCreateNotificationDialogOpen, setIsCreateNotificationDialogOpen] =
    useState(false);
  const [notificationFormError, setNotificationFormError] = useState("");
  const [isSavingNotification, setIsSavingNotification] = useState(false);
  const [editingNotificationProfileId, setEditingNotificationProfileId] =
    useState<number | null>(null);
  const [deletingNotificationProfileId, setDeletingNotificationProfileId] =
    useState<number | null>(null);

  function startAddDialog() {
    setCreateDraft(createDefaultProfileDraft());
    if (sources.length > 0) {
      setCreateDraft((currentDraft) => ({
        ...currentDraft,
        sourceId: sources[0].id,
      }));
    }
    setFormError("");
    setIsCreateDialogOpen(true);
  }

  function startEditingProfile(profile: SavedProfile) {
    setEditingProfileId(profile.id);
    setEditDraft(mapProfileToDraft(profile));
    setFormError("");
  }

  function cancelEditingProfile() {
    setEditingProfileId(null);
    setFormError("");
  }

  async function handleCreateProfile(input: ProfileInput) {
    setFormError("");
    setIsSavingProfile(true);
    const actionTraceId = generateActionTraceId();

    try {
      const createdProfile = await createProfile(input, actionTraceId);
      onProfilesChanged([createdProfile, ...profiles]);
      setIsCreateDialogOpen(false);
      setCreateDraft(createDefaultProfileDraft());
    } catch (error) {
      setFormError(
        withTraceId(
          "Could not save the profile. Check the backend server and database connection.",
          error,
          actionTraceId,
        ),
      );
    } finally {
      setIsSavingProfile(false);
    }
  }

  async function handleUpdateProfile(input: ProfileInput) {
    if (editingProfileId === null) {
      return;
    }

    setFormError("");
    setIsSavingProfile(true);
    const actionTraceId = generateActionTraceId();

    try {
      const updatedProfile = await updateProfile(
        editingProfileId,
        input,
        actionTraceId,
      );
      onProfilesChanged(
        profiles.map((profile) =>
          profile.id === editingProfileId ? updatedProfile : profile,
        ),
      );
      cancelEditingProfile();
    } catch (error) {
      setFormError(
        withTraceId(
          "Could not update the profile. Check the backend server and database connection.",
          error,
          actionTraceId,
        ),
      );
    } finally {
      setIsSavingProfile(false);
    }
  }

  async function handleDeleteProfile(profileId: number) {
    setDeletingProfileId(profileId);
    const actionTraceId = generateActionTraceId();

    try {
      await deleteProfileRequest(profileId, actionTraceId);
      onProfilesChanged(profiles.filter((profile) => profile.id !== profileId));

      if (editingProfileId === profileId) {
        cancelEditingProfile();
      }
    } catch (error) {
      setFormError(
        withTraceId(
          "Could not delete the selected profile. Check the backend server and database connection.",
          error,
          actionTraceId,
        ),
      );
    } finally {
      setDeletingProfileId(null);
    }
  }

  const [createSourceDraft, setCreateSourceDraft] = useState<SourceDraft>(
    createDefaultSourceDraft(),
  );
  const [editSourceDraft, setEditSourceDraft] = useState<SourceDraft>(
    createDefaultSourceDraft(),
  );

  function startCreateSource() {
    setCreateSourceDraft(createDefaultSourceDraft());
    setSourceFormError("");
    setIsCreateSourceDialogOpen(true);
  }

  function startEditSource(source: Source) {
    setEditingSourceId(source.id);
    setEditSourceDraft(mapSourceToDraft(source));
    setSourceFormError("");
  }

  function cancelEditSource() {
    setEditingSourceId(null);
    setSourceFormError("");
  }

  async function handleCreateSource(input: SourceInput) {
    setSourceFormError("");
    setIsSavingSource(true);
    const actionTraceId = generateActionTraceId();

    try {
      const createdSource = await createSource(input, actionTraceId);
      onSourcesChanged([createdSource, ...sources]);
      setIsCreateSourceDialogOpen(false);
      setCreateSourceDraft(createDefaultSourceDraft());
    } catch (error) {
      setSourceFormError(
        withTraceId("Could not create source.", error, actionTraceId),
      );
    } finally {
      setIsSavingSource(false);
    }
  }

  async function handleUpdateSource(input: SourceInput) {
    if (editingSourceId === null) {
      return;
    }

    setSourceFormError("");
    setIsSavingSource(true);
    const actionTraceId = generateActionTraceId();

    try {
      const updatedSource = await updateSource(
        editingSourceId,
        input,
        actionTraceId,
      );
      onSourcesChanged(
        sources.map((source) =>
          source.id === editingSourceId ? updatedSource : source,
        ),
      );
      cancelEditSource();
    } catch (error) {
      setSourceFormError(
        withTraceId("Could not update source.", error, actionTraceId),
      );
    } finally {
      setIsSavingSource(false);
    }
  }

  async function handleDeleteSource(sourceId: number) {
    setDeletingSourceId(sourceId);
    const actionTraceId = generateActionTraceId();

    try {
      await deleteSourceRequest(sourceId, actionTraceId);
      onSourcesChanged(sources.filter((source) => source.id !== sourceId));
    } catch (error) {
      setSourceFormError(
        withTraceId("Could not delete source.", error, actionTraceId),
      );
    } finally {
      setDeletingSourceId(null);
    }
  }

  const [createNotificationDraft, setCreateNotificationDraft] =
    useState<NotificationChannelDraft>(createDefaultNotificationChannelDraft());
  const [editNotificationDraft, setEditNotificationDraft] =
    useState<NotificationChannelDraft>(createDefaultNotificationChannelDraft());

  function startCreateNotificationChannel() {
    setCreateNotificationDraft(createDefaultNotificationChannelDraft());
    setNotificationFormError("");
    setIsCreateNotificationDialogOpen(true);
  }

  function startEditNotificationChannel(channel: NotificationChannel) {
    setEditingNotificationProfileId(channel.id);
    setEditNotificationDraft(mapNotificationChannelToDraft(channel));
    setNotificationFormError("");
  }

  function cancelEditNotificationChannel() {
    setEditingNotificationProfileId(null);
    setNotificationFormError("");
  }

  async function handleCreateNotificationChannel(
    input: NotificationChannelInput,
  ) {
    setNotificationFormError("");
    setIsSavingNotification(true);
    const actionTraceId = generateActionTraceId();

    try {
      const createdChannel = await createNotificationChannel(
        input,
        actionTraceId,
      );
      onNotificationChannelsChanged([createdChannel, ...notificationChannels]);
      setIsCreateNotificationDialogOpen(false);
      setCreateNotificationDraft(createDefaultNotificationChannelDraft());
    } catch (error) {
      setNotificationFormError(
        withTraceId(
          "Could not create the notification channel. Check the backend server and database connection.",
          error,
          actionTraceId,
        ),
      );
    } finally {
      setIsSavingNotification(false);
    }
  }

  async function handleUpdateNotificationChannel(
    input: NotificationChannelInput,
  ) {
    if (editingNotificationProfileId === null) {
      return;
    }

    setNotificationFormError("");
    setIsSavingNotification(true);
    const actionTraceId = generateActionTraceId();

    try {
      const updatedChannel = await updateNotificationChannel(
        editingNotificationProfileId,
        input,
        actionTraceId,
      );
      onNotificationChannelsChanged(
        notificationChannels.map((channel) =>
          channel.id === editingNotificationProfileId
            ? updatedChannel
            : channel,
        ),
      );
      cancelEditNotificationChannel();
    } catch (error) {
      setNotificationFormError(
        withTraceId(
          "Could not update the notification channel. Check the backend server and database connection.",
          error,
          actionTraceId,
        ),
      );
    } finally {
      setIsSavingNotification(false);
    }
  }

  return (
    <section className="page profiles-page" aria-labelledby="profiles-title">
      <h1 id="profiles-title">Profiles</h1>
      <p className="page-intro">
        Manage sources, notification channels, and profiles in separate tabs.
      </p>

      <div className="tabs-container" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "sources"}
          className={`tab-button ${activeTab === "sources" ? "is-active" : ""}`}
          onClick={() => setActiveTab("sources")}
        >
          Sources
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "notifications"}
          className={`tab-button ${activeTab === "notifications" ? "is-active" : ""}`}
          onClick={() => setActiveTab("notifications")}
        >
          Notification Channels
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "profiles"}
          className={`tab-button ${activeTab === "profiles" ? "is-active" : ""}`}
          onClick={() => setActiveTab("profiles")}
        >
          Profiles
        </button>
      </div>

      {activeTab === "sources" ? (
        <section
          className="panel profiles-summary"
          aria-labelledby="sources-title"
        >
          <div className="summary-header">
            <div>
              <h2 id="sources-title" className="title-with-count">
                <span>Sources</span>
                <span
                  className="title-count-badge"
                  aria-label={`${sources.length} sources`}
                >
                  {sources.length}
                </span>
              </h2>
            </div>
            <div className="saved-profile-actions">
              <button
                type="button"
                className="primary-button compact-button"
                onClick={startCreateSource}
              >
                Add source
              </button>
            </div>
          </div>

          {sources.length === 0 ? (
            <article className="panel empty-state">
              <h3>No sources yet</h3>
              <p>Create a source with URL and RSS definitions first.</p>
            </article>
          ) : (
            <ul className="profile-name-list" aria-label="Source entries">
              {sources.map((source) => (
                <li key={source.id}>
                  <span>{source.name}</span>
                  <div className="saved-profile-actions">
                    <button
                      type="button"
                      className="ghost-button compact-button"
                      onClick={() => startEditSource(source)}
                    >
                      Edit source
                    </button>
                    <button
                      type="button"
                      className="ghost-button compact-button compact-button-danger"
                      onClick={() => void handleDeleteSource(source.id)}
                      disabled={deletingSourceId === source.id}
                    >
                      {deletingSourceId === source.id
                        ? "Deleting..."
                        : "Delete source"}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      {activeTab === "profiles" ? (
        <section
          className="panel profiles-summary"
          aria-labelledby="saved-profiles-title"
        >
          <div className="summary-header">
            <div>
              <h2 id="saved-profiles-title" className="title-with-count">
                <span>Profiles</span>
                <span
                  className="title-count-badge"
                  aria-label={`${profiles.length} profiles`}
                >
                  {profiles.length}
                </span>
              </h2>
            </div>
            <div className="saved-profile-actions">
              <button
                type="button"
                className="primary-button compact-button"
                onClick={startAddDialog}
              >
                Add profile
              </button>
              <button
                type="button"
                className="ghost-button compact-button"
                onClick={() => void onReloadProfiles()}
              >
                Refresh
              </button>
            </div>
          </div>

          {profilesError ? (
            <article className="panel empty-state">
              <h3>Profiles unavailable</h3>
              <p>{profilesError}</p>
            </article>
          ) : isLoadingProfiles ? (
            <article className="panel empty-state">
              <h3>Loading profiles</h3>
              <p>Fetching saved profiles from the API layer.</p>
            </article>
          ) : profiles.length === 0 ? (
            <article className="panel empty-state">
              <h3>No profiles yet</h3>
              <p>
                Add your first profile to define where news is collected from.
              </p>
            </article>
          ) : (
            <ul className="profile-name-list" aria-label="Profile entries">
              {profiles.map((profile) => (
                <li key={profile.id}>
                  <span>{profile.name}</span>
                  <div className="saved-profile-actions">
                    <button
                      type="button"
                      className="ghost-button compact-button"
                      onClick={() => startEditingProfile(profile)}
                    >
                      Edit profile
                    </button>
                    <button
                      type="button"
                      className="ghost-button compact-button compact-button-danger"
                      onClick={() => void handleDeleteProfile(profile.id)}
                      disabled={deletingProfileId === profile.id}
                    >
                      {deletingProfileId === profile.id
                        ? "Deleting..."
                        : "Delete profile"}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      {activeTab === "notifications" ? (
        <section
          className="panel notifications-summary"
          aria-labelledby="notification-channels-title"
        >
          <div className="summary-header">
            <div>
              <h2 id="notification-channels-title" className="title-with-count">
                <span>Notification Channels</span>
                <span
                  className="title-count-badge"
                  aria-label={`${notificationChannels.length} notification channels`}
                >
                  {notificationChannels.length}
                </span>
              </h2>
            </div>
            <div className="saved-profile-actions">
              <button
                type="button"
                className="primary-button compact-button"
                onClick={startCreateNotificationChannel}
              >
                Add notification channel
              </button>
            </div>
          </div>

          {notificationChannels.length === 0 ? (
            <article className="panel empty-state">
              <h3>No notification channels</h3>
              <p>
                Create a notification channel to define Email and Slack delivery
                options.
              </p>
            </article>
          ) : (
            <ul
              className="profile-name-list"
              aria-label="Notification channels"
            >
              {notificationChannels.map((channel) => (
                <li key={channel.id}>
                  <span>{channel.name}</span>
                  <div className="saved-profile-actions">
                    <button
                      type="button"
                      className="ghost-button compact-button"
                      onClick={() => {
                        startEditNotificationChannel(channel);
                      }}
                    >
                      Edit channel
                    </button>
                    <button
                      type="button"
                      className="ghost-button compact-button compact-button-danger"
                      onClick={async () => {
                        setDeletingNotificationProfileId(channel.id);
                        const actionTraceId = generateActionTraceId();
                        try {
                          await deleteNotificationChannelRequest(
                            channel.id,
                            actionTraceId,
                          );
                          onNotificationChannelsChanged(
                            notificationChannels.filter(
                              (c) => c.id !== channel.id,
                            ),
                          );
                        } catch (error) {
                          setNotificationFormError(
                            withTraceId(
                              "Could not delete notification channel.",
                              error,
                              actionTraceId,
                            ),
                          );
                        } finally {
                          setDeletingNotificationProfileId(null);
                        }
                      }}
                      disabled={deletingNotificationProfileId === channel.id}
                    >
                      {deletingNotificationProfileId === channel.id
                        ? "Deleting..."
                        : "Delete channel"}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      {editingProfileId !== null ? (
        <ModalDialog
          title="Edit profile dialog"
          onClose={cancelEditingProfile}
          className="profile-dialog-card"
        >
          <ProfileForm
            mode="edit"
            initialDraft={editDraft}
            isSaving={isSavingProfile}
            formError={formError}
            headingId="edit-profile-title"
            sources={sources}
            notificationChannels={notificationChannels}
            onSubmit={handleUpdateProfile}
            onCancel={cancelEditingProfile}
          />
        </ModalDialog>
      ) : null}

      {isCreateDialogOpen ? (
        <ModalDialog
          title="Add profile dialog"
          onClose={() => {
            setIsCreateDialogOpen(false);
            setFormError("");
          }}
          className="profile-dialog-card"
        >
          <ProfileForm
            mode="create"
            initialDraft={createDraft}
            isSaving={isSavingProfile}
            formError={formError}
            headingId="add-profile-title"
            sources={sources}
            notificationChannels={notificationChannels}
            onSubmit={handleCreateProfile}
            onCancel={() => {
              setIsCreateDialogOpen(false);
              setFormError("");
            }}
          />
        </ModalDialog>
      ) : null}

      {editingNotificationProfileId !== null ? (
        <ModalDialog
          title="Edit notification channel dialog"
          onClose={cancelEditNotificationChannel}
        >
          <NotificationChannelForm
            mode="edit"
            initialDraft={editNotificationDraft}
            isSaving={isSavingNotification}
            formError={notificationFormError}
            headingId="edit-notification-channel-title"
            onSubmit={handleUpdateNotificationChannel}
            onCancel={cancelEditNotificationChannel}
          />
        </ModalDialog>
      ) : null}

      {editingSourceId !== null ? (
        <ModalDialog title="Edit source dialog" onClose={cancelEditSource}>
          <SourceForm
            mode="edit"
            initialDraft={editSourceDraft}
            isSaving={isSavingSource}
            formError={sourceFormError}
            headingId="edit-source-title"
            onSubmit={handleUpdateSource}
            onCancel={cancelEditSource}
          />
        </ModalDialog>
      ) : null}

      {isCreateSourceDialogOpen ? (
        <ModalDialog
          title="Add source dialog"
          onClose={() => {
            setIsCreateSourceDialogOpen(false);
            setSourceFormError("");
          }}
        >
          <SourceForm
            mode="create"
            initialDraft={createSourceDraft}
            isSaving={isSavingSource}
            formError={sourceFormError}
            headingId="add-source-title"
            onSubmit={handleCreateSource}
            onCancel={() => {
              setIsCreateSourceDialogOpen(false);
              setSourceFormError("");
            }}
          />
        </ModalDialog>
      ) : null}

      {isCreateNotificationDialogOpen ? (
        <ModalDialog
          title="Add notification channel dialog"
          onClose={() => {
            setIsCreateNotificationDialogOpen(false);
            setNotificationFormError("");
          }}
        >
          <NotificationChannelForm
            mode="create"
            initialDraft={createNotificationDraft}
            isSaving={isSavingNotification}
            formError={notificationFormError}
            headingId="add-notification-channel-title"
            onSubmit={handleCreateNotificationChannel}
            onCancel={() => {
              setIsCreateNotificationDialogOpen(false);
              setNotificationFormError("");
            }}
          />
        </ModalDialog>
      ) : null}
    </section>
  );
}

type ContextPageProps = {
  selectedProfile: SavedProfile | null;
};

function ChatbotPage({ selectedProfile }: ContextPageProps) {
  const navigate = useNavigate();
  const location = useLocation();
  type ChatTurn = {
    id: string;
    message: string;
    agentResponse: string;
    failed?: boolean;
  };

  const [sessionId, setSessionId] = useState(() => crypto.randomUUID());
  const [chatTurnsBySession, setChatTurnsBySession] = useState<
    Record<string, ChatTurn[]>
  >({});
  const [quickReplies, setQuickReplies] = useState<ChatQuickReply[]>([]);
  const [question, setQuestion] = useState("");
  const [pendingQuestion, setPendingQuestion] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [isSendSuccess, setIsSendSuccess] = useState(false);
  const sendSuccessTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const [chatError, setChatError] = useState("");
  const [isSessionInfoOpen, setIsSessionInfoOpen] = useState(false);
  const [isSessionIdCopied, setIsSessionIdCopied] = useState(false);
  const sessionIdCopiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [voiceInputLanguage, setVoiceInputLanguage] =
    useState<ChatbotVoiceLanguage>(() =>
      resolveChatbotVoiceLanguage(
        typeof navigator === "object" ? navigator.language : null,
      ),
    );
  const chatEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);

  const chatTurns = chatTurnsBySession[sessionId] ?? [];

  function appendTurnToSession(targetSessionId: string, nextTurn: ChatTurn) {
    setChatTurnsBySession((current) => {
      const sessionTurns = current[targetSessionId] ?? [];
      return {
        ...current,
        [targetSessionId]: [...sessionTurns, nextTurn],
      };
    });
  }

  function startNewChatSession() {
    setSessionId(crypto.randomUUID());
    setQuestion("");
    setPendingQuestion(null);
    setChatError("");
    setIsSessionInfoOpen(false);
    setSelectedFileName(null);
    setIsSendSuccess(false);
    if (sendSuccessTimerRef.current) {
      clearTimeout(sendSuccessTimerRef.current);
      sendSuccessTimerRef.current = null;
    }
    setIsRecording(false);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  useEffect(() => {
    let cancelled = false;
    const actionTraceId = generateActionTraceId();

    void listChatQuickReplies(actionTraceId)
      .then((response) => {
        if (!cancelled) {
          setQuickReplies(Array.isArray(response) ? response : []);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setQuickReplies([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!selectedProfile) {
      setChatTurnsBySession({});
      setQuestion("");
      setPendingQuestion(null);
      setChatError("");
      return;
    }

    startNewChatSession();
  }, [selectedProfile?.id, location.key]);

  useEffect(() => {
    const SpeechRecognitionCtor =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;

    if (!SpeechRecognitionCtor) {
      recognitionRef.current = null;
      return;
    }

    const recognition = new SpeechRecognitionCtor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = voiceInputLanguage;

    recognition.onresult = (event: any) => {
      let transcript = "";
      for (let index = 0; index < event.results.length; index += 1) {
        transcript += event.results[index][0].transcript;
      }
      setQuestion(transcript.trimStart());
    };

    recognition.onend = () => {
      setIsRecording(false);
    };

    recognition.onerror = () => {
      setIsRecording(false);
    };

    recognitionRef.current = recognition;

    return () => {
      try {
        recognition.stop();
      } catch {
        // Ignore stop failures during unmount.
      }
      recognitionRef.current = null;
    };
  }, [voiceInputLanguage]);

  useEffect(() => {
    if (recognitionRef.current) {
      recognitionRef.current.lang = voiceInputLanguage;
    }
  }, [voiceInputLanguage]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [chatTurns, pendingQuestion, isSending]);

  async function submitQuestion(
    rawQuestion: string,
    providedSessionId?: string,
  ) {
    if (!selectedProfile) {
      return;
    }

    const trimmedQuestion = rawQuestion.trim();

    if (!trimmedQuestion) {
      setChatError("Please enter a question before submitting.");
      return;
    }

    const promptForApi = selectedFileName
      ? `${trimmedQuestion}\n\nAttached file: ${selectedFileName}`
      : trimmedQuestion;
    const requestSessionId =
      typeof providedSessionId === "string" && providedSessionId.trim()
        ? providedSessionId
        : sessionId;

    if (isRecording) {
      try {
        recognitionRef.current?.stop?.();
      } catch {
        // Ignore stop failures while transitioning from record to send.
      }
      setIsRecording(false);
    }

    setIsSending(true);
    setPendingQuestion(promptForApi);
    setQuestion("");
    setChatError("");
    const actionTraceId = generateActionTraceId();

    try {
      const dispatchResult = await dispatchChatbotMessage(
        {
          profileId: selectedProfile.id,
          sessionId: requestSessionId,
          message: promptForApi,
        },
        actionTraceId,
      );

      console.debug("Dispatch result received:", {
        dispatchResult,
        dispatchResultKeys: Object.keys(dispatchResult ?? {}),
      });

      const assistantResponse = findDispatchResponseText(dispatchResult);

      console.debug("Extracted assistant response:", {
        assistantResponse,
        wasFound: assistantResponse !== null,
      });

      if (!assistantResponse) {
        console.error("Dispatch response extraction failed", {
          dispatchResult,
          dispatchResultJSON: JSON.stringify(dispatchResult),
          traceId: actionTraceId,
        });
        throw new Error(
          "Chatbot dispatch did not return a synchronous assistant response.",
        );
      }

      appendTurnToSession(requestSessionId, {
        id: crypto.randomUUID(),
        message: promptForApi,
        agentResponse: assistantResponse,
      });

      setPendingQuestion(null);
      setSelectedFileName(null);
      setIsSendSuccess(true);
      if (sendSuccessTimerRef.current) {
        clearTimeout(sendSuccessTimerRef.current);
      }
      sendSuccessTimerRef.current = setTimeout(() => {
        setIsSendSuccess(false);
      }, 2000);
    } catch (error) {
      const errorMessage = withChatbotFailureDetails(
        "Failed to process your message in the chatbot service.",
        error,
        actionTraceId,
      );
      appendTurnToSession(requestSessionId, {
        id: crypto.randomUUID(),
        message: promptForApi,
        agentResponse: errorMessage,
        failed: true,
      });
      setPendingQuestion(null);
      setChatError(errorMessage);
    } finally {
      setIsSending(false);
    }
  }

  function resetChat() {
    if (isSending) {
      return;
    }

    try {
      recognitionRef.current?.stop?.();
    } catch {
      // Ignore stop failures when resetting the chat.
    }

    startNewChatSession();
  }

  async function copySessionIdToClipboard() {
    try {
      await navigator.clipboard.writeText(sessionId);
      setIsSessionIdCopied(true);
      if (sessionIdCopiedTimerRef.current) {
        clearTimeout(sessionIdCopiedTimerRef.current);
      }
      sessionIdCopiedTimerRef.current = setTimeout(() => {
        setIsSessionIdCopied(false);
      }, 2000);
    } catch {
      setChatError("Could not copy session id to clipboard.");
    }
  }

  function handleAttachClick() {
    fileInputRef.current?.click();
  }

  function handleFileSelection(event: React.ChangeEvent<HTMLInputElement>) {
    const selectedFile = event.target.files?.[0] ?? null;
    setSelectedFileName(selectedFile ? selectedFile.name : null);
  }

  function toggleVoiceInput() {
    if (!recognitionRef.current) {
      setChatError("Voice input is not supported in this browser.");
      return;
    }

    if (isRecording) {
      recognitionRef.current.stop();
      setIsRecording(false);
      return;
    }

    setChatError("");
    recognitionRef.current.start();
    setIsRecording(true);
  }

  async function handleSubmitQuestion(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await submitQuestion(question);
  }

  async function handleQuickReply(prompt: string) {
    const normalizedPrompt = prompt.trim();

    if (!normalizedPrompt || isSending) {
      return;
    }

    const resolvedSessionId =
      typeof sessionId === "string" && sessionId.trim().length > 0
        ? sessionId
        : crypto.randomUUID();

    if (resolvedSessionId !== sessionId) {
      setSessionId(resolvedSessionId);
    }

    await submitQuestion(normalizedPrompt, resolvedSessionId);
  }

  if (!selectedProfile) {
    return (
      <section className="page chat-page" aria-labelledby="chatbot-title">
        <h1 id="chatbot-title">Chatbot</h1>
        <article className="panel empty-state">
          <h3>No profile selected</h3>
          <p>Select a profile from the header to use chatbot context.</p>
        </article>
      </section>
    );
  }

  return (
    <section className="page chat-page" aria-labelledby="chatbot-title">
      <h1 id="chatbot-title">Chatbot</h1>
      <div className="panel chat-panel">
        <div className="chat-assistant-header">
          <div>
            <h2 className="chat-assistant-title">News Assistant</h2>
          </div>
          <div className="chat-header-actions">
            <button
              type="button"
              className="chat-icon-btn"
              onClick={() => {
                setIsSessionInfoOpen(true);
              }}
              title="Session Information"
              aria-label="Session Information"
            >
              <svg
                viewBox="0 0 24 24"
                width="18"
                height="18"
                aria-hidden="true"
              >
                <circle
                  cx="12"
                  cy="12"
                  r="9"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                />
                <path
                  d="M12 10v6"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
                <circle cx="12" cy="7" r="1.2" fill="currentColor" />
              </svg>
            </button>
            <button
              type="button"
              className="chat-icon-btn"
              onClick={() => {
                navigate("/chatbot/history");
              }}
              title="Chat History"
              aria-label="Chat History"
            >
              <svg
                viewBox="0 0 24 24"
                width="18"
                height="18"
                aria-hidden="true"
              >
                <path
                  d="M12 7v5l3 2"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M3 12a9 9 0 1 0 3-6.7"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M3 4v3h3"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
            <button
              type="button"
              className="chat-icon-btn"
              onClick={resetChat}
              disabled={isSending}
              title="New Chat"
              aria-label="New Chat"
            >
              <svg
                viewBox="0 0 24 24"
                width="18"
                height="18"
                aria-hidden="true"
              >
                <path
                  d="M12 5v14M5 12h14"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </div>
        </div>

        {isSessionInfoOpen ? (
          <ModalDialog
            title="Session Information"
            onClose={() => {
              setIsSessionInfoOpen(false);
            }}
            className="chat-session-dialog-card"
          >
            <div className="chat-session-info-row">
              <span className="chat-session-info-value">{sessionId}</span>
              <button
                type="button"
                className={`chat-icon-btn${isSessionIdCopied ? " copied" : ""}`}
                onClick={() => {
                  void copySessionIdToClipboard();
                }}
                title={isSessionIdCopied ? "Copied!" : "Copy Session Id"}
                aria-label={isSessionIdCopied ? "Copied!" : "Copy Session Id"}
              >
                {isSessionIdCopied ? (
                  <svg
                    viewBox="0 0 24 24"
                    width="18"
                    height="18"
                    aria-hidden="true"
                  >
                    <polyline
                      points="20 6 9 17 4 12"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                ) : (
                  <svg
                    viewBox="0 0 24 24"
                    width="18"
                    height="18"
                    aria-hidden="true"
                  >
                    <rect
                      x="9"
                      y="9"
                      width="11"
                      height="11"
                      rx="2"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    />
                    <rect
                      x="4"
                      y="4"
                      width="11"
                      height="11"
                      rx="2"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    />
                  </svg>
                )}
              </button>
            </div>
          </ModalDialog>
        ) : null}

        {chatError ? <p className="global-error">{chatError}</p> : null}

        <div className="chat-thread" aria-label="Chat history" role="log">
          <div className="chat-window">
            {chatTurns.length === 0 && !pendingQuestion ? (
              <article className="chat-bubble chat-bubble-assistant chat-empty-hint chat-welcome-card">
                <p className="chat-text">
                  Welcome. I am your personal news assistant let me know how i
                  can help you.
                </p>
              </article>
            ) : null}
            {chatTurns.map((message) => (
              <div key={message.id} className="chat-turn">
                <article className="chat-bubble chat-bubble-user">
                  <p className="chat-role">You</p>
                  <p className="chat-text">{message.message}</p>
                </article>
                <article className="chat-bubble chat-bubble-assistant">
                  <p className="chat-role">Assistant</p>
                  <p className="chat-text">
                    {message.failed
                      ? `The chatbot agent failed to respond. ${message.agentResponse}`
                      : message.agentResponse}
                  </p>
                </article>
              </div>
            ))}
            {pendingQuestion ? (
              <div className="chat-turn" aria-live="polite">
                <article className="chat-bubble chat-bubble-user">
                  <p className="chat-role">You</p>
                  <p className="chat-text">{pendingQuestion}</p>
                </article>
                <article className="chat-bubble chat-bubble-assistant">
                  <p className="chat-role">Assistant</p>
                  <p className="chat-text">Thinking...</p>
                </article>
              </div>
            ) : null}
            <div ref={chatEndRef} />
          </div>
        </div>

        <form className="chat-form" onSubmit={handleSubmitQuestion}>
          <input
            ref={fileInputRef}
            type="file"
            className="chat-file-input"
            onChange={handleFileSelection}
          />
          {selectedFileName ? (
            <div
              className="chat-attachment-chip"
              role="status"
              aria-live="polite"
            >
              {selectedFileName}
              <button
                type="button"
                className="chat-attachment-remove"
                onClick={() => {
                  setSelectedFileName(null);
                  if (fileInputRef.current) {
                    fileInputRef.current.value = "";
                  }
                }}
                aria-label="Remove attached file"
              >
                x
              </button>
            </div>
          ) : null}
          <textarea
            id="chatbot-question"
            className="chat-question-input"
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
                event.preventDefault();
                handleSubmitQuestion(
                  event as unknown as React.FormEvent<HTMLFormElement>,
                );
              }
            }}
            placeholder={isRecording ? "Listening..." : "Type your message..."}
            maxLength={2000}
            disabled={isSending}
            autoComplete="off"
          />
          <div className="chat-form-actions chat-input-actions">
            <label className="chat-voice-language-control">
              <select
                className="chat-voice-language-select"
                aria-label="Voice input language"
                value={voiceInputLanguage}
                onChange={(event) =>
                  setVoiceInputLanguage(
                    event.target.value as ChatbotVoiceLanguage,
                  )
                }
                disabled={isSending || isRecording}
                title="Language"
              >
                {CHATBOT_VOICE_LANGUAGE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              className="chat-icon-btn"
              onClick={handleAttachClick}
              aria-label="Attach file"
              disabled={isSending}
              title="Attach file"
            >
              <svg
                viewBox="0 0 24 24"
                width="18"
                height="18"
                aria-hidden="true"
              >
                <path
                  d="M8 7v9a4 4 0 1 0 8 0V6a3 3 0 1 0-6 0v9a2 2 0 1 0 4 0V8"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
            <button
              type="button"
              className={`chat-icon-btn ${isRecording ? "is-recording" : ""}`}
              onClick={toggleVoiceInput}
              aria-label={
                isRecording ? "Stop voice input" : "Start voice input"
              }
              disabled={isSending}
              title={isRecording ? "Stop voice input" : "Start voice input"}
            >
              <svg
                viewBox="0 0 24 24"
                width="18"
                height="18"
                aria-hidden="true"
              >
                <path
                  d="M12 3a3 3 0 0 1 3 3v6a3 3 0 1 1-6 0V6a3 3 0 0 1 3-3z"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M19 10a7 7 0 1 1-14 0M12 19v3"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
            <button
              type="submit"
              className={`chat-send-btn${isSendSuccess ? " send-success" : ""}`}
              disabled={isSending || !question.trim()}
              aria-label={isSendSuccess ? "Sent!" : "Send message"}
              title={isSendSuccess ? "Sent!" : "Send"}
            >
              {isSending ? (
                "..."
              ) : isSendSuccess ? (
                <svg
                  viewBox="0 0 24 24"
                  width="18"
                  height="18"
                  aria-hidden="true"
                >
                  <polyline
                    points="20 6 9 17 4 12"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              ) : (
                <svg
                  viewBox="0 0 24 24"
                  width="18"
                  height="18"
                  aria-hidden="true"
                >
                  <path
                    d="M22 2 11 13"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="m22 2-7 20-4-9-9-4 20-7z"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              )}
            </button>
          </div>
        </form>

        <div className="chat-quick-actions" aria-label="Chat quick actions">
          {quickReplies.map((action, index) => (
            <button
              key={`${action.name}-${index}`}
              type="button"
              className="chat-action-btn"
              disabled={isSending}
              onClick={() => {
                void handleQuickReply(action.prompt);
              }}
            >
              {action.name}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

function ChatHistoryPage({ selectedProfile }: ContextPageProps) {
  const defaultHistoryQualityFilter = 10;
  const defaultHistoryTimePeriodFilter: ChatHistoryTimePeriod = "last_day";
  const defaultHistoryRoleFilter: ChatHistoryRoleFilter = "all";
  const [qualityFilter, setQualityFilter] = useState(10);
  const [qualityInputText, setQualityInputText] = useState("10");
  const [timePeriodFilter, setTimePeriodFilter] =
    useState<ChatHistoryTimePeriod>("last_day");
  const [roleFilter, setRoleFilter] = useState<ChatHistoryRoleFilter>("all");
  const [sessionIdFilter, setSessionIdFilter] = useState("");
  const [historyRows, setHistoryRows] = useState<ChatHistoryMessage[]>([]);
  const [historyError, setHistoryError] = useState("");
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  type ChatHistoryFilters = {
    quality: number;
    timePeriod: ChatHistoryTimePeriod;
    role: ChatHistoryRoleFilter;
    sessionId: string;
  };

  async function loadHistory(filters?: ChatHistoryFilters) {
    if (!selectedProfile) {
      return;
    }

    const effectiveFilters = filters ?? {
      quality: qualityFilter,
      timePeriod: timePeriodFilter,
      role: roleFilter,
      sessionId: sessionIdFilter.trim(),
    };

    setIsLoadingHistory(true);
    setHistoryError("");
    const actionTraceId = generateActionTraceId();

    try {
      const rows = await listChatHistoryMessages(
        selectedProfile.id,
        {
          quality: effectiveFilters.quality,
          timePeriod: effectiveFilters.timePeriod,
          role: effectiveFilters.role,
          sessionId: effectiveFilters.sessionId,
        },
        actionTraceId,
      );
      setHistoryRows(rows);
      setCurrentPage(1);
    } catch (error) {
      setHistoryRows([]);
      setHistoryError(
        withTraceId("Could not load chat history.", error, actionTraceId),
      );
    } finally {
      setIsLoadingHistory(false);
    }
  }

  useEffect(() => {
    if (!selectedProfile) {
      setHistoryRows([]);
      setHistoryError("");
      setCurrentPage(1);
      return;
    }

    const timeout = window.setTimeout(() => {
      void loadHistory({
        quality: qualityFilter,
        timePeriod: timePeriodFilter,
        role: roleFilter,
        sessionId: sessionIdFilter.trim(),
      });
    }, 200);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [
    selectedProfile?.id,
    qualityFilter,
    timePeriodFilter,
    roleFilter,
    sessionIdFilter,
  ]);

  function resetFilters() {
    setQualityFilter(defaultHistoryQualityFilter);
    setQualityInputText(String(defaultHistoryQualityFilter));
    setTimePeriodFilter(defaultHistoryTimePeriodFilter);
    setRoleFilter(defaultHistoryRoleFilter);
    setSessionIdFilter("");
    setCurrentPage(1);
  }

  function filterBySession(sessionId: string) {
    resetFilters();
    setSessionIdFilter(sessionId);
    setTimePeriodFilter("all");
    setCurrentPage(1);
  }

  const totalPages = Math.max(1, Math.ceil(historyRows.length / itemsPerPage));
  const paginatedRows = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return historyRows.slice(startIndex, startIndex + itemsPerPage);
  }, [historyRows, currentPage]);

  if (!selectedProfile) {
    return (
      <section className="page" aria-labelledby="chat-history-title">
        <h1 id="chat-history-title">Chat History</h1>
        <article className="panel empty-state">
          <h3>No profile selected</h3>
          <p>Select a profile from the header to inspect chat history.</p>
        </article>
      </section>
    );
  }

  return (
    <section className="page" aria-labelledby="chat-history-title">
      <h1 id="chat-history-title">{selectedProfile.name} - Chat History</h1>

      <div className="chat-history-filter-container">
        <form className="chat-history-filter-row">
          <label
            className="field chat-history-quality-field"
            htmlFor="chat-quality-filter"
          >
            <span>Quality (≤ value)</span>
            <input
              id="chat-quality-filter"
              name="qualityFilter"
              type="number"
              min={1}
              max={10}
              step={1}
              value={qualityInputText}
              onChange={(event) => {
                const raw = event.target.value;
                setQualityInputText(raw);
                const parsed = Number(raw);
                if (Number.isInteger(parsed) && parsed >= 1 && parsed <= 10) {
                  setQualityFilter(parsed);
                }
              }}
              onBlur={() => {
                const parsed = Number(qualityInputText);
                const clamped =
                  Number.isInteger(parsed) && parsed >= 1 && parsed <= 10
                    ? parsed
                    : defaultHistoryQualityFilter;
                setQualityFilter(clamped);
                setQualityInputText(String(clamped));
              }}
              placeholder="1 – 10"
            />
          </label>

          <label
            className="field chat-history-period-field"
            htmlFor="chat-time-filter"
          >
            <span>Time Period</span>
            <select
              id="chat-time-filter"
              name="timePeriodFilter"
              value={timePeriodFilter}
              onChange={(event) => {
                setTimePeriodFilter(
                  event.target.value as ChatHistoryTimePeriod,
                );
              }}
            >
              {CHAT_HISTORY_TIME_PERIOD_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label
            className="field chat-history-role-field"
            htmlFor="chat-role-filter"
          >
            <span>Role</span>
            <select
              id="chat-role-filter"
              name="roleFilter"
              value={roleFilter}
              onChange={(event) => {
                setRoleFilter(event.target.value as ChatHistoryRoleFilter);
              }}
            >
              {CHAT_HISTORY_ROLE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label
            className="field chat-history-session-field"
            htmlFor="chat-session-filter"
          >
            <span>Session Id</span>
            <input
              id="chat-session-filter"
              name="sessionIdFilter"
              type="search"
              value={sessionIdFilter}
              onChange={(event) => {
                setSessionIdFilter(event.target.value);
              }}
              placeholder="Type all or part of a session id"
            />
          </label>

          <div className="chat-history-quality-slider-wrapper">
            <input
              aria-label="Quality slider"
              type="range"
              min={1}
              max={10}
              step={1}
              value={qualityFilter}
              onChange={(event) => {
                const value = Number(event.target.value);
                setQualityFilter(value);
                setQualityInputText(String(value));
              }}
              className="chat-history-quality-slider"
            />
          </div>

          <div className="chat-history-filter-actions">
            <button
              type="button"
              className="primary-button compact-button"
              onClick={() => {
                resetFilters();
              }}
              disabled={isLoadingHistory}
            >
              Reset
            </button>
            <button
              type="button"
              className="refresh-icon-button"
              onClick={() => {
                void loadHistory();
              }}
              disabled={isLoadingHistory}
              title="Refresh chat history"
              aria-label="Refresh chat history"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M23 4v6h-6" />
                <path d="M1 20v-6h6" />
                <path d="M3.51 9a9 9 0 0 1 14.13-3.36L23 10" />
                <path d="M20.49 15a9 9 0 0 1-14.13 3.36L1 14" />
              </svg>
            </button>
          </div>
        </form>
      </div>

      {historyError ? (
        <p className="form-error" role="alert">
          {historyError}
        </p>
      ) : null}

      {historyRows.length === 1000 ? (
        <article className="news-errors-warning" role="alert">
          <strong>Maximum of 1000 rows reached.</strong>
          <p>
            Refine your selection with Quality, Time Period, or Session Id to
            narrow the results.
          </p>
        </article>
      ) : null}

      {isLoadingHistory ? (
        <article className="panel empty-state">
          <h3>Loading chat history</h3>
          <p>Fetching chat records for your current filters.</p>
        </article>
      ) : (
        <>
          <div
            className="chat-history-table"
            role="table"
            aria-label="Chat history entries"
          >
            <div className="chat-history-head" role="row">
              <span role="columnheader">Timestamp</span>
              <span role="columnheader">Session Id</span>
              <span role="columnheader">Role</span>
              <span role="columnheader">Message</span>
              <span role="columnheader">Quality</span>
              <span role="columnheader">Actions</span>
            </div>
            {paginatedRows.map((row) => (
              <div className="chat-history-row" role="row" key={row.id}>
                <span role="cell">{formatNewsTimestamp(row.createdTs)}</span>
                <span role="cell" className="chat-history-session-cell">
                  {row.sessionId}
                </span>
                <span role="cell">{row.role}</span>
                <span role="cell" className="chat-history-message-cell">
                  {row.message}
                </span>
                <span role="cell">{row.quality ?? "-"}</span>
                <span role="cell" className="chat-history-action-cell">
                  <button
                    type="button"
                    className="chat-icon-btn"
                    onClick={() => {
                      void filterBySession(row.sessionId);
                    }}
                    title="Show entire session"
                    aria-label="Show entire session"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      width="18"
                      height="18"
                      aria-hidden="true"
                    >
                      <path
                        d="M4 5h12a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H9l-4 3v-3H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M10 9h4"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M8 12h6"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </button>
                </span>
              </div>
            ))}
          </div>

          {historyRows.length === 0 ? (
            <article className="panel empty-state">
              <h3>No chat history matches the current filters</h3>
              <p>Adjust the filters and run search again.</p>
            </article>
          ) : null}

          {historyRows.length > 0 ? (
            <div className="news-pagination">
              <div className="pagination-info">
                Showing {(currentPage - 1) * itemsPerPage + 1} to{" "}
                {Math.min(currentPage * itemsPerPage, historyRows.length)} of{" "}
                {historyRows.length} chat entries
              </div>
              <div className="pagination-controls">
                <button
                  className="primary-button compact-button"
                  onClick={() =>
                    setCurrentPage((page) => Math.max(1, page - 1))
                  }
                  disabled={currentPage === 1}
                  aria-label="Previous page"
                >
                  Previous
                </button>
                <span className="pagination-status" aria-live="polite">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  className="primary-button compact-button"
                  onClick={() =>
                    setCurrentPage((page) => Math.min(totalPages, page + 1))
                  }
                  disabled={currentPage === totalPages}
                  aria-label="Next page"
                >
                  Next
                </button>
              </div>
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}

function NewsPage({ selectedProfile }: ContextPageProps) {
  const [newsItems, setNewsItems] = useState<SavedNewsItem[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(true);
  const [isLoadingNews, setIsLoadingNews] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [newsError, setNewsError] = useState("");
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date | null>(null);
  const [pendingFavoriteIds, setPendingFavoriteIds] = useState<Set<number>>(
    new Set(),
  );
  const [sortOrder, setSortOrder] = useState<"latest" | "oldest">("latest");
  const [currentPage, setCurrentPage] = useState(1);
  const [profileErrorCount, setProfileErrorCount] = useState(0);
  const [isScraping, setIsScraping] = useState(false);
  const [scrapeSuccess, setScrapeSuccess] = useState(false);
  const scrapeSuccessTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const itemsPerPage = 10;

  async function loadProfileErrorCount() {
    if (!selectedProfile) {
      return;
    }

    try {
      const actionTraceId = generateActionTraceId();
      const currentErrors = await listErrors(
        selectedProfile.id,
        "",
        actionTraceId,
      );
      setProfileErrorCount(currentErrors.length);
    } catch {
      // Keep the News page usable even if error-count refresh fails.
    }
  }

  async function loadNews(options?: { refreshOnly?: boolean }) {
    if (!selectedProfile) {
      return;
    }

    const refreshOnly = options?.refreshOnly ?? false;
    setNewsError("");
    const actionTraceId = generateActionTraceId();

    if (refreshOnly) {
      setIsRefreshing(true);
    } else {
      setIsLoadingNews(true);
    }

    try {
      const loadedNews = await listNews(selectedProfile.id, actionTraceId);
      setNewsItems(loadedNews);
      setLastRefreshedAt(new Date());
      // Keep error warning in sync with each news refresh.
      void loadProfileErrorCount();
    } catch (error) {
      setNewsError(
        withTraceId(
          "Could not load news for the selected profile.",
          error,
          actionTraceId,
        ),
      );
    } finally {
      if (refreshOnly) {
        setIsRefreshing(false);
      } else {
        setIsLoadingNews(false);
      }
    }
  }

  useEffect(() => {
    if (!selectedProfile) {
      setNewsItems([]);
      setLastRefreshedAt(null);
      setNewsError("");
      setProfileErrorCount(0);
      return;
    }

    void loadNews();
    void loadProfileErrorCount();
  }, [selectedProfile?.id]);

  useEffect(() => {
    if (!selectedProfile) {
      return;
    }

    const intervalHandle = window.setInterval(() => {
      void loadProfileErrorCount();
    }, 30_000);

    return () => {
      window.clearInterval(intervalHandle);
    };
  }, [selectedProfile?.id]);

  useEffect(() => {
    if (!selectedProfile || !autoRefreshEnabled) {
      return;
    }

    const intervalHandle = window.setInterval(() => {
      void loadNews({ refreshOnly: true });
    }, NEWS_REFRESH_INTERVAL_MS);

    return () => {
      window.clearInterval(intervalHandle);
    };
  }, [selectedProfile?.id, autoRefreshEnabled]);

  // Reset page when search or filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, showFavoritesOnly]);

  const filteredAndSortedNews = useMemo(() => {
    const queryTerms = searchTerm
      .toLocaleLowerCase()
      .split(/\s+/)
      .map((term) => term.trim())
      .filter(Boolean);

    let filtered = newsItems.filter((item) => {
      if (showFavoritesOnly && !item.favorite) {
        return false;
      }

      if (queryTerms.length === 0) {
        return true;
      }

      const searchableText =
        `${item.title} ${item.summary}`.toLocaleLowerCase();

      return queryTerms.every((term) => searchableText.includes(term));
    });

    // Sort by timestamp
    filtered = [...filtered].sort((a, b) => {
      const timeA = new Date(a.timestamp).getTime();
      const timeB = new Date(b.timestamp).getTime();
      return sortOrder === "latest" ? timeB - timeA : timeA - timeB;
    });

    return filtered;
  }, [newsItems, searchTerm, showFavoritesOnly, sortOrder]);

  // Paginate the filtered and sorted news
  const totalPages = Math.ceil(filteredAndSortedNews.length / itemsPerPage);
  const paginatedNews = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredAndSortedNews.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredAndSortedNews, currentPage]);

  async function handleToggleFavorite(item: SavedNewsItem) {
    if (!selectedProfile) {
      return;
    }

    const actionTraceId = generateActionTraceId();

    setPendingFavoriteIds((current) => {
      const next = new Set(current);
      next.add(item.id);
      return next;
    });

    try {
      const updatedItem = await updateNewsFavorite(
        item.id,
        selectedProfile.id,
        !item.favorite,
        actionTraceId,
      );

      setNewsItems((current) =>
        current.map((entry) =>
          entry.id === updatedItem.id ? updatedItem : entry,
        ),
      );
    } catch (error) {
      setNewsError(
        withTraceId("Could not update favorite state.", error, actionTraceId),
      );
    } finally {
      setPendingFavoriteIds((current) => {
        const next = new Set(current);
        next.delete(item.id);
        return next;
      });
    }
  }

  if (!selectedProfile) {
    return (
      <section className="page" aria-labelledby="news-title">
        <h1 id="news-title">News</h1>
        <article className="panel empty-state">
          <h3>No profile selected</h3>
          <p>Select a profile from the header to show news for that profile.</p>
        </article>
      </section>
    );
  }

  const rolesDisplay =
    (selectedProfile.roles ?? []).length > 0
      ? `${(selectedProfile.roles ?? []).join(", ")}`
      : "None";

  const tagsDisplay =
    (selectedProfile.tags ?? []).length > 0
      ? `${(selectedProfile.tags ?? []).join(", ")}`
      : "None";

  return (
    <section className="page" aria-labelledby="news-title">
      <h1 id="news-title">{selectedProfile.name} - News</h1>
      <div className="news-info-section">
        <div className="news-info-row">
          <span className="news-info-label">Roles:</span>
          <span className="news-info-value">{rolesDisplay}</span>
        </div>
        <div className="news-info-row">
          <span className="news-info-label">Tags:</span>
          <span className="news-info-value">{tagsDisplay}</span>
        </div>
      </div>

      {profileErrorCount > 0 ? (
        <article className="news-errors-warning" role="alert">
          <strong>
            {profileErrorCount} error{profileErrorCount === 1 ? "" : "s"} from
            the latest scrape run
          </strong>
          <p>
            Open the <Link to="/errors">Errors page</Link> to inspect message,
            stack, workflow, node, and payload details.
          </p>
        </article>
      ) : null}

      <div className="news-toolbar">
        <button
          className={`primary-button compact-button news-scrape-btn${scrapeSuccess ? " send-success" : ""}`}
          type="button"
          disabled={isScraping}
          aria-label={scrapeSuccess ? "Scrape complete" : "Scrape news"}
          title={scrapeSuccess ? "Scrape complete" : "Scrape news"}
          onClick={async () => {
            const actionTraceId = generateActionTraceId();
            setIsScraping(true);
            setScrapeSuccess(false);
            try {
              await triggerScrapeWorkflow(selectedProfile.id, actionTraceId);
              setNewsError("");
              void loadProfileErrorCount();
              setScrapeSuccess(true);
              if (scrapeSuccessTimerRef.current) {
                clearTimeout(scrapeSuccessTimerRef.current);
              }
              scrapeSuccessTimerRef.current = setTimeout(() => {
                setScrapeSuccess(false);
              }, 2000);
            } catch (error) {
              setNewsError(
                withTraceId(
                  "Could not trigger scrape workflow.",
                  error,
                  actionTraceId,
                ),
              );
            } finally {
              setIsScraping(false);
            }
          }}
        >
          {isScraping ? (
            "..."
          ) : scrapeSuccess ? (
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
              <polyline
                points="20 6 9 17 4 12"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
              <path
                d="M5 4h10l4 4v12H5z"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M12 9v7M9 13l3 3 3-3"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
        </button>
        <label className="news-toggle" htmlFor="news-auto-refresh">
          <input
            id="news-auto-refresh"
            type="checkbox"
            checked={autoRefreshEnabled}
            onChange={(event) => {
              setAutoRefreshEnabled(event.target.checked);
            }}
          />
          Auto-refresh every 5 minutes
        </label>
        <div className="refresh-status">
          {lastRefreshedAt && (
            <span>Last refresh: {lastRefreshedAt.toLocaleTimeString()}</span>
          )}
          <button
            type="button"
            className="refresh-icon-button"
            onClick={() => {
              void loadNews({ refreshOnly: true });
            }}
            disabled={isRefreshing}
            title="Refresh news"
            aria-label="Refresh news"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="23 4 23 10 17 10" />
              <polyline points="1 20 1 14 7 14" />
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36M20.49 15a9 9 0 0 1-14.85 3.36" />
            </svg>
          </button>
        </div>
      </div>

      <div className="news-filter-row">
        <label className="field news-search-field">
          <span>Search keywords</span>
          <input
            value={searchTerm}
            onChange={(event) => {
              setSearchTerm(event.target.value);
            }}
            type="search"
            placeholder="Filter by title or summary"
            aria-label="Search news by title or summary"
          />
        </label>
        <label className="field news-sort-field">
          <span>Sort by</span>
          <select
            value={sortOrder}
            onChange={(event) => {
              setSortOrder(event.target.value as "latest" | "oldest");
            }}
            aria-label="Sort news by timestamp"
          >
            <option value="latest">Latest first</option>
            <option value="oldest">Oldest first</option>
          </select>
        </label>
        <div className="news-filter-actions">
          <FavoriteStarButton
            isActive={showFavoritesOnly}
            label={
              showFavoritesOnly
                ? "Disable favorites-only filter"
                : "Show favorites only"
            }
            className="news-filter-star"
            onClick={() => {
              setShowFavoritesOnly((current) => !current);
            }}
          />
          <span className="news-filter-label">Favorites only</span>
        </div>
      </div>

      {newsError ? (
        <p className="form-error" role="alert">
          {newsError}
        </p>
      ) : null}

      {isLoadingNews ? (
        <article className="panel empty-state">
          <h3>Loading news</h3>
          <p>Fetching the latest entries for this profile.</p>
        </article>
      ) : (
        <>
          <div
            className="news-table"
            role="table"
            aria-label="Collected AI news"
          >
            <div className="news-head" role="row">
              <span role="columnheader">Title</span>
              <span role="columnheader">Summary</span>
              <span role="columnheader">Origin</span>
              <span role="columnheader">Timestamp</span>
              <span role="columnheader">Link</span>
              <span role="columnheader" className="news-favorite-header">
                <span>Favorite</span>
              </span>
            </div>
            {paginatedNews.map((item) => (
              <div className="news-row" role="row" key={item.id}>
                <span role="cell">{item.title}</span>
                <span role="cell">{item.summary}</span>
                <span role="cell">{item.origin}</span>
                <span role="cell">{formatNewsTimestamp(item.timestamp)}</span>
                <a
                  role="cell"
                  href={item.link}
                  target="_blank"
                  rel="noreferrer"
                >
                  Open article
                </a>
                <span role="cell" className="news-favorite-cell">
                  <FavoriteStarButton
                    className="news-favorite-button"
                    onClick={() => {
                      void handleToggleFavorite(item);
                    }}
                    disabled={pendingFavoriteIds.has(item.id)}
                    isActive={item.favorite}
                    label={
                      item.favorite
                        ? `Unmark favorite: ${item.title}`
                        : `Mark favorite: ${item.title}`
                    }
                  />
                </span>
              </div>
            ))}
          </div>

          {filteredAndSortedNews.length === 0 ? (
            <article className="panel empty-state">
              <h3>No news matches the current filters</h3>
              <p>Try another keyword or turn off the favorites filter.</p>
            </article>
          ) : null}

          {filteredAndSortedNews.length > 0 && (
            <div className="news-pagination">
              <div className="pagination-info">
                Showing {(currentPage - 1) * itemsPerPage + 1} to{" "}
                {Math.min(
                  currentPage * itemsPerPage,
                  filteredAndSortedNews.length,
                )}{" "}
                of {filteredAndSortedNews.length} news items
              </div>
              <div className="pagination-controls">
                <button
                  className="primary-button compact-button"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  aria-label="Previous page"
                >
                  Previous
                </button>
                <span className="pagination-status" aria-live="polite">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  className="primary-button compact-button"
                  onClick={() =>
                    setCurrentPage((p) => Math.min(totalPages, p + 1))
                  }
                  disabled={currentPage === totalPages}
                  aria-label="Next page"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}

function ErrorsPage({ selectedProfile }: ContextPageProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchTerm, setSearchTerm] = useState("");
  const [errors, setErrors] = useState<SavedErrorItem[]>([]);
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(true);
  const [isLoadingErrors, setIsLoadingErrors] = useState(false);
  const [isRefreshingErrors, setIsRefreshingErrors] = useState(false);
  const [errorsLoadError, setErrorsLoadError] = useState("");
  const [selectedErrorId, setSelectedErrorId] = useState<number | null>(null);
  const [detailsModalState, setDetailsModalState] = useState<{
    title: string;
    content: string;
  } | null>(null);
  const [copyFeedback, setCopyFeedback] = useState("");
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date | null>(null);

  async function handleCopyModalContent() {
    if (!detailsModalState) {
      return;
    }

    try {
      await navigator.clipboard.writeText(detailsModalState.content);
      setCopyFeedback("Copied");
      window.setTimeout(() => {
        setCopyFeedback("");
      }, 1200);
    } catch {
      setCopyFeedback("Copy failed");
      window.setTimeout(() => {
        setCopyFeedback("");
      }, 1200);
    }
  }

  async function loadErrors(options?: { refreshOnly?: boolean }) {
    if (!selectedProfile) {
      return;
    }

    const refreshOnly = options?.refreshOnly ?? false;
    setErrorsLoadError("");

    if (refreshOnly) {
      setIsRefreshingErrors(true);
    } else {
      setIsLoadingErrors(true);
    }

    const actionTraceId = generateActionTraceId();

    try {
      const loadedErrors = await listErrors(
        selectedProfile.id,
        "",
        actionTraceId,
      );

      if (loadedErrors.length === 0) {
        navigate("/news", { replace: true });
        return;
      }

      setErrors(loadedErrors);
      setLastRefreshedAt(new Date());
      setSelectedErrorId((current) => {
        if (loadedErrors.length === 0) {
          return null;
        }

        if (
          current !== null &&
          loadedErrors.some((errorItem) => errorItem.id === current)
        ) {
          return current;
        }

        return loadedErrors[0].id;
      });
    } catch (error) {
      setErrorsLoadError(
        withTraceId("Could not load profile errors.", error, actionTraceId),
      );
      setErrors([]);
      setSelectedErrorId(null);
      setLastRefreshedAt(null);
    } finally {
      if (refreshOnly) {
        setIsRefreshingErrors(false);
      } else {
        setIsLoadingErrors(false);
      }
    }
  }

  function handleRefreshErrors() {
    void loadErrors({ refreshOnly: true });
  }

  useEffect(() => {
    if (!selectedProfile) {
      setErrors([]);
      setSelectedErrorId(null);
      setErrorsLoadError("");
      setLastRefreshedAt(null);
      return;
    }

    void loadErrors();
  }, [selectedProfile?.id, location.pathname]);

  useEffect(() => {
    if (!selectedProfile || !autoRefreshEnabled) {
      return;
    }

    const intervalHandle = window.setInterval(() => {
      void loadErrors({ refreshOnly: true });
    }, NEWS_REFRESH_INTERVAL_MS);

    return () => {
      window.clearInterval(intervalHandle);
    };
  }, [selectedProfile?.id, autoRefreshEnabled]);

  const filteredErrors = useMemo(() => {
    const queryTerms = searchTerm
      .toLocaleLowerCase()
      .split(/\s+/)
      .map((term) => term.trim())
      .filter(Boolean);

    let filtered = errors;

    if (queryTerms.length > 0) {
      filtered = errors.filter((errorItem) => {
        const searchableText = [
          errorItem.id,
          errorItem.traceId,
          errorItem.executionId,
          errorItem.errorMessage,
          errorItem.errorDescription ?? "",
          errorItem.errorStack ?? "",
          errorItem.errorHttpCode !== null ? errorItem.errorHttpCode : "",
          errorItem.nodeName,
          errorItem.nodeType,
          errorItem.workflowName,
          errorItem.workflowId,
          JSON.stringify(errorItem.json ?? {}),
          errorItem.createdTs,
          errorItem.updatedTs,
        ]
          .join(" ")
          .toLocaleLowerCase();

        return queryTerms.every((term) => searchableText.includes(term));
      });
    }

    // Sort by created timestamp, latest first
    return [...filtered].sort((a, b) => {
      const timeA = new Date(a.createdTs).getTime();
      const timeB = new Date(b.createdTs).getTime();
      return timeB - timeA;
    });
  }, [errors, searchTerm]);

  useEffect(() => {
    setSelectedErrorId((current) => {
      if (filteredErrors.length === 0) {
        return null;
      }

      if (
        current !== null &&
        filteredErrors.some((errorItem) => errorItem.id === current)
      ) {
        return current;
      }

      return filteredErrors[0].id;
    });
  }, [filteredErrors]);

  const selectedError =
    filteredErrors.find((errorItem) => errorItem.id === selectedErrorId) ??
    null;

  if (!selectedProfile) {
    return (
      <section className="page" aria-labelledby="errors-title">
        <h1 id="errors-title">Errors</h1>
        <article className="panel empty-state">
          <h3>No profile selected</h3>
          <p>Select a profile from the header to inspect scrape errors.</p>
        </article>
      </section>
    );
  }

  return (
    <section className="page errors-page" aria-labelledby="errors-title">
      <h1 id="errors-title">{selectedProfile.name} - Errors</h1>
      <p className="page-intro">
        Errors are displayed in red and represent issues from the latest scrape
        run for the active profile.
      </p>

      <div className="news-toolbar">
        <label className="news-toggle" htmlFor="errors-auto-refresh">
          <input
            id="errors-auto-refresh"
            type="checkbox"
            checked={autoRefreshEnabled}
            onChange={(event) => {
              setAutoRefreshEnabled(event.target.checked);
            }}
          />
          Auto-refresh every 5 minutes
        </label>
        <div className="refresh-status" aria-live="polite">
          <span>
            Last refresh:{" "}
            {lastRefreshedAt
              ? lastRefreshedAt.toLocaleTimeString()
              : "Not refreshed yet"}
          </span>
          <button
            type="button"
            className="refresh-icon-button"
            onClick={handleRefreshErrors}
            disabled={isLoadingErrors || isRefreshingErrors}
            title="Refresh errors"
            aria-label="Refresh errors"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="23 4 23 10 17 10" />
              <polyline points="1 20 1 14 7 14" />
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36M20.49 15a9 9 0 0 1-14.85 3.36" />
            </svg>
          </button>
        </div>
      </div>

      <div className="news-filter-row">
        <label className="field news-search-field">
          <span>Filter errors</span>
          <input
            value={searchTerm}
            onChange={(event) => {
              setSearchTerm(event.target.value);
            }}
            type="search"
            placeholder="Filter on any information"
            aria-label="Filter errors"
          />
        </label>
      </div>

      {errorsLoadError ? (
        <p className="form-error" role="alert">
          {errorsLoadError}
        </p>
      ) : null}

      {isLoadingErrors ? (
        <article className="panel empty-state">
          <h3>Loading errors</h3>
          <p>Fetching errors for this profile.</p>
        </article>
      ) : filteredErrors.length === 0 ? (
        <article className="panel empty-state">
          <h3>No errors found</h3>
          <p>No scrape errors match your current search.</p>
        </article>
      ) : (
        <div className="errors-layout">
          <div className="panel errors-list-panel">
            <h2>Error list</h2>
            <ul className="error-list" aria-label="Profile errors">
              {filteredErrors.map((errorItem) => (
                <li key={errorItem.id}>
                  <button
                    type="button"
                    className={`error-list-button${
                      errorItem.id === selectedErrorId ? " is-selected" : ""
                    }`}
                    onClick={() => {
                      setSelectedErrorId(errorItem.id);
                    }}
                  >
                    <span className="error-http-code">
                      {errorItem.errorHttpCode}
                    </span>
                    <span className="error-list-content">
                      <strong>{errorItem.errorMessage}</strong>
                      <span>
                        {errorItem.nodeName} •{" "}
                        {formatNewsTimestamp(errorItem.createdTs)}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div className="panel errors-detail-panel">
            <h2>Error details</h2>
            {selectedError ? (
              <dl className="error-detail-grid">
                <dt>ID</dt>
                <dd>{selectedError.id}</dd>

                <dt>Trace ID</dt>
                <dd>{selectedError.traceId}</dd>

                <dt>Execution ID</dt>
                <dd>{selectedError.executionId}</dd>

                <dt>Error message</dt>
                <dd>{selectedError.errorMessage}</dd>

                <dt>Error description</dt>
                <dd>{selectedError.errorDescription ?? <em>—</em>}</dd>

                <dt>Error stack</dt>
                <dd>
                  {selectedError.errorStack ? (
                    <button
                      type="button"
                      className="ghost-button compact-button"
                      onClick={() => {
                        setDetailsModalState({
                          title: "Stack Trace",
                          content: selectedError.errorStack!,
                        });
                      }}
                    >
                      Open stack trace
                    </button>
                  ) : (
                    <em>—</em>
                  )}
                </dd>

                <dt>Error HTTP code</dt>
                <dd>{selectedError.errorHttpCode ?? <em>—</em>}</dd>

                <dt>Node name</dt>
                <dd>{selectedError.nodeName}</dd>

                <dt>Node type</dt>
                <dd>{selectedError.nodeType}</dd>

                <dt>Workflow name</dt>
                <dd>{selectedError.workflowName}</dd>

                <dt>Workflow id</dt>
                <dd>{selectedError.workflowId}</dd>

                <dt>JSON</dt>
                <dd>
                  {selectedError.json ? (
                    <button
                      type="button"
                      className="ghost-button compact-button"
                      onClick={() => {
                        setDetailsModalState({
                          title: "JSON",
                          content: JSON.stringify(selectedError.json, null, 2),
                        });
                      }}
                    >
                      Open JSON
                    </button>
                  ) : (
                    <em>—</em>
                  )}
                </dd>

                <dt>Created</dt>
                <dd>{formatNewsTimestamp(selectedError.createdTs)}</dd>

                <dt>Updated</dt>
                <dd>{formatNewsTimestamp(selectedError.updatedTs)}</dd>
              </dl>
            ) : (
              <p>Select an error from the list to view details.</p>
            )}
          </div>
        </div>
      )}

      {detailsModalState ? (
        <ModalDialog
          title={detailsModalState.title}
          onClose={() => {
            setDetailsModalState(null);
            setCopyFeedback("");
          }}
        >
          <div className="errors-details-modal-body">
            <div className="errors-details-modal-actions">
              <button
                type="button"
                className="primary-button compact-button"
                onClick={() => {
                  void handleCopyModalContent();
                }}
              >
                Copy
              </button>
              {copyFeedback ? (
                <span aria-live="polite" className="errors-copy-feedback">
                  {copyFeedback}
                </span>
              ) : null}
            </div>
            <textarea
              className="errors-details-modal-content"
              value={detailsModalState.content}
              readOnly
            />
          </div>
        </ModalDialog>
      ) : null}
    </section>
  );
}

function App() {
  const [activeEnvironment, setActiveEnvironment] =
    useState<ApiEnvironment | null>(() => {
      // On page refresh (same session), restore from localStorage
      // On new tab/window (new session), show dialog (return null)
      if (isSessionEnvironmentSelected()) {
        return getInitialAppEnvironment();
      }
      return null;
    });
  const [pendingEnvironmentSelection, setPendingEnvironmentSelection] =
    useState<ApiEnvironment>(() => getInitialAppEnvironment() ?? "production");
  const [profiles, setProfiles] = useState<SavedProfile[]>([]);
  const [sources, setSources] = useState<Source[]>([]);
  const [profilesError, setProfilesError] = useState("");
  const [isLoadingProfiles, setIsLoadingProfiles] = useState(false);
  const [notificationChannels, setNotificationChannels] = useState<
    NotificationChannel[]
  >([]);
  const [selectedProfileId, setSelectedProfileId] = useState<number | null>(
    null,
  );
  const [selectedProfileErrorCount, setSelectedProfileErrorCount] = useState(0);

  async function loadProfiles() {
    setIsLoadingProfiles(true);
    setProfilesError("");
    const actionTraceId = generateActionTraceId();

    try {
      const loadedProfiles = await listProfiles(actionTraceId);
      setProfiles(loadedProfiles);
    } catch (error) {
      setProfilesError(
        withTraceId(
          "Could not load profiles from the API. Check the backend server and database configuration.",
          error,
          actionTraceId,
        ),
      );
    } finally {
      setIsLoadingProfiles(false);
    }
  }

  async function loadNotificationChannels() {
    const actionTraceId = generateActionTraceId();
    try {
      const loaded = await listNotificationChannels(actionTraceId);
      setNotificationChannels(loaded);
    } catch (error) {
      console.error("Could not load notification channels:", error);
    }
  }

  async function loadSources() {
    const actionTraceId = generateActionTraceId();
    try {
      const loaded = await listSources(actionTraceId);
      setSources(loaded);
    } catch (error) {
      console.error("Could not load sources:", error);
    }
  }

  useEffect(() => {
    if (activeEnvironment === null) {
      return;
    }

    setApiEnvironment(activeEnvironment);
    setChatbotApiEnvironment(activeEnvironment);

    try {
      window.localStorage.setItem(
        APP_ENVIRONMENT_STORAGE_KEY,
        activeEnvironment,
      );
    } catch {
      // Ignore storage failures and keep runtime-only selection.
    }

    // Mark that environment has been selected in this session
    try {
      sessionStorage.setItem(SESSION_ENVIRONMENT_STORAGE_KEY, "true");
    } catch {
      // Ignore storage failures
    }

    void loadProfiles();
    void loadSources();
    void loadNotificationChannels();
  }, [activeEnvironment]);

  useEffect(() => {
    if (profiles.length === 0) {
      setSelectedProfileId(null);
      return;
    }

    setSelectedProfileId((currentId) => {
      if (
        currentId !== null &&
        profiles.some((profile) => profile.id === currentId)
      ) {
        return currentId;
      }

      const aiDemoProfile = profiles.find(
        (profile) => profile.name.trim().toLocaleLowerCase() === "ai demo",
      );

      return aiDemoProfile?.id ?? profiles[0].id;
    });
  }, [profiles]);

  const selectedProfile = useMemo(
    () => profiles.find((profile) => profile.id === selectedProfileId) ?? null,
    [profiles, selectedProfileId],
  );

  useEffect(() => {
    if (!selectedProfile) {
      setSelectedProfileErrorCount(0);
      return;
    }

    // Clear stale count while switching profiles, then load fresh profile-scoped count.
    setSelectedProfileErrorCount(0);

    const activeProfileId = selectedProfile.id;

    let isCancelled = false;

    async function loadErrorCount() {
      const actionTraceId = generateActionTraceId();

      try {
        const currentErrors = await listErrors(
          activeProfileId,
          "",
          actionTraceId,
        );

        if (!isCancelled) {
          setSelectedProfileErrorCount(currentErrors.length);
        }
      } catch {
        if (!isCancelled) {
          setSelectedProfileErrorCount(0);
        }
      }
    }

    void loadErrorCount();

    const intervalHandle = window.setInterval(() => {
      void loadErrorCount();
    }, 30_000);

    return () => {
      isCancelled = true;
      window.clearInterval(intervalHandle);
    };
  }, [selectedProfile?.id]);

  function handleProfilesChanged(nextProfiles: SavedProfile[]) {
    setProfiles(nextProfiles);
  }

  function handleNotificationChannelsChanged(
    nextProfiles: NotificationChannel[],
  ) {
    setNotificationChannels(nextProfiles);
  }

  function handleSourcesChanged(nextSources: Source[]) {
    setSources(nextSources);
  }

  return (
    <div className="app-shell">
      {activeEnvironment === null ? (
        <StartupEnvironmentDialog
          selectedEnvironment={pendingEnvironmentSelection}
          onChangeEnvironment={setPendingEnvironmentSelection}
          onConnect={() => {
            setActiveEnvironment(pendingEnvironmentSelection);
          }}
        />
      ) : null}
      <header className="topbar">
        <Link to="/" className="brand" aria-label="Home">
          <img src={aiNewsLogo} alt="News Scraper logo" />
          <span>News Scraper</span>
          <span
            className={`environment-badge ${
              activeEnvironment === "test"
                ? "environment-badge-test"
                : "environment-badge-production"
            }`}
            aria-label="Selected environment"
          >
            {activeEnvironment === "test" ? "Test" : "Production"}
          </span>
        </Link>
        <div className="topbar-right">
          <ProfileCombobox
            profiles={profiles}
            selectedProfileId={selectedProfileId}
            isLoading={isLoadingProfiles}
            onSelect={setSelectedProfileId}
          />
          <nav aria-label="Main">
            <ul>
              <li>
                <Link to="/profiles">Profiles</Link>
              </li>
              <li>
                <Link to="/chatbot">Chatbot</Link>
              </li>
              <li>
                <Link to="/news">News</Link>
              </li>
              <li>
                {selectedProfileErrorCount > 0 ? (
                  <Link to="/errors" className="error-nav-link">
                    <span>Errors</span>
                    <span className="error-nav-count" aria-label="error count">
                      {selectedProfileErrorCount}
                    </span>
                  </Link>
                ) : null}
              </li>
            </ul>
          </nav>
        </div>
      </header>

      {profilesError ? <p className="global-error">{profilesError}</p> : null}

      <main>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route
            path="/profiles"
            element={
              <ProfilesPage
                profiles={profiles}
                sources={sources}
                isLoadingProfiles={isLoadingProfiles}
                profilesError={profilesError}
                notificationChannels={notificationChannels}
                onProfilesChanged={handleProfilesChanged}
                onSourcesChanged={handleSourcesChanged}
                onReloadProfiles={loadProfiles}
                onNotificationChannelsChanged={
                  handleNotificationChannelsChanged
                }
              />
            }
          />
          <Route
            path="/chatbot"
            element={<ChatbotPage selectedProfile={selectedProfile} />}
          />
          <Route
            path="/chatbot/history"
            element={<ChatHistoryPage selectedProfile={selectedProfile} />}
          />
          <Route
            path="/news"
            element={<NewsPage selectedProfile={selectedProfile} />}
          />
          <Route
            path="/errors"
            element={<ErrorsPage selectedProfile={selectedProfile} />}
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;
