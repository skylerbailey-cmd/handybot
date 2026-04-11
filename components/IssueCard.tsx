import { Link } from "expo-router";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { colors, radius, spacing } from "@/lib/theme";
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
  return (
    <Link href={`/issue/${issue.id}`} asChild>
      <Pressable style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
        <View style={styles.thumb}>
          {issue.coverImageUri ? (
            <Image source={{ uri: issue.coverImageUri }} style={styles.thumbImage} />
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
          <Text style={styles.timestamp}>Updated {timeAgo(issue.updatedAt)}</Text>
        </View>
        <Text style={styles.chevron}>›</Text>
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
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
  timestamp: {
    marginTop: 4,
    fontSize: 11,
    color: colors.textSubtle,
  },
  chevron: {
    fontSize: 28,
    color: colors.textSubtle,
    paddingHorizontal: 4,
  },
});
