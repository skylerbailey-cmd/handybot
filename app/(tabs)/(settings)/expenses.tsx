import { Stack, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { isAtLeast } from "@/lib/tiers";
import { showPaywallAlert } from "@/lib/showPaywall";
import { loadIssues } from "@/lib/storage";
import { getActiveHome } from "@/lib/homes";
import { shareScheduleECsv } from "@/lib/scheduleEExport";
import { colors, radius, spacing } from "@/lib/theme";
import type { ExpenseCategory, Issue } from "@/lib/types";

const CATEGORY_LABEL: Record<ExpenseCategory, string> = {
  repairs: "Repairs",
  maintenance: "Maintenance",
  supplies: "Supplies",
  improvements: "Improvements",
  auto_travel: "Auto & Travel",
  other: "Other",
};

const CATEGORY_ORDER: ExpenseCategory[] = [
  "repairs",
  "maintenance",
  "supplies",
  "improvements",
  "auto_travel",
  "other",
];

export default function ExpensesScreen() {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [homeName, setHomeName] = useState("Home");
  const [exporting, setExporting] = useState(false);

  useFocusEffect(
    useCallback(() => {
      loadIssues().then(setIssues);
      getActiveHome().then((h) => {
        if (h) setHomeName(h.name);
      });
    }, [])
  );

  if (!isAtLeast("landlord")) {
    return (
      <>
        <Stack.Screen options={{ title: "Expenses & Taxes" }} />
        <View style={styles.gateContainer}>
          <Text style={styles.gateIcon}>📊</Text>
          <Text style={styles.gateTitle}>
            Schedule E tracking is a Landlord feature
          </Text>
          <Text style={styles.gateBody}>
            Track repair expenses by tax category and export a year-end CSV
            ready for Schedule E / TurboTax.
          </Text>
          <Pressable
            onPress={() =>
              showPaywallAlert(
                "Schedule E expense tracking is only available on the Landlord plan."
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

  const withExpense = issues.filter((i) => {
    if (!i.expenseAmountUsd || i.expenseAmountUsd <= 0) return false;
    const d = i.expenseDate ?? i.updatedAt;
    return new Date(d).getFullYear() === year;
  });

  const grandTotal = withExpense.reduce(
    (s, i) => s + (i.expenseAmountUsd ?? 0),
    0
  );

  const categoryTotals = CATEGORY_ORDER.map((cat) => {
    const inCat = withExpense.filter(
      (i) => (i.expenseCategory ?? "other") === cat
    );
    const total = inCat.reduce((s, i) => s + (i.expenseAmountUsd ?? 0), 0);
    return { cat, label: CATEGORY_LABEL[cat], items: inCat, total };
  }).filter((c) => c.items.length > 0);

  async function handleExport() {
    setExporting(true);
    try {
      await shareScheduleECsv({ issues, homeName, year });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Export failed";
      if (!msg.includes("cancelled") && !msg.includes("canceled")) {
        Alert.alert("Export failed", msg);
      }
    } finally {
      setExporting(false);
    }
  }

  return (
    <>
      <Stack.Screen options={{ title: "Expenses & Taxes" }} />
      <ScrollView contentContainerStyle={styles.container}>
        {/* Year picker */}
        <View style={styles.yearRow}>
          <Pressable onPress={() => setYear((y) => y - 1)}>
            <Text style={styles.yearArrow}>‹</Text>
          </Pressable>
          <Text style={styles.yearLabel}>{year}</Text>
          <Pressable
            onPress={() => setYear((y) => Math.min(y + 1, currentYear))}
          >
            <Text
              style={[
                styles.yearArrow,
                year >= currentYear && { opacity: 0.3 },
              ]}
            >
              ›
            </Text>
          </Pressable>
        </View>

        {/* Summary card */}
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Total expenses — {year}</Text>
          <Text style={styles.summaryAmount}>
            ${grandTotal.toFixed(2)}
          </Text>
          <Text style={styles.summaryHome}>{homeName}</Text>
        </View>

        {/* Category breakdown */}
        {categoryTotals.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>
              No expenses recorded for {year}. Add expenses on your completed
              repairs to track them here.
            </Text>
          </View>
        ) : (
          categoryTotals.map(({ cat, label, items, total }) => (
            <View key={cat} style={styles.catSection}>
              <View style={styles.catHeader}>
                <Text style={styles.catTitle}>{label}</Text>
                <Text style={styles.catTotal}>${total.toFixed(2)}</Text>
              </View>
              {items.map((issue) => (
                <View key={issue.id} style={styles.expenseRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.expenseTitle} numberOfLines={1}>
                      {issue.title}
                    </Text>
                    <Text style={styles.expenseDate}>
                      {new Date(
                        issue.expenseDate ?? issue.updatedAt
                      ).toLocaleDateString()}
                      {issue.receiptVendor
                        ? ` — ${issue.receiptVendor}`
                        : ""}
                    </Text>
                  </View>
                  <Text style={styles.expenseAmount}>
                    ${(issue.expenseAmountUsd ?? 0).toFixed(2)}
                  </Text>
                </View>
              ))}
            </View>
          ))
        )}

        {/* Export button */}
        {withExpense.length > 0 && (
          <Pressable
            onPress={handleExport}
            disabled={exporting}
            style={[styles.exportBtn, exporting && { opacity: 0.6 }]}
          >
            <Text style={styles.exportBtnText}>
              {exporting ? "Exporting..." : "Export CSV for Schedule E"}
            </Text>
          </Pressable>
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
  yearRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.lg,
    marginBottom: spacing.lg,
  },
  yearArrow: {
    fontSize: 28,
    fontWeight: "700",
    color: colors.brand,
    paddingHorizontal: spacing.md,
  },
  yearLabel: {
    fontSize: 20,
    fontWeight: "900",
    color: colors.text,
  },
  summaryCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    alignItems: "center",
    marginBottom: spacing.lg,
  },
  summaryLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.textSubtle,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  summaryAmount: {
    fontSize: 32,
    fontWeight: "900",
    color: colors.text,
    marginTop: spacing.xs,
  },
  summaryHome: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 2,
  },
  empty: {
    padding: spacing.lg,
    alignItems: "center",
  },
  emptyText: {
    fontSize: 13,
    color: colors.textMuted,
    textAlign: "center",
    lineHeight: 19,
  },
  catSection: {
    marginBottom: spacing.md,
  },
  catHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    marginBottom: spacing.xs,
  },
  catTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: colors.text,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  catTotal: {
    fontSize: 14,
    fontWeight: "800",
    color: colors.text,
  },
  expenseRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.xs,
    gap: spacing.md,
  },
  expenseTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.text,
  },
  expenseDate: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 1,
  },
  expenseAmount: {
    fontSize: 15,
    fontWeight: "800",
    color: colors.text,
  },
  exportBtn: {
    backgroundColor: colors.brand,
    borderRadius: radius.md,
    paddingVertical: spacing.md + 2,
    alignItems: "center",
    marginTop: spacing.md,
  },
  exportBtnText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "800",
  },
});
