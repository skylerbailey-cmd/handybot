import { Pressable, StyleSheet, Switch, Text, View } from "react-native";
import { formatDueDate, formatFrequency } from "@/lib/reminders";
import { colors, radius, spacing } from "@/lib/theme";
import type { Reminder } from "@/lib/types";

interface Props {
  reminder: Reminder;
  onToggle: (enabled: boolean) => void;
  onPress?: () => void;
}

export default function ReminderRow({ reminder, onToggle, onPress }: Props) {
  const overdue = reminder.enabled && reminder.nextDue <= Date.now();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && { opacity: 0.85 }]}
    >
      <View
        style={[
          styles.iconWrap,
          reminder.enabled
            ? { backgroundColor: colors.brandLight }
            : { backgroundColor: "#f5f5f4" },
        ]}
      >
        <Text style={styles.icon}>{reminder.icon}</Text>
      </View>
      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={1}>
          {reminder.title}
        </Text>
        {reminder.description && (
          <Text style={styles.description} numberOfLines={2}>
            {reminder.description}
          </Text>
        )}
        <View style={styles.metaRow}>
          <Text style={styles.metaText}>
            {formatFrequency(reminder.frequencyDays)}
          </Text>
          {reminder.enabled && (
            <>
              <Text style={styles.metaDot}>·</Text>
              <Text
                style={[
                  styles.metaText,
                  overdue && styles.overdueText,
                ]}
              >
                {formatDueDate(reminder)}
              </Text>
            </>
          )}
        </View>
      </View>
      <Switch
        value={reminder.enabled}
        onValueChange={onToggle}
        trackColor={{ false: "#d6d3d1", true: colors.brand }}
        thumbColor="#ffffff"
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  icon: {
    fontSize: 22,
  },
  body: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.text,
  },
  description: {
    marginTop: 2,
    fontSize: 12,
    color: colors.textMuted,
    lineHeight: 17,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 4,
  },
  metaText: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.textSubtle,
  },
  overdueText: {
    color: colors.danger,
  },
  metaDot: {
    fontSize: 11,
    color: colors.textSubtle,
  },
});
