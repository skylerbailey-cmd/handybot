import { getSupabase } from "../supabase";
import type { ChatMessage, Issue } from "../types";
import { uploadLocalImageIfNeeded } from "./photosRemote";

/**
 * Push the set of issues for a (user, home) scope to Supabase.
 *
 * `plan` and `messages` are stored as JSONB blobs — we don't normalize
 * them because the UI always reads the whole Issue at once and these
 * nested shapes evolve frequently with Claude's tool-use output.
 *
 * Any local file:// photo URIs are uploaded to the "photos" bucket and
 * swapped for https URLs before the row is written, so other devices can
 * render the images.
 */
export async function pushIssues(args: {
  userId: string;
  homeId: string;
  issues: Issue[];
}): Promise<Issue[]> {
  const { userId, homeId, issues } = args;
  const supabase = getSupabase();
  if (!supabase) return issues;

  // Rewrite cover/chat image URIs with uploaded URLs.
  const normalized: Issue[] = [];
  for (const issue of issues) {
    const remoteCover = await uploadLocalImageIfNeeded(
      issue.coverImageUri,
      userId
    );
    const remoteMessages: ChatMessage[] = [];
    for (const m of issue.messages) {
      const remoteImg = await uploadLocalImageIfNeeded(m.imageUri, userId);
      remoteMessages.push({ ...m, imageUri: remoteImg });
    }
    normalized.push({
      ...issue,
      coverImageUri: remoteCover,
      messages: remoteMessages,
    });
  }

  if (normalized.length > 0) {
    const rows = normalized.map((i) => ({
      id: i.id,
      user_id: userId,
      home_id: homeId,
      title: i.title,
      summary: i.summary,
      status: i.status,
      cover_image_uri: i.coverImageUri ?? null,
      plan: i.plan,
      messages: i.messages,
      created_at: i.createdAt,
      updated_at: i.updatedAt,
    }));
    const { error } = await supabase
      .from("issues")
      .upsert(rows, { onConflict: "id" });
    if (error) {
      console.warn("pushIssues upsert failed", error.message);
      return issues;
    }
  }

  // Delete any cloud rows that are no longer in the local list for this home.
  const ids = normalized.map((i) => i.id);
  const { error: delErr } =
    ids.length > 0
      ? await supabase
          .from("issues")
          .delete()
          .eq("user_id", userId)
          .eq("home_id", homeId)
          .not("id", "in", `(${ids.map((id) => `"${id}"`).join(",")})`)
      : await supabase
          .from("issues")
          .delete()
          .eq("user_id", userId)
          .eq("home_id", homeId);
  if (delErr) console.warn("pushIssues delete failed", delErr.message);

  return normalized;
}

export async function deleteIssueRemote(
  userId: string,
  issueId: string
): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;
  const { error } = await supabase
    .from("issues")
    .delete()
    .eq("user_id", userId)
    .eq("id", issueId);
  if (error) console.warn("deleteIssueRemote failed", error.message);
}
