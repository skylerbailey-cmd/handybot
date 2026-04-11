import { Link, Stack, useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import IssueCard from "@/components/IssueCard";
import PrimaryButton from "@/components/PrimaryButton";
import { ensureUser, loadIssues } from "@/lib/storage";
import { colors, radius, spacing } from "@/lib/theme";
import type { Issue } from "@/lib/types";

export default function HomeScreen() {
  const router = useRouter();
  const [issues, setIssues] = useState<Issue[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const refresh = useCallback(async () => {
    const [, loaded] = await Promise.all([ensureUser(), loadIssues()]);
    setIssues(loaded);
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

  return (
    <>
      <Stack.Screen
        options={{
          headerRight: () => (
            <Link href="/settings" asChild>
              <Pressable hitSlop={10} style={styles.headerBtn}>
                <Text style={styles.headerBtnText}>⚙︎</Text>
              </Pressable>
            </Link>
          ),
        }}
      />
      <FlatList
        data={issues ?? []}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <IssueCard issue={item} />}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={{ height: spacing.sm + 4 }} />}
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
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Your repairs</Text>
              {issues && issues.length > 0 && (
                <Text style={styles.sectionCount}>
                  {issues.length} {issues.length === 1 ? "issue" : "issues"}
                </Text>
              )}
            </View>
          </View>
        }
        ListEmptyComponent={
          issues === null ? (
            <LoadingList />
          ) : (
            <EmptyState onNew={() => router.push("/new")} />
          )
        }
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
    marginBottom: spacing.lg,
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
    marginBottom: spacing.sm,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.text,
  },
  sectionCount: {
    fontSize: 13,
    color: colors.textSubtle,
  },
  headerBtn: {
    paddingHorizontal: spacing.sm,
  },
  headerBtnText: {
    fontSize: 22,
    color: colors.textMuted,
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
});
