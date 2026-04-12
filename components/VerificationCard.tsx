import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from "react-native";
import { colors, radius, spacing } from "@/lib/theme";
import type { VerificationResult } from "@/lib/types";

interface Props {
  /** True when Claude is actively verifying a freshly-uploaded photo. */
  verifying: boolean;
  /** Latest verification result, if any. */
  result?: VerificationResult;
  /** Called when the user taps the verify/re-verify button. */
  onRequestVerify: () => void;
}

/**
 * Appears at the bottom of the Plan tab once every step is checked off.
 * Lets the user submit a "finished work" photo for Claude to verify.
 * Handles three display states:
 *  1. No result yet → prompts for a photo.
 *  2. Verifying → spinner + status.
 *  3. Result present → pass / fail card with appropriate CTA.
 */
export default function VerificationCard({
  verifying,
  result,
  onRequestVerify,
}: Props) {
  if (verifying) {
    return (
      <View style={[styles.card, styles.cardNeutral]}>
        <ActivityIndicator color={colors.brand} size="large" />
        <Text style={styles.title}>Verifying your work...</Text>
        <Text style={styles.body}>
          HandyBot is looking at your photo and checking that the repair
          looks right.
        </Text>
      </View>
    );
  }

  if (!result) {
    return (
      <View style={[styles.card, styles.cardNeutral]}>
        <View style={styles.iconCircle}>
          <Text style={styles.iconText}>📸</Text>
        </View>
        <Text style={styles.title}>Verify your work</Text>
        <Text style={styles.body}>
          Before we call this done, snap a photo of the finished repair.
          HandyBot will take a look and either confirm it&apos;s good or
          add fix-up steps if something needs a second pass.
        </Text>
        <Pressable
          onPress={onRequestVerify}
          style={({ pressed }) => [
            styles.primaryBtn,
            pressed && { opacity: 0.85 },
          ]}
        >
          <Text style={styles.primaryBtnText}>Upload finished photo</Text>
        </Pressable>
      </View>
    );
  }

  if (result.verified) {
    return (
      <View style={[styles.card, styles.cardSuccess]}>
        <View style={[styles.iconCircle, { backgroundColor: "#bbf7d0" }]}>
          <Text style={styles.iconText}>✅</Text>
        </View>
        <Text style={[styles.title, { color: "#065f46" }]}>
          Verified — nice work!
        </Text>
        <Text style={[styles.body, { color: "#047857" }]}>{result.feedback}</Text>
        {result.photoUri && (
          <Image source={{ uri: result.photoUri }} style={styles.photo} />
        )}
        <Pressable
          onPress={onRequestVerify}
          style={({ pressed }) => [
            styles.secondaryBtn,
            pressed && { opacity: 0.7 },
          ]}
        >
          <Text style={styles.secondaryBtnText}>Re-verify with a new photo</Text>
        </Pressable>
      </View>
    );
  }

  // Not verified — fix-up required.
  return (
    <View style={[styles.card, styles.cardWarning]}>
      <View style={[styles.iconCircle, { backgroundColor: "#fed7aa" }]}>
        <Text style={styles.iconText}>🔍</Text>
      </View>
      <Text style={[styles.title, { color: "#7c2d12" }]}>
        Not quite yet — let&apos;s fix it
      </Text>
      <Text style={[styles.body, { color: "#9a3412" }]}>{result.feedback}</Text>
      {result.photoUri && (
        <Image source={{ uri: result.photoUri }} style={styles.photo} />
      )}
      {result.fixStepsAdded ? (
        <View style={styles.fixNotice}>
          <Text style={styles.fixNoticeText}>
            ✨ Added {result.fixStepsAdded}{" "}
            {result.fixStepsAdded === 1 ? "fix-up step" : "fix-up steps"} to
            your plan above — work through them and then verify again.
          </Text>
        </View>
      ) : null}
      <Pressable
        onPress={onRequestVerify}
        style={({ pressed }) => [
          styles.primaryBtn,
          pressed && { opacity: 0.85 },
        ]}
      >
        <Text style={styles.primaryBtnText}>Re-verify with a new photo</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.lg,
    gap: spacing.md,
    alignItems: "center",
  },
  cardNeutral: {
    backgroundColor: colors.brandLighter,
    borderColor: "#fed7aa",
  },
  cardSuccess: {
    backgroundColor: "#ecfdf5",
    borderColor: "#a7f3d0",
  },
  cardWarning: {
    backgroundColor: "#fff7ed",
    borderColor: "#fed7aa",
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: radius.pill,
    backgroundColor: "#ffedd5",
    alignItems: "center",
    justifyContent: "center",
  },
  iconText: {
    fontSize: 28,
  },
  title: {
    fontSize: 16,
    fontWeight: "800",
    color: colors.text,
    textAlign: "center",
  },
  body: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.textMuted,
    textAlign: "center",
  },
  photo: {
    width: "100%",
    aspectRatio: 4 / 3,
    borderRadius: radius.md,
    backgroundColor: "#f5f5f4",
  },
  fixNotice: {
    backgroundColor: "#ffedd5",
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
  },
  fixNoticeText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#9a3412",
    textAlign: "center",
    lineHeight: 17,
  },
  primaryBtn: {
    alignSelf: "stretch",
    backgroundColor: colors.brand,
    borderRadius: radius.md,
    paddingVertical: spacing.md + 2,
    alignItems: "center",
  },
  primaryBtnText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "800",
  },
  secondaryBtn: {
    alignSelf: "stretch",
    paddingVertical: spacing.sm,
    alignItems: "center",
  },
  secondaryBtnText: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: "700",
    textDecorationLine: "underline",
  },
});
