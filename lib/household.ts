import { getSupabase } from "./supabase";
import { ensureUser, generateId } from "./storage";
import { getSession } from "./auth";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Household {
  id: string;
  name: string;
  ownerId: string;
  createdAt: number;
}

export interface HouseholdMember {
  id: string;
  householdId: string;
  userId: string;
  role: "owner" | "member";
  joinedAt: number;
  /** Populated from the users table when loading members. */
  name?: string;
  email?: string;
}

export interface HouseholdInvite {
  id: string;
  householdId: string;
  email: string;
  invitedBy: string;
  token: string;
  status: "pending" | "accepted" | "expired";
  createdAt: number;
  expiresAt: number;
}

// ---------------------------------------------------------------------------
// Household CRUD
// ---------------------------------------------------------------------------

/**
 * Create a new household. The current user becomes the owner and first member.
 */
export async function createHousehold(name: string): Promise<Household | null> {
  const supabase = getSupabase();
  if (!supabase) return null;

  const user = await ensureUser();
  const household: Household = {
    id: generateId(),
    name,
    ownerId: user.id,
    createdAt: Date.now(),
  };

  const { error } = await supabase.from("households").insert({
    id: household.id,
    name: household.name,
    owner_id: household.ownerId,
    created_at: household.createdAt,
    updated_at: household.createdAt,
  });
  if (error) {
    console.warn("createHousehold failed", error.message);
    return null;
  }

  // Add owner as first member
  await supabase.from("household_members").insert({
    id: generateId(),
    household_id: household.id,
    user_id: user.id,
    role: "owner",
    joined_at: household.createdAt,
  });

  return household;
}

/**
 * Load the household the current user belongs to (if any).
 * A user can belong to at most one household.
 */
export async function loadMyHousehold(): Promise<Household | null> {
  const supabase = getSupabase();
  if (!supabase) return null;

  const user = await ensureUser();
  const { data, error } = await supabase
    .from("household_members")
    .select("household_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;

  const { data: hh, error: hhErr } = await supabase
    .from("households")
    .select("*")
    .eq("id", data.household_id)
    .maybeSingle();

  if (hhErr || !hh) return null;

  return {
    id: hh.id,
    name: hh.name,
    ownerId: hh.owner_id,
    createdAt: hh.created_at,
  };
}

/**
 * Update the household name.
 */
export async function updateHouseholdName(
  householdId: string,
  name: string
): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase) return false;

  const { error } = await supabase
    .from("households")
    .update({ name, updated_at: Date.now() })
    .eq("id", householdId);
  return !error;
}

/**
 * Delete a household entirely. Only the owner should call this.
 * Cascades to members and invites via foreign keys.
 */
export async function deleteHousehold(
  householdId: string
): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase) return false;

  // Unlink any homes from this household first
  await supabase
    .from("homes")
    .update({ household_id: null })
    .eq("household_id", householdId);

  const { error } = await supabase
    .from("households")
    .delete()
    .eq("id", householdId);
  return !error;
}

// ---------------------------------------------------------------------------
// Members
// ---------------------------------------------------------------------------

/**
 * Load all members of a household with their user info.
 */
export async function loadHouseholdMembers(
  householdId: string
): Promise<HouseholdMember[]> {
  const supabase = getSupabase();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("household_members")
    .select("*, users(name)")
    .eq("household_id", householdId)
    .order("joined_at", { ascending: true });

  if (error || !data) return [];

  return data.map((row: Record<string, unknown>) => ({
    id: row.id as string,
    householdId: row.household_id as string,
    userId: row.user_id as string,
    role: row.role as "owner" | "member",
    joinedAt: row.joined_at as number,
    name: (row.users as Record<string, unknown>)?.name as string | undefined,
  }));
}

/**
 * Remove a member from the household. Cannot remove the owner.
 */
export async function removeMember(
  householdId: string,
  userId: string
): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase) return false;

  const { error } = await supabase
    .from("household_members")
    .delete()
    .eq("household_id", householdId)
    .eq("user_id", userId);
  return !error;
}

/**
 * Leave a household. If the owner leaves, the household is deleted.
 */
export async function leaveHousehold(householdId: string): Promise<boolean> {
  const user = await ensureUser();
  const household = await loadMyHousehold();

  if (!household) return false;

  if (household.ownerId === user.id) {
    return deleteHousehold(householdId);
  }

  return removeMember(householdId, user.id);
}

// ---------------------------------------------------------------------------
// Invites
// ---------------------------------------------------------------------------

/**
 * Generate a random invite token.
 */
function generateToken(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let token = "";
  for (let i = 0; i < 32; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}

/**
 * Create an invite for someone to join the household.
 */
export async function createInvite(
  householdId: string,
  email: string
): Promise<HouseholdInvite | null> {
  const supabase = getSupabase();
  if (!supabase) return null;

  const user = await ensureUser();
  const sevenDays = 7 * 24 * 60 * 60 * 1000;

  const invite: HouseholdInvite = {
    id: generateId(),
    householdId,
    email: email.toLowerCase().trim(),
    invitedBy: user.id,
    token: generateToken(),
    status: "pending",
    createdAt: Date.now(),
    expiresAt: Date.now() + sevenDays,
  };

  const { error } = await supabase.from("household_invites").insert({
    id: invite.id,
    household_id: invite.householdId,
    email: invite.email,
    invited_by: invite.invitedBy,
    token: invite.token,
    status: invite.status,
    created_at: invite.createdAt,
    expires_at: invite.expiresAt,
  });

  if (error) {
    console.warn("createInvite failed", error.message);
    return null;
  }

  return invite;
}

/**
 * Load pending invites for a household (owner view).
 */
export async function loadPendingInvites(
  householdId: string
): Promise<HouseholdInvite[]> {
  const supabase = getSupabase();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("household_invites")
    .select("*")
    .eq("household_id", householdId)
    .eq("status", "pending")
    .gt("expires_at", Date.now())
    .order("created_at", { ascending: false });

  if (error || !data) return [];

  return data.map((row: Record<string, unknown>) => ({
    id: row.id as string,
    householdId: row.household_id as string,
    email: row.email as string,
    invitedBy: row.invited_by as string,
    token: row.token as string,
    status: row.status as "pending",
    createdAt: row.created_at as number,
    expiresAt: row.expires_at as number,
  }));
}

/**
 * Cancel a pending invite.
 */
export async function cancelInvite(inviteId: string): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase) return false;

  const { error } = await supabase
    .from("household_invites")
    .delete()
    .eq("id", inviteId);
  return !error;
}

/**
 * Check if the currently signed-in user has any pending household invites
 * (matched by their auth email).
 */
export async function checkMyInvites(): Promise<HouseholdInvite[]> {
  const supabase = getSupabase();
  if (!supabase) return [];

  const session = await getSession();
  if (!session?.user?.email) return [];

  const { data, error } = await supabase
    .from("household_invites")
    .select("*")
    .eq("email", session.user.email.toLowerCase())
    .eq("status", "pending")
    .gt("expires_at", Date.now());

  if (error || !data) return [];

  return data.map((row: Record<string, unknown>) => ({
    id: row.id as string,
    householdId: row.household_id as string,
    email: row.email as string,
    invitedBy: row.invited_by as string,
    token: row.token as string,
    status: row.status as "pending",
    createdAt: row.created_at as number,
    expiresAt: row.expires_at as number,
  }));
}

/**
 * Accept a household invite via server-side RPC. The RPC validates the
 * invite, checks email match and expiry, and inserts the member row with
 * SECURITY DEFINER privileges (bypassing the owner-only hm_insert policy).
 */
export async function acceptInvite(inviteId: string): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase) return false;

  const { data, error } = await supabase.rpc("accept_household_invite", {
    p_invite_id: inviteId,
  });

  if (error) {
    console.warn("acceptInvite RPC failed", error.message);
    return false;
  }

  return data === true;
}

// ---------------------------------------------------------------------------
// Home sharing
// ---------------------------------------------------------------------------

/**
 * Share a home with the household (sets household_id on the home row).
 */
export async function shareHomeWithHousehold(
  homeId: string,
  householdId: string
): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase) return false;

  const { error } = await supabase
    .from("homes")
    .update({ household_id: householdId })
    .eq("id", homeId);
  return !error;
}

/**
 * Unshare a home from the household (removes household_id).
 */
export async function unshareHome(homeId: string): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase) return false;

  const { error } = await supabase
    .from("homes")
    .update({ household_id: null })
    .eq("id", homeId);
  return !error;
}

/**
 * Load homes shared with the current user via their household.
 * Returns home IDs that belong to OTHER household members.
 */
export async function loadSharedHomes(): Promise<
  Array<{ id: string; name: string; address: string; icon: string; createdAt: number; ownerName?: string }>
> {
  const supabase = getSupabase();
  if (!supabase) return [];

  const household = await loadMyHousehold();
  if (!household) return [];

  const user = await ensureUser();

  // Get all homes linked to this household that aren't owned by the current user
  const { data, error } = await supabase
    .from("homes")
    .select("*, users(name)")
    .eq("household_id", household.id)
    .neq("user_id", user.id);

  if (error || !data) return [];

  return data.map((row: Record<string, unknown>) => ({
    id: row.id as string,
    name: (row.name as string) ?? "Home",
    address: (row.address as string) ?? "",
    icon: (row.icon as string) ?? "🏠",
    createdAt: (row.created_at as number) ?? Date.now(),
    ownerName: (row.users as Record<string, unknown>)?.name as string | undefined,
  }));
}
