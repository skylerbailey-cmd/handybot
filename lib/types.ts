export type MessageRole = "user" | "assistant";

export type ProposalStatus = "pending" | "accepted" | "dismissed";

export interface ProposedStep {
  title: string;
  detail: string;
  estimatedMinutes: number;
  /**
   * Optional "don't mess this up" warning: the one specific mistake a
   * novice commonly makes that ruins the repair. Only set for steps
   * where a concrete, high-stakes error is likely.
   */
  criticalWarning?: string;
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
  /**
   * If this message is a question/answer about a specific plan step, the
   * ID of that step. Step-scoped messages are shown inside the step help
   * modal and filtered OUT of the main chat thread so the main tab stays
   * focused on project-level discussion.
   */
  relatedStepId?: string;
}

export type IssueStatus = "in_progress" | "completed" | "verified";

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
  /** Estimated retail price in USD for the quantity needed. */
  estimatedPriceUsd?: number;
  /** User's checklist state — do they already have it? */
  have: boolean;
}

export interface PlanStep {
  id: string;
  title: string;
  detail: string;
  estimatedMinutes?: number;
  /**
   * "Don't mess this up" callout for the one specific mistake that ruins
   * this step — e.g. "Don't overtighten the fitting or you'll crack the
   * pipe" or "Turn off the breaker at the main panel first". Optional;
   * most steps won't have one.
   */
  criticalWarning?: string;
  completed: boolean;
}

export interface SuggestedReminder {
  title: string;
  description: string;
  /** How often the reminder should repeat, in days. */
  frequencyDays: number;
  /** Single-character emoji icon. */
  icon: string;
}

/**
 * Result of Claude verifying a photo of the completed repair. Stored on
 * the plan so the UI can show the latest outcome even after a reload.
 */
export interface VerificationResult {
  verified: boolean;
  feedback: string;
  verifiedAt: number;
  /** Local file URI of the photo the user submitted for verification. */
  photoUri?: string;
  /** Number of fix-up steps appended the last time verification failed. */
  fixStepsAdded?: number;
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
  /**
   * Optional recurring-maintenance reminders Claude thinks make sense
   * as follow-ups to this specific repair. Shown to the user when they
   * complete the repair so a one-time fix can become a lasting habit.
   */
  suggestedReminders?: SuggestedReminder[];
  /** Latest result of verifying a finished-work photo, if any. */
  verificationResult?: VerificationResult;
}

export type ReminderCategory =
  | "hvac"
  | "plumbing"
  | "exterior"
  | "interior"
  | "appliance"
  | "safety"
  | "yard"
  | "general";

export interface MaintenanceTemplate {
  /** Stable id so enabled state can be looked up later. */
  id: string;
  title: string;
  description: string;
  category: ReminderCategory;
  /** Single-character emoji. */
  icon: string;
  /** How often this task should recur, in days. */
  frequencyDays: number;
}

export interface Reminder {
  id: string;
  /** If this reminder was created from a prebuilt template. */
  templateId?: string;
  title: string;
  description?: string;
  icon: string;
  category: ReminderCategory;
  frequencyDays: number;
  /** Unix ms timestamp when this reminder should fire next. */
  nextDue: number;
  /** Whether local notifications are currently scheduled. */
  enabled: boolean;
  /** Identifier returned by expo-notifications when scheduled. */
  notificationId?: string;
  /** Optional link back to the repair this reminder was created from. */
  sourceIssueId?: string;
  /** Room label this reminder is associated with (e.g. "Kitchen"). */
  room?: string;
  createdAt: number;
}

export type ExpenseCategory =
  | "repairs"
  | "maintenance"
  | "supplies"
  | "improvements"
  | "auto_travel"
  | "other";

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
  /** Schedule E expense tracking (landlord tier) */
  expenseAmountUsd?: number;
  expenseCategory?: ExpenseCategory;
  expenseDate?: number;
  receiptPhotoUri?: string;
  receiptVendor?: string;
}

export interface User {
  id: string;
  name: string;
  createdAt: number;
}

// --------------------------------------------------------------------------
// Home inventory
// --------------------------------------------------------------------------

export type ItemCondition = "good" | "fair" | "poor" | "replace_soon";

export type WarrantyStatus = "active" | "expiring" | "expired" | "none";

export interface HomeItemReminder {
  title: string;
  description: string;
  frequencyDays: number;
  icon: string;
}

export interface HomeItem {
  id: string;
  name: string;
  category: string;
  icon: string;
  room: string;
  /** Local file URI of the item photo. */
  photoUri?: string;
  /** Manufacturer / brand name, e.g. "GE", "Rheem", "Carrier". */
  make?: string;
  /** Model name or number, e.g. "Profile PFE28KYNFS". */
  model?: string;
  /** Serial number, if visible. */
  serialNumber?: string;
  /** Year manufactured or installed, e.g. 2019. */
  yearInstalled?: number;
  estimatedAgeYears: number;
  typicalLifespanYears: number;
  condition: ItemCondition;
  conditionNotes: string;
  maintenanceTips: string[];
  /** Claude-generated recurring maintenance reminders specific to this item. */
  suggestedReminders?: HomeItemReminder[];
  /** Unix ms timestamp of when the item was purchased. */
  purchaseDate?: number;
  /** Unix ms timestamp of when the warranty expires. */
  warrantyExpiration?: number;
  /** Warranty provider, e.g. "Samsung", "Home Depot Protection Plan". */
  warrantyProvider?: string;
  /** Free-text notes about what the warranty covers. */
  warrantyCoverageNotes?: string;
  /** Local file URI of a photo of the warranty card or certificate. */
  warrantyPhotoUri?: string;
  /** Local file URI of a photo of the purchase receipt. */
  receiptPhotoUri?: string;
  /** Whether the user has registered this product with the manufacturer. */
  warrantyRegistered?: boolean;
  /** Estimated replacement cost in USD (what it would cost to buy new today). */
  replacementCostUsd?: number;
  createdAt: number;
  updatedAt: number;
}

// --------------------------------------------------------------------------
// Activity log
// --------------------------------------------------------------------------

export interface ActivityEvent {
  id: string;
  homeId: string;
  actorUserId: string;
  actorName: string;
  action: "created" | "updated" | "completed" | "deleted";
  entityType: "issue" | "reminder" | "home_item" | "expense";
  entityId: string;
  entityTitle: string;
  createdAt: number;
}

// --------------------------------------------------------------------------
// Vendor contacts
// --------------------------------------------------------------------------

export type VendorSpecialty =
  | "plumbing"
  | "electrical"
  | "hvac"
  | "roofing"
  | "appliance"
  | "handyman"
  | "landscaping"
  | "other";

export interface Vendor {
  id: string;
  homeId: string;
  name: string;
  phone?: string;
  email?: string;
  specialty: VendorSpecialty;
  hourlyRateUsd?: number;
  notes?: string;
  lastUsedAt?: number;
  createdAt: number;
}

// --------------------------------------------------------------------------
// Ask HandyBot (general Q&A not tied to a specific repair)
// --------------------------------------------------------------------------

export interface AskMessage {
  id: string;
  role: MessageRole;
  text: string;
  imageUri?: string;
  createdAt: number;
}

/** Message shape sent to the Claude chat endpoint. */
export interface ChatRequestMessage {
  role: MessageRole;
  text: string;
  imageBase64?: string;
  imageMediaType?: "image/jpeg" | "image/png" | "image/gif" | "image/webp";
}
