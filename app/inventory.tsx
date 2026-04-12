import { Stack, useFocusEffect, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

const ANALYZING_MESSAGES = [
  "Analyzing your photo...",
  "Identifying the item...",
  "Estimating age and condition...",
  "Checking for wear and damage...",
  "Building maintenance tips...",
  "Almost done...",
];

const MESSAGE_INTERVAL_MS = 3000;
import PrimaryButton from "@/components/PrimaryButton";
import { analyzeHomeItem } from "@/lib/claude";
import {
  getItemsNeedingAttention,
  loadInventory,
  removeHomeItem,
} from "@/lib/homeData";
import { promptAndPickImage, readImageAsBase64 } from "@/lib/image";
import { formatFrequency, loadReminders } from "@/lib/reminders";
import { colors, radius, spacing } from "@/lib/theme";
import type { HomeItem, Reminder } from "@/lib/types";

const CONDITION_LABEL: Record<string, string> = {
  good: "Good",
  fair: "Fair",
  poor: "Poor",
  replace_soon: "Replace soon",
};

const CONDITION_COLOR: Record<
  string,
  { bg: string; fg: string }
> = {
  good: { bg: "#d1fae5", fg: "#047857" },
  fair: { bg: "#fef3c7", fg: "#b45309" },
  poor: { bg: "#fee2e2", fg: "#b91c1c" },
  replace_soon: { bg: "#fee2e2", fg: "#b91c1c" },
};

const CATEGORY_LABEL: Record<string, string> = {
  hvac: "HVAC",
  plumbing: "Plumbing",
  electrical: "Electrical",
  appliance: "Appliances",
  structural: "Structural",
  exterior: "Exterior",
  safety: "Safety",
  other: "Other",
};

export default function InventoryScreen() {
  const router = useRouter();
  const [items, setItems] = useState<HomeItem[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [adding, setAdding] = useState(false);
  const [expandedReminderSections, setExpandedReminderSections] = useState<
    Set<string>
  >(new Set());
  const [msgIndex, setMsgIndex] = useState(0);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!adding) {
      setMsgIndex(0);
      return;
    }
    const interval = setInterval(() => {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start(() => {
        setMsgIndex((prev) => (prev + 1) % ANALYZING_MESSAGES.length);
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }).start();
      });
    }, MESSAGE_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [adding, fadeAnim]);

  const refresh = useCallback(async () => {
    const [loadedItems, loadedReminders] = await Promise.all([
      loadInventory(),
      loadReminders(),
    ]);
    setItems(loadedItems);
    setReminders(loadedReminders);
  }, []);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  const attention = useMemo(() => getItemsNeedingAttention(items), [items]);

  // Track which reminders have already been added from inventory items
  const addedReminderTitles = useMemo(() => {
    const titles = new Set<string>();
    for (const r of reminders) {
      if (r.sourceIssueId) titles.add(`${r.sourceIssueId}:${r.title}`);
      else titles.add(r.title);
    }
    return titles;
  }, [reminders]);

  function handleAddReminder(
    item: HomeItem,
    reminder: { title: string; description: string; frequencyDays: number; icon: string }
  ) {
    router.push({
      pathname: "/reminder/new",
      params: {
        prefillTitle: reminder.title,
        prefillDescription: reminder.description,
        prefillIcon: reminder.icon,
        prefillFrequencyDays: String(reminder.frequencyDays),
        sourceItemId: item.id,
      },
    });
  }

  const grouped = useMemo(() => {
    const map = new Map<string, HomeItem[]>();
    for (const item of items) {
      const list = map.get(item.category) ?? [];
      list.push(item);
      map.set(item.category, list);
    }
    return Array.from(map.entries());
  }, [items]);

  // First item (in render order) that has smart reminders — auto-expand its section
  const firstItemWithRemindersId = useMemo(() => {
    for (const [, categoryItems] of grouped) {
      for (const it of categoryItems) {
        if (it.suggestedReminders && it.suggestedReminders.length > 0) {
          return it.id;
        }
      }
    }
    return null;
  }, [grouped]);

  async function handleAddItem() {
    if (adding) return;
    try {
      const picked = await promptAndPickImage("Photograph a home item");
      if (!picked) return;
      setAdding(true);
      const base64 = await readImageAsBase64(picked.uri);
      const analysis = await analyzeHomeItem({
        imageBase64: base64,
        imageMediaType: "image/jpeg",
      });

      // Navigate to the edit/review screen so the user can adjust
      // Claude's analysis before saving.
      router.push({
        pathname: "/inventory-edit",
        params: {
          analyzedData: JSON.stringify(analysis),
          photoUri: picked.uri,
        },
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not analyze item";
      Alert.alert("Something went wrong", msg);
    } finally {
      setAdding(false);
    }
  }

  function handleEditItem(item: HomeItem) {
    router.push({
      pathname: "/inventory-edit",
      params: { itemId: item.id },
    });
  }

  function handleDeleteItem(item: HomeItem) {
    Alert.alert(
      `Remove ${item.name}?`,
      "This item will be removed from your home inventory.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            await removeHomeItem(item.id);
            await refresh();
          },
        },
      ]
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          headerRight: () => (
            <Pressable
              onPress={handleAddItem}
              disabled={adding}
              hitSlop={10}
              style={styles.headerBtn}
            >
              <Text style={styles.headerBtnText}>
                {adding ? "..." : "+ Add"}
              </Text>
            </Pressable>
          ),
        }}
      />
      <ScrollView contentContainerStyle={styles.container}>
        {items.length === 0 && !adding && (
          <View style={styles.empty}>
            <View style={styles.emptyIcon}>
              <Text style={styles.emptyIconText}>🏠</Text>
            </View>
            <Text style={styles.emptyTitle}>Your home inventory</Text>
            <Text style={styles.emptyBody}>
              Photograph your appliances, water heater, HVAC, roof — anything
              you want HandyBot to track. We&apos;ll identify each item,
              estimate its age and condition, and alert you when something
              needs attention.
            </Text>
            <PrimaryButton
              title="+ Add your first item"
              onPress={handleAddItem}
              loading={adding}
            />
          </View>
        )}

        {attention.length > 0 && (
          <View style={styles.alertCard}>
            <Text style={styles.alertTitle}>
              ⚠ {attention.length}{" "}
              {attention.length === 1 ? "item needs" : "items need"} attention
            </Text>
            {attention.map((item) => {
              const remaining =
                item.typicalLifespanYears - item.estimatedAgeYears;
              return (
                <View key={item.id} style={styles.alertRow}>
                  <Text style={styles.alertIcon}>{item.icon}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.alertItemName}>{item.name}</Text>
                    <Text style={styles.alertItemNote}>
                      {remaining <= 0
                        ? `Past typical ${item.typicalLifespanYears}-year lifespan`
                        : `${remaining} ${remaining === 1 ? "year" : "years"} of expected life remaining`}
                      {item.condition === "poor" || item.condition === "replace_soon"
                        ? ` · Condition: ${CONDITION_LABEL[item.condition]}`
                        : ""}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {grouped.map(([category, categoryItems]) => (
          <View key={category} style={styles.section}>
            <Text style={styles.sectionTitle}>
              {CATEGORY_LABEL[category] ?? category}
            </Text>
            {categoryItems.map((item) => {
              const c = CONDITION_COLOR[item.condition] ?? CONDITION_COLOR.fair;
              return (
                <Pressable
                  key={item.id}
                  onPress={() => handleEditItem(item)}
                  onLongPress={() => handleDeleteItem(item)}
                  style={({ pressed }) => [
                    styles.itemCard,
                    pressed && { opacity: 0.9 },
                  ]}
                >
                  {item.photoUri && (
                    <Image
                      source={{ uri: item.photoUri }}
                      style={styles.itemPhoto}
                    />
                  )}
                  <View style={styles.itemBody}>
                    <View style={styles.itemHeader}>
                      <Text style={styles.itemIcon}>{item.icon}</Text>
                      <Text style={styles.itemName} numberOfLines={1}>
                        {item.name}
                      </Text>
                      <View
                        style={[
                          styles.conditionBadge,
                          { backgroundColor: c.bg },
                        ]}
                      >
                        <Text
                          style={[styles.conditionText, { color: c.fg }]}
                        >
                          {CONDITION_LABEL[item.condition]}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.itemNotes} numberOfLines={2}>
                      {item.conditionNotes}
                    </Text>
                    <View style={styles.itemMeta}>
                      <Text style={styles.itemMetaText}>
                        ~{item.estimatedAgeYears}yr old
                      </Text>
                      <Text style={styles.itemMetaDot}>·</Text>
                      <Text style={styles.itemMetaText}>
                        Lasts ~{item.typicalLifespanYears}yr
                      </Text>
                    </View>
                    {item.maintenanceTips.length > 0 && (
                      <View style={styles.tipsWrap}>
                        {item.maintenanceTips.slice(0, 2).map((tip, i) => (
                          <Text key={i} style={styles.tipText}>
                            • {tip}
                          </Text>
                        ))}
                      </View>
                    )}
                    {item.suggestedReminders &&
                      item.suggestedReminders.length > 0 &&
                      (() => {
                        const isOpen =
                          expandedReminderSections.has(item.id) ||
                          (item.id === firstItemWithRemindersId &&
                            !expandedReminderSections.has(`${item.id}:closed`));
                        return (
                          <View style={styles.remindersSection}>
                            <Pressable
                              onPress={() => {
                                setExpandedReminderSections((prev) => {
                                  const next = new Set(prev);
                                  if (isOpen) {
                                    next.delete(item.id);
                                    // Mark auto-open item as explicitly closed
                                    if (item.id === firstItemWithRemindersId) {
                                      next.add(`${item.id}:closed`);
                                    }
                                  } else {
                                    next.add(item.id);
                                    next.delete(`${item.id}:closed`);
                                  }
                                  return next;
                                });
                              }}
                              style={styles.remindersSectionHeader}
                            >
                              <Text style={styles.remindersSectionTitle}>
                                🔔 Smart reminders ({item.suggestedReminders.length})
                              </Text>
                              <Text style={styles.remindersToggleHint}>
                                {isOpen ? "Hide" : "Tap to view"}
                              </Text>
                              <Text style={styles.remindersChevron}>
                                {isOpen ? "▾" : "▸"}
                              </Text>
                            </Pressable>
                            {isOpen &&
                              item.suggestedReminders.map((sr, ri) => {
                                const alreadyAdded = addedReminderTitles.has(
                                  `${item.id}:${sr.title}`
                                );
                                return (
                                  <Pressable
                                    key={ri}
                                    onPress={() => {
                                      if (!alreadyAdded) {
                                        handleAddReminder(item, sr);
                                      }
                                    }}
                                    style={styles.reminderRow}
                                  >
                                    <Text style={styles.reminderIcon}>
                                      {sr.icon}
                                    </Text>
                                    <View style={styles.reminderBody}>
                                      <Text
                                        style={styles.reminderTitle}
                                        numberOfLines={1}
                                      >
                                        {sr.title}
                                      </Text>
                                      <Text
                                        style={styles.reminderDesc}
                                        numberOfLines={1}
                                      >
                                        {formatFrequency(sr.frequencyDays)} · {sr.description}
                                      </Text>
                                    </View>
                                    {alreadyAdded ? (
                                      <Text style={styles.addedChip}>✓</Text>
                                    ) : (
                                      <Pressable
                                        onPress={() =>
                                          handleAddReminder(item, sr)
                                        }
                                        style={styles.reminderAddCircle}
                                        hitSlop={8}
                                      >
                                        <Text style={styles.reminderAddCircleText}>
                                          +
                                        </Text>
                                      </Pressable>
                                    )}
                                  </Pressable>
                                );
                              })}
                          </View>
                        );
                      })()}
                  </View>
                </Pressable>
              );
            })}
          </View>
        ))}

        {items.length > 0 && (
          <Text style={styles.hint}>Tap to edit · Long-press to remove</Text>
        )}
      </ScrollView>

      {adding && (
        <View style={styles.loadingOverlay} pointerEvents="auto">
          <View style={styles.loadingCard}>
            <ActivityIndicator color={colors.brand} size="large" />
            <Animated.Text
              style={[styles.loadingMessage, { opacity: fadeAnim }]}
            >
              {ANALYZING_MESSAGES[msgIndex]}
            </Animated.Text>
            <View style={styles.loadingDots}>
              {ANALYZING_MESSAGES.map((_, i) => (
                <View
                  key={i}
                  style={[
                    styles.loadingDot,
                    i === msgIndex && styles.loadingDotActive,
                    i < msgIndex && styles.loadingDotPast,
                  ]}
                />
              ))}
            </View>
            <Text style={styles.loadingHint}>
              This usually takes 10–15 seconds
            </Text>
          </View>
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl * 2,
  },
  headerBtn: {
    paddingHorizontal: spacing.sm,
  },
  headerBtnText: {
    fontSize: 15,
    fontWeight: "800",
    color: colors.brand,
  },
  empty: {
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.xl,
  },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 999,
    backgroundColor: colors.brandLight,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyIconText: {
    fontSize: 36,
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
    maxWidth: 340,
    lineHeight: 20,
  },
  alertCard: {
    backgroundColor: "#fff7ed",
    borderWidth: 1,
    borderColor: "#fed7aa",
    borderRadius: radius.lg,
    padding: spacing.md + 2,
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  alertTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#9a3412",
  },
  alertRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  alertIcon: {
    fontSize: 20,
  },
  alertItemName: {
    fontSize: 14,
    fontWeight: "700",
    color: "#7c2d12",
  },
  alertItemNote: {
    fontSize: 12,
    color: "#9a3412",
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "800",
    color: colors.text,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: spacing.sm,
  },
  itemCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
    marginBottom: spacing.sm + 2,
  },
  itemPhoto: {
    width: "100%",
    height: 140,
  },
  itemBody: {
    padding: spacing.md,
    gap: spacing.xs + 2,
  },
  itemHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  itemIcon: {
    fontSize: 20,
  },
  itemName: {
    flex: 1,
    fontSize: 16,
    fontWeight: "700",
    color: colors.text,
  },
  conditionBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  conditionText: {
    fontSize: 11,
    fontWeight: "700",
  },
  itemNotes: {
    fontSize: 13,
    color: colors.textMuted,
    lineHeight: 18,
  },
  itemMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  itemMetaText: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.textSubtle,
  },
  itemMetaDot: {
    fontSize: 11,
    color: colors.textSubtle,
  },
  tipsWrap: {
    marginTop: spacing.xs,
    gap: 2,
  },
  tipText: {
    fontSize: 12,
    color: colors.textMuted,
    lineHeight: 17,
  },
  remindersSection: {
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderColor: colors.border,
    gap: 2,
  },
  remindersSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.xs + 2,
    backgroundColor: colors.brandLighter,
    borderRadius: radius.sm,
  },
  remindersSectionTitle: {
    flex: 1,
    fontSize: 11,
    fontWeight: "800",
    color: colors.text,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  remindersToggleHint: {
    fontSize: 10,
    fontWeight: "700",
    color: colors.brand,
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  remindersChevron: {
    fontSize: 14,
    fontWeight: "800",
    color: colors.brand,
    width: 14,
    textAlign: "center",
  },
  reminderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs + 2,
    borderTopWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.xs + 2,
  },
  reminderBody: {
    flex: 1,
    gap: 1,
  },
  reminderIcon: {
    fontSize: 14,
  },
  reminderTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.text,
  },
  addedChip: {
    fontSize: 10,
    fontWeight: "800",
    color: colors.success,
    backgroundColor: colors.successBg,
    paddingHorizontal: spacing.xs + 2,
    paddingVertical: 2,
    borderRadius: radius.pill,
    overflow: "hidden",
  },
  arrow: {
    fontSize: 14,
    color: colors.textSubtle,
    width: 18,
    textAlign: "center",
  },
  reminderDesc: {
    fontSize: 11,
    color: colors.textMuted,
    lineHeight: 14,
  },
  reminderAddCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.brand,
    alignItems: "center",
    justifyContent: "center",
  },
  reminderAddCircleText: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "700",
    lineHeight: 20,
    marginTop: -2,
  },
  hint: {
    textAlign: "center",
    fontSize: 11,
    color: colors.textSubtle,
    marginTop: spacing.md,
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
});
