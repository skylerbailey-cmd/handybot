import { useEffect, useMemo, useRef, useState } from "react";
import {
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import MessageBubble from "./MessageBubble";
import TypingIndicator from "./TypingIndicator";
import { colors, formatDuration, radius, spacing } from "@/lib/theme";
import type { ChatMessage, PlanStep } from "@/lib/types";

interface Props {
  visible: boolean;
  step: PlanStep | null;
  stepNumber: number;
  messages: ChatMessage[];
  sending: boolean;
  onClose: () => void;
  onSend: (stepId: string, text: string) => void | Promise<void>;
}

const SUGGESTIONS = [
  "Can you explain this differently?",
  "How do I know when I'm done with this step?",
  "What if I don't have the exact tool?",
  "I'm stuck — what should I check?",
];

export default function StepHelpModal({
  visible,
  step,
  stepNumber,
  messages,
  sending,
  onClose,
  onSend,
}: Props) {
  const [draft, setDraft] = useState("");
  const listRef = useRef<FlatList<ChatMessage>>(null);

  const stepMessages = useMemo(
    () => (step ? messages.filter((m) => m.relatedStepId === step.id) : []),
    [messages, step]
  );

  useEffect(() => {
    if (!visible) setDraft("");
  }, [visible]);

  useEffect(() => {
    if (stepMessages.length === 0) return;
    const t = setTimeout(() => {
      listRef.current?.scrollToEnd({ animated: true });
    }, 50);
    return () => clearTimeout(t);
  }, [stepMessages.length, sending]);

  async function handleSend(text: string) {
    if (!step) return;
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    setDraft("");
    await onSend(step.id, trimmed);
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: colors.background }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerLabel}>Help on step {stepNumber}</Text>
            <Text style={styles.headerTitle} numberOfLines={2}>
              {step?.title ?? "Step"}
            </Text>
            {step?.estimatedMinutes ? (
              <Text style={styles.headerMeta}>
                ⏱ {formatDuration(step.estimatedMinutes)}
              </Text>
            ) : null}
          </View>
          <Pressable onPress={onClose} hitSlop={10} style={styles.closeBtn}>
            <Text style={styles.closeBtnText}>✕</Text>
          </Pressable>
        </View>

        <FlatList
          ref={listRef}
          data={stepMessages}
          keyExtractor={(m) => m.id}
          renderItem={({ item }) => <MessageBubble message={item} />}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={
            step ? <StepReminderCard step={step} stepNumber={stepNumber} /> : null
          }
          ListFooterComponent={sending ? <TypingIndicator /> : null}
          onContentSizeChange={() =>
            listRef.current?.scrollToEnd({ animated: false })
          }
        />

        {stepMessages.length === 0 && !sending && (
          <View style={styles.suggestions}>
            <Text style={styles.suggestionsLabel}>Try asking</Text>
            <View style={styles.suggestionsRow}>
              {SUGGESTIONS.map((s) => (
                <Pressable
                  key={s}
                  onPress={() => handleSend(s)}
                  style={({ pressed }) => [
                    styles.suggestionChip,
                    pressed && { opacity: 0.85 },
                  ]}
                >
                  <Text style={styles.suggestionChipText}>{s}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}

        <View style={styles.composer}>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder={`Ask about step ${stepNumber}...`}
            placeholderTextColor={colors.textSubtle}
            multiline
            style={styles.input}
          />
          <Pressable
            onPress={() => handleSend(draft)}
            disabled={sending || !draft.trim()}
            style={({ pressed }) => [
              styles.sendBtn,
              (sending || !draft.trim()) && styles.sendBtnDisabled,
              pressed && { opacity: 0.8 },
            ]}
          >
            <Text style={styles.sendBtnText}>➤</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function StepReminderCard({
  step,
  stepNumber,
}: {
  step: PlanStep;
  stepNumber: number;
}) {
  return (
    <View style={styles.stepCard}>
      <Text style={styles.stepCardLabel}>Step {stepNumber}</Text>
      <Text style={styles.stepCardTitle}>{step.title}</Text>
      <Text style={styles.stepCardDetail}>{step.detail}</Text>
      {step.criticalWarning && (
        <View style={styles.stepWarning}>
          <Text style={styles.stepWarningLabel}>⚠ DON&apos;T MESS THIS UP</Text>
          <Text style={styles.stepWarningText}>{step.criticalWarning}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
  },
  headerLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: colors.brand,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  headerTitle: {
    marginTop: 2,
    fontSize: 18,
    fontWeight: "800",
    color: colors.text,
  },
  headerMeta: {
    marginTop: 4,
    fontSize: 12,
    color: colors.textSubtle,
    fontWeight: "600",
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: radius.pill,
    backgroundColor: "#f5f5f4",
    alignItems: "center",
    justifyContent: "center",
  },
  closeBtnText: {
    fontSize: 16,
    color: colors.textMuted,
    fontWeight: "700",
  },
  listContent: {
    padding: spacing.lg,
    paddingBottom: spacing.md,
  },
  stepCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md + 2,
    marginBottom: spacing.md,
    gap: 4,
  },
  stepCardLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: colors.brand,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  stepCardTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.text,
  },
  stepCardDetail: {
    fontSize: 13,
    lineHeight: 19,
    color: colors.textMuted,
  },
  stepWarning: {
    marginTop: spacing.sm,
    backgroundColor: "#fff7ed",
    borderLeftWidth: 3,
    borderLeftColor: "#ea580c",
    padding: spacing.sm + 2,
    borderRadius: radius.sm,
  },
  stepWarningLabel: {
    fontSize: 10,
    fontWeight: "900",
    color: "#9a3412",
    letterSpacing: 0.6,
  },
  stepWarningText: {
    marginTop: 2,
    fontSize: 12,
    fontWeight: "700",
    color: "#7c2d12",
    lineHeight: 17,
  },
  suggestions: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
    gap: spacing.sm,
  },
  suggestionsLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: colors.textSubtle,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  suggestionsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs + 2,
  },
  suggestionChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
  },
  suggestionChipText: {
    fontSize: 12,
    color: colors.textMuted,
    fontWeight: "600",
  },
  composer: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: spacing.sm,
    padding: spacing.md,
    paddingBottom: Platform.OS === "ios" ? spacing.lg : spacing.md,
    borderTopWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 140,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    paddingHorizontal: spacing.md,
    paddingTop: Platform.OS === "ios" ? 12 : 8,
    paddingBottom: Platform.OS === "ios" ? 12 : 8,
    fontSize: 15,
    color: colors.text,
    backgroundColor: colors.surface,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.brand,
    alignItems: "center",
    justifyContent: "center",
  },
  sendBtnDisabled: {
    opacity: 0.4,
  },
  sendBtnText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
  },
});
