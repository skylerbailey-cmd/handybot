import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActionSheetIOS,
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
import PlanView from "@/components/PlanView";
import SegmentedTabs from "@/components/SegmentedTabs";
import TypingIndicator from "@/components/TypingIndicator";
import { sendProjectChat } from "@/lib/claude";
import { readImageAsBase64 } from "@/lib/image";
import {
  deleteIssue,
  generateId,
  getIssue,
  upsertIssue,
} from "@/lib/storage";
import { colors, radius, spacing } from "@/lib/theme";
import type { ChatMessage, ChatRequestMessage, Issue } from "@/lib/types";

type TabKey = "plan" | "chat";

export default function IssueWorkspaceScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [issue, setIssue] = useState<Issue | null | undefined>(undefined);
  const [tab, setTab] = useState<TabKey>("plan");
  const [draft, setDraft] = useState("");
  const [pendingImage, setPendingImage] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
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

  function openOverflow() {
    if (!issue) return;
    const toggleLabel =
      issue.status === "resolved" ? "Mark as in progress" : "Mark as resolved";
    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ["Cancel", toggleLabel, "Delete repair"],
          destructiveButtonIndex: 2,
          cancelButtonIndex: 0,
        },
        (idx) => {
          if (idx === 1) toggleResolved();
          if (idx === 2) handleDelete();
        }
      );
    } else {
      Alert.alert(issue.title || "Repair", undefined, [
        { text: "Cancel", style: "cancel" },
        { text: toggleLabel, onPress: toggleResolved },
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
        text: reply,
        createdAt: Date.now(),
      };

      await persist({
        ...withUser,
        messages: [...withUser.messages, assistantMsg],
        updatedAt: Date.now(),
      });
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
          />
        ) : (
          <View style={{ flex: 1 }}>
            <FlatList
              ref={listRef}
              data={issue.messages}
              keyExtractor={(m) => m.id}
              renderItem={({ item }) => <MessageBubble message={item} />}
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
});
