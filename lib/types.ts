export type MessageRole = "user" | "assistant";

export interface ChatMessage {
  id: string;
  role: MessageRole;
  text: string;
  /** Data URL of an image the user attached to this message, if any. */
  imageUrl?: string;
  createdAt: number;
}

export type IssueStatus = "in_progress" | "resolved";

export interface Issue {
  id: string;
  title: string;
  summary: string;
  status: IssueStatus;
  createdAt: number;
  updatedAt: number;
  /** Stored as a data URL for simple local-only persistence. */
  coverImage?: string;
  messages: ChatMessage[];
}

export interface User {
  id: string;
  name: string;
  createdAt: number;
}

/** Shape sent to the /api/chat route. */
export interface ChatRequestMessage {
  role: MessageRole;
  text: string;
  imageDataUrl?: string;
}
