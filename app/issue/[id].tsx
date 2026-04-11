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
import TypingIndicator from "@/components/TypingIndicator";
import {
  applyProposalToPlan,
  createRepairPlan,
  sendProjectChat,
} from "@/lib/claude";
import { readImageAsBase64 } from "@/lib/image";
import {
  deleteIssue,
  generateId,
  getIssue,
  upsertIssue,
} from "@/lib/storage";
import { colors, radius, spacing } from "@/lib/theme";
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

  const chatCount = issue?.messages.length ?? 0;

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
    persist({
      ...issue,
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
    const toggleLabel =
      issue.status === "resolved" ? "Mark as in progress" : "Mark as resolved";
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
    await persist({
      ...issue,
      status: issue.status === "resolved" ? "in_progress" : "resolved",
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
      const msg =
        err instanceof Error ? err.message : "Could not regenerate the plan.";
      setError(msg);
      Alert.alert("Regenerate failed", msg);
    } finally {
      setRegenerating(false);
    }
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
      const apiMessages: ChatRequestMessage[] = await Promise.all(
        withUser.messages.map(async (m) => {
          const base: ChatRequestMessage = { role: m.role, text: m.text };
          if (m.imageUri) {
            base.imageBase64 = await readImageAsBase64(m.imageUri);
            base.imageMediaType = "image/jpeg";
          }
          return base;
        })
      );

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
      const msg = err instanceof Error ? err.message : "Could not reach Claude";
      setError(msg);
    } finally {
      setSending(false);
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
            onRegenerate={confirmRegenerate}
            regenerating={regenerating}
          />
        ) : (
          <View style={{ flex: 1 }}>
            <FlatList
              ref={listRef}
              data={issue.messages}
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
