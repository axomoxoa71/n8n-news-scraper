export type ChatMessage = {
  id: number;
  profileId: number;
  sessionId: string;
  message: string;
  agentResponse: string | null;
  n8nExecutionId: string | null;
  traceId: string;
  status: "pending" | "processing" | "completed" | "failed";
  createdTs: string;
  updatedTs: string;
};

export type ChatMessageInput = {
  profileId: number;
  sessionId: string;
  message: string;
};

export type ChatDispatchResponse = {
  sessionId: string;
  message: string;
  agentResponse: string;
  executionId: string | null;
  status: "completed";
};

export type ChatQuickReply = {
  name: string;
  prompt: string;
};

export type SavedChatMessage = ChatMessage;

export type ChatHistoryMessage = {
  id: number;
  profileId: number | null;
  sessionId: string;
  message: string;
  role: "user" | "assistant";
  quality: number | null;
  createdTs: string;
};
