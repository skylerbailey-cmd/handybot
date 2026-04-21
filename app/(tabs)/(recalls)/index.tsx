import { Stack, useFocusEffect } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useCallback, useMemo, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { loadInventory } from "@/lib/homeData";
import { checkForRecalls, type RecallAlert } from "@/lib/recalls";
import { colors, radius, spacing } from "@/lib/theme";
import type { HomeItem } from "@/lib/types";

export default function RecallsScreen() {
  const [items, setItems] = useState<HomeItem[]>([]);
  const [alerts, setAlerts] = useState<RecallAlert[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const loadedItems = await loadInventory();
      setItems(loadedItems);
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
                The CPSC has issued safety recalls that may affect items in your
                inventory. Tap a recall to view full details on CPSC.gov.
              </Text>
            </View>

            {alerts.map((alert) => {
              const item = itemMap.get(alert.itemId);
              return (
                <Pressable
                  key={`${alert.recallId}-${alert.itemId}`}
                  onPress={() => {
                    if (alert.url) WebBrowser.openBrowserAsync(alert.url);
                  }}
                  style={({ pressed }) => [
                    styles.recallCard,
                    pressed && { opacity: 0.9 },
                  ]}
                >
                  <View style={styles.recallHeader}>
                    <Text style={styles.recallItemIcon}>
                      {item?.icon ?? "⚠"}
                    </Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.recallItemName} numberOfLines={1}>
                        {item?.name ?? "Unknown item"}
                      </Text>
                      {(item?.make || item?.model) && (
                        <Text style={styles.recallItemSpec} numberOfLines={1}>
                          {[item?.make, item?.model].filter(Boolean).join(" ")}
                        </Text>
                      )}
                    </View>
                    <View style={styles.recallBadge}>
                      <Text style={styles.recallBadgeText}>RECALL</Text>
                    </View>
                  </View>

                  <Text style={styles.recallTitle} numberOfLines={2}>
                    {alert.title}
                  </Text>

                  {alert.hazard ? (
                    <View style={styles.hazardRow}>
                      <Text style={styles.hazardLabel}>Hazard:</Text>
                      <Text style={styles.hazardText} numberOfLines={2}>
                        {alert.hazard}
                      </Text>
                    </View>
                  ) : null}

                  {alert.remedy ? (
                    <View style={styles.hazardRow}>
                      <Text style={styles.hazardLabel}>Remedy:</Text>
                      <Text style={styles.hazardText} numberOfLines={2}>
                        {alert.remedy}
                      </Text>
                    </View>
                  ) : null}

                  {alert.recallDate ? (
                    <Text style={styles.recallDate}>
                      Recalled: {alert.recallDate}
                    </Text>
                  ) : null}

                  <Text style={styles.recallLink}>View on CPSC.gov →</Text>

                  <Text style={styles.matchReason}>{alert.matchReason}</Text>
                </Pressable>
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
  recallLink: {
    fontSize: 13,
    fontWeight: "700",
    color: "#dc2626",
  },
  matchReason: {
    fontSize: 10,
    color: colors.textSubtle,
    fontStyle: "italic",
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
