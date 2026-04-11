export type MessageRole = "user" | "assistant";

export interface ChatMessage {
  id: string;
  role: MessageRole;
  text: string;
  /** Local file URI (file://...) to an image saved by expo-file-system. */
  imageUri?: string;
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
  /** Local file URI used as the thumbnail on the home screen. */
  coverImageUri?: string;
  messages: ChatMessage[];
}

export interface User {
  id: string;
  name: string;
  createdAt: number;
}

/** Message shape sent to the Claude client (base64 is read at send time). */
export interface ChatRequestMessage {
  role: MessageRole;
  text: string;
  imageBase64?: string;
  imageMediaType?: "image/jpeg" | "image/png" | "image/gif" | "image/webp";
}
