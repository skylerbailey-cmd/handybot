export type MessageRole = "user" | "assistant";

export type ProposalStatus = "pending" | "accepted" | "dismissed";

export interface ProposedStep {
  title: string;
  detail: string;
  estimatedMinutes: number;
}

export interface ProposedTool {
  name: string;
  required: boolean;
}

export interface ProposedMaterial {
  name: string;
  quantity: string;
  notes?: string;
}

/**
 * A model-proposed update to the current repair plan. Surfaced in the chat
 * thread as a card the user can Accept or Dismiss. Additive only — existing
 * steps, tools, and materials are never mutated.
 */
export interface PlanProposal {
  rationale: string;
  newSteps?: ProposedStep[];
  newTools?: ProposedTool[];
  newMaterials?: ProposedMaterial[];
  newSafetyNotes?: string[];
  newDifficulty?: Difficulty;
  newTotalMinutes?: number;
  status: ProposalStatus;
}

export interface ChatMessage {
  id: string;
  role: MessageRole;
  text: string;
  /** Local file URI (file://...) to an image saved by expo-file-system. */
  imageUri?: string;
  createdAt: number;
  /** If the assistant suggested a plan change on this turn. */
  proposal?: PlanProposal;
}

export type IssueStatus = "in_progress" | "resolved";

export type Difficulty = "Easy" | "Medium" | "Hard" | "Call a pro";

export interface ToolItem {
  id: string;
  name: string;
  required: boolean;
  /** User's checklist state — do they already have it? */
  have: boolean;
}

export interface MaterialItem {
  id: string;
  name: string;
  quantity: string;
  notes?: string;
  /** User's checklist state — do they already have it? */
  have: boolean;
}

export interface PlanStep {
  id: string;
  title: string;
  detail: string;
  estimatedMinutes?: number;
  completed: boolean;
}

export interface RepairPlan {
  difficulty: Difficulty;
  /** Total estimated time across all steps, in minutes. */
  estimatedMinutes: number;
  tools: ToolItem[];
  materials: MaterialItem[];
  steps: PlanStep[];
  safetyNotes: string[];
}

export interface Issue {
  id: string;
  title: string;
  summary: string;
  status: IssueStatus;
  createdAt: number;
  updatedAt: number;
  /** Local file URI used as the thumbnail on the home screen. */
  coverImageUri?: string;
  plan: RepairPlan;
  messages: ChatMessage[];
}

export interface User {
  id: string;
  name: string;
  createdAt: number;
}

/** Message shape sent to the Claude chat endpoint. */
export interface ChatRequestMessage {
  role: MessageRole;
  text: string;
  imageBase64?: string;
  imageMediaType?: "image/jpeg" | "image/png" | "image/gif" | "image/webp";
}
