import { Stack, useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { loadActivity } from "@/lib/activityLog";
import { isAtLeast, getTierLimits } from "@/lib/tiers";
import { showPaywallAlert } from "@/lib/showPaywall";
import { colors, radius, spacing } from "@/lib/theme";
import type { ActivityEvent } from "@/lib/types";

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

function timeAgo(ms: number): string {
  const diff = Date.now() - ms;
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return "yesterday";
  if (days < 30) return `${days}d ago`;
  return new Date(ms).toLocaleDateString();
}

export default function ActivityScreen() {
  const router = useRouter();
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [filterActor, setFilterActor] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      loadActivity({ limit: 200 }).then(setEvents);
    }, [])
  );

  if (!isAtLeast("family") || !getTierLimits().familyMembers) {
    return (
      <>
        <Stack.Screen options={{ title: "Activity Log" }} />
        <View style={styles.gateContainer}>
          <Text style={styles.gateIcon}>📋</Text>
          <Text style={styles.gateTitle}>
            Activity log is a Family feature
          </Text>
          <Text style={styles.gateBody}>
            See who did what across your shared household.
          </Text>
          <Pressable
            onPress={() =>
              showPaywallAlert(
                "Activity log is only available on the Family plan."
              )
            }
            style={styles.gateBtn}
          >
            <Text style={styles.gateBtnText}>See plans</Text>
          </Pressable>
        </View>
      </>
    );
  }

  // Get unique actors for filter
  const actors = [...new Set(events.map((e) => e.actorName))];
  const filtered = filterActor
    ? events.filter((e) => e.actorName === filterActor)
    : events;

  return (
    <>
      <Stack.Screen options={{ title: "Activity Log" }} />
      {actors.length > 1 && (
        <View style={styles.filterRow}>
          <Pressable
            onPress={() => setFilterActor(null)}
            style={[
              styles.filterChip,
              !filterActor && styles.filterChipActive,
            ]}
          >
            <Text
              style={[
                styles.filterChipText,
                !filterActor && styles.filterChipTextActive,
              ]}
            >
              All
            </Text>
          </Pressable>
          {actors.map((name) => (
            <Pressable
              key={name}
              onPress={() => setFilterActor(name)}
              style={[
                styles.filterChip,
                filterActor === name && styles.filterChipActive,
              ]}
            >
              <Text
                style={[
                  styles.filterChipText,
                  filterActor === name && styles.filterChipTextActive,
                ]}
              >
                {name}
              </Text>
            </Pressable>
          ))}
        </View>
      )}
      <FlatList
        data={filtered}
        keyExtractor={(e) => e.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No activity yet.</Text>
          </View>
        }
        renderItem={({ item: ev }) => (
          <Pressable
            onPress={() => {
              if (ev.entityType === "issue") {
                router.push({
                  pathname: "/(tabs)/(repair)/issue/[id]",
                  params: { id: ev.entityId },
                });
              }
            }}
            style={styles.row}
          >
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
          </Pressable>
        )}
      />
    </>
  );
}

const styles = StyleSheet.create({
  gateContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
    gap: spacing.md,
  },
  gateIcon: { fontSize: 48 },
  gateTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: colors.text,
    textAlign: "center",
  },
  gateBody: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: "center",
    maxWidth: 300,
  },
  gateBtn: {
    backgroundColor: colors.brand,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    marginTop: spacing.sm,
  },
  gateBtnText: { color: "#fff", fontSize: 15, fontWeight: "800" },
  filterRow: {
    flexDirection: "row",
    gap: spacing.xs,
    padding: spacing.md,
    paddingBottom: 0,
    flexWrap: "wrap",
  },
  filterChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  filterChipActive: {
    backgroundColor: colors.brand,
    borderColor: colors.brand,
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.textMuted,
  },
  filterChipTextActive: { color: "#fff" },
  list: {
    padding: spacing.md,
    paddingBottom: spacing.xxl,
  },
  empty: {
    padding: spacing.xl,
    alignItems: "center",
  },
  emptyText: {
    fontSize: 13,
    color: colors.textMuted,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.sm + 2,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.brandLight,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontSize: 14,
    fontWeight: "800",
    color: colors.brandDark,
  },
  eventText: {
    fontSize: 14,
    color: colors.textMuted,
    lineHeight: 19,
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
