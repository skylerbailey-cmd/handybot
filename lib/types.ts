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
  newTotalSavingsUsd?: number;
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

export type RiskSeverity = "low" | "medium" | "high";

export type RiskCategory =
  | "electrical"
  | "plumbing"
  | "gas"
  | "structural"
  | "height"
  | "chemical"
  | "fire"
  | "sharps"
  | "general";

/**
 * Specific hazard assessment for the repair. Present when the work
 * involves real physical risk (live wiring, pressurized water, gas,
 * working at height, etc.). The user is still allowed to proceed — this
 * is advisory, not blocking.
 */
export interface RiskAssessment {
  severity: RiskSeverity;
  category: RiskCategory;
  /** Short label, e.g. "Live 120V wiring". */
  headline: string;
  /** 1-2 plain-language sentences explaining the specific hazard. */
  rationale: string;
  /** When true, the UI displays a "Call a pro" recommendation prominently. */
  callAProRecommended: boolean;
}

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
  /**
   * Estimated labor cost in USD of hiring a licensed professional
   * (handyman, plumber, electrician, etc.) to do this repair. Does NOT
   * include materials, since the user is buying those. Used throughout
   * the UI to show how much the user saves by doing it themselves.
   */
  estimatedSavingsUsd: number;
  tools: ToolItem[];
  materials: MaterialItem[];
  steps: PlanStep[];
  safetyNotes: string[];
  /** Optional hazard assessment. Only set for repairs with real risk. */
  risk?: RiskAssessment;
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
