import { useRouter } from "expo-router";
import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import ImagePickerButton from "@/components/ImagePickerButton";
import PrimaryButton from "@/components/PrimaryButton";
import { createRepairPlan } from "@/lib/claude";
import { readImageAsBase64 } from "@/lib/image";
import { generateId, upsertIssue } from "@/lib/storage";
import { colors, radius, spacing } from "@/lib/theme";
import type { ChatMessage, Issue } from "@/lib/types";

export default function NewIssueScreen() {
  const router = useRouter();
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      router.replace(`/issue/${id}`);
    } catch (err) {
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
      </ScrollView>
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
});
