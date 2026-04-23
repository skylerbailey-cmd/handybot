import { useCallback, useEffect, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import {
  createReminderFromSuggestion,
  formatFrequency,
  loadReminders,
  requestNotificationPermissions,
} from "@/lib/reminders";
import { showPaywallAlert } from "@/lib/showPaywall";
import { canAddReminder } from "@/lib/tiers";
import { colors, radius, spacing } from "@/lib/theme";
import type { SuggestedReminder } from "@/lib/types";

interface Props {
  suggestions: SuggestedReminder[];
  sourceIssueId: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Shown inside the Plan tab once a repair is complete. Lets the user
 * one-tap enable each Claude-suggested follow-up reminder. Tracks "already
 * added" state by matching title + sourceIssueId against stored reminders.
 */
export default function SuggestedRemindersCard({
  suggestions,
  sourceIssueId,
}: Props) {
  const [addedTitles, setAddedTitles] = useState<Set<string>>(new Set());
  const [busyTitle, setBusyTitle] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const all = await loadReminders();
    const mine = all.filter((r) => r.sourceIssueId === sourceIssueId);
    setAddedTitles(new Set(mine.map((r) => r.title)));
  }, [sourceIssueId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function handleAdd(s: SuggestedReminder) {
    if (busyTitle) return;
    setBusyTitle(s.title);
    try {
      const granted = await requestNotificationPermissions();
      if (!granted) {
        Alert.alert(
          "Notifications disabled",
          "HandyBot will still track this reminder in the app, but your phone won't notify you. You can enable notifications in your device Settings.",
          [
            {
              text: "Add anyway",
              onPress: async () => {
                await addSuggestion(s);
              },
            },
            { text: "Cancel", style: "cancel" },
          ]
        );
        return;
      }
      await addSuggestion(s);
    } finally {
      setBusyTitle(null);
    }
  }

  async function addSuggestion(s: SuggestedReminder) {
    const check = await canAddReminder();
    if (!check.allowed) {
      showPaywallAlert(check.message);
      return;
    }
    const startDate = new Date(Date.now() + s.frequencyDays * DAY_MS);
    await createReminderFromSuggestion({
      suggestion: s,
      sourceIssueId,
      startDate,
    });
    await refresh();
  }

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.icon}>🔔</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Keep it fixed</Text>
          <Text style={styles.sub}>
            Turn this one-time repair into a habit. Add any of these recurring
            reminders — we&apos;ll notify you when each one is due.
          </Text>
        </View>
      </View>

      <View style={styles.list}>
        {suggestions.map((s, i) => {
          const already = addedTitles.has(s.title);
          const isBusy = busyTitle === s.title;
          return (
            <View
              key={`${s.title}-${i}`}
              style={[styles.row, i > 0 && styles.rowDivider]}
            >
              <View style={styles.rowIconWrap}>
                <Text style={styles.rowIcon}>{s.icon || "🛠"}</Text>
              </View>
              <View style={styles.rowBody}>
                <Text style={styles.rowTitle}>{s.title}</Text>
                <Text style={styles.rowDesc} numberOfLines={3}>
                  {s.description}
                </Text>
                <Text style={styles.rowFreq}>
                  {formatFrequency(s.frequencyDays)}
                </Text>
              </View>
              <Pressable
                onPress={() => handleAdd(s)}
                disabled={already || isBusy}
                style={({ pressed }) => [
                  styles.addBtn,
                  already && styles.addBtnAdded,
                  pressed && !already && { opacity: 0.85 },
                ]}
              >
                <Text
                  style={[
                    styles.addBtnText,
                    already && styles.addBtnTextAdded,
                  ]}
                >
                  {already ? "✓ Added" : isBusy ? "..." : "+ Add"}
                </Text>
              </Pressable>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: "#a7f3d0",
    backgroundColor: "#ecfdf5",
    padding: spacing.lg,
  },
  headerRow: {
    flexDirection: "row",
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  icon: {
    fontSize: 28,
  },
  title: {
    fontSize: 16,
    fontWeight: "800",
    color: "#065f46",
  },
  sub: {
    marginTop: 2,
    fontSize: 13,
    color: "#047857",
    lineHeight: 18,
  },
  list: {
    backgroundColor: "#ffffff",
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: "#bbf7d0",
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.md,
  },
  rowDivider: {
    borderTopWidth: 1,
    borderColor: "#d1fae5",
  },
  rowIconWrap: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: "#ecfdf5",
    alignItems: "center",
    justifyContent: "center",
  },
  rowIcon: {
    fontSize: 20,
  },
  rowBody: {
    flex: 1,
    minWidth: 0,
  },
  rowTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.text,
  },
  rowDesc: {
    marginTop: 2,
    fontSize: 12,
    color: colors.textMuted,
    lineHeight: 17,
  },
  rowFreq: {
    marginTop: 3,
    fontSize: 11,
    fontWeight: "700",
    color: colors.textSubtle,
  },
  addBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.brand,
  },
  addBtnAdded: {
    backgroundColor: colors.successBg,
  },
  addBtnText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#ffffff",
  },
  addBtnTextAdded: {
    color: colors.success,
  },
});
