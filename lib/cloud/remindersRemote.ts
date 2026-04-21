import { getSupabase } from "../supabase";
import type { Reminder } from "../types";

export async function pushReminders(args: {
  userId: string;
  homeId: string;
  reminders: Reminder[];
}): Promise<void> {
  const { userId, homeId, reminders } = args;
  const supabase = getSupabase();
  if (!supabase) return;

  if (reminders.length > 0) {
    const rows = reminders.map((r) => ({
      id: r.id,
      user_id: userId,
      home_id: homeId,
      template_id: r.templateId ?? null,
      title: r.title,
      description: r.description ?? null,
      icon: r.icon,
      category: r.category,
      frequency_days: r.frequencyDays,
      next_due: r.nextDue,
      enabled: r.enabled,
      notification_id: r.notificationId ?? null,
      source_issue_id: r.sourceIssueId ?? null,
      room: r.room ?? null,
      created_at: r.createdAt,
    }));
    const { error } = await supabase
      .from("reminders")
      .upsert(rows, { onConflict: "id" });
    if (error) {
      console.warn("pushReminders upsert failed", error.message);
      return;
    }
  }

  const ids = reminders.map((r) => r.id);
  const { error: delErr } =
    ids.length > 0
      ? await supabase
          .from("reminders")
          .delete()
          .eq("user_id", userId)
          .eq("home_id", homeId)
          .not("id", "in", `(${ids.map((id) => `"${id}"`).join(",")})`)
      : await supabase
          .from("reminders")
          .delete()
          .eq("user_id", userId)
          .eq("home_id", homeId);
  if (delErr) console.warn("pushReminders delete failed", delErr.message);
}

export async function deleteReminderRemote(
  userId: string,
  reminderId: string
): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;
  const { error } = await supabase
    .from("reminders")
    .delete()
    .eq("user_id", userId)
    .eq("id", reminderId);
  if (error) console.warn("deleteReminderRemote failed", error.message);
}
