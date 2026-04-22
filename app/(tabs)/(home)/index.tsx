import { Stack, useFocusEffect, useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useCallback, useMemo, useState } from "react";
import {
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import UpcomingRemindersCard from "@/components/UpcomingRemindersCard";
import { getActiveHome, type Home } from "@/lib/homes";
import {
  getItemsNeedingAttention,
  getWarrantyStatus,
  loadInventory,
  notifyExpiringWarranties,
} from "@/lib/homeData";
import { checkForRecalls, type RecallAlert } from "@/lib/recalls";
import {
  formatDueDate,
  loadReminders,
  markReminderDone,
} from "@/lib/reminders";
import { loadIssues } from "@/lib/storage";
import { colors, formatMoney, radius, spacing } from "@/lib/theme";
import type { HomeItem, Issue, Reminder } from "@/lib/types";

const CONDITION_LABEL: Record<string, string> = {
  good: "Good",
  fair: "Fair",
  poor: "Poor",
  replace_soon: "Replace soon",
};

const CONDITION_COLOR: Record<string, { bg: string; fg: string }> = {
  good: { bg: "#d1fae5", fg: "#047857" },
  fair: { bg: "#fef3c7", fg: "#b45309" },
  poor: { bg: "#fee2e2", fg: "#b91c1c" },
  replace_soon: { bg: "#fee2e2", fg: "#b91c1c" },
};

export default function HomeDashboard() {
  const router = useRouter();
  const [activeHome, setActiveHome] = useState<Home | undefined>();
  const [inventory, setInventory] = useState<HomeItem[]>([]);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [recalls, setRecalls] = useState<RecallAlert[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const refresh = useCallback(async () => {
    const [home, inv, iss, rem] = await Promise.all([
      getActiveHome(),
      loadInventory(),
      loadIssues(),
      loadReminders(),
    ]);
    setActiveHome(home);
    setInventory(inv);
    setIssues(iss);
    setReminders(rem);
    if (inv.length > 0) {
      checkForRecalls(inv).then(setRecalls).catch(() => {});
      notifyExpiringWarranties(inv).catch(() => {});
    }
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

  const attentionItems = useMemo(
    () => getItemsNeedingAttention(inventory),
    [inventory]
  );

  const expiringWarranties = useMemo(
    () =>
      inventory
        .filter((i) => {
          const ws = getWarrantyStatus(i);
          return ws === "expiring" || ws === "active";
        })
        .filter((i) => i.warrantyExpiration)
        .sort((a, b) => a.warrantyExpiration! - b.warrantyExpiration!)
        .slice(0, 5),
    [inventory]
  );

  const upcomingReminders = useMemo(
    () =>
      reminders
        .filter((r) => r.enabled)
        .sort((a, b) => a.nextDue - b.nextDue)
        .slice(0, 5),
    [reminders]
  );

  const ongoingRepairs = useMemo(
    () => issues.filter((i) => i.status === "in_progress"),
    [issues]
  );

  const completedRepairs = useMemo(
    () =>
      issues.filter(
        (i) => i.status === "completed" || i.status === "verified"
      ),
    [issues]
  );

  const totalSaved = useMemo(
    () =>
      completedRepairs.reduce(
        (s, i) => s + (i.plan.estimatedSavingsUsd ?? 0),
        0
      ),
    [completedRepairs]
  );

  async function handleReminderDone(reminder: Reminder) {
    const updated = await markReminderDone(reminder.id);
    await refresh();
    if (updated) {
      Alert.alert(
        `${reminder.icon}  Done`,
        `"${reminder.title}" marked done. Next: ${formatDueDate(updated)}.`
      );
    }
  }

  // Home health score
  const healthScore = useMemo(() => {
    if (inventory.length === 0) return null;
    let score = 100;
    // Deduct for items needing attention
    score -= attentionItems.length * 10;
    // Deduct for active recalls
    score -= recalls.length * 15;
    // Deduct for overdue reminders
    const overdue = reminders.filter(
      (r) => r.enabled && r.nextDue <= Date.now()
    );
    score -= overdue.length * 5;
    return Math.max(0, Math.min(100, score));
  }, [inventory, attentionItems, recalls, reminders]);

  const healthColor =
    healthScore === null
      ? colors.textSubtle
      : healthScore >= 80
        ? "#047857"
        : healthScore >= 50
          ? "#b45309"
          : "#b91c1c";
  const healthBg =
    healthScore === null
      ? "#f5f5f4"
      : healthScore >= 80
        ? "#d1fae5"
        : healthScore >= 50
          ? "#fef3c7"
          : "#fee2e2";
  const healthLabel =
    healthScore === null
      ? "Add items to get started"
      : healthScore >= 80
        ? "Your home is in great shape"
        : healthScore >= 50
          ? "A few things need your attention"
          : "Several items need attention";

  return (
    <>
      <Stack.Screen
        options={{
          title: activeHome
            ? `${activeHome.icon} ${activeHome.name}`
            : "HandyBot",
          headerLeft: () => (
            <Pressable
              onPress={() => router.push("/(tabs)/(settings)/homes")}
              hitSlop={8}
              style={({ pressed }) => [
                styles.homeSwitcher,
                pressed && { opacity: 0.7 },
              ]}
            >
              <Text style={styles.homeSwitcherText}>Switch</Text>
            </Pressable>
          ),
        }}
      />
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onPullToRefresh}
            tintColor={colors.brand}
          />
        }
      >
        {/* Home Health Score */}
        <View style={[styles.healthCard, { backgroundColor: healthBg }]}>
          <View style={styles.healthTop}>
            {healthScore !== null && (
              <Text style={[styles.healthScore, { color: healthColor }]}>
                {healthScore}
              </Text>
            )}
            <View style={{ flex: 1 }}>
              <Text style={[styles.healthLabel, { color: healthColor }]}>
                Home Health Score
              </Text>
              <Text style={[styles.healthTitle, { color: healthColor }]}>
                {healthLabel}
              </Text>
              <Text style={styles.healthSub}>
                {inventory.length} items tracked
                {attentionItems.length > 0
                  ? ` · ${attentionItems.length} need attention`
                  : ""}
                {recalls.length > 0 ? ` · ${recalls.length} recall${recalls.length !== 1 ? "s" : ""}` : ""}
              </Text>
            </View>
          </View>
        </View>

        {/* Quick Actions */}
        <View style={styles.quickActions}>
          <Pressable
            onPress={() => router.push("/(tabs)/(inventory)/edit")}
            style={({ pressed }) => [
              styles.quickActionBtn,
              pressed && { opacity: 0.85 },
            ]}
          >
            <Text style={styles.quickActionIcon}>📦</Text>
            <Text style={styles.quickActionLabel}>Add Item</Text>
          </Pressable>
          <Pressable
            onPress={() => router.push("/(tabs)/(repair)")}
            style={({ pressed }) => [
              styles.quickActionBtn,
              styles.quickActionBtnRepair,
              pressed && { opacity: 0.85 },
            ]}
          >
            <Text style={styles.quickActionIcon}>🔧</Text>
            <Text style={styles.quickActionLabel}>New Repair</Text>
          </Pressable>
        </View>

        {/* Recall Alerts */}
        {recalls.length > 0 && (
          <View style={styles.recallCard}>
            <Text style={styles.recallTitle}>
              ⚠ {recalls.length} recall{recalls.length !== 1 ? "s" : ""} found
            </Text>
            {recalls.slice(0, 3).map((alert) => {
              const item = inventory.find((i) => i.id === alert.itemId);
              return (
                <Pressable
                  key={`${alert.recallId}-${alert.itemId}`}
                  onPress={() => {
                    if (alert.url) WebBrowser.openBrowserAsync(alert.url);
                  }}
                  style={styles.recallRow}
                >
                  <Text style={styles.recallIcon}>
                    {item?.icon ?? "⚠"}
                  </Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.recallItem} numberOfLines={1}>
                      {item?.name ?? "Unknown item"}
                    </Text>
                    <Text style={styles.recallDesc} numberOfLines={2}>
                      {alert.title}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
            {recalls.length > 3 && (
              <Pressable
                onPress={() => router.push("/(tabs)/(repair)/history")}
              >
                <Text style={styles.recallSeeAll}>
                  View all {recalls.length} recalls →
                </Text>
              </Pressable>
            )}
          </View>
        )}

        {/* Items Needing Attention */}
        {attentionItems.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Needs attention</Text>
            {attentionItems.slice(0, 5).map((item) => {
              const c =
                CONDITION_COLOR[item.condition] ?? CONDITION_COLOR.fair;
              const remaining =
                item.typicalLifespanYears - item.estimatedAgeYears;
              return (
                <Pressable
                  key={item.id}
                  onPress={() =>
                    router.push({
                      pathname: "/(tabs)/(inventory)/edit",
                      params: { itemId: item.id },
                    })
                  }
                  style={({ pressed }) => [
                    styles.attentionRow,
                    pressed && { opacity: 0.9 },
                  ]}
                >
                  <Text style={styles.attentionIcon}>{item.icon}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.attentionName} numberOfLines={1}>
                      {item.name}
                    </Text>
                    <Text style={styles.attentionDetail}>
                      {getWarrantyStatus(item) === "expiring"
                        ? `Warranty expires ${new Date(item.warrantyExpiration!).toLocaleDateString()}`
                        : remaining <= 0
                          ? `Past typical ${item.typicalLifespanYears}-year lifespan`
                          : `${remaining} year${remaining !== 1 ? "s" : ""} remaining`}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.conditionBadge,
                      { backgroundColor: c.bg },
                    ]}
                  >
                    <Text style={[styles.conditionText, { color: c.fg }]}>
                      {CONDITION_LABEL[item.condition]}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
            {attentionItems.length > 5 && (
              <Pressable onPress={() => router.push("/(tabs)/(inventory)")}>
                <Text style={styles.seeAllLink}>
                  View all {attentionItems.length} items →
                </Text>
              </Pressable>
            )}
          </View>
        )}

        {/* Warranty Timeline */}
        {expiringWarranties.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Warranty timeline</Text>
            {expiringWarranties.map((item) => {
              const ws = getWarrantyStatus(item);
              const expDate = new Date(
                item.warrantyExpiration!
              ).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              });
              const daysLeft = Math.ceil(
                (item.warrantyExpiration! - Date.now()) / (24 * 60 * 60 * 1000)
              );
              return (
                <Pressable
                  key={item.id}
                  onPress={() =>
                    router.push({
                      pathname: "/(tabs)/(inventory)/edit",
                      params: { itemId: item.id },
                    })
                  }
                  style={({ pressed }) => [
                    styles.warrantyRow,
                    pressed && { opacity: 0.9 },
                  ]}
                >
                  <Text style={styles.attentionIcon}>{item.icon}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.attentionName} numberOfLines={1}>
                      {item.name}
                    </Text>
                    <Text
                      style={[
                        styles.attentionDetail,
                        ws === "expiring" && { color: "#b45309" },
                      ]}
                    >
                      {ws === "expiring"
                        ? `Expires ${expDate} (${daysLeft}d left)`
                        : `Expires ${expDate}`}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        )}

        {/* Upcoming Maintenance */}
        <UpcomingRemindersCard
          reminders={upcomingReminders}
          onMarkDone={handleReminderDone}
        />

        {/* Repair Summary */}
        <Pressable
          onPress={() => router.push("/(tabs)/(repair)")}
          style={styles.repairCard}
        >
          <View style={styles.repairCardHeader}>
            <Text style={styles.repairCardIcon}>🔧</Text>
            <Text style={styles.sectionTitle}>Repairs</Text>
          </View>
          <View style={styles.repairStats}>
            {ongoingRepairs.length > 0 && (
              <View style={styles.repairStat}>
                <Text style={styles.repairStatValue}>
                  {ongoingRepairs.length}
                </Text>
                <Text style={styles.repairStatLabel}>In progress</Text>
              </View>
            )}
            <View style={styles.repairStat}>
              <Text style={styles.repairStatValue}>
                {completedRepairs.length}
              </Text>
              <Text style={styles.repairStatLabel}>Completed</Text>
            </View>
            {totalSaved > 0 && (
              <View style={styles.repairStat}>
                <Text
                  style={[styles.repairStatValue, { color: colors.success }]}
                >
                  {formatMoney(totalSaved)}
                </Text>
                <Text style={styles.repairStatLabel}>Saved</Text>
              </View>
            )}
          </View>
          <View style={styles.repairCardActions}>
            <Pressable
              onPress={(e) => {
                e.stopPropagation();
                router.push("/(tabs)/(repair)");
              }}
              style={styles.newRepairBtn}
            >
              <Text style={styles.newRepairBtnText}>+ New Repair</Text>
            </Pressable>
            <Text style={styles.repairCardLink}>
              View all repairs →
            </Text>
          </View>
        </Pressable>

        {/* Inventory Overview */}
        <Pressable
          onPress={() => router.push("/(tabs)/(inventory)")}
          style={styles.inventoryCard}
        >
          <View style={styles.inventoryCardRow}>
            <Text style={{ fontSize: 24 }}>📦</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.inventoryCardTitle}>
                Home Inventory
              </Text>
              <Text style={styles.inventoryCardSub}>
                {inventory.length} items tracked
              </Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </View>
        </Pressable>

        {/* Empty state — no inventory */}
        {inventory.length === 0 && issues.length === 0 && (
          <View style={styles.empty}>
            <View style={styles.emptyIcon}>
              <Text style={{ fontSize: 32 }}>🏠</Text>
            </View>
            <Text style={styles.emptyTitle}>Welcome to HandyBot</Text>
            <Text style={styles.emptyBody}>
              Start by adding items to your home inventory — photograph your
              appliances, water heater, HVAC, and more. We&apos;ll track
              warranties, suggest maintenance, and alert you to recalls.
            </Text>
            <Pressable
              onPress={() => router.push("/(tabs)/(inventory)/edit")}
              style={styles.emptyBtn}
            >
              <Text style={styles.emptyBtnText}>+ Add your first item</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl * 2,
  },
  homeSwitcher: {
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.pill,
    backgroundColor: colors.brandLight,
  },
  homeSwitcherText: {
    fontSize: 12,
    fontWeight: "800",
    color: colors.brandDark,
  },

  // Health card
  healthCard: {
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  healthTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  healthScore: {
    fontSize: 36,
    fontWeight: "900",
  },
  healthLabel: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    opacity: 0.7,
    marginBottom: 1,
  },
  healthTitle: {
    fontSize: 16,
    fontWeight: "800",
  },
  healthSub: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },

  // Quick actions
  quickActions: {
    flexDirection: "row",
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  quickActionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    backgroundColor: colors.brand,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
  },
  quickActionBtnRepair: {
    backgroundColor: "#1d4ed8",
  },
  quickActionIcon: {
    fontSize: 16,
  },
  quickActionLabel: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "800",
  },

  // Recalls
  recallCard: {
    backgroundColor: "#fef2f2",
    borderWidth: 1,
    borderColor: "#fca5a5",
    borderRadius: radius.lg,
    padding: spacing.md + 2,
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  recallTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#991b1b",
  },
  recallRow: {
    flexDirection: "row",
    gap: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderColor: "#fecaca",
  },
  recallIcon: {
    fontSize: 20,
    marginTop: 2,
  },
  recallItem: {
    fontSize: 13,
    fontWeight: "700",
    color: "#991b1b",
  },
  recallDesc: {
    fontSize: 12,
    color: "#7f1d1d",
    lineHeight: 16,
    marginTop: 1,
  },
  recallSeeAll: {
    fontSize: 12,
    fontWeight: "700",
    color: "#dc2626",
    marginTop: spacing.xs,
  },

  // Sections
  section: {
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: colors.text,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: spacing.sm,
  },
  seeAllLink: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.brand,
    marginTop: spacing.xs,
    paddingLeft: spacing.xs,
  },

  // Attention items
  attentionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.xs + 2,
  },
  attentionIcon: {
    fontSize: 22,
  },
  attentionName: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.text,
  },
  attentionDetail: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 1,
  },
  conditionBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  conditionText: {
    fontSize: 10,
    fontWeight: "700",
  },

  // Warranty timeline
  warrantyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.xs + 2,
  },

  // Repair summary
  repairCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  repairCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  repairCardIcon: {
    fontSize: 18,
  },
  repairStats: {
    flexDirection: "row",
    gap: spacing.md,
  },
  repairStat: {
    flex: 1,
    backgroundColor: "#f5f5f4",
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: "center",
  },
  repairStatValue: {
    fontSize: 20,
    fontWeight: "900",
    color: colors.text,
  },
  repairStatLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: colors.textSubtle,
    textTransform: "uppercase",
    letterSpacing: 0.3,
    marginTop: 2,
  },
  repairCardActions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: spacing.md,
  },
  newRepairBtn: {
    backgroundColor: colors.brand,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.md,
  },
  newRepairBtnText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "800",
  },
  repairCardLink: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.brand,
  },

  // Inventory card
  inventoryCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  inventoryCardRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  inventoryCardTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.text,
  },
  inventoryCardSub: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 1,
  },
  chevron: {
    fontSize: 22,
    fontWeight: "700",
    color: colors.textSubtle,
  },

  // Empty state
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
    width: 64,
    height: 64,
    borderRadius: radius.pill,
    backgroundColor: colors.brandLight,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: colors.text,
  },
  emptyBody: {
    fontSize: 13,
    color: colors.textMuted,
    textAlign: "center",
    maxWidth: 320,
    lineHeight: 19,
  },
  emptyBtn: {
    backgroundColor: colors.brand,
    borderRadius: radius.md,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    marginTop: spacing.sm,
  },
  emptyBtnText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "800",
  },
});
