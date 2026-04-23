import { Stack, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { getSupabase } from "@/lib/supabase";
import { colors, radius, spacing } from "@/lib/theme";

interface ParentNotification {
  id: number;
  question: string;
  response?: string;
  category?: string;
  acknowledged: boolean;
  createdAt: string;
}

const CATEGORY_ICON: Record<string, string> = {
  electrical: "⚡",
  gas: "🔥",
  heights: "🪜",
  chemical: "⚗",
};

export default function MinorActivityScreen() {
  const [notifications, setNotifications] = useState<ParentNotification[]>([]);

  useFocusEffect(
    useCallback(() => {
      loadNotifications().then(setNotifications);
    }, [])
  );

  async function loadNotifications(): Promise<ParentNotification[]> {
    const supabase = getSupabase();
    if (!supabase) return [];
    const { data, error } = await supabase
      .from("parent_notifications")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);
    if (error || !data) return [];
    return data.map((r: Record<string, unknown>) => ({
      id: r.id as number,
      question: r.question as string,
      response: (r.response as string) ?? undefined,
      category: (r.category as string) ?? undefined,
      acknowledged: r.acknowledged as boolean,
      createdAt: r.created_at as string,
    }));
  }

  async function handleAcknowledge(id: number) {
    const supabase = getSupabase();
    if (!supabase) return;
    await supabase
      .from("parent_notifications")
      .update({ acknowledged: true })
      .eq("id", id);
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, acknowledged: true } : n))
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: "Safety Reviews" }} />
      <FlatList
        data={notifications}
        keyExtractor={(n) => String(n.id)}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>
              No safety alerts yet. When a minor household member asks about
              potentially dangerous repairs, you'll see the conversation here.
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <View
            style={[
              styles.card,
              item.acknowledged && styles.cardAcknowledged,
            ]}
          >
            <View style={styles.cardHeader}>
              <Text style={styles.categoryIcon}>
                {CATEGORY_ICON[item.category ?? ""] ?? "⚠"}
              </Text>
              <Text style={styles.categoryLabel}>
                {item.category
                  ? item.category.charAt(0).toUpperCase() +
                    item.category.slice(1)
                  : "Safety"}{" "}
                alert
              </Text>
              <Text style={styles.time}>
                {new Date(item.createdAt).toLocaleDateString()}
              </Text>
            </View>

            <Text style={styles.questionLabel}>Asked:</Text>
            <Text style={styles.questionText}>{item.question}</Text>

            {item.response && (
              <>
                <Text style={styles.questionLabel}>HandyBot replied:</Text>
                <Text style={styles.responseText}>
                  {item.response.slice(0, 300)}
                  {item.response.length > 300 ? "..." : ""}
                </Text>
              </>
            )}

            {!item.acknowledged && (
              <Pressable
                onPress={() => handleAcknowledge(item.id)}
                style={styles.ackBtn}
              >
                <Text style={styles.ackBtnText}>Acknowledge</Text>
              </Pressable>
            )}
          </View>
        )}
      />
    </>
  );
}

const styles = StyleSheet.create({
  list: {
    padding: spacing.md,
    paddingBottom: spacing.xxl,
  },
  empty: {
    padding: spacing.xl,
    alignItems: "center",
  },
  emptyText: {
    fontSize: 13,
    color: colors.textMuted,
    textAlign: "center",
    lineHeight: 19,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: "#fca5a5",
    padding: spacing.md,
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  cardAcknowledged: {
    borderColor: colors.border,
    opacity: 0.7,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  categoryIcon: { fontSize: 18 },
  categoryLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: "#b91c1c",
    flex: 1,
  },
  time: {
    fontSize: 11,
    color: colors.textSubtle,
  },
  questionLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: colors.textSubtle,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  questionText: {
    fontSize: 14,
    color: colors.text,
    lineHeight: 20,
  },
  responseText: {
    fontSize: 13,
    color: colors.textMuted,
    lineHeight: 19,
  },
  ackBtn: {
    backgroundColor: colors.brand,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    alignItems: "center",
    marginTop: spacing.xs,
  },
  ackBtnText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
  },
});
