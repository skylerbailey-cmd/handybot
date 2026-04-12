import { Link, Stack, useFocusEffect, useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
  Pressable,
  RefreshControl,
  SectionList,
  StyleSheet,
  Text,
  View,
} from "react-native";
import IssueCard from "@/components/IssueCard";
import PrimaryButton from "@/components/PrimaryButton";
import UpcomingRemindersCard from "@/components/UpcomingRemindersCard";
import { loadReminders } from "@/lib/reminders";
import { ensureUser, loadIssues } from "@/lib/storage";
import { colors, formatMoney, radius, spacing } from "@/lib/theme";
import type { Issue, Reminder } from "@/lib/types";

type IssueSection = {
  key: "ongoing" | "completed";
  title: string;
  data: Issue[];
};

export default function HomeScreen() {
  const router = useRouter();
  const [issues, setIssues] = useState<Issue[] | null>(null);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const refresh = useCallback(async () => {
    const [, loadedIssues, loadedReminders] = await Promise.all([
      ensureUser(),
      loadIssues(),
      loadReminders(),
    ]);
    setIssues(loadedIssues);
    setReminders(loadedReminders);
  }, []);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  async function onPullToRefresh() {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }

  const sections = useMemo<IssueSection[]>(() => {
    if (!issues) return [];
    const ongoing = issues.filter((i) => i.status === "in_progress");
    const completed = issues.filter((i) => i.status === "completed");
    const verified = issues.filter((i) => i.status === "verified");
    const result: IssueSection[] = [];
    if (ongoing.length > 0) {
      result.push({ key: "ongoing", title: "Ongoing", data: ongoing });
    }
    if (completed.length > 0) {
      result.push({ key: "completed", title: "Completed", data: completed });
    }
    if (verified.length > 0) {
      result.push({ key: "verified", title: "Verified", data: verified });
    }
    return result;
  }, [issues]);

  const totalSaved = useMemo(() => {
    if (!issues) return 0;
    return issues
      .filter(
        (i) => i.status === "completed" || i.status === "verified"
      )
      .reduce((sum, i) => sum + (i.plan.estimatedSavingsUsd ?? 0), 0);
  }, [issues]);

  const upcomingReminders = useMemo(() => {
    return reminders
      .filter((r) => r.enabled)
      .sort((a, b) => a.nextDue - b.nextDue)
      .slice(0, 3);
  }, [reminders]);

  const hasAnyIssues = !!issues && issues.length > 0;

  return (
    <>
      <Stack.Screen
        options={{
          headerRight: () => (
            <View style={styles.headerActions}>
              <Link href="/reminders" asChild>
                <Pressable hitSlop={10} style={styles.headerBtn}>
                  <Text style={styles.headerBtnText}>🔔</Text>
                </Pressable>
              </Link>
              <Link href="/settings" asChild>
                <Pressable hitSlop={10} style={styles.headerBtn}>
                  <Text style={styles.headerBtnText}>⚙︎</Text>
                </Pressable>
              </Link>
            </View>
          ),
        }}
      />
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <IssueCard issue={item} />}
        renderSectionHeader={({ section }) => (
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <View style={styles.sectionMeta}>
              {(section.key === "completed" || section.key === "verified") &&
              totalSaved > 0 && (
                <Text style={styles.savedTotal}>
                  ✓ Saved {formatMoney(totalSaved)} total
                </Text>
              )}
              <Text style={styles.sectionCount}>
                {section.data.length}
              </Text>
            </View>
          </View>
        )}
        renderSectionFooter={() => <View style={{ height: spacing.sm }} />}
        SectionSeparatorComponent={() => <View style={{ height: spacing.xs }} />}
        ItemSeparatorComponent={() => (
          <View style={{ height: spacing.sm + 4 }} />
        )}
        stickySectionHeadersEnabled={false}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={styles.heroCard}>
              <Text style={styles.heroTitle}>What needs fixing today?</Text>
              <Text style={styles.heroSub}>
                Snap a photo of something broken in your home and I&apos;ll walk
                you through how to fix it, step by step.
              </Text>
              <PrimaryButton
                title="+ New repair"
                onPress={() => router.push("/new")}
                style={styles.heroButton}
              />
            </View>
            {totalSaved > 0 && (
              <View style={styles.totalSavedCard}>
                <Text style={styles.totalSavedIcon}>💰</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.totalSavedAmount}>
                    {formatMoney(totalSaved)} saved
                  </Text>
                  <Text style={styles.totalSavedSub}>
                    by doing repairs yourself instead of hiring pros
                  </Text>
                </View>
              </View>
            )}
            <View style={styles.quickNav}>
              <QuickNavBtn
                icon="💬"
                label="Ask HandyBot"
                onPress={() => router.push("/ask")}
              />
              <QuickNavBtn
                icon="🏠"
                label="Home inventory"
                onPress={() => router.push("/inventory")}
              />
              <QuickNavBtn
                icon="📋"
                label="Repair history"
                onPress={() => router.push("/history")}
              />
            </View>
            <UpcomingRemindersCard reminders={upcomingReminders} />
          </View>
        }
        ListEmptyComponent={
          issues === null ? (
            <LoadingList />
          ) : (
            <EmptyState onNew={() => router.push("/new")} />
          )
        }
        ListFooterComponent={null}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onPullToRefresh}
            tintColor={colors.brand}
          />
        }
      />
    </>
  );
}

function LoadingList() {
  return (
    <View style={{ gap: spacing.sm }}>
      {[0, 1, 2].map((i) => (
        <View key={i} style={styles.skeleton} />
      ))}
    </View>
  );
}

function QuickNavBtn({
  icon,
  label,
  onPress,
}: {
  icon: string;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.quickNavBtn,
        pressed && { opacity: 0.85, transform: [{ scale: 0.97 }] },
      ]}
    >
      <Text style={styles.quickNavIcon}>{icon}</Text>
      <Text style={styles.quickNavLabel}>{label}</Text>
    </Pressable>
  );
}

function EmptyState({ onNew }: { onNew: () => void }) {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}>
        <Text style={styles.emptyIconText}>🧰</Text>
      </View>
      <Text style={styles.emptyTitle}>No repairs yet</Text>
      <Text style={styles.emptyBody}>
        Tap the button above to take a photo of what&apos;s broken and get
        started.
      </Text>
      <PrimaryButton
        title="+ New repair"
        onPress={onNew}
        style={{ marginTop: spacing.md, alignSelf: "stretch" }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl * 2,
  },
  header: {
    marginBottom: spacing.md,
  },
  heroCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg + 4,
    marginBottom: spacing.md,
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: colors.text,
  },
  heroSub: {
    marginTop: spacing.sm,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textMuted,
  },
  heroButton: {
    marginTop: spacing.lg,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 2,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: colors.text,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  sectionMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  savedTotal: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.success,
  },
  sectionCount: {
    minWidth: 22,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: radius.pill,
    backgroundColor: "#e7e5e4",
    fontSize: 11,
    fontWeight: "700",
    color: colors.textMuted,
    textAlign: "center",
    overflow: "hidden",
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  headerBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: "#f5f5f4",
    alignItems: "center",
    justifyContent: "center",
  },
  headerBtnText: {
    fontSize: 22,
  },
  skeleton: {
    height: 88,
    borderRadius: radius.lg,
    backgroundColor: "#f5f5f4",
  },
  empty: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xl,
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: radius.pill,
    backgroundColor: colors.brandLight,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyIconText: {
    fontSize: 26,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.text,
  },
  emptyBody: {
    fontSize: 13,
    color: colors.textMuted,
    textAlign: "center",
    maxWidth: 320,
  },
  quickNav: {
    flexDirection: "row",
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  quickNavBtn: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.md + 2,
    alignItems: "center",
    gap: spacing.xs,
  },
  quickNavIcon: {
    fontSize: 24,
  },
  quickNavLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.textMuted,
    textAlign: "center",
  },
  totalSavedCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: "#ecfdf5",
    borderWidth: 1,
    borderColor: "#a7f3d0",
  },
  totalSavedIcon: {
    fontSize: 32,
  },
  totalSavedAmount: {
    fontSize: 22,
    fontWeight: "900",
    color: "#065f46",
  },
  totalSavedSub: {
    fontSize: 12,
    color: "#047857",
    marginTop: 2,
  },
});
