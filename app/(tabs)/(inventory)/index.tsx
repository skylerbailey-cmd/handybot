import { Stack, useFocusEffect, useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import PrimaryButton from "@/components/PrimaryButton";
import {
  getItemsNeedingAttention,
  getWarrantyStatus,
  loadInventory,
  removeHomeItem,
  updateHomeItem,
} from "@/lib/homeData";
import { promptAndPickImage } from "@/lib/image";
import { checkForRecalls, type RecallAlert } from "@/lib/recalls";
import {
  createCustomReminder,
  formatFrequency,
  loadReminders,
} from "@/lib/reminders";
import { loadRoomLabels } from "@/lib/rooms";
import { colors, radius, spacing } from "@/lib/theme";
import type { HomeItem, Reminder } from "@/lib/types";
import { usePhotoUri } from "@/hooks/usePhotoUri";
import { getRegistrationUrl, openRegistrationPage } from "@/lib/warrantyRegistry";

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

const WARRANTY_BADGE: Record<string, { bg: string; fg: string; label: string }> = {
  active: { bg: "#d1fae5", fg: "#047857", label: "Warranty Active" },
  expiring: { bg: "#fef3c7", fg: "#b45309", label: "Warranty Expiring" },
  expired: { bg: "#fee2e2", fg: "#b91c1c", label: "Warranty Expired" },
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

interface ItemSuggestion {
  name: string;
  icon: string;
  category: string;
  /** Keywords to match against existing items — if any match, hide this suggestion. */
  keywords: string[];
}

const COMMON_ITEMS: ItemSuggestion[] = [
  // HVAC
  { name: "Furnace", icon: "🔥", category: "hvac", keywords: ["furnace", "heater"] },
  { name: "Air Conditioner", icon: "❄️", category: "hvac", keywords: ["air conditioner", "ac unit", "a/c"] },
  { name: "Water Heater", icon: "🚿", category: "hvac", keywords: ["water heater", "hot water"] },
  { name: "Thermostat", icon: "🌡", category: "hvac", keywords: ["thermostat", "nest", "ecobee"] },
  // Appliances
  { name: "Refrigerator", icon: "🧊", category: "appliance", keywords: ["refrigerator", "fridge"] },
  { name: "Dishwasher", icon: "🍽", category: "appliance", keywords: ["dishwasher"] },
  { name: "Washer", icon: "👕", category: "appliance", keywords: ["washer", "washing machine"] },
  { name: "Dryer", icon: "🌀", category: "appliance", keywords: ["dryer"] },
  { name: "Oven / Range", icon: "🍳", category: "appliance", keywords: ["oven", "range", "stove"] },
  { name: "Microwave", icon: "📡", category: "appliance", keywords: ["microwave"] },
  // Plumbing
  { name: "Sump Pump", icon: "💧", category: "plumbing", keywords: ["sump pump"] },
  { name: "Water Softener", icon: "🚰", category: "plumbing", keywords: ["water softener"] },
  // Electrical
  { name: "Electrical Panel", icon: "⚡", category: "electrical", keywords: ["electrical panel", "breaker", "fuse box"] },
  { name: "Generator", icon: "🔌", category: "electrical", keywords: ["generator"] },
  // Exterior
  { name: "Roof", icon: "🏠", category: "exterior", keywords: ["roof", "shingles"] },
  { name: "Garage Door", icon: "🚗", category: "exterior", keywords: ["garage door"] },
  { name: "Deck / Patio", icon: "🪵", category: "exterior", keywords: ["deck", "patio"] },
  // Safety
  { name: "Smoke Detectors", icon: "🔔", category: "safety", keywords: ["smoke detector", "smoke alarm"] },
  { name: "CO Detector", icon: "🛡", category: "safety", keywords: ["co detector", "carbon monoxide"] },
  { name: "Fire Extinguisher", icon: "🧯", category: "safety", keywords: ["fire extinguisher"] },
];

export default function InventoryScreen() {
  const router = useRouter();
  const [items, setItems] = useState<HomeItem[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [failedImages, setFailedImages] = useState<Set<string>>(new Set());
  const [recallAlerts, setRecallAlerts] = useState<RecallAlert[]>([]);
  const [expandedReminderSections, setExpandedReminderSections] = useState<
    Set<string>
  >(new Set());
  const [roomFilter, setRoomFilter] = useState<string | null>(null);
  const [roomLabels, setRoomLabels] = useState<string[]>([]);

  const refresh = useCallback(async () => {
    const [loadedItems, loadedReminders, loadedRooms] = await Promise.all([
      loadInventory(),
      loadReminders(),
      loadRoomLabels(),
    ]);
    setItems(loadedItems);
    setReminders(loadedReminders);
    setRoomLabels(loadedRooms);

    // Check for CPSC recalls in the background (cached for 24h)
    if (loadedItems.length > 0) {
      checkForRecalls(loadedItems)
        .then(setRecallAlerts)
        .catch(() => {
          /* non-blocking — recall check is best-effort */
        });
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  // Rooms that actually have items assigned — only show these as filter chips
  const roomsInUse = useMemo(() => {
    const used = new Set<string>();
    for (const item of items) {
      if (item.room) used.add(item.room);
    }
    return roomLabels.filter((r) => used.has(r));
  }, [items, roomLabels]);

  // Apply room filter
  const filteredItems = useMemo(
    () => (roomFilter ? items.filter((i) => i.room === roomFilter) : items),
    [items, roomFilter]
  );

  const attention = useMemo(() => getItemsNeedingAttention(filteredItems), [filteredItems]);

  // Group recall alerts by item ID for per-card badges
  const recallsByItem = useMemo(() => {
    const map = new Map<string, RecallAlert[]>();
    for (const alert of recallAlerts) {
      const list = map.get(alert.itemId) ?? [];
      list.push(alert);
      map.set(alert.itemId, list);
    }
    return map;
  }, [recallAlerts]);

  // Track which reminders have already been added from inventory items
  const addedReminderTitles = useMemo(() => {
    const titles = new Set<string>();
    for (const r of reminders) {
      if (r.sourceIssueId) titles.add(`${r.sourceIssueId}:${r.title}`);
      else titles.add(r.title);
    }
    return titles;
  }, [reminders]);

  // Suggestions: common items the user hasn't added yet, grouped by category
  const suggestions = useMemo(() => {
    if (roomFilter) return new Map<string, ItemSuggestion[]>(); // hide when filtering by room
    const itemNames = items.map((i) => i.name.toLowerCase());
    const remaining = COMMON_ITEMS.filter(
      (s) =>
        !s.keywords.some((kw) =>
          itemNames.some((n) => n.includes(kw))
        )
    );
    const map = new Map<string, ItemSuggestion[]>();
    for (const s of remaining) {
      const list = map.get(s.category) ?? [];
      list.push(s);
      map.set(s.category, list);
    }
    return map;
  }, [items, roomFilter]);

  function handleAddSuggestion(s: ItemSuggestion) {
    router.push({
      pathname: "/(tabs)/(inventory)/edit",
      params: { prefillName: s.name, prefillIcon: s.icon, prefillCategory: s.category },
    });
  }

  function handleAddReminder(
    item: HomeItem,
    reminder: { title: string; description: string; frequencyDays: number; icon: string }
  ) {
    router.push({
      pathname: "/(tabs)/(reminders)/new",
      params: {
        prefillTitle: reminder.title,
        prefillDescription: reminder.description,
        prefillIcon: reminder.icon,
        prefillFrequencyDays: String(reminder.frequencyDays),
        sourceItemId: item.id,
        prefillRoom: item.room || undefined,
      },
    });
  }

  const grouped = useMemo(() => {
    const map = new Map<string, HomeItem[]>();
    for (const item of filteredItems) {
      const list = map.get(item.category) ?? [];
      list.push(item);
      map.set(item.category, list);
    }
    return Array.from(map.entries());
  }, [filteredItems]);

  // Items with warranties, sorted by expiration (soonest first)
  const warrantyItems = useMemo(() => {
    return filteredItems
      .filter((i) => i.warrantyExpiration)
      .sort((a, b) => a.warrantyExpiration! - b.warrantyExpiration!);
  }, [filteredItems]);

  // Auto-create warranty expiration reminders for items within 60 days
  useEffect(() => {
    if (warrantyItems.length === 0 || reminders.length === 0) return;

    const existingTitles = new Set(reminders.map((r) => r.title));
    const SIXTY_DAYS = 60 * 24 * 60 * 60 * 1000;
    const now = Date.now();

    for (const item of warrantyItems) {
      if (!item.warrantyExpiration) continue;
      const timeLeft = item.warrantyExpiration - now;
      if (timeLeft <= 0 || timeLeft > SIXTY_DAYS) continue;

      const reminderTitle = `Warranty expiring: ${item.name}`;
      if (existingTitles.has(reminderTitle)) continue;

      // Auto-create a one-time reminder 7 days before expiration
      const sevenDaysBefore = new Date(item.warrantyExpiration - 7 * 24 * 60 * 60 * 1000);
      const startDate = sevenDaysBefore.getTime() > now ? sevenDaysBefore : new Date(now + 60000);

      createCustomReminder({
        title: reminderTitle,
        description: `The warranty on your ${item.name}${item.warrantyProvider ? ` (${item.warrantyProvider})` : ""} expires ${new Date(item.warrantyExpiration).toLocaleDateString()}. Review coverage and file any claims before it lapses.`,
        icon: "📋",
        category: "general",
        frequencyDays: 365, // won't repeat meaningfully — one-shot
        startDate,
        sourceIssueId: item.id,
        room: item.room || undefined,
      }).then(() => {
        refresh();
      }).catch(() => {
        /* best-effort */
      });

      // Only auto-create one at a time to avoid spamming
      break;
    }
  }, [warrantyItems, reminders]);

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

  function handleAddItem() {
    router.push({ pathname: "/(tabs)/(inventory)/edit" });
  }

  function handleEditItem(item: HomeItem) {
    router.push({
      pathname: "/(tabs)/(inventory)/edit",
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
              hitSlop={10}
              style={styles.headerBtn}
            >
              <Text style={styles.headerBtnText}>+ Add</Text>
            </Pressable>
          ),
        }}
      />
      <ScrollView contentContainerStyle={styles.container}>
        {roomsInUse.length > 1 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.roomFilterRow}
            style={styles.roomFilterScroll}
          >
            <Pressable
              onPress={() => setRoomFilter(null)}
              style={[
                styles.roomFilterChip,
                !roomFilter && styles.roomFilterChipActive,
              ]}
            >
              <Text
                style={[
                  styles.roomFilterChipText,
                  !roomFilter && styles.roomFilterChipTextActive,
                ]}
              >
                All rooms
              </Text>
            </Pressable>
            {roomsInUse.map((r) => (
              <Pressable
                key={r}
                onPress={() => setRoomFilter(roomFilter === r ? null : r)}
                style={[
                  styles.roomFilterChip,
                  roomFilter === r && styles.roomFilterChipActive,
                ]}
              >
                <Text
                  style={[
                    styles.roomFilterChipText,
                    roomFilter === r && styles.roomFilterChipTextActive,
                  ]}
                >
                  {r}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        )}

        {filteredItems.length === 0 && !roomFilter && items.length === 0 && (
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
                      {getWarrantyStatus(item) === "expiring"
                        ? `Warranty expires ${new Date(item.warrantyExpiration!).toLocaleDateString()}`
                        : remaining <= 0
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

        {warrantyItems.length > 0 && (
          <View style={styles.warrantySection}>
            <Text style={styles.sectionTitle}>Warranties</Text>
            <Text style={styles.warrantySectionSub}>
              Sorted by expiration date
            </Text>
            {warrantyItems.map((item) => {
              const ws = getWarrantyStatus(item);
              const wc = WARRANTY_BADGE[ws] ?? WARRANTY_BADGE.active;
              const expDate = new Date(
                item.warrantyExpiration!
              ).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              });
              const now = Date.now();
              const daysLeft = Math.ceil(
                (item.warrantyExpiration! - now) / (24 * 60 * 60 * 1000)
              );

              return (
                <Pressable
                  key={`warranty-${item.id}`}
                  onPress={() => handleEditItem(item)}
                  style={({ pressed }) => [
                    styles.warrantyRow,
                    pressed && { opacity: 0.9 },
                  ]}
                >
                  <Text style={styles.warrantyItemIcon}>{item.icon}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.warrantyItemName} numberOfLines={1}>
                      {item.name}
                    </Text>
                    {(item.make || item.warrantyProvider) && (
                      <Text style={styles.warrantyItemMeta} numberOfLines={1}>
                        {item.warrantyProvider || item.make}
                      </Text>
                    )}
                    <Text
                      style={[
                        styles.warrantyExpiry,
                        { color: wc.fg },
                      ]}
                    >
                      {ws === "expired"
                        ? `Expired ${expDate}`
                        : ws === "expiring"
                          ? `Expires ${expDate} (${daysLeft} day${daysLeft !== 1 ? "s" : ""} left)`
                          : `Expires ${expDate}`}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.warrantyStatusBadge,
                      { backgroundColor: wc.bg },
                    ]}
                  >
                    <Text
                      style={[
                        styles.warrantyStatusText,
                        { color: wc.fg },
                      ]}
                    >
                      {ws === "expired"
                        ? "Expired"
                        : ws === "expiring"
                          ? "Expiring"
                          : "Active"}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        )}

        {grouped.map(([category, categoryItems]) => (
          <View key={category} style={styles.section}>
            <Text style={styles.sectionTitle}>
              {CATEGORY_LABEL[category] ?? category}
            </Text>
            {/* Suggestion chips for this category */}
            {(suggestions.get(category) ?? []).length > 0 && (
              <View style={styles.suggestionRow}>
                {(suggestions.get(category) ?? []).map((s) => (
                  <Pressable
                    key={s.name}
                    onPress={() => handleAddSuggestion(s)}
                    style={styles.suggestionChip}
                  >
                    <Text style={styles.suggestionIcon}>{s.icon}</Text>
                    <Text style={styles.suggestionText}>+ {s.name}</Text>
                  </Pressable>
                ))}
              </View>
            )}
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
                  <ItemPhoto
                    uri={item.photoUri}
                    failed={failedImages.has(item.id)}
                    onError={() =>
                      setFailedImages((prev) => new Set(prev).add(item.id))
                    }
                    icon={item.icon}
                  />
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
                    {recallsByItem.has(item.id) && (
                      <Pressable
                        onPress={() => {
                          const alert = recallsByItem.get(item.id)![0];
                          if (alert.url) WebBrowser.openBrowserAsync(alert.url);
                        }}
                        style={styles.recallBadge}
                      >
                        <Text style={styles.recallBadgeText}>
                          ⚠ RECALL
                        </Text>
                      </Pressable>
                    )}
                    {(() => {
                      const ws = getWarrantyStatus(item);
                      if (ws === "none") return null;
                      const wc = WARRANTY_BADGE[ws];
                      return (
                        <View
                          style={[
                            styles.conditionBadge,
                            { backgroundColor: wc.bg, alignSelf: "flex-start" },
                          ]}
                        >
                          <Text style={[styles.conditionText, { color: wc.fg }]}>
                            {wc.label}
                          </Text>
                        </View>
                      );
                    })()}
                    {/* Warranty + Receipt action row */}
                    <View style={styles.actionRow}>
                      {item.make && !item.warrantyRegistered && (
                        <Pressable
                          onPress={(e) => {
                            e.stopPropagation();
                            openRegistrationPage(item).then(() => {
                              Alert.alert(
                                "Mark as registered?",
                                "Did you complete the warranty registration?",
                                [
                                  { text: "Not yet", style: "cancel" },
                                  {
                                    text: "Yes, registered",
                                    onPress: async () => {
                                      await updateHomeItem(item.id, {
                                        warrantyRegistered: true,
                                      });
                                      refresh();
                                      // Prompt to upload warranty document
                                      Alert.alert(
                                        "Save warranty info?",
                                        "Upload a photo or PDF of your warranty confirmation, certificate, or email so you have it on file.",
                                        [
                                          { text: "Skip", style: "cancel" },
                                          {
                                            text: "Upload",
                                            onPress: async () => {
                                              const result = await promptAndPickImage(
                                                "Warranty document",
                                                { includeFiles: true }
                                              );
                                              if (result) {
                                                await updateHomeItem(item.id, {
                                                  warrantyPhotoUri: result.uri,
                                                });
                                                refresh();
                                              }
                                            },
                                          },
                                        ]
                                      );
                                    },
                                  },
                                ]
                              );
                            });
                          }}
                          style={styles.actionBtn}
                        >
                          <Text style={styles.actionBtnText}>
                            📋 Register Warranty
                          </Text>
                        </Pressable>
                      )}
                      {item.warrantyRegistered && (
                        <View style={styles.registeredBadge}>
                          <Text style={styles.registeredBadgeText}>
                            ✓ Warranty Registered
                          </Text>
                        </View>
                      )}
                      {!item.receiptPhotoUri ? (
                        <Pressable
                          onPress={(e) => {
                            e.stopPropagation();
                            router.push({
                              pathname: "/(tabs)/(inventory)/edit",
                              params: { itemId: item.id, scrollTo: "receipt" },
                            });
                          }}
                          style={styles.actionBtn}
                        >
                          <Text style={styles.actionBtnText}>
                            🧾 Add Receipt
                          </Text>
                        </Pressable>
                      ) : (
                        <View style={styles.registeredBadge}>
                          <Text style={styles.registeredBadgeText}>
                            ✓ Receipt Saved
                          </Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.itemNotes} numberOfLines={2}>
                      {item.conditionNotes}
                    </Text>
                    {(item.make || item.model) && (
                      <Text style={styles.itemSpecText} numberOfLines={1}>
                        {[item.make, item.model].filter(Boolean).join(" ")}
                        {item.yearInstalled ? ` (${item.yearInstalled})` : ""}
                      </Text>
                    )}
                    <View style={styles.itemMeta}>
                      {item.room ? (
                        <>
                          <Text style={styles.itemMetaText}>{item.room}</Text>
                          <Text style={styles.itemMetaDot}>·</Text>
                        </>
                      ) : null}
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

        {/* Suggestion-only sections for categories with no items yet */}
        {!roomFilter &&
          Array.from(suggestions.entries())
            .filter(([cat]) => !grouped.some(([c]) => c === cat))
            .map(([cat, catSuggestions]) => (
              <View key={`suggest-${cat}`} style={styles.section}>
                <Text style={styles.sectionTitle}>
                  {CATEGORY_LABEL[cat] ?? cat}
                </Text>
                <View style={styles.suggestionRow}>
                  {catSuggestions.map((s) => (
                    <Pressable
                      key={s.name}
                      onPress={() => handleAddSuggestion(s)}
                      style={styles.suggestionChip}
                    >
                      <Text style={styles.suggestionIcon}>{s.icon}</Text>
                      <Text style={styles.suggestionText}>+ {s.name}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            ))}

        {filteredItems.length > 0 && roomFilter && (
          <Text style={styles.roomFilterCountHint}>
            Showing {filteredItems.length}{" "}
            {filteredItems.length === 1 ? "item" : "items"} in {roomFilter}
          </Text>
        )}

        {items.length > 0 && (
          <Pressable
            onPress={() => router.push("/(tabs)/(inventory)/insurance-export")}
            style={styles.insuranceBtn}
          >
            <Text style={styles.insuranceBtnIcon}>🛡</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.insuranceBtnText}>Export for insurance</Text>
              <Text style={styles.insuranceBtnHint}>
                Generate a claim-ready PDF
              </Text>
            </View>
            <Text style={styles.insuranceBtnArrow}>›</Text>
          </Pressable>
        )}

        {items.length > 0 && (
          <Text style={styles.hint}>Tap to edit · Long-press to remove</Text>
        )}
      </ScrollView>

    </>
  );
}

function ItemPhoto({
  uri,
  failed,
  onError,
  icon,
}: {
  uri?: string;
  failed: boolean;
  onError: () => void;
  icon?: string;
}) {
  const resolved = usePhotoUri(uri);
  if (resolved && !failed) {
    return (
      <Image
        source={{ uri: resolved }}
        style={styles.itemPhoto}
        onError={onError}
      />
    );
  }
  if (!resolved) return null;
  return (
    <View style={styles.itemPhotoPlaceholder}>
      <Text style={styles.itemPhotoPlaceholderText}>{icon || "📷"}</Text>
      <Text style={styles.itemPhotoPlaceholderHint}>Photo unavailable</Text>
    </View>
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
  itemPhotoPlaceholder: {
    width: "100%",
    height: 140,
    backgroundColor: "#f5f5f4",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  itemPhotoPlaceholderText: {
    fontSize: 32,
  },
  itemPhotoPlaceholderHint: {
    fontSize: 11,
    color: colors.textSubtle,
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
  itemSpecText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.textMuted,
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
  recallBadge: {
    alignSelf: "flex-start",
    backgroundColor: "#fee2e2",
    borderWidth: 1,
    borderColor: "#fca5a5",
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
    marginTop: 2,
  },
  recallBadgeText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#dc2626",
  },
  actionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  actionBtn: {
    backgroundColor: colors.brandLighter,
    borderWidth: 1,
    borderColor: colors.brandLight,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
  },
  actionBtnText: {
    fontSize: 12,
    fontWeight: "800",
    color: colors.brand,
  },
  insuranceBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginTop: spacing.lg,
  },
  insuranceBtnIcon: {
    fontSize: 24,
  },
  insuranceBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.text,
  },
  insuranceBtnHint: {
    fontSize: 11,
    color: colors.textMuted,
  },
  insuranceBtnArrow: {
    fontSize: 20,
    fontWeight: "700",
    color: colors.textSubtle,
  },
  registeredBadge: {
    alignSelf: "flex-start",
    backgroundColor: "#d1fae5",
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  registeredBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#047857",
  },
  warrantySection: {
    marginBottom: spacing.lg,
  },
  warrantySectionSub: {
    fontSize: 11,
    color: colors.textSubtle,
    marginBottom: spacing.sm,
  },
  warrantyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  warrantyItemIcon: {
    fontSize: 24,
  },
  warrantyItemName: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.text,
  },
  warrantyItemMeta: {
    fontSize: 12,
    color: colors.textMuted,
  },
  warrantyExpiry: {
    fontSize: 12,
    fontWeight: "600",
    marginTop: 2,
  },
  warrantyStatusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  warrantyStatusText: {
    fontSize: 10,
    fontWeight: "800",
  },
  suggestionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginBottom: spacing.sm + 2,
  },
  suggestionChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: "dashed",
    backgroundColor: colors.surface,
  },
  suggestionIcon: {
    fontSize: 16,
  },
  suggestionText: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.brand,
  },
  roomFilterScroll: {
    marginBottom: spacing.lg,
    flexGrow: 0,
  },
  roomFilterRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  roomFilterChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.pill,
    backgroundColor: "#f5f5f4",
    borderWidth: 1,
    borderColor: colors.border,
  },
  roomFilterChipActive: {
    backgroundColor: colors.brandLight,
    borderColor: colors.brand,
  },
  roomFilterChipText: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.textMuted,
  },
  roomFilterChipTextActive: {
    color: colors.brandDark,
    fontWeight: "700",
  },
  roomFilterCountHint: {
    fontSize: 12,
    color: colors.textSubtle,
    textAlign: "center",
    marginTop: spacing.sm,
  },
});
