import { Link } from "expo-router";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import DifficultyBadge from "./DifficultyBadge";
import { colors, formatDuration, radius, spacing } from "@/lib/theme";
import type { Issue } from "@/lib/types";

function timeAgo(ts: number) {
  const diffMs = Date.now() - ts;
  const sec = Math.floor(diffMs / 1000);
  if (sec < 60) return "just now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d ago`;
  return new Date(ts).toLocaleDateString();
}

export default function IssueCard({ issue }: { issue: Issue }) {
  const stepsDone = issue.plan.steps.filter((s) => s.completed).length;
  const stepsTotal = issue.plan.steps.length;
  const progressPct =
    stepsTotal === 0 ? 0 : Math.round((stepsDone / stepsTotal) * 100);

  return (
    <Link href={`/issue/${issue.id}`} asChild>
      <Pressable
        style={({ pressed }) => [styles.card, pressed && styles.pressed]}
      >
        <View style={styles.thumb}>
          {issue.coverImageUri ? (
            <Image
              source={{ uri: issue.coverImageUri }}
              style={styles.thumbImage}
            />
          ) : (
            <View style={styles.thumbPlaceholder}>
              <Text style={styles.thumbPlaceholderText}>📷</Text>
            </View>
          )}
        </View>
        <View style={styles.body}>
          <View style={styles.titleRow}>
            <Text style={styles.title} numberOfLines={1}>
              {issue.title || "Untitled repair"}
            </Text>
            {issue.status === "resolved" && (
              <View style={styles.resolvedBadge}>
                <Text style={styles.resolvedBadgeText}>Resolved</Text>
              </View>
            )}
          </View>
          <Text style={styles.summary} numberOfLines={2}>
            {issue.summary || "Tap to continue the conversation."}
          </Text>

          <View style={styles.metaRow}>
            <DifficultyBadge difficulty={issue.plan.difficulty} />
            <Text style={styles.metaDot}>·</Text>
            <Text style={styles.metaText}>
              {formatDuration(issue.plan.estimatedMinutes)}
            </Text>
            {stepsTotal > 0 && (
              <>
                <Text style={styles.metaDot}>·</Text>
                <Text style={styles.metaText}>
                  {stepsDone}/{stepsTotal}
                </Text>
              </>
            )}
          </View>

          <View style={styles.progressTrack}>
            <View
              style={[styles.progressFill, { width: `${progressPct}%` }]}
            />
          </View>

          <Text style={styles.timestamp}>Updated {timeAgo(issue.updatedAt)}</Text>
        </View>
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.995 }],
  },
  thumb: {
    width: 72,
    height: 72,
    borderRadius: radius.md,
    overflow: "hidden",
    backgroundColor: "#f5f5f4",
  },
  thumbImage: {
    width: "100%",
    height: "100%",
  },
  thumbPlaceholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  thumbPlaceholderText: {
    fontSize: 28,
  },
  body: {
    flex: 1,
    minWidth: 0,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  title: {
    flex: 1,
    fontSize: 16,
    fontWeight: "600",
    color: colors.text,
  },
  resolvedBadge: {
    backgroundColor: colors.successBg,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  resolvedBadgeText: {
    color: colors.success,
    fontSize: 11,
    fontWeight: "600",
  },
  summary: {
    marginTop: 2,
    fontSize: 13,
    color: colors.textMuted,
    lineHeight: 18,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs + 2,
    marginTop: spacing.sm,
  },
  metaText: {
    fontSize: 12,
    color: colors.textMuted,
    fontWeight: "600",
  },
  metaDot: {
    fontSize: 12,
    color: colors.textSubtle,
  },
  progressTrack: {
    height: 4,
    borderRadius: radius.pill,
    backgroundColor: "#f5f5f4",
    overflow: "hidden",
    marginTop: spacing.sm,
  },
  progressFill: {
    height: "100%",
    backgroundColor: colors.brand,
  },
  timestamp: {
    marginTop: 4,
    fontSize: 11,
    color: colors.textSubtle,
  },
});
