import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, radius, spacing } from "@/lib/theme";

interface Tab<T extends string> {
  key: T;
  label: string;
  badge?: number;
}

interface Props<T extends string> {
  tabs: ReadonlyArray<Tab<T>>;
  value: T;
  onChange: (value: T) => void;
}

export default function SegmentedTabs<T extends string>({
  tabs,
  value,
  onChange,
}: Props<T>) {
  return (
    <View style={styles.track}>
      {tabs.map((tab) => {
        const active = tab.key === value;
        return (
          <Pressable
            key={tab.key}
            onPress={() => onChange(tab.key)}
            style={[styles.tab, active && styles.tabActive]}
          >
            <Text style={[styles.label, active && styles.labelActive]}>
              {tab.label}
            </Text>
            {tab.badge !== undefined && tab.badge > 0 && (
              <View style={[styles.badge, active && styles.badgeActive]}>
                <Text
                  style={[styles.badgeText, active && styles.badgeTextActive]}
                >
                  {tab.badge}
                </Text>
              </View>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: "row",
    backgroundColor: "#f5f5f4",
    borderRadius: radius.md,
    padding: 3,
    marginHorizontal: spacing.lg,
    marginVertical: spacing.sm,
  },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.sm + 2,
  },
  tabActive: {
    backgroundColor: colors.surface,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.textMuted,
  },
  labelActive: {
    color: colors.text,
  },
  badge: {
    minWidth: 20,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: radius.pill,
    backgroundColor: "#e7e5e4",
    alignItems: "center",
    justifyContent: "center",
  },
  badgeActive: {
    backgroundColor: colors.brand,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.textMuted,
  },
  badgeTextActive: {
    color: "#fff",
  },
});
