import { Link, useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { formatDueDate } from "@/lib/reminders";
import { colors, radius, spacing } from "@/lib/theme";
import type { Reminder } from "@/lib/types";

interface Props {
  reminders: Reminder[];
  onMarkDone?: (reminder: Reminder) => void;
}

/**
 * Surfaces the next 1-3 upcoming maintenance reminders at the top of the
 * home screen so the user remembers what's on deck without having to open
 * the Reminders tab. Tapping a row deep-links into Reminders with that
 * reminder highlighted.
 */
export default function UpcomingRemindersCard({ reminders, onMarkDone }: Props) {
  const router = useRouter();

  if (reminders.length === 0) return null;

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <Text style={styles.icon}>🔔</Text>
          <Text style={styles.title}>Upcoming maintenance</Text>
        </View>
        <Link href="/reminders" asChild>
          <Pressable hitSlop={6}>
            <Text style={styles.seeAll}>See all →</Text>
          </Pressable>
        </Link>
      </View>

      <View style={styles.list}>
        {reminders.map((r, i) => {
          const overdue = r.nextDue <= Date.now();
          return (
            <Pressable
              key={r.id}
              onPress={() =>
                router.push({
                  pathname: "/reminders",
                  params: { highlight: r.id },
                })
              }
              style={({ pressed }) => [
                styles.row,
                i > 0 && styles.rowDivider,
                pressed && { opacity: 0.85 },
              ]}
            >
              <View style={styles.rowIconWrap}>
                <Text style={styles.rowIcon}>{r.icon}</Text>
              </View>
              <View style={styles.rowBody}>
                <Text style={styles.rowTitle} numberOfLines={1}>
                  {r.title}
                </Text>
                <Text
                  style={[styles.rowDue, overdue && styles.rowDueOverdue]}
                >
                  {formatDueDate(r)}
                </Text>
                {overdue && onMarkDone && (
                  <Pressable
                    onPress={(e) => {
                      e.stopPropagation();
                      onMarkDone(r);
                    }}
                    style={({ pressed }) => [
                      styles.markDoneBtn,
                      pressed && { opacity: 0.85 },
                    ]}
                  >
                    <Text style={styles.markDoneBtnText}>✓ Done</Text>
                  </Pressable>
                )}
              </View>
              <Text style={styles.chevron}>›</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md + 2,
    marginBottom: spacing.md,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.sm,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  icon: {
    fontSize: 18,
  },
  title: {
    fontSize: 13,
    fontWeight: "800",
    color: colors.text,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  seeAll: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.brand,
  },
  list: {
    backgroundColor: "#fafaf9",
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
  },
  rowDivider: {
    borderTopWidth: 1,
    borderColor: colors.border,
  },
  rowIconWrap: {
    width: 32,
    height: 32,
    borderRadius: radius.pill,
    backgroundColor: colors.brandLight,
    alignItems: "center",
    justifyContent: "center",
  },
  rowIcon: {
    fontSize: 16,
  },
  rowBody: {
    flex: 1,
    minWidth: 0,
  },
  rowTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.text,
  },
  rowDue: {
    marginTop: 1,
    fontSize: 11,
    fontWeight: "700",
    color: colors.textSubtle,
  },
  rowDueOverdue: {
    color: colors.danger,
  },
  chevron: {
    fontSize: 22,
    color: colors.textSubtle,
  },
  markDoneBtn: {
    alignSelf: "flex-start",
    marginTop: spacing.xs + 2,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.success,
  },
  markDoneBtnText: {
    color: "#ffffff",
    fontSize: 11,
    fontWeight: "800",
  },
});
