import { useCallback, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { loadActivity } from "@/lib/activityLog";
import { colors, radius, spacing } from "@/lib/theme";
import type { ActivityEvent } from "@/lib/types";

function timeAgo(ms: number): string {
  const diff = Date.now() - ms;
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return "yesterday";
  return `${days}d ago`;
}

const ACTION_VERB: Record<string, string> = {
  created: "added",
  updated: "updated",
  completed: "completed",
  deleted: "removed",
};

const ENTITY_ICON: Record<string, string> = {
  issue: "🔧",
  reminder: "⏰",
  home_item: "📦",
  expense: "💰",
};

export default function ActivityFeed() {
  const [events, setEvents] = useState<ActivityEvent[]>([]);

  useFocusEffect(
    useCallback(() => {
      loadActivity({ limit: 5 }).then(setEvents);
    }, [])
  );

  if (events.length === 0) return null;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Recent activity</Text>
      {events.map((ev) => (
        <View key={ev.id} style={styles.row}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {ev.actorName.charAt(0).toUpperCase()}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.eventText} numberOfLines={2}>
              <Text style={styles.actorName}>{ev.actorName}</Text>
              {" "}
              {ACTION_VERB[ev.action] ?? ev.action}
              {" "}
              {ENTITY_ICON[ev.entityType] ?? ""}
              {" "}
              <Text style={styles.entityTitle}>
                &quot;{ev.entityTitle}&quot;
              </Text>
            </Text>
            <Text style={styles.time}>{timeAgo(ev.createdAt)}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  title: {
    fontSize: 13,
    fontWeight: "800",
    color: colors.text,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.brandLight,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontSize: 13,
    fontWeight: "800",
    color: colors.brandDark,
  },
  eventText: {
    fontSize: 13,
    color: colors.textMuted,
    lineHeight: 18,
  },
  actorName: {
    fontWeight: "700",
    color: colors.text,
  },
  entityTitle: {
    fontWeight: "600",
    color: colors.text,
  },
  time: {
    fontSize: 11,
    color: colors.textSubtle,
    marginTop: 1,
  },
});
