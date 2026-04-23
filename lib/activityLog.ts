import AsyncStorage from "@react-native-async-storage/async-storage";
import { getSession } from "./auth";
import { getActiveHomeId, storagePrefix } from "./homes";
import { generateId, ensureUser } from "./storage";
import { getSupabase } from "./supabase";
import { isAtLeast } from "./tiers";
import type { ActivityEvent } from "./types";

function activityKey(homeId?: string): string {
  if (homeId) return `handybot:${homeId}:activity`;
  return storagePrefix() + "activity";
}

export async function loadActivity(args?: {
  limit?: number;
  homeId?: string;
}): Promise<ActivityEvent[]> {
  const limit = args?.limit ?? 20;
  try {
    const raw = await AsyncStorage.getItem(activityKey(args?.homeId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ActivityEvent[];
    if (!Array.isArray(parsed)) return [];
    return parsed.slice(0, limit);
  } catch {
    return [];
  }
}

async function saveActivity(
  events: ActivityEvent[],
  homeId?: string
): Promise<void> {
  // Keep at most 200 events per home
  const trimmed = events.slice(0, 200);
  await AsyncStorage.setItem(activityKey(homeId), JSON.stringify(trimmed));
}

/**
 * Log an activity event. Fills actor info from the current session.
 * Best-effort — never throws.
 */
export async function logActivity(partial: {
  action: ActivityEvent["action"];
  entityType: ActivityEvent["entityType"];
  entityId: string;
  entityTitle: string;
  homeId?: string;
}): Promise<void> {
  try {
    const user = await ensureUser();
    const homeId = partial.homeId ?? getActiveHomeId();

    const event: ActivityEvent = {
      id: generateId(),
      homeId,
      actorUserId: user.id,
      actorName: user.name,
      action: partial.action,
      entityType: partial.entityType,
      entityId: partial.entityId,
      entityTitle: partial.entityTitle,
      createdAt: Date.now(),
    };

    // Save locally
    const all = await loadActivity({ homeId, limit: 200 });
    all.unshift(event);
    await saveActivity(all, homeId);

    // Mirror to cloud if pro+ tier
    if (isAtLeast("pro")) {
      const supabase = getSupabase();
      if (supabase) {
        const session = await getSession();
        if (session?.user?.id) {
          supabase
            .from("activity_log")
            .insert({
              id: event.id,
              user_id: session.user.id,
              home_id: event.homeId,
              actor_user_id: session.user.id,
              actor_name: event.actorName,
              action: event.action,
              entity_type: event.entityType,
              entity_id: event.entityId,
              entity_title: event.entityTitle,
            })
            .then(() => {}, () => {});
        }
      }
    }
  } catch {
    /* never break the write path */
  }
}
