import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActionSheetIOS,
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import ImagePickerButton from "@/components/ImagePickerButton";
import MessageBubble from "@/components/MessageBubble";
import PlanProposalCard from "@/components/PlanProposalCard";
import PlanView from "@/components/PlanView";
import SegmentedTabs from "@/components/SegmentedTabs";
import StepHelpModal from "@/components/StepHelpModal";
import TypingIndicator from "@/components/TypingIndicator";
import {
  ClaudeQuotaError,
  applyProposalToPlan,
  applyVerificationResult,
  createRepairPlan,
  sendProjectChat,
  verifyRepair,
} from "@/lib/claude";
import { promptAndPickImage, readImageAsBase64 } from "@/lib/image";
import {
  deleteIssue,
  generateId,
  getIssue,
  upsertIssue,
} from "@/lib/storage";
import { showPaywallAlert } from "@/lib/showPaywall";
import { colors, radius, spacing } from "@/lib/theme";
import { canUseVerification } from "@/lib/tiers";
import type {
  ChatMessage,
  ChatRequestMessage,
  Issue,
  PlanProposal,
} from "@/lib/types";

type TabKey = "plan" | "chat";

export default function IssueWorkspaceScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [issue, setIssue] = useState<Issue | null | undefined>(undefined);
  const [tab, setTab] = useState<TabKey>("plan");
  const [draft, setDraft] = useState("");
  const [pendingImage, setPendingImage] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [stepHelpSending, setStepHelpSending] = useState(false);
  const [helpStepId, setHelpStepId] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<FlatList<ChatMessage>>(null);

  const loadIssue = useCallback(async () => {
    if (!id) return;
    const found = await getIssue(id);
    setIssue(found ?? null);
  }, [id]);

  useEffect(() => {
    loadIssue();
  }, [loadIssue]);

  /**
   * Messages shown in the main Chat tab — excludes step-scoped Q&A,
   * which live in the step help modal instead.
   */
  const mainChatMessages = useMemo(
    () => (issue?.messages ?? []).filter((m) => !m.relatedStepId),
    [issue?.messages]
  );
  const chatCount = mainChatMessages.length;
  const helpStep = useMemo(
    () =>
      helpStepId && issue
        ? issue.plan.steps.find((s) => s.id === helpStepId)
        : undefined,
    [helpStepId, issue]
  );
  const helpStepNumber = useMemo(() => {
    if (!helpStepId || !issue) return 0;
    const idx = issue.plan.steps.findIndex((s) => s.id === helpStepId);
    return idx < 0 ? 0 : idx + 1;
  }, [helpStepId, issue]);

  useEffect(() => {
    if (tab !== "chat" || chatCount === 0) return;
    const t = setTimeout(() => {
      listRef.current?.scrollToEnd({ animated: true });
    }, 50);
    return () => clearTimeout(t);
  }, [tab, chatCount, sending]);

  async function persist(updated: Issue) {
    setIssue(updated);
    try {
      await upsertIssue(updated);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not save.";
      setError(msg);
    }
  }

  function setStepCompleted(stepId: string, completed: boolean) {
    if (!issue) return;
    const steps = issue.plan.steps.map((s) =>
      s.id === stepId ? { ...s, completed } : s
    );
    const allDone =
      steps.length > 0 && steps.every((s) => s.completed);

    // Auto-manage status based on step completion:
    // - All steps done → "completed" (unless already "verified")
    // - Not all done → back to "in_progress"
    let status = issue.status;
    if (allDone && status === "in_progress") {
      status = "completed";
    } else if (!allDone && (status === "completed" || status === "verified")) {
      status = "in_progress";
    }

    persist({
      ...issue,
      status,
      plan: { ...issue.plan, steps },
      updatedAt: Date.now(),
    });
  }

  function toggleTool(toolId: string) {
    if (!issue) return;
    const tools = issue.plan.tools.map((t) =>
      t.id === toolId ? { ...t, have: !t.have } : t
    );
    persist({
      ...issue,
      plan: { ...issue.plan, tools },
      updatedAt: Date.now(),
    });
  }

  function toggleMaterial(materialId: string) {
    if (!issue) return;
    const materials = issue.plan.materials.map((m) =>
      m.id === materialId ? { ...m, have: !m.have } : m
    );
    persist({
      ...issue,
      plan: { ...issue.plan, materials },
      updatedAt: Date.now(),
    });
  }

  function acceptProposal(messageId: string) {
    if (!issue) return;
    const msg = issue.messages.find((m) => m.id === messageId);
    if (!msg?.proposal || msg.proposal.status !== "pending") return;

    const updatedPlan = applyProposalToPlan(issue.plan, msg.proposal);
    const updatedMessages = issue.messages.map((m) =>
      m.id === messageId
        ? { ...m, proposal: { ...msg.proposal!, status: "accepted" as const } }
        : m
    );
    persist({
      ...issue,
      plan: updatedPlan,
      messages: updatedMessages,
      updatedAt: Date.now(),
    });
  }

  function dismissProposal(messageId: string) {
    if (!issue) return;
    const msg = issue.messages.find((m) => m.id === messageId);
    if (!msg?.proposal || msg.proposal.status !== "pending") return;
    const updatedMessages = issue.messages.map((m) =>
      m.id === messageId
        ? {
            ...m,
            proposal: { ...msg.proposal!, status: "dismissed" as const },
          }
        : m
    );
    persist({
      ...issue,
      messages: updatedMessages,
      updatedAt: Date.now(),
    });
  }

  function openOverflow() {
    if (!issue) return;
    const isFinished =
      issue.status === "completed" || issue.status === "verified";
    const toggleLabel = isFinished
      ? "Mark as in progress"
      : "Mark as completed";
    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: [
            "Cancel",
            toggleLabel,
            "Regenerate plan",
            "Delete repair",
          ],
          destructiveButtonIndex: 3,
          cancelButtonIndex: 0,
        },
        (idx) => {
          if (idx === 1) toggleResolved();
          if (idx === 2) confirmRegenerate();
          if (idx === 3) handleDelete();
        }
      );
    } else {
      Alert.alert(issue.title || "Repair", undefined, [
        { text: "Cancel", style: "cancel" },
        { text: toggleLabel, onPress: toggleResolved },
        { text: "Regenerate plan", onPress: confirmRegenerate },
        { text: "Delete", style: "destructive", onPress: handleDelete },
      ]);
    }
  }

  async function toggleResolved() {
    if (!issue) return;
    const isFinished =
      issue.status === "completed" || issue.status === "verified";
    await persist({
      ...issue,
      status: isFinished ? "in_progress" : "completed",
      updatedAt: Date.now(),
    });
  }

  async function handleDelete() {
    if (!issue) return;
    Alert.alert(
      "Delete this repair?",
      "This can't be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            await deleteIssue(issue.id);
            router.back();
          },
        },
      ],
      { cancelable: true }
    );
  }

  function confirmRegenerate() {
    if (!issue || regenerating) return;
    const firstUser = issue.messages.find((m) => m.role === "user");
    if (!firstUser?.imageUri) {
      Alert.alert(
        "Can't regenerate",
        "The original photo for this repair couldn't be found."
      );
      return;
    }
    Alert.alert(
      "Regenerate plan?",
      "HandyBot will build a fresh plan from your original photo. Your checked steps, tools, and materials will be cleared, but the chat history will stay.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Regenerate", onPress: handleRegenerate },
      ]
    );
  }

  async function handleRegenerate() {
    if (!issue || regenerating) return;
    const firstUser = issue.messages.find((m) => m.role === "user");
    if (!firstUser?.imageUri) return;

    setRegenerating(true);
    setError(null);
    try {
      const base64 = await readImageAsBase64(firstUser.imageUri);
      const generated = await createRepairPlan({
        note: firstUser.text,
        imageBase64: base64,
        imageMediaType: "image/jpeg",
      });

      const regenNote: ChatMessage = {
        id: generateId(),
        role: "assistant",
        text:
          "I've regenerated this repair plan from the original photo. Any checked steps or items have been reset.\n\n" +
          (generated.openingMessage || ""),
        createdAt: Date.now(),
      };

      await persist({
        ...issue,
        title: generated.title,
        summary: generated.summary,
        plan: generated.plan,
        messages: [...issue.messages, regenNote],
        updatedAt: Date.now(),
      });
    } catch (err) {
      if (err instanceof ClaudeQuotaError) {
        showPaywallAlert(err.userMessage);
        return;
      }
      const msg =
        err instanceof Error ? err.message : "Could not regenerate the plan.";
      setError(msg);
      Alert.alert("Regenerate failed", msg);
    } finally {
      setRegenerating(false);
    }
  }

  /**
   * Serialize issue.messages into the Claude API shape. User messages with
   * a relatedStepId get a "[About step N: title]" prefix so Claude knows
   * which step the question is about without the UI having to pollute the
   * stored text.
   */
  async function buildApiMessages(
    forIssue: Issue
  ): Promise<ChatRequestMessage[]> {
    return Promise.all(
      forIssue.messages.map(async (m) => {
        let text = m.text;
        if (m.role === "user" && m.relatedStepId) {
          const idx = forIssue.plan.steps.findIndex(
            (s) => s.id === m.relatedStepId
          );
          const step = idx >= 0 ? forIssue.plan.steps[idx] : undefined;
          if (step) {
            text = `[About step ${idx + 1}: "${step.title}"]\n${m.text}`;
          }
        }
        const base: ChatRequestMessage = { role: m.role, text };
        if (m.imageUri) {
          base.imageBase64 = await readImageAsBase64(m.imageUri);
          base.imageMediaType = "image/jpeg";
        }
        return base;
      })
    );
  }

  async function handleSend() {
    if (!issue || sending) return;
    const trimmed = draft.trim();
    if (!trimmed && !pendingImage) return;

    setError(null);

    const userMsg: ChatMessage = {
      id: generateId(),
      role: "user",
      text: trimmed,
      imageUri: pendingImage ?? undefined,
      createdAt: Date.now(),
    };

    const withUser: Issue = {
      ...issue,
      messages: [...issue.messages, userMsg],
      updatedAt: Date.now(),
    };
    await persist(withUser);

    setDraft("");
    setPendingImage(null);
    setSending(true);

    try {
      const apiMessages = await buildApiMessages(withUser);
      const reply = await sendProjectChat(withUser, apiMessages);

      const assistantMsg: ChatMessage = {
        id: generateId(),
        role: "assistant",
        text:
          reply.text ||
          (reply.proposal
            ? "I have a suggested plan update — take a look below."
            : "Got it."),
        createdAt: Date.now(),
        proposal: reply.proposal,
      };

      await persist({
        ...withUser,
        messages: [...withUser.messages, assistantMsg],
        updatedAt: Date.now(),
      });

      // If Claude proposed an update, flip to the chat tab so the user sees it.
      if (reply.proposal && tab !== "chat") {
        setTab("chat");
      }
    } catch (err) {
      if (err instanceof ClaudeQuotaError) {
        showPaywallAlert(err.userMessage);
        return;
      }
      const msg = err instanceof Error ? err.message : "Could not reach Claude";
      setError(msg);
    } finally {
      setSending(false);
    }
  }

  async function handleStepHelpSend(stepId: string, text: string) {
    if (!issue || stepHelpSending) return;

    const userMsg: ChatMessage = {
      id: generateId(),
      role: "user",
      text,
      createdAt: Date.now(),
      relatedStepId: stepId,
    };
    const withUser: Issue = {
      ...issue,
      messages: [...issue.messages, userMsg],
      updatedAt: Date.now(),
    };
    await persist(withUser);

    setStepHelpSending(true);
    try {
      const apiMessages = await buildApiMessages(withUser);
      const reply = await sendProjectChat(withUser, apiMessages);
      const assistantMsg: ChatMessage = {
        id: generateId(),
        role: "assistant",
        text: reply.text || "Let me know if that helps.",
        createdAt: Date.now(),
        relatedStepId: stepId,
        proposal: reply.proposal,
      };
      await persist({
        ...withUser,
        messages: [...withUser.messages, assistantMsg],
        updatedAt: Date.now(),
      });
    } catch (err) {
      if (err instanceof ClaudeQuotaError) {
        showPaywallAlert(err.userMessage);
        return;
      }
      const msg = err instanceof Error ? err.message : "Could not reach Claude";
      Alert.alert("Couldn't fetch help", msg);
    } finally {
      setStepHelpSending(false);
    }
  }

  async function handleRequestVerify() {
    if (!issue || verifying) return;
    const verifyCheck = canUseVerification();
    if (!verifyCheck.allowed) {
      showPaywallAlert(verifyCheck.message);
      return;
    }
    setError(null);
    try {
      const result = await promptAndPickImage("Upload a photo of your finished work");
      if (!result) return;
      setVerifying(true);
      const base64 = await readImageAsBase64(result.uri);
      const verifyResult = await verifyRepair({
        issue,
        imageBase64: base64,
        imageMediaType: "image/jpeg",
      });
      const updatedPlan = applyVerificationResult(
        issue.plan,
        verifyResult,
        result.uri
      );
      await persist({
        ...issue,
        plan: updatedPlan,
        // Auto-verify when verification passes — moves the project
        // from Completed to the Verified section on the home screen.
        status: verifyResult.verified ? "verified" : issue.status,
        updatedAt: Date.now(),
      });
      if (verifyResult.verified) {
        Alert.alert(
          "Repair verified!",
          "Great work — this project has been moved to your Verified repairs."
        );
      } else if (verifyResult.fixSteps.length > 0) {
        Alert.alert(
          "A few things to fix",
          `HandyBot added ${verifyResult.fixSteps.length} fix-up ${verifyResult.fixSteps.length === 1 ? "step" : "steps"} to your plan. Work through them and verify again when you're done.`
        );
      }
    } catch (err) {
      if (err instanceof ClaudeQuotaError) {
        showPaywallAlert(err.userMessage);
        return;
      }
      const msg =
        err instanceof Error ? err.message : "Could not verify the repair.";
      Alert.alert("Verify failed", msg);
    } finally {
      setVerifying(false);
    }
  }

  const tabs = useMemo(
    () =>
      [
        { key: "plan" as const, label: "Plan" },
        { key: "chat" as const, label: "Chat", badge: chatCount },
      ] as const,
    [chatCount]
  );

  if (issue === undefined) {
    return (
      <View style={styles.centered}>
        <Text style={styles.placeholder}>Loading...</Text>
      </View>
    );
  }

  if (issue === null) {
    return (
      <View style={styles.centered}>
        <Text style={styles.missingTitle}>Repair not found</Text>
        <Text style={styles.placeholder}>
          This repair may have been deleted.
        </Text>
      </View>
    );
  }

  const renderChatItem = ({ item }: { item: ChatMessage }) => (
    <View>
      <MessageBubble message={item} />
      {item.proposal && (
        <PlanProposalCard
          proposal={item.proposal}
          onAccept={() => acceptProposal(item.id)}
          onDismiss={() => dismissProposal(item.id)}
        />
      )}
    </View>
  );

  return (
    <>
      <Stack.Screen
        options={{
          title: issue.title || "Repair",
          headerRight: () => (
            <Pressable
              onPress={openOverflow}
              hitSlop={10}
              style={styles.headerBtn}
            >
              <Text style={styles.headerBtnText}>⋯</Text>
            </Pressable>
          ),
        }}
      />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 88 : 0}
      >
        <SegmentedTabs tabs={tabs} value={tab} onChange={setTab} />

        {tab === "plan" ? (
          <PlanView
            issue={issue}
            onSetStepCompleted={setStepCompleted}
            onToggleTool={toggleTool}
            onToggleMaterial={toggleMaterial}
            onRequestStepHelp={(stepId) => setHelpStepId(stepId)}
            onRequestVerify={handleRequestVerify}
            verifying={verifying}
            onRegenerate={confirmRegenerate}
            regenerating={regenerating}
          />
        ) : (
          <View style={{ flex: 1 }}>
            <FlatList
              ref={listRef}
              data={mainChatMessages}
              keyExtractor={(m) => m.id}
              renderItem={renderChatItem}
              contentContainerStyle={styles.listContent}
              ListFooterComponent={sending ? <TypingIndicator /> : null}
              onContentSizeChange={() =>
                listRef.current?.scrollToEnd({ animated: false })
              }
            />

            {error && (
              <View style={styles.errorBar}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            <View style={styles.composer}>
              {pendingImage && (
                <View style={{ marginBottom: spacing.sm }}>
                  <ImagePickerButton
                    value={pendingImage}
                    onChange={setPendingImage}
                    variant="compact"
                  />
                </View>
              )}
              <View style={styles.composerRow}>
                {!pendingImage && (
                  <ImagePickerButton
                    value={null}
                    onChange={setPendingImage}
                    variant="compact"
                  />
                )}
                <TextInput
                  value={draft}
                  onChangeText={setDraft}
                  placeholder="Share an update or ask a follow-up..."
                  placeholderTextColor={colors.textSubtle}
                  multiline
                  style={styles.input}
                />
                <Pressable
                  onPress={handleSend}
                  disabled={sending || (!draft.trim() && !pendingImage)}
                  style={({ pressed }) => [
                    styles.sendBtn,
                    (sending || (!draft.trim() && !pendingImage)) &&
                      styles.sendBtnDisabled,
                    pressed && { opacity: 0.8 },
                  ]}
                >
                  <Text style={styles.sendBtnText}>➤</Text>
                </Pressable>
              </View>
            </View>
          </View>
        )}

        {regenerating && (
          <View style={styles.regenOverlay} pointerEvents="auto">
            <View style={styles.regenCard}>
              <ActivityIndicator color={colors.brand} size="large" />
              <Text style={styles.regenTitle}>Rebuilding your plan...</Text>
              <Text style={styles.regenBody}>
                HandyBot is re-analyzing your original photo.
              </Text>
            </View>
          </View>
        )}
      </KeyboardAvoidingView>

      <StepHelpModal
        visible={!!helpStep}
        step={helpStep ?? null}
        stepNumber={helpStepNumber}
        messages={issue.messages}
        sending={stepHelpSending}
        onClose={() => setHelpStepId(null)}
        onSend={handleStepHelpSend}
      />
    </>
  );
}

const styles = StyleSheet.create({
  listContent: {
    padding: spacing.lg,
    paddingBottom: spacing.md,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
    gap: spacing.sm,
  },
  missingTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.text,
  },
  placeholder: {
    fontSize: 14,
    color: colors.textMuted,
  },
  headerBtn: {
    paddingHorizontal: spacing.sm,
  },
  headerBtnText: {
    fontSize: 24,
    color: colors.textMuted,
  },
  errorBar: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
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
  composer: {
    borderTopWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.md,
    paddingBottom: Platform.OS === "ios" ? spacing.lg : spacing.md,
  },
  composerRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: spacing.sm,
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
    textAlignVertical: "center",
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
  regenOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(28,25,23,0.45)",
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
  },
  regenCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.xl,
    alignItems: "center",
    gap: spacing.sm,
    minWidth: 260,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  regenTitle: {
    marginTop: spacing.sm,
    fontSize: 16,
    fontWeight: "700",
    color: colors.text,
  },
  regenBody: {
    fontSize: 13,
    color: colors.textMuted,
    textAlign: "center",
  },
});
