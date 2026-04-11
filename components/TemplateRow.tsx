import { Pressable, StyleSheet, Text, View } from "react-native";
import { formatFrequency } from "@/lib/reminders";
import { colors, radius, spacing } from "@/lib/theme";
import type { MaintenanceTemplate } from "@/lib/types";

interface Props {
  template: MaintenanceTemplate;
  alreadyEnabled: boolean;
  onPress: () => void;
}

export default function TemplateRow({
  template,
  alreadyEnabled,
  onPress,
}: Props) {
  return (
    <Pressable
      onPress={onPress}
      disabled={alreadyEnabled}
      style={({ pressed }) => [
        styles.row,
        pressed && !alreadyEnabled && { opacity: 0.85 },
        alreadyEnabled && styles.rowEnabled,
      ]}
    >
      <View style={styles.iconWrap}>
        <Text style={styles.icon}>{template.icon}</Text>
      </View>
      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={1}>
          {template.title}
        </Text>
        <Text style={styles.description} numberOfLines={2}>
          {template.description}
        </Text>
        <Text style={styles.meta}>{formatFrequency(template.frequencyDays)}</Text>
      </View>
      <View style={styles.action}>
        {alreadyEnabled ? (
          <Text style={styles.addedText}>✓ Added</Text>
        ) : (
          <Text style={styles.addText}>Add</Text>
        )}
      </View>
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
  rowEnabled: {
    backgroundColor: "#fafaf9",
    opacity: 0.75,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    backgroundColor: "#f5f5f4",
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
  meta: {
    marginTop: 4,
    fontSize: 11,
    fontWeight: "700",
    color: colors.textSubtle,
  },
  action: {
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.brand,
  },
  addText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#ffffff",
  },
  addedText: {
    fontSize: 12,
    fontWeight: "800",
    color: colors.success,
  },
});
