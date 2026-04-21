import { useCallback, useEffect, useRef, useState } from "react";
import {
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
import TypingIndicator from "@/components/TypingIndicator";
import { askHandyBot } from "@/lib/claude";
import {
  buildHomeContext,
  clearAskMessages,
  loadAskMessages,
  saveAskMessages,
} from "@/lib/homeData";
import { readImageAsBase64 } from "@/lib/image";
import { generateId } from "@/lib/storage";
import { colors, radius, spacing } from "@/lib/theme";
import type { AskMessage, ChatRequestMessage } from "@/lib/types";

const SUGGESTIONS = [
  "Is this crack in my wall something to worry about?",
  "What's a good monthly home maintenance routine?",
  "My electricity bill doubled — what should I check?",
  "How do I know when to replace my water heater?",
  "What's this weird smell near my HVAC?",
];

export default function AskScreen() {
  const [messages, setMessages] = useState<AskMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [pendingImage, setPendingImage] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [homeContext, setHomeContext] = useState<string | undefined>();
  const listRef = useRef<FlatList<AskMessage>>(null);

  useEffect(() => {
    loadAskMessages().then(setMessages);
    buildHomeContext().then(setHomeContext).catch(() => {
      /* non-blocking */
    });
  }, []);

  useEffect(() => {
    if (messages.length === 0) return;
    const t = setTimeout(() => {
      listRef.current?.scrollToEnd({ animated: true });
    }, 50);
    return () => clearTimeout(t);
  }, [messages.length, sending]);

  async function handleSend(text?: string) {
    const trimmed = (text ?? draft).trim();
    if ((!trimmed && !pendingImage) || sending) return;

    const userMsg: AskMessage = {
      id: generateId(),
      role: "user",
      text: trimmed || "What do you think about this?",
      imageUri: pendingImage ?? undefined,
      createdAt: Date.now(),
    };

    const withUser = [...messages, userMsg];
    setMessages(withUser);
    await saveAskMessages(withUser);
    setDraft("");
    setPendingImage(null);
    setSending(true);

    try {
      const apiMessages: ChatRequestMessage[] = await Promise.all(
        withUser.map(async (m) => {
          const base: ChatRequestMessage = { role: m.role, text: m.text };
          if (m.imageUri) {
            base.imageBase64 = await readImageAsBase64(m.imageUri);
            base.imageMediaType = "image/jpeg";
          }
          return base;
        })
      );

      const reply = await askHandyBot(apiMessages, homeContext);

      const assistantMsg: AskMessage = {
        id: generateId(),
        role: "assistant",
        text: reply || "Hmm, I'm not sure about that one. Could you tell me more or send a photo?",
        createdAt: Date.now(),
      };

      const updated = [...withUser, assistantMsg];
      setMessages(updated);
      await saveAskMessages(updated);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not reach HandyBot";
      Alert.alert("Something went wrong", msg);
    } finally {
      setSending(false);
    }
  }

  function handleClear() {
    Alert.alert(
      "Clear conversation?",
      "This will delete the entire Ask HandyBot chat history.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear",
          style: "destructive",
          onPress: async () => {
            setMessages([]);
            await clearAskMessages();
          },
        },
      ]
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 88 : 0}
    >
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(m) => m.id}
        renderItem={({ item }) => (
          <MessageBubble
            message={{ ...item, role: item.role }}
          />
        )}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          messages.length === 0 ? (
            <View style={styles.emptyState}>
              <View style={styles.emptyIcon}>
                <Text style={styles.emptyIconText}>💬</Text>
              </View>
              <Text style={styles.emptyTitle}>Ask HandyBot anything</Text>
              <Text style={styles.emptyBody}>
                No repair project needed — just ask about your home. Attach a
                photo of something you&apos;re curious or concerned about.
              </Text>
              <View style={styles.suggestionsWrap}>
                <Text style={styles.suggestionsLabel}>Try asking</Text>
                {SUGGESTIONS.map((s) => (
                  <Pressable
                    key={s}
                    onPress={() => handleSend(s)}
                    style={({ pressed }) => [
                      styles.suggestion,
                      pressed && { opacity: 0.85 },
                    ]}
                  >
                    <Text style={styles.suggestionText}>{s}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          ) : null
        }
        ListFooterComponent={
          <>
            {sending && <TypingIndicator />}
            {messages.length > 2 && (
              <Pressable
                onPress={handleClear}
                style={styles.clearBtn}
                hitSlop={8}
              >
                <Text style={styles.clearBtnText}>Clear conversation</Text>
              </Pressable>
            )}
          </>
        }
        onContentSizeChange={() =>
          listRef.current?.scrollToEnd({ animated: false })
        }
      />

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
            placeholder="Ask about your home..."
            placeholderTextColor={colors.textSubtle}
            multiline
            style={styles.input}
          />
          <Pressable
            onPress={() => handleSend()}
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
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  listContent: {
    padding: spacing.lg,
    paddingBottom: spacing.md,
  },
  emptyState: {
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.xl,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 999,
    backgroundColor: colors.brandLight,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyIconText: {
    fontSize: 30,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: colors.text,
  },
  emptyBody: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: "center",
    maxWidth: 320,
    lineHeight: 20,
  },
  suggestionsWrap: {
    alignSelf: "stretch",
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  suggestionsLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: colors.textSubtle,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  suggestion: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  suggestionText: {
    fontSize: 14,
    color: colors.text,
  },
  clearBtn: {
    alignSelf: "center",
    marginTop: spacing.lg,
    paddingVertical: spacing.sm,
  },
  clearBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.textSubtle,
    textDecorationLine: "underline",
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
