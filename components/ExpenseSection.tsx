import { useState } from "react";
import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { extractReceiptData } from "@/lib/claude";
import { promptAndPickImage, readImageAsBase64 } from "@/lib/image";
import { getTierLimits } from "@/lib/tiers";
import { showPaywallAlert } from "@/lib/showPaywall";
import { colors, radius, spacing } from "@/lib/theme";
import type { ExpenseCategory, Issue } from "@/lib/types";

interface Props {
  issue: Issue;
  onUpdate: (fields: Partial<Issue>) => void;
}

const CATEGORIES: { value: ExpenseCategory; label: string }[] = [
  { value: "repairs", label: "Repairs" },
  { value: "maintenance", label: "Maintenance" },
  { value: "supplies", label: "Supplies" },
  { value: "improvements", label: "Improvements" },
  { value: "auto_travel", label: "Auto & Travel" },
  { value: "other", label: "Other" },
];

export default function ExpenseSection({ issue, onUpdate }: Props) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(!!issue.expenseAmountUsd);
  const [amount, setAmount] = useState(
    issue.expenseAmountUsd ? String(issue.expenseAmountUsd) : ""
  );
  const [category, setCategory] = useState<ExpenseCategory>(
    issue.expenseCategory ?? "repairs"
  );
  const [vendor, setVendor] = useState(issue.receiptVendor ?? "");
  const [receiptUri, setReceiptUri] = useState(issue.receiptPhotoUri);
  const [scanning, setScanning] = useState(false);
  const [dirty, setDirty] = useState(false);

  const canTrack = getTierLimits().scheduleETracking;

  function markDirty() {
    setDirty(true);
  }

  async function handleAddReceipt() {
    try {
      const result = await promptAndPickImage("Add receipt photo");
      if (result) {
        setReceiptUri(result.uri);
        markDirty();
      }
    } catch {
      /* cancelled */
    }
  }

  async function handleAutoFill() {
    if (!receiptUri) return;
    setScanning(true);
    try {
      const base64 = await readImageAsBase64(receiptUri);
      const data = await extractReceiptData({ imageBase64: base64 });
      if (data.totalUsd > 0) {
        setAmount(String(data.totalUsd));
      }
      if (data.vendorName) {
        setVendor(data.vendorName);
      }
      if (data.dateIso) {
        const parsed = new Date(data.dateIso).getTime();
        if (!isNaN(parsed)) {
          onUpdate({ expenseDate: parsed });
        }
      }
      markDirty();
    } catch {
      Alert.alert("OCR failed", "Could not read the receipt. Fill in the fields manually.");
    } finally {
      setScanning(false);
    }
  }

  function handleSave() {
    if (!canTrack) {
      showPaywallAlert(
        "Schedule E expense tracking is only available on the Landlord plan."
      );
      return;
    }
    const parsed = parseFloat(amount);
    onUpdate({
      expenseAmountUsd: parsed > 0 ? Math.round(parsed * 100) / 100 : undefined,
      expenseCategory: category,
      receiptVendor: vendor.trim() || undefined,
      receiptPhotoUri: receiptUri,
      expenseDate: issue.expenseDate ?? issue.updatedAt,
    });
    setDirty(false);
    Alert.alert("Expense saved", "This repair's expense has been recorded.");
  }

  return (
    <View style={styles.container}>
      <Pressable
        onPress={() => setExpanded((e) => !e)}
        style={styles.header}
      >
        <Text style={styles.headerIcon}>💰</Text>
        <Text style={styles.headerTitle}>Expense</Text>
        {!canTrack && (
          <View style={styles.tierBadge}>
            <Text style={styles.tierBadgeText}>Landlord</Text>
          </View>
        )}
        {issue.expenseAmountUsd && issue.expenseAmountUsd > 0 && (
          <Text style={styles.headerAmount}>
            ${issue.expenseAmountUsd.toFixed(2)}
          </Text>
        )}
        <Text style={styles.chevron}>{expanded ? "▾" : "▸"}</Text>
      </Pressable>

      {expanded && (
        <View style={styles.body}>
          <Text style={styles.label}>Amount (USD)</Text>
          <TextInput
            style={styles.input}
            value={amount}
            onChangeText={(v) => {
              setAmount(v);
              markDirty();
            }}
            placeholder="0.00"
            placeholderTextColor={colors.textSubtle}
            keyboardType="decimal-pad"
          />

          <Text style={styles.label}>Category</Text>
          <View style={styles.categoryGrid}>
            {CATEGORIES.map((c) => (
              <Pressable
                key={c.value}
                onPress={() => {
                  setCategory(c.value);
                  markDirty();
                }}
                style={[
                  styles.categoryChip,
                  category === c.value && styles.categoryChipActive,
                ]}
              >
                <Text
                  style={[
                    styles.categoryChipText,
                    category === c.value && styles.categoryChipTextActive,
                  ]}
                >
                  {c.label}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.label}>Vendor</Text>
          <TextInput
            style={styles.input}
            value={vendor}
            onChangeText={(v) => {
              setVendor(v);
              markDirty();
            }}
            placeholder="e.g. Home Depot, Joe's Plumbing"
            placeholderTextColor={colors.textSubtle}
          />

          <View style={styles.receiptRow}>
            <Pressable onPress={handleAddReceipt} style={styles.receiptBtn}>
              <Text style={styles.receiptBtnText}>
                {receiptUri ? "Change receipt" : "Add receipt photo"}
              </Text>
            </Pressable>
            {receiptUri && (
              <Pressable
                onPress={handleAutoFill}
                disabled={scanning}
                style={[styles.autoFillBtn, scanning && { opacity: 0.6 }]}
              >
                <Text style={styles.autoFillBtnText}>
                  {scanning ? "Reading..." : "Auto-fill from receipt"}
                </Text>
              </Pressable>
            )}
          </View>

          {dirty && (
            <Pressable onPress={handleSave} style={styles.saveBtn}>
              <Text style={styles.saveBtnText}>Save Expense</Text>
            </Pressable>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.md,
    gap: spacing.sm,
  },
  headerIcon: { fontSize: 18 },
  headerTitle: { fontSize: 14, fontWeight: "700", color: colors.text, flex: 1 },
  headerAmount: {
    fontSize: 14,
    fontWeight: "800",
    color: colors.text,
  },
  tierBadge: {
    backgroundColor: "#fef3c7",
    paddingHorizontal: spacing.xs + 2,
    paddingVertical: 1,
    borderRadius: radius.pill,
  },
  tierBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#92400e",
  },
  chevron: {
    fontSize: 14,
    color: colors.textSubtle,
  },
  body: {
    padding: spacing.md,
    paddingTop: 0,
    gap: spacing.sm,
  },
  label: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.textSubtle,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.sm,
    fontSize: 15,
    color: colors.text,
  },
  categoryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
  },
  categoryChip: {
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs + 1,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
  },
  categoryChipActive: {
    backgroundColor: colors.brand,
    borderColor: colors.brand,
  },
  categoryChipText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.textMuted,
  },
  categoryChipTextActive: { color: "#fff" },
  receiptRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  receiptBtn: {
    borderWidth: 1,
    borderColor: colors.brand,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  receiptBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.brand,
  },
  autoFillBtn: {
    backgroundColor: "#ede9fe",
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  autoFillBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#7c3aed",
  },
  saveBtn: {
    backgroundColor: colors.brand,
    borderRadius: radius.md,
    paddingVertical: spacing.sm + 2,
    alignItems: "center",
    marginTop: spacing.xs,
  },
  saveBtnText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "800",
  },
});
