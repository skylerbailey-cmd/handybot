import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { colors, radius, spacing } from "@/lib/theme";

type Variant = "primary" | "secondary" | "danger";

interface Props {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: Variant;
  style?: StyleProp<ViewStyle>;
}

export default function PrimaryButton({
  title,
  onPress,
  disabled,
  loading,
  variant = "primary",
  style,
}: Props) {
  const v = variants[variant];
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.base,
        { backgroundColor: v.bg, borderColor: v.border },
        (disabled || loading) && styles.disabled,
        pressed && { opacity: 0.85 },
        style,
      ]}
    >
      <View style={styles.inner}>
        {loading ? (
          <ActivityIndicator color={v.text} />
        ) : (
          <Text style={[styles.text, { color: v.text }]}>{title}</Text>
        )}
      </View>
    </Pressable>
  );
}

const variants: Record<Variant, { bg: string; text: string; border: string }> = {
  primary: {
    bg: colors.brand,
    text: "#ffffff",
    border: colors.brand,
  },
  secondary: {
    bg: colors.surface,
    text: colors.text,
    border: colors.borderStrong,
  },
  danger: {
    bg: colors.surface,
    text: colors.danger,
    border: "#fecaca",
  },
};

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.md,
    borderWidth: 1,
    paddingVertical: spacing.md + 2,
    paddingHorizontal: spacing.lg,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  disabled: {
    opacity: 0.55,
  },
  inner: {
    alignItems: "center",
    justifyContent: "center",
  },
  text: {
    fontSize: 15,
    fontWeight: "600",
  },
});
