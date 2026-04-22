import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import ImagePickerButton from "@/components/ImagePickerButton";
import PrimaryButton from "@/components/PrimaryButton";
import { ClaudeQuotaError, createRepairPlan } from "@/lib/claude";
import { readImageAsBase64 } from "@/lib/image";
import { generateId, upsertIssue } from "@/lib/storage";
import { colors, radius, spacing } from "@/lib/theme";
import type { ChatMessage, Issue } from "@/lib/types";

const LOADING_MESSAGES = [
  "Analyzing your photo...",
  "Identifying the problem...",
  "Researching the best fix...",
  "Building your step-by-step plan...",
  "Estimating tools and materials...",
  "Checking for safety concerns...",
  "Calculating how much you'll save...",
  "Almost there — putting it all together...",
];

const MESSAGE_INTERVAL_MS = 3000;

export default function NewIssueScreen() {
  const router = useRouter();
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingMsgIndex, setLoadingMsgIndex] = useState(0);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!submitting) {
      setLoadingMsgIndex(0);
      return;
    }
    const interval = setInterval(() => {
      // Fade out, swap text, fade in
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start(() => {
        setLoadingMsgIndex((prev) => (prev + 1) % LOADING_MESSAGES.length);
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }).start();
      });
    }, MESSAGE_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [submitting, fadeAnim]);

  async function handleSubmit() {
    if (!imageUri || submitting) return;
    setSubmitting(true);
    setError(null);

    const id = generateId();
    const now = Date.now();
    const userText =
      note.trim() || "Here's what's broken. What should I do?";

    try {
      const imageBase64 = await readImageAsBase64(imageUri);

      const generated = await createRepairPlan({
        note: userText,
        imageBase64,
        imageMediaType: "image/jpeg",
      });

      const firstUserMsg: ChatMessage = {
        id: generateId(),
        role: "user",
        text: userText,
        imageUri,
        createdAt: now,
      };

      const assistantMsg: ChatMessage = {
        id: generateId(),
        role: "assistant",
        text:
          generated.openingMessage ||
          "I've put together a plan for this repair. Check the Plan tab and let me know if you have questions.",
        createdAt: Date.now(),
      };

      const issue: Issue = {
        id,
        title: generated.title,
        summary: generated.summary,
        status: "in_progress",
        createdAt: now,
        updatedAt: Date.now(),
        coverImageUri: imageUri,
        plan: generated.plan,
        messages: [firstUserMsg, assistantMsg],
      };

      await upsertIssue(issue);
      router.replace(`/(tabs)/(repair)/issue/${id}`);
    } catch (err) {
      if (err instanceof ClaudeQuotaError) {
        Alert.alert(
          "Free limit reached",
          err.userMessage,
          [
            { text: "OK", style: "cancel" },
            {
              text: "Upgrade to Pro",
              onPress: () => router.push("/(tabs)/(settings)"),
            },
          ]
        );
        setSubmitting(false);
        return;
      }
      const msg = err instanceof Error ? err.message : "Something went wrong";
      setError(msg);
      setSubmitting(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.card}>
          <Text style={styles.stepTitle}>1. Show HandyBot what&apos;s wrong</Text>
          <Text style={styles.stepHelp}>
            Take a photo of the broken thing. Close-ups help.
          </Text>
          <View style={{ marginTop: spacing.md }}>
            <ImagePickerButton value={imageUri} onChange={setImageUri} />
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.stepTitle}>2. Add a quick note (optional)</Text>
          <Text style={styles.stepHelp}>
            Anything you know about the problem — when it started, sounds,
            smells, what you&apos;ve already tried.
          </Text>
          <TextInput
            value={note}
            onChangeText={setNote}
            placeholder="e.g. My kitchen faucet started dripping last night..."
            placeholderTextColor={colors.textSubtle}
            multiline
            style={styles.textarea}
          />
        </View>

        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>What you&apos;ll get</Text>
          <Text style={styles.infoBody}>
            HandyBot will analyze your photo and build you a complete repair
            project: difficulty rating, time estimate, tools needed, materials
            list, and a step-by-step checklist you can tick off as you work.
          </Text>
        </View>

        {error && (
          <View style={styles.errorCard}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <PrimaryButton
          title={submitting ? "Building your plan..." : "Generate repair plan"}
          onPress={handleSubmit}
          disabled={!imageUri}
          loading={submitting}
        />

        <Pressable
          onPress={() => router.push("/(tabs)/(repair)/manual-repair")}
          style={({ pressed }) => [
            styles.manualEntryBtn,
            pressed && { opacity: 0.7 },
          ]}
        >
          <Text style={styles.manualEntryText}>Create manual entry</Text>
        </Pressable>
      </ScrollView>

      {submitting && (
        <View style={styles.loadingOverlay} pointerEvents="auto">
          <View style={styles.loadingCard}>
            <ActivityIndicator color={colors.brand} size="large" />
            <Animated.Text
              style={[styles.loadingMessage, { opacity: fadeAnim }]}
            >
              {LOADING_MESSAGES[loadingMsgIndex]}
            </Animated.Text>
            <View style={styles.loadingDots}>
              {LOADING_MESSAGES.map((_, i) => (
                <View
                  key={i}
                  style={[
                    styles.loadingDot,
                    i === loadingMsgIndex && styles.loadingDotActive,
                    i < loadingMsgIndex && styles.loadingDotPast,
                  ]}
                />
              ))}
            </View>
            <Text style={styles.loadingHint}>
              This usually takes 10–20 seconds
            </Text>
          </View>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.lg,
    gap: spacing.md,
    paddingBottom: spacing.xxl,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  stepTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.text,
  },
  stepHelp: {
    marginTop: spacing.xs,
    fontSize: 13,
    color: colors.textMuted,
  },
  textarea: {
    marginTop: spacing.md,
    minHeight: 90,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    padding: spacing.md,
    fontSize: 14,
    color: colors.text,
    textAlignVertical: "top",
    backgroundColor: colors.surface,
  },
  infoCard: {
    backgroundColor: colors.brandLighter,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: "#fed7aa",
    padding: spacing.lg,
  },
  infoTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.brandDark,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  infoBody: {
    marginTop: spacing.xs,
    fontSize: 13,
    lineHeight: 19,
    color: "#7c2d12",
  },
  errorCard: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: "#fecaca",
    backgroundColor: colors.dangerBg,
    padding: spacing.md,
  },
  errorText: {
    color: colors.danger,
    fontSize: 13,
  },
  loadingOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(28,25,23,0.5)",
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
  },
  loadingCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.xl + 4,
    alignItems: "center",
    gap: spacing.md,
    minWidth: 280,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 5,
  },
  loadingMessage: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.text,
    textAlign: "center",
    minHeight: 22,
  },
  loadingDots: {
    flexDirection: "row",
    gap: 6,
    marginTop: spacing.xs,
  },
  loadingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#e7e5e4",
  },
  loadingDotActive: {
    backgroundColor: colors.brand,
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  loadingDotPast: {
    backgroundColor: colors.brandLight,
  },
  loadingHint: {
    fontSize: 12,
    color: colors.textSubtle,
    marginTop: spacing.xs,
  },
  manualEntryBtn: {
    alignItems: "center",
    paddingVertical: spacing.md,
  },
  manualEntryText: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.textSubtle,
  },
});
