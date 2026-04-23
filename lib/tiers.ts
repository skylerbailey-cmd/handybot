import AsyncStorage from "@react-native-async-storage/async-storage";
import { getSupabase } from "./supabase";
import { loadHomes } from "./homes";
import { loadReminders } from "./reminders";

// ---------------------------------------------------------------------------
// Tier definitions
// ---------------------------------------------------------------------------

export type TierSlug = "free" | "pro" | "family" | "landlord";

export interface TierLimits {
  aiRepairsPerMonth: number; // 0 = unlimited
  askQuestionsPerMonth: number;
  maxHomes: number; // 0 = unlimited
  maxAiInventoryItems: number; // 0 = unlimited
  maxActiveReminders: number; // 0 = unlimited
  cloudSync: boolean;
  exportImport: boolean;
  aiVerification: boolean;
  warrantyTracker: boolean;
  historyEditable: boolean;
  insurancePdf: boolean;
  familyMembers: number; // 0 = none
  kidsSafeMode: boolean;
  tenantReports: boolean;
  vendorBook: boolean;
  invoiceGenerator: boolean;
  scheduleETracking: boolean;
}

export interface TierInfo {
  slug: TierSlug;
  name: string;
  tagline: string;
  monthlyPrice: number; // USD
  yearlyPrice: number; // USD
  limits: TierLimits;
}

export const TIERS: Record<TierSlug, TierInfo> = {
  free: {
    slug: "free",
    name: "Free",
    tagline: "Get started with the basics",
    monthlyPrice: 0,
    yearlyPrice: 0,
    limits: {
      aiRepairsPerMonth: 3,
      askQuestionsPerMonth: 10,
      maxHomes: 1,
      maxAiInventoryItems: 3,
      maxActiveReminders: 5,
      cloudSync: false,
      exportImport: false,
      aiVerification: false,
      warrantyTracker: false,
      historyEditable: false,
      insurancePdf: false,
      familyMembers: 0,
      kidsSafeMode: false,
      tenantReports: false,
      vendorBook: false,
      invoiceGenerator: false,
      scheduleETracking: false,
    },
  },
  pro: {
    slug: "pro",
    name: "Pro",
    tagline: "Everything you need for your home",
    monthlyPrice: 6.99,
    yearlyPrice: 59.99,
    limits: {
      aiRepairsPerMonth: 0,
      askQuestionsPerMonth: 0,
      maxHomes: 3,
      maxAiInventoryItems: 0,
      maxActiveReminders: 0,
      cloudSync: true,
      exportImport: true,
      aiVerification: true,
      warrantyTracker: true,
      historyEditable: true,
      insurancePdf: true,
      familyMembers: 0,
      kidsSafeMode: false,
      tenantReports: false,
      vendorBook: false,
      invoiceGenerator: false,
      scheduleETracking: false,
    },
  },
  family: {
    slug: "family",
    name: "Family",
    tagline: "Share your home with the whole family",
    monthlyPrice: 12.99,
    yearlyPrice: 109,
    limits: {
      aiRepairsPerMonth: 0,
      askQuestionsPerMonth: 0,
      maxHomes: 5,
      maxAiInventoryItems: 0,
      maxActiveReminders: 0,
      cloudSync: true,
      exportImport: true,
      aiVerification: true,
      warrantyTracker: true,
      historyEditable: true,
      insurancePdf: true,
      familyMembers: 4,
      kidsSafeMode: true,
      tenantReports: false,
      vendorBook: false,
      invoiceGenerator: false,
      scheduleETracking: false,
    },
  },
  landlord: {
    slug: "landlord",
    name: "Landlord",
    tagline: "Manage all your properties in one place",
    monthlyPrice: 19.99,
    yearlyPrice: 179,
    limits: {
      aiRepairsPerMonth: 0,
      askQuestionsPerMonth: 0,
      maxHomes: 0, // unlimited
      maxAiInventoryItems: 0,
      maxActiveReminders: 0,
      cloudSync: true,
      exportImport: true,
      aiVerification: true,
      warrantyTracker: true,
      historyEditable: true,
      insurancePdf: true,
      familyMembers: 4,
      kidsSafeMode: true,
      tenantReports: true,
      vendorBook: true,
      invoiceGenerator: true,
      scheduleETracking: true,
    },
  },
};

// ---------------------------------------------------------------------------
// Current tier state
// ---------------------------------------------------------------------------

const TIER_KEY = "handybot:tier";
const PAYWALL_OPENS_KEY = "handybot:appOpens";

let _currentTier: TierSlug = "free";
let _hydrated = false;
const _listeners = new Set<(tier: TierSlug) => void>();

export async function hydrateTier(): Promise<TierSlug> {
  if (_hydrated) return _currentTier;

  // Try server first
  const supabase = getSupabase();
  if (supabase) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase
          .from("user_entitlements")
          .select("tier")
          .eq("user_id", user.id)
          .maybeSingle();
        if (data?.tier) {
          _currentTier = data.tier as TierSlug;
          await AsyncStorage.setItem(TIER_KEY, _currentTier);
          _hydrated = true;
          return _currentTier;
        }
      }
    } catch {
      // Fall through to local
    }
  }

  // Fallback to local cache
  try {
    const raw = await AsyncStorage.getItem(TIER_KEY);
    if (raw && raw in TIERS) {
      _currentTier = raw as TierSlug;
    }
  } catch {
    // default free
  }
  _hydrated = true;
  return _currentTier;
}

export function getCurrentTier(): TierSlug {
  return _currentTier;
}

export function getTierInfo(tier?: TierSlug): TierInfo {
  return TIERS[tier ?? _currentTier];
}

export function getTierLimits(tier?: TierSlug): TierLimits {
  return TIERS[tier ?? _currentTier].limits;
}

export function isFreeUser(): boolean {
  return _currentTier === "free";
}

export function isAtLeast(required: TierSlug): boolean {
  const order: TierSlug[] = ["free", "pro", "family", "landlord"];
  return order.indexOf(_currentTier) >= order.indexOf(required);
}

/**
 * Update the cached tier. Called by RevenueCat webhook or after purchase.
 */
export async function setTier(tier: TierSlug): Promise<void> {
  _currentTier = tier;
  _hydrated = true;
  await AsyncStorage.setItem(TIER_KEY, tier);
  for (const fn of _listeners) {
    try { fn(tier); } catch { /* ignore */ }
  }
}

export function subscribeTier(fn: (tier: TierSlug) => void): () => void {
  _listeners.add(fn);
  return () => { _listeners.delete(fn); };
}

// ---------------------------------------------------------------------------
// Limit checks
// ---------------------------------------------------------------------------

export async function canAddHome(): Promise<{ allowed: boolean; message: string }> {
  const limits = getTierLimits();
  if (limits.maxHomes === 0) return { allowed: true, message: "" };
  const homes = await loadHomes();
  if (homes.length >= limits.maxHomes) {
    const upgrade = _currentTier === "free" ? "Pro" : _currentTier === "pro" ? "Family" : "Landlord";
    return {
      allowed: false,
      message: `You've reached the ${limits.maxHomes}-home limit on your ${TIERS[_currentTier].name} plan. Upgrade to ${upgrade} for more homes.`,
    };
  }
  return { allowed: true, message: "" };
}

export async function canAddReminder(): Promise<{ allowed: boolean; message: string }> {
  const limits = getTierLimits();
  if (limits.maxActiveReminders === 0) return { allowed: true, message: "" };
  const reminders = await loadReminders();
  const active = reminders.filter((r) => r.enabled).length;
  if (active >= limits.maxActiveReminders) {
    return {
      allowed: false,
      message: `You've reached the ${limits.maxActiveReminders}-reminder limit on your Free plan. Upgrade to Pro for unlimited reminders.`,
    };
  }
  return { allowed: true, message: "" };
}

export function canUseCloudSync(): { allowed: boolean; message: string } {
  if (getTierLimits().cloudSync) return { allowed: true, message: "" };
  return {
    allowed: false,
    message: "Cloud sync is a Pro feature. Upgrade to keep your data backed up across devices.",
  };
}

export function canExportImport(): { allowed: boolean; message: string } {
  if (getTierLimits().exportImport) return { allowed: true, message: "" };
  return {
    allowed: false,
    message: "Home transfer is a Pro feature. Upgrade to export and import your home data.",
  };
}

export function canUseVerification(): { allowed: boolean; message: string } {
  if (getTierLimits().aiVerification) return { allowed: true, message: "" };
  return {
    allowed: false,
    message: "AI repair verification is a Pro feature. Upgrade to get your repairs verified by HandyBot.",
  };
}

export function canUseInsurancePdf(): { allowed: boolean; message: string } {
  if (getTierLimits().insurancePdf) return { allowed: true, message: "" };
  return {
    allowed: false,
    message: "Insurance inventory export is a Pro feature. Upgrade to generate claim-ready PDFs.",
  };
}

export function canUseWarrantyTracker(): { allowed: boolean; message: string } {
  if (getTierLimits().warrantyTracker) return { allowed: true, message: "" };
  return {
    allowed: false,
    message: "The warranty tracker is a Pro feature. Upgrade to track and manage your warranties.",
  };
}

// ---------------------------------------------------------------------------
// Periodic paywall nudge for free users
// ---------------------------------------------------------------------------

/**
 * Track app opens and return true if we should show the paywall.
 * Shows on the 3rd open, then every 5th after that.
 */
export async function shouldShowPaywallNudge(): Promise<boolean> {
  if (_currentTier !== "free") return false;
  try {
    const raw = await AsyncStorage.getItem(PAYWALL_OPENS_KEY);
    const opens = (parseInt(raw ?? "0", 10) || 0) + 1;
    await AsyncStorage.setItem(PAYWALL_OPENS_KEY, String(opens));
    // Show on 3rd open, then every 5th after that
    if (opens === 3) return true;
    if (opens > 3 && (opens - 3) % 5 === 0) return true;
    return false;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Annual savings helpers
// ---------------------------------------------------------------------------

export function annualSavings(tier: TierSlug): number {
  const info = TIERS[tier];
  return Math.round((info.monthlyPrice * 12 - info.yearlyPrice) * 100) / 100;
}

export function annualSavingsPercent(tier: TierSlug): number {
  const info = TIERS[tier];
  const monthly12 = info.monthlyPrice * 12;
  if (monthly12 === 0) return 0;
  return Math.round(((monthly12 - info.yearlyPrice) / monthly12) * 100);
}
