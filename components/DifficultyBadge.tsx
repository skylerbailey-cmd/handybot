import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { difficultyColors, radius, spacing } from "@/lib/theme";
import type { Difficulty } from "@/lib/types";

interface Props {
  difficulty: Difficulty;
  style?: StyleProp<ViewStyle>;
}

export default function DifficultyBadge({ difficulty, style }: Props) {
  const c = difficultyColors[difficulty];
  return (
    <View style={[styles.badge, { backgroundColor: c.bg }, style]}>
      <Text style={[styles.text, { color: c.fg }]}>{difficulty}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 3,
    borderRadius: radius.pill,
    alignSelf: "flex-start",
  },
  text: {
    fontSize: 12,
    fontWeight: "700",
  },
});
