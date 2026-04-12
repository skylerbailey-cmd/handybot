import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, radius, spacing } from "@/lib/theme";

interface Props {
  checked: boolean;
  onToggle: () => void;
  title: string;
  subtitle?: string;
  rightText?: string;
  badge?: string;
  detail?: string;
}

export default function ChecklistRow({
  checked,
  onToggle,
  title,
  subtitle,
  rightText,
  badge,
  detail,
}: Props) {
  return (
    <Pressable
      onPress={onToggle}
      style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}
    >
      <View style={[styles.check, checked && styles.checkOn]}>
        {checked && <Text style={styles.checkMark}>✓</Text>}
      </View>
      <View style={styles.body}>
        <View style={styles.titleRow}>
          <Text
            style={[styles.title, checked && styles.titleDone]}
            numberOfLines={2}
          >
            {title}
          </Text>
          {badge && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{badge}</Text>
            </View>
          )}
          {rightText && <Text style={styles.right}>{rightText}</Text>}
        </View>
        {subtitle && (
          <Text
            style={[styles.subtitle, checked && styles.subtitleDone]}
            numberOfLines={2}
          >
            {subtitle}
          </Text>
        )}
        {detail && (
          <Text style={[styles.detail, checked && styles.detailDone]}>
            {detail}
          </Text>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  check: {
    width: 24,
    height: 24,
    borderRadius: radius.sm,
    borderWidth: 2,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  checkOn: {
    backgroundColor: colors.brand,
    borderColor: colors.brand,
  },
  checkMark: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "800",
    lineHeight: 16,
  },
  body: {
    flex: 1,
    minWidth: 0,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  title: {
    flex: 1,
    fontSize: 15,
    fontWeight: "600",
    color: colors.text,
  },
  titleDone: {
    color: colors.textSubtle,
    textDecorationLine: "line-through",
  },
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.sm,
    backgroundColor: colors.brandLight,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: colors.brandDark,
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  right: {
    fontSize: 12,
    color: colors.textSubtle,
    fontWeight: "600",
  },
  subtitle: {
    marginTop: 2,
    fontSize: 13,
    color: colors.textMuted,
  },
  subtitleDone: {
    color: colors.textSubtle,
  },
  detail: {
    marginTop: 4,
    fontSize: 13,
    lineHeight: 19,
    color: colors.textMuted,
  },
  detailDone: {
    color: colors.textSubtle,
  },
});
