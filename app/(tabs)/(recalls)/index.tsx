import { Stack, useFocusEffect } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useCallback, useMemo, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { loadInventory } from "@/lib/homeData";
import {
  checkForRecalls,
  dismissRecallAlert,
  getRecallTracking,
  loadRecallTracking,
  RECALL_STATUS_STEPS,
  updateRecallStatus,
  type RecallAlert,
  type RecallStatus,
  type RecallTracking,
} from "@/lib/recalls";
import { colors, radius, spacing } from "@/lib/theme";
import type { HomeItem } from "@/lib/types";

export default function RecallsScreen() {
  const [items, setItems] = useState<HomeItem[]>([]);
  const [alerts, setAlerts] = useState<RecallAlert[]>([]);
  const [tracking, setTracking] = useState<Map<string, RecallTracking>>(
    new Map()
  );
  const [loading, setLoading] = useState(true);
  const [expandedCard, setExpandedCard] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "confirmed" | "possible">("all");

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [loadedItems, trackingMap] = await Promise.all([
        loadInventory(),
        loadRecallTracking(),
      ]);
      setItems(loadedItems);
      setTracking(trackingMap);
      if (loadedItems.length > 0) {
        const found = await checkForRecalls(loadedItems);
        setAlerts(found);
      } else {
        setAlerts([]);
      }
    } catch {
      /* best-effort */
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  const itemMap = useMemo(
    () => new Map(items.map((i) => [i.id, i])),
    [items]
  );

  // Sort: exact matches first, then by status (active → resolved)
  const sortedAlerts = useMemo(() => {
    const statusOrder: Record<RecallStatus, number> = {
      new: 0,
      contacted: 1,
      in_progress: 2,
      resolved: 3,
    };
    let filtered = [...alerts];
    if (filter === "confirmed") filtered = filtered.filter((a) => a.isExactMatch);
    if (filter === "possible") filtered = filtered.filter((a) => !a.isExactMatch);

    return filtered.sort((a, b) => {
      // Exact matches first
      if (a.isExactMatch !== b.isExactMatch) return a.isExactMatch ? -1 : 1;
      // Then by status
      const ta = getRecallTracking(tracking, a.recallId, a.itemId);
      const tb = getRecallTracking(tracking, b.recallId, b.itemId);
      return statusOrder[ta.status] - statusOrder[tb.status];
    });
  }, [alerts, tracking, filter]);

  async function handleStatusChange(
    alert: RecallAlert,
    newStatus: RecallStatus
  ) {
    await updateRecallStatus(alert.recallId, alert.itemId, newStatus);
    setTracking(await loadRecallTracking());
  }

  return (
    <>
      <Stack.Screen options={{ title: "Recalls" }} />
      <ScrollView contentContainerStyle={styles.container}>
        {loading ? (
          <View style={styles.loadingWrap}>
            {[0, 1, 2].map((i) => (
              <View key={i} style={styles.skeleton} />
            ))}
            <Text style={styles.loadingText}>Checking for recalls...</Text>
          </View>
        ) : items.length === 0 ? (
          <View style={styles.empty}>
            <View style={styles.emptyIcon}>
              <Text style={styles.emptyIconText}>🛡</Text>
            </View>
            <Text style={styles.emptyTitle}>No items to check</Text>
            <Text style={styles.emptyBody}>
              Add items to your Home Inventory and we&apos;ll automatically
              check the CPSC database for safety recalls that might affect them.
            </Text>
          </View>
        ) : alerts.length === 0 ? (
          <View style={styles.empty}>
            <View style={[styles.emptyIcon, styles.safeIcon]}>
              <Text style={styles.emptyIconText}>✓</Text>
            </View>
            <Text style={styles.emptyTitle}>No recalls found</Text>
            <Text style={styles.emptyBody}>
              None of your {items.length} inventory{" "}
              {items.length === 1 ? "item" : "items"} matched any active CPSC
              recalls. We check automatically every 24 hours.
            </Text>
          </View>
        ) : (
          <>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryTitle}>
                {alerts.length} recall{alerts.length !== 1 ? "s" : ""} found
              </Text>
              <Text style={styles.summaryBody}>
                {(() => {
                  const exact = alerts.filter((a) => a.isExactMatch).length;
                  const possible = alerts.length - exact;
                  const resolved = alerts.filter(
                    (a) =>
                      getRecallTracking(tracking, a.recallId, a.itemId)
                        .status === "resolved"
                  ).length;
                  const parts: string[] = [];
                  if (exact > 0) parts.push(`${exact} confirmed`);
                  if (possible > 0) parts.push(`${possible} possible`);
                  if (resolved > 0) parts.push(`${resolved} resolved`);
                  return parts.join(" · ") + ". Possible matches may not apply to your exact product — review and dismiss if not relevant.";
                })()}
              </Text>
            </View>

            {/* Filter chips */}
            <View style={styles.filterRow}>
              {(["all", "confirmed", "possible"] as const).map((f) => {
                const active = filter === f;
                const count =
                  f === "all"
                    ? alerts.length
                    : f === "confirmed"
                      ? alerts.filter((a) => a.isExactMatch).length
                      : alerts.filter((a) => !a.isExactMatch).length;
                const label =
                  f === "all" ? `All (${count})` : f === "confirmed" ? `Confirmed (${count})` : `Possible (${count})`;
                return (
                  <Pressable
                    key={f}
                    onPress={() => setFilter(f)}
                    style={[
                      styles.filterChip,
                      active && (f === "confirmed" ? styles.filterChipConfirmed : f === "possible" ? styles.filterChipPossible : styles.filterChipAll),
                    ]}
                  >
                    <Text
                      style={[
                        styles.filterChipText,
                        active && (f === "confirmed" ? styles.filterChipTextConfirmed : f === "possible" ? styles.filterChipTextPossible : styles.filterChipTextAll),
                      ]}
                    >
                      {label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {sortedAlerts.map((alert) => {
              const item = itemMap.get(alert.itemId);
              const t = getRecallTracking(
                tracking,
                alert.recallId,
                alert.itemId
              );
              const cardId = `${alert.recallId}-${alert.itemId}`;
              const isExpanded = expandedCard === cardId;
              const isResolved = t.status === "resolved";
              const isPossible = !alert.isExactMatch;
              const currentStepIdx = RECALL_STATUS_STEPS.findIndex(
                (s) => s.key === t.status
              );

              return (
                <View
                  key={cardId}
                  style={[
                    styles.recallCard,
                    isPossible && !isResolved && styles.recallCardPossible,
                    isResolved && styles.recallCardResolved,
                  ]}
                >
                  {/* Possible match banner */}
                  {isPossible && !isResolved && (
                    <View style={styles.possibleBanner}>
                      <Text style={styles.possibleBannerText}>
                        Possible match — check if this recall applies to your specific product
                      </Text>
                    </View>
                  )}

                  {/* Header — tap to expand/collapse */}
                  <Pressable
                    onPress={() =>
                      setExpandedCard(isExpanded ? null : cardId)
                    }
                    style={styles.recallHeader}
                  >
                    <Text style={styles.recallItemIcon}>
                      {item?.icon ?? "⚠"}
                    </Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.recallItemName} numberOfLines={1}>
                        {item?.name ?? "Unknown item"}
                      </Text>
                      {(item?.make || item?.model) && (
                        <Text style={styles.recallItemSpec} numberOfLines={1}>
                          {[item?.make, item?.model]
                            .filter(Boolean)
                            .join(" ")}
                        </Text>
                      )}
                    </View>
                    {isResolved ? (
                      <View style={styles.resolvedBadge}>
                        <Text style={styles.resolvedBadgeText}>
                          ✓ RESOLVED
                        </Text>
                      </View>
                    ) : isPossible ? (
                      <View style={styles.possibleBadge}>
                        <Text style={styles.possibleBadgeText}>POSSIBLE</Text>
                      </View>
                    ) : (
                      <View style={styles.recallBadge}>
                        <Text style={styles.recallBadgeText}>RECALL</Text>
                      </View>
                    )}
                  </Pressable>

                  <Text
                    style={[
                      styles.recallTitle,
                      isPossible && !isResolved && styles.recallTitlePossible,
                    ]}
                    numberOfLines={2}
                  >
                    {alert.title}
                  </Text>

                  {/* Progress bar */}
                  <View style={styles.progressSection}>
                    {/* Horizontal dot + line track */}
                    <View style={styles.progressTrack}>
                      {RECALL_STATUS_STEPS.map((step, idx) => {
                        const isDone = idx <= currentStepIdx;
                        const isCurrent = idx === currentStepIdx;
                        return (
                          <View key={step.key} style={styles.progressSegment}>
                            {idx > 0 && (
                              <View
                                style={[
                                  styles.progressLine,
                                  isDone && styles.progressLineDone,
                                ]}
                              />
                            )}
                            <View
                              style={[
                                styles.progressDot,
                                isDone && styles.progressDotDone,
                                isCurrent && styles.progressDotCurrent,
                              ]}
                            >
                              {isDone && !isCurrent && (
                                <Text style={styles.progressDotCheck}>✓</Text>
                              )}
                            </View>
                          </View>
                        );
                      })}
                    </View>

                    {/* Labels under dots */}
                    <View style={styles.progressLabels}>
                      {RECALL_STATUS_STEPS.map((step, idx) => {
                        const isCurrent = idx === currentStepIdx;
                        const isDone = idx < currentStepIdx;
                        return (
                          <Text
                            key={step.key}
                            style={[
                              styles.progressLabelText,
                              isCurrent && styles.progressLabelCurrent,
                              isDone && styles.progressLabelDone,
                            ]}
                            numberOfLines={1}
                          >
                            {step.label}
                          </Text>
                        );
                      })}
                    </View>

                    {/* Current status description + nav buttons */}
                    <View style={styles.statusRow}>
                      <Pressable
                        onPress={() => {
                          if (currentStepIdx > 0) {
                            handleStatusChange(
                              alert,
                              RECALL_STATUS_STEPS[currentStepIdx - 1].key
                            );
                          }
                        }}
                        disabled={currentStepIdx === 0}
                        style={[
                          styles.navBtn,
                          currentStepIdx === 0 && styles.navBtnDisabled,
                        ]}
                      >
                        <Text
                          style={[
                            styles.navBtnText,
                            currentStepIdx === 0 && styles.navBtnTextDisabled,
                          ]}
                        >
                          ‹ Back
                        </Text>
                      </Pressable>

                      <View style={styles.statusCenter}>
                        <Text style={styles.statusDesc}>
                          {RECALL_STATUS_STEPS[currentStepIdx].description}
                        </Text>
                      </View>

                      <Pressable
                        onPress={() => {
                          if (
                            currentStepIdx <
                            RECALL_STATUS_STEPS.length - 1
                          ) {
                            handleStatusChange(
                              alert,
                              RECALL_STATUS_STEPS[currentStepIdx + 1].key
                            );
                          }
                        }}
                        disabled={
                          currentStepIdx === RECALL_STATUS_STEPS.length - 1
                        }
                        style={[
                          styles.navBtn,
                          styles.navBtnNext,
                          currentStepIdx ===
                            RECALL_STATUS_STEPS.length - 1 &&
                            styles.navBtnDisabled,
                        ]}
                      >
                        <Text
                          style={[
                            styles.navBtnNextText,
                            currentStepIdx ===
                              RECALL_STATUS_STEPS.length - 1 &&
                              styles.navBtnTextDisabled,
                          ]}
                        >
                          {currentStepIdx ===
                          RECALL_STATUS_STEPS.length - 2
                            ? "Resolve ›"
                            : "Next ›"}
                        </Text>
                      </Pressable>
                    </View>
                  </View>

                  {/* Expanded details */}
                  {isExpanded && (
                    <View style={styles.expandedDetails}>
                      {alert.hazard ? (
                        <View style={styles.hazardRow}>
                          <Text style={styles.hazardLabel}>Hazard:</Text>
                          <Text
                            style={styles.hazardText}
                            numberOfLines={4}
                          >
                            {alert.hazard}
                          </Text>
                        </View>
                      ) : null}

                      {alert.remedy ? (
                        <View style={styles.hazardRow}>
                          <Text style={styles.hazardLabel}>Remedy:</Text>
                          <Text
                            style={styles.hazardText}
                            numberOfLines={4}
                          >
                            {alert.remedy}
                          </Text>
                        </View>
                      ) : null}

                      {alert.recallDate ? (
                        <Text style={styles.recallDate}>
                          Recalled: {alert.recallDate}
                        </Text>
                      ) : null}

                      <Pressable
                        onPress={() => {
                          if (alert.url)
                            WebBrowser.openBrowserAsync(alert.url);
                        }}
                        style={styles.cpscBtn}
                      >
                        <Text style={styles.cpscBtnText}>
                          View full details on CPSC.gov →
                        </Text>
                      </Pressable>

                      <Text style={styles.matchReason}>
                        {alert.matchReason}
                      </Text>

                      {isPossible && !isResolved && (
                        <Pressable
                          onPress={() => {
                            Alert.alert(
                              "Dismiss this recall?",
                              "This will remove it from your list. If it turns out to be relevant, it will reappear on the next recall check.",
                              [
                                { text: "Cancel", style: "cancel" },
                                {
                                  text: "Dismiss",
                                  style: "destructive",
                                  onPress: async () => {
                                    await dismissRecallAlert(
                                      alert.recallId,
                                      alert.itemId
                                    );
                                    setAlerts((prev) =>
                                      prev.filter(
                                        (a) =>
                                          !(
                                            a.recallId === alert.recallId &&
                                            a.itemId === alert.itemId
                                          )
                                      )
                                    );
                                  },
                                },
                              ]
                            );
                          }}
                          style={styles.dismissBtn}
                        >
                          <Text style={styles.dismissBtnText}>
                            Dismiss — doesn't apply to my product
                          </Text>
                        </Pressable>
                      )}
                    </View>
                  )}

                  {/* Expand/collapse hint */}
                  <Pressable
                    onPress={() =>
                      setExpandedCard(isExpanded ? null : cardId)
                    }
                  >
                    <Text style={styles.expandHint}>
                      {isExpanded ? "Show less" : "Show details"}
                    </Text>
                  </Pressable>
                </View>
              );
            })}
          </>
        )}

        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>How recall checking works</Text>
          <Text style={styles.infoBody}>
            We search the U.S. Consumer Product Safety Commission (CPSC) recall
            database using the brand, model, and name of each item in your home
            inventory. The more detail you add to your items, the better the
            matching. Results are cached for 24 hours.
          </Text>
        </View>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl * 2,
  },
  loadingWrap: {
    gap: spacing.sm,
  },
  skeleton: {
    height: 80,
    borderRadius: radius.lg,
    backgroundColor: "#f5f5f4",
  },
  loadingText: {
    textAlign: "center",
    fontSize: 13,
    color: colors.textMuted,
    marginTop: spacing.sm,
  },
  empty: {
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.xl,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 999,
    backgroundColor: colors.brandLight,
    alignItems: "center",
    justifyContent: "center",
  },
  safeIcon: {
    backgroundColor: "#d1fae5",
  },
  emptyIconText: {
    fontSize: 30,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: colors.text,
  },
  emptyBody: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: "center",
    maxWidth: 340,
    lineHeight: 20,
  },
  summaryCard: {
    backgroundColor: "#fef2f2",
    borderWidth: 1,
    borderColor: "#fca5a5",
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#991b1b",
  },
  summaryBody: {
    fontSize: 13,
    color: "#b91c1c",
    lineHeight: 18,
    marginTop: spacing.xs,
  },
  recallCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: "#fca5a5",
    padding: spacing.lg,
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  recallCardPossible: {
    borderColor: "#fcd34d",
    backgroundColor: "#fffbeb",
  },
  recallCardResolved: {
    borderColor: colors.border,
    opacity: 0.75,
  },
  possibleBanner: {
    backgroundColor: "#fef3c7",
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs + 2,
    marginBottom: spacing.xs,
  },
  possibleBannerText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#92400e",
    textAlign: "center",
  },
  possibleBadge: {
    backgroundColor: "#fef3c7",
    borderWidth: 1,
    borderColor: "#fcd34d",
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  possibleBadgeText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#b45309",
  },
  recallHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  recallItemIcon: {
    fontSize: 24,
  },
  recallItemName: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.text,
  },
  recallItemSpec: {
    fontSize: 12,
    color: colors.textMuted,
  },
  recallBadge: {
    backgroundColor: "#fee2e2",
    borderWidth: 1,
    borderColor: "#fca5a5",
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  recallBadgeText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#dc2626",
  },
  recallTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#7f1d1d",
    lineHeight: 19,
  },
  recallTitlePossible: {
    color: "#78350f",
  },
  hazardRow: {
    flexDirection: "row",
    gap: spacing.xs,
  },
  hazardLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#991b1b",
  },
  hazardText: {
    flex: 1,
    fontSize: 12,
    color: "#b91c1c",
    lineHeight: 16,
  },
  recallDate: {
    fontSize: 11,
    color: colors.textSubtle,
  },
  resolvedBadge: {
    backgroundColor: "#d1fae5",
    borderWidth: 1,
    borderColor: "#6ee7b7",
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  resolvedBadgeText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#047857",
  },
  progressSection: {
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  progressTrack: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.sm,
  },
  progressSegment: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  progressLine: {
    flex: 1,
    height: 3,
    backgroundColor: colors.border,
    borderRadius: 2,
  },
  progressLineDone: {
    backgroundColor: "#047857",
  },
  progressDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  progressDotDone: {
    backgroundColor: "#d1fae5",
    borderColor: "#047857",
  },
  progressDotCurrent: {
    borderColor: colors.brand,
    backgroundColor: colors.brandLight,
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 3,
  },
  progressDotCheck: {
    fontSize: 11,
    fontWeight: "800",
    color: "#047857",
  },
  progressLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 2,
  },
  progressLabelText: {
    flex: 1,
    fontSize: 10,
    fontWeight: "600",
    color: colors.textSubtle,
    textAlign: "center",
  },
  progressLabelCurrent: {
    fontWeight: "800",
    color: colors.text,
  },
  progressLabelDone: {
    color: "#047857",
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  statusCenter: {
    flex: 1,
  },
  statusDesc: {
    fontSize: 12,
    color: colors.textMuted,
    textAlign: "center",
    lineHeight: 16,
  },
  navBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  navBtnNext: {
    backgroundColor: colors.brand,
    borderColor: colors.brand,
  },
  navBtnDisabled: {
    opacity: 0.35,
  },
  navBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.textMuted,
  },
  navBtnNextText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#ffffff",
  },
  navBtnTextDisabled: {
    color: colors.textSubtle,
  },
  expandedDetails: {
    gap: spacing.sm,
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderColor: colors.border,
  },
  cpscBtn: {
    backgroundColor: "#fef2f2",
    borderWidth: 1,
    borderColor: "#fca5a5",
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    alignSelf: "flex-start",
  },
  cpscBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#dc2626",
  },
  expandHint: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.brand,
    textAlign: "center",
    paddingTop: spacing.xs,
  },
  matchReason: {
    fontSize: 10,
    color: colors.textSubtle,
    fontStyle: "italic",
  },
  filterRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  filterChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  filterChipAll: {
    backgroundColor: colors.text,
    borderColor: colors.text,
  },
  filterChipConfirmed: {
    backgroundColor: "#fee2e2",
    borderColor: "#fca5a5",
  },
  filterChipPossible: {
    backgroundColor: "#fef3c7",
    borderColor: "#fcd34d",
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.textMuted,
  },
  filterChipTextAll: {
    color: "#ffffff",
  },
  filterChipTextConfirmed: {
    color: "#dc2626",
  },
  filterChipTextPossible: {
    color: "#b45309",
  },
  dismissBtn: {
    backgroundColor: "#fef3c7",
    borderWidth: 1,
    borderColor: "#fcd34d",
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    alignItems: "center",
  },
  dismissBtnText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#92400e",
  },
  infoCard: {
    backgroundColor: "#f5f5f4",
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginTop: spacing.lg,
  },
  infoTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.text,
  },
  infoBody: {
    fontSize: 12,
    color: colors.textMuted,
    lineHeight: 17,
    marginTop: spacing.xs,
  },
});
