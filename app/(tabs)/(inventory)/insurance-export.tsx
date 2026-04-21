import { Stack, useFocusEffect, useRouter } from "expo-router";
import * as Sharing from "expo-sharing";
import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import PrimaryButton from "@/components/PrimaryButton";
import { getActiveHome, type Home } from "@/lib/homes";
import { loadInventory } from "@/lib/homeData";
import { computeAcv, exportInsurancePdf } from "@/lib/insuranceExport";
import { ensureUser } from "@/lib/storage";
import { isCloudBackupEnabled } from "@/lib/subscription";
import { colors, formatMoney, radius, spacing } from "@/lib/theme";
import type { HomeItem, User } from "@/lib/types";

export default function InsuranceExportScreen() {
  const router = useRouter();
  const [isPro, setIsPro] = useState(isCloudBackupEnabled());
  const [items, setItems] = useState<HomeItem[]>([]);
  const [home, setHome] = useState<Home | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const [exporting, setExporting] = useState(false);

  useFocusEffect(
    useCallback(() => {
      setIsPro(isCloudBackupEnabled());
      Promise.all([loadInventory(), getActiveHome(), ensureUser()]).then(
        ([inv, h, u]) => {
          setItems(inv);
          setHome(h ?? null);
          setUser(u);
        }
      );
    }, [])
  );

  const includedItems = useMemo(
    () => items.filter((i) => !excluded.has(i.id)),
    [items, excluded]
  );

  const totalReplacement = useMemo(
    () => includedItems.reduce((s, i) => s + (i.replacementCostUsd ?? 0), 0),
    [includedItems]
  );

  const totalAcv = useMemo(
    () => includedItems.reduce((s, i) => s + computeAcv(i), 0),
    [includedItems]
  );

  function toggleItem(id: string) {
    setExcluded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleExport() {
    if (exporting) return;
    setExporting(true);
    try {
      const uri = await exportInsurancePdf({
        items: includedItems,
        home,
        user,
      });
      await Sharing.shareAsync(uri, {
        mimeType: "application/pdf",
        UTI: "com.adobe.pdf",
        dialogTitle: "Share Insurance Inventory PDF",
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Export failed";
      if (!msg.includes("cancelled") && !msg.includes("canceled")) {
        Alert.alert("Export failed", msg);
      }
    } finally {
      setExporting(false);
    }
  }

  // -- Paywall state --
  if (!isPro) {
    return (
      <>
        <Stack.Screen options={{ title: "Insurance Export" }} />
        <ScrollView contentContainerStyle={styles.paywallContainer}>
          <View style={styles.paywallIcon}>
            <Text style={styles.paywallIconText}>🛡</Text>
          </View>
          <Text style={styles.paywallTitle}>
            Insurance Inventory Export (Pro)
          </Text>
          <Text style={styles.paywallBody}>
            Generate a claim-ready PDF of your home inventory formatted as a
            Schedule of Personal Property. Includes photos, replacement cost
            estimates, depreciated values, and a per-room breakdown — exactly
            what an insurance adjuster expects after a fire, flood, or theft
            claim.
          </Text>

          <View style={styles.paywallFeatures}>
            {[
              "Cover page with total replacement cost & ACV",
              "Per-room grouping with item photos",
              "AI-estimated replacement costs",
              "Straight-line depreciation (ACV) calculation",
              "Shareable PDF with legal disclaimer",
            ].map((f, i) => (
              <View key={i} style={styles.featureRow}>
                <Text style={styles.featureCheck}>✓</Text>
                <Text style={styles.featureText}>{f}</Text>
              </View>
            ))}
          </View>

          <View style={styles.paywallSample}>
            <Text style={styles.paywallSampleTitle}>
              Schedule of Personal Property
            </Text>
            <Text style={styles.paywallSampleSubtitle}>
              Home Inventory Valuation Report
            </Text>
            <View style={styles.paywallSampleRow}>
              <View style={styles.paywallSampleThumb} />
              <View style={{ flex: 1, gap: 2 }}>
                <View style={styles.paywallSampleLine} />
                <View style={[styles.paywallSampleLine, { width: "60%" }]} />
              </View>
              <View style={{ alignItems: "flex-end", gap: 2 }}>
                <View style={[styles.paywallSampleLine, { width: 50 }]} />
                <View style={[styles.paywallSampleLine, { width: 40 }]} />
              </View>
            </View>
            <View style={styles.paywallSampleRow}>
              <View style={styles.paywallSampleThumb} />
              <View style={{ flex: 1, gap: 2 }}>
                <View style={styles.paywallSampleLine} />
                <View style={[styles.paywallSampleLine, { width: "50%" }]} />
              </View>
              <View style={{ alignItems: "flex-end", gap: 2 }}>
                <View style={[styles.paywallSampleLine, { width: 50 }]} />
                <View style={[styles.paywallSampleLine, { width: 40 }]} />
              </View>
            </View>
          </View>

          <PrimaryButton
            title="Go Pro"
            onPress={() => router.push("/(tabs)/(settings)")}
            style={{ marginTop: spacing.xl }}
          />
        </ScrollView>
      </>
    );
  }

  // -- Pro state --
  return (
    <>
      <Stack.Screen options={{ title: "Insurance Export" }} />
      <View style={styles.flex}>
        <ScrollView contentContainerStyle={styles.container}>
          {items.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>📦</Text>
              <Text style={styles.emptyTitle}>No inventory items</Text>
              <Text style={styles.emptyBody}>
                Add items to your home inventory first, then come back to
                generate your insurance export.
              </Text>
              <PrimaryButton
                title="Go to Inventory"
                onPress={() => router.push("/(tabs)/(inventory)")}
                variant="secondary"
              />
            </View>
          ) : (
            <>
              <Text style={styles.heading}>
                Select items to include ({includedItems.length} of{" "}
                {items.length})
              </Text>
              {items.map((item) => {
                const included = !excluded.has(item.id);
                const acv = computeAcv(item);
                return (
                  <Pressable
                    key={item.id}
                    onPress={() => toggleItem(item.id)}
                    style={[
                      styles.itemRow,
                      !included && styles.itemRowExcluded,
                    ]}
                  >
                    <View
                      style={[
                        styles.checkbox,
                        included && styles.checkboxActive,
                      ]}
                    >
                      {included && (
                        <Text style={styles.checkboxMark}>✓</Text>
                      )}
                    </View>
                    <Text style={styles.itemIcon}>{item.icon}</Text>
                    <View style={styles.itemInfo}>
                      <Text
                        style={[
                          styles.itemName,
                          !included && styles.textExcluded,
                        ]}
                        numberOfLines={1}
                      >
                        {item.name}
                      </Text>
                      <Text style={styles.itemSub} numberOfLines={1}>
                        {[item.make, item.model].filter(Boolean).join(" ") ||
                          item.room ||
                          item.category}
                      </Text>
                    </View>
                    <View style={styles.itemCosts}>
                      <Text
                        style={[
                          styles.itemCostMain,
                          !included && styles.textExcluded,
                        ]}
                      >
                        {formatMoney(item.replacementCostUsd) || "—"}
                      </Text>
                      <Text style={styles.itemCostAcv}>
                        {formatMoney(acv) || "—"} ACV
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
              {items.some((i) => !i.replacementCostUsd) && (
                <Text style={styles.hint}>
                  Items without a replacement cost estimate will show $0.
                  Open the item to trigger an AI estimate.
                </Text>
              )}
            </>
          )}
        </ScrollView>

        {items.length > 0 && (
          <View style={styles.bottomBar}>
            <View style={styles.bottomTotals}>
              <View style={styles.bottomTotalCol}>
                <Text style={styles.bottomLabel}>Replacement</Text>
                <Text style={styles.bottomAmount}>
                  {formatMoney(totalReplacement) || "$0"}
                </Text>
              </View>
              <View style={styles.bottomTotalCol}>
                <Text style={styles.bottomLabel}>ACV</Text>
                <Text style={styles.bottomAmount}>
                  {formatMoney(totalAcv) || "$0"}
                </Text>
              </View>
            </View>
            <PrimaryButton
              title={exporting ? "Generating PDF..." : "Export PDF"}
              onPress={handleExport}
              loading={exporting}
              disabled={includedItems.length === 0}
            />
          </View>
        )}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: {
    padding: spacing.lg,
    paddingBottom: 180,
  },
  heading: {
    fontSize: 13,
    fontWeight: "800",
    color: colors.text,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
  },
  itemRow: {
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
  itemRowExcluded: {
    opacity: 0.5,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: colors.borderStrong,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxActive: {
    backgroundColor: colors.brand,
    borderColor: colors.brand,
  },
  checkboxMark: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "800",
    marginTop: -1,
  },
  itemIcon: {
    fontSize: 20,
  },
  itemInfo: {
    flex: 1,
    gap: 1,
  },
  itemName: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.text,
  },
  itemSub: {
    fontSize: 11,
    color: colors.textMuted,
  },
  textExcluded: {
    color: colors.textSubtle,
  },
  itemCosts: {
    alignItems: "flex-end",
    gap: 1,
  },
  itemCostMain: {
    fontSize: 13,
    fontWeight: "800",
    color: colors.text,
  },
  itemCostAcv: {
    fontSize: 10,
    color: colors.textMuted,
  },
  hint: {
    fontSize: 11,
    color: colors.textSubtle,
    textAlign: "center",
    marginTop: spacing.md,
    lineHeight: 16,
  },
  bottomBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    paddingBottom: spacing.xxl + 8,
    gap: spacing.md,
  },
  bottomTotals: {
    flexDirection: "row",
    justifyContent: "space-around",
  },
  bottomTotalCol: {
    alignItems: "center",
    gap: 2,
  },
  bottomLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  bottomAmount: {
    fontSize: 18,
    fontWeight: "800",
    color: colors.text,
  },
  empty: {
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.xl * 2,
  },
  emptyIcon: {
    fontSize: 40,
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
    maxWidth: 300,
    lineHeight: 19,
  },

  // Paywall
  paywallContainer: {
    padding: spacing.xl,
    alignItems: "center",
    paddingBottom: spacing.xxl * 2,
  },
  paywallIcon: {
    width: 72,
    height: 72,
    borderRadius: 999,
    backgroundColor: colors.brandLight,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md,
  },
  paywallIconText: {
    fontSize: 36,
  },
  paywallTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: colors.text,
    textAlign: "center",
  },
  paywallBody: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: "center",
    lineHeight: 20,
    marginTop: spacing.sm,
    maxWidth: 340,
  },
  paywallFeatures: {
    marginTop: spacing.xl,
    gap: spacing.sm,
    alignSelf: "stretch",
  },
  featureRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
  },
  featureCheck: {
    fontSize: 14,
    fontWeight: "800",
    color: colors.success,
    width: 20,
    textAlign: "center",
  },
  featureText: {
    fontSize: 14,
    color: colors.text,
    flex: 1,
  },

  // Sample PDF placeholder
  paywallSample: {
    marginTop: spacing.xl,
    alignSelf: "stretch",
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.md,
  },
  paywallSampleTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: colors.text,
    textAlign: "center",
  },
  paywallSampleSubtitle: {
    fontSize: 10,
    color: colors.textMuted,
    textAlign: "center",
    marginTop: -8,
  },
  paywallSampleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.xs,
    borderTopWidth: 1,
    borderColor: colors.border,
  },
  paywallSampleThumb: {
    width: 32,
    height: 32,
    borderRadius: 4,
    backgroundColor: "#f5f5f4",
    borderWidth: 1,
    borderColor: colors.border,
  },
  paywallSampleLine: {
    height: 8,
    borderRadius: 4,
    backgroundColor: "#f5f5f4",
    width: "80%",
  },
});
