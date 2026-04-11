import { useState } from "react";
import {
  Alert,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { promptAndPickImage } from "@/lib/image";
import { colors, radius, spacing } from "@/lib/theme";

interface Props {
  value: string | null;
  onChange: (uri: string | null) => void;
  label?: string;
  helperText?: string;
  /** Render a compact square (for chat composer) vs full-width dropzone. */
  variant?: "dropzone" | "compact";
}

export default function ImagePickerButton({
  value,
  onChange,
  label = "Add a photo",
  helperText = "Tap to take a photo or pick one from your library",
  variant = "dropzone",
}: Props) {
  const [busy, setBusy] = useState(false);

  async function open() {
    setBusy(true);
    try {
      const result = await promptAndPickImage();
      if (result) onChange(result.uri);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not load image.";
      Alert.alert("Can't attach photo", msg);
    } finally {
      setBusy(false);
    }
  }

  if (value) {
    return (
      <View style={variant === "dropzone" ? styles.previewWrap : styles.previewWrapCompact}>
        <Image source={{ uri: value }} style={styles.previewImage} />
        <Pressable
          onPress={() => onChange(null)}
          style={styles.removeBtn}
          hitSlop={8}
        >
          <Text style={styles.removeBtnText}>✕</Text>
        </Pressable>
      </View>
    );
  }

  if (variant === "compact") {
    return (
      <Pressable
        onPress={open}
        disabled={busy}
        style={({ pressed }) => [
          styles.compactButton,
          pressed && { opacity: 0.7 },
        ]}
      >
        <Text style={styles.compactIcon}>📷</Text>
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={open}
      disabled={busy}
      style={({ pressed }) => [styles.dropzone, pressed && styles.dropzonePressed]}
    >
      <View style={styles.iconCircle}>
        <Text style={styles.iconText}>📷</Text>
      </View>
      <Text style={styles.label}>{busy ? "Loading..." : label}</Text>
      <Text style={styles.helper}>{helperText}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  dropzone: {
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: colors.borderStrong,
    backgroundColor: "#fafaf9",
    borderRadius: radius.lg,
    padding: spacing.xl,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
  },
  dropzonePressed: {
    borderColor: colors.brand,
    backgroundColor: colors.brandLighter,
  },
  iconCircle: {
    width: 52,
    height: 52,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  iconText: {
    fontSize: 24,
  },
  label: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.textMuted,
  },
  helper: {
    fontSize: 12,
    color: colors.textSubtle,
    textAlign: "center",
  },
  previewWrap: {
    position: "relative",
    borderRadius: radius.lg,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.border,
  },
  previewWrapCompact: {
    position: "relative",
    borderRadius: radius.md,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.border,
    width: 120,
    height: 120,
  },
  previewImage: {
    width: "100%",
    aspectRatio: 1,
  },
  removeBtn: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: radius.pill,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
  },
  removeBtnText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
  },
  compactButton: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  compactIcon: {
    fontSize: 20,
  },
});
