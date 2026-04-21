import {
  Link,
  Stack,
  useFocusEffect,
  useLocalSearchParams,
  useRouter,
} from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import ReanimatedSwipeable, {
  type SwipeableMethods,
} from "react-native-gesture-handler/ReanimatedSwipeable";
import ReminderRow from "@/components/ReminderRow";
import SegmentedTabs from "@/components/SegmentedTabs";
import TemplateRow from "@/components/TemplateRow";
import {
  createReminderFromTemplate,
  deleteReminder,
  ensureNotificationsConfigured,
  formatDueDate,
  loadReminders,
  markReminderDone,
  requestNotificationPermissions,
  setReminderEnabled,
  snoozeReminder,
} from "@/lib/reminders";
import { MAINTENANCE_TEMPLATES } from "@/lib/reminderTemplates";
import { colors, radius, spacing } from "@/lib/theme";
import type { MaintenanceTemplate, Reminder } from "@/lib/types";

type TabKey = "active" | "suggested";
type GroupBy = "status" | "category" | "room";

const DAY_MS = 24 * 60 * 60 * 1000;

export default function RemindersScreen() {
  const { highlight } = useLocalSearchParams<{ highlight?: string }>();
  const router = useRouter();
  const [reminders, setReminders] = useState<Reminder[] | null>(null);
  const [tab, setTab] = useState<TabKey>("active");
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const [groupBy, setGroupBy] = useState<GroupBy>("status");

  const refresh = useCallback(async () => {
    setReminders(await loadReminders());
  }, []);

  useEffect(() => {
    ensureNotificationsConfigured().catch(() => {
      /* ignore */
    });
  }, []);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  // If we arrived via notification tap (or the home preview), flash the
  // matching reminder and make sure the active tab is visible.
  useEffect(() => {
    if (!highlight) return;
    setTab("active");
    setHighlightedId(highlight);
    const t = setTimeout(() => setHighlightedId(null), 3500);
    return () => clearTimeout(t);
  }, [highlight]);

  const enabledTemplateIds = useMemo(() => {
    return new Set(
      (reminders ?? [])
        .filter((r) => r.templateId)
        .map((r) => r.templateId as string)
    );
  }, [reminders]);

  async function handleAddTemplate(template: MaintenanceTemplate) {
    const granted = await requestNotificationPermissions();
    if (!granted) {
      setPermissionDenied(true);
      Alert.alert(
        "Notifications disabled",
        "HandyBot can still track this reminder in the app, but you won't get a push notification when it's due. You can enable notifications in your device Settings.",
        [
          {
            text: "Add anyway",
            onPress: async () => {
              await addTemplateWithStart(template);
            },
          },
          { text: "Cancel", style: "cancel" },
        ]
      );
      return;
    }
    await addTemplateWithStart(template);
  }

  async function addTemplateWithStart(template: MaintenanceTemplate) {
    // Default start: one frequency-period from now.
    const start = new Date(Date.now() + template.frequencyDays * DAY_MS);
    await createReminderFromTemplate(template, start);
    await refresh();
  }

  async function handleToggle(reminder: Reminder, enabled: boolean) {
    if (enabled) {
      const granted = await requestNotificationPermissions();
      if (!granted) {
        Alert.alert(
          "Notifications disabled",
          "Enable notifications in your device Settings so we can alert you when this reminder is due."
        );
        return;
      }
    }
    await setReminderEnabled(reminder.id, enabled);
    await refresh();
  }

  async function handleDelete(reminder: Reminder) {
    Alert.alert(
      "Delete reminder?",
      `"${reminder.title}" will be removed and any scheduled notification canceled.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            await deleteReminder(reminder.id);
            await refresh();
          },
        },
      ]
    );
  }

  async function handleMarkDone(reminder: Reminder) {
    const updated = await markReminderDone(reminder.id);
    await refresh();
    if (updated) {
      Alert.alert(
        `${reminder.icon}  Nice work`,
        `"${reminder.title}" marked done. Next reminder: ${formatDueDate(updated)}.`
      );
    }
  }

  async function handleSnooze(reminder: Reminder) {
    const updated = await snoozeReminder(reminder.id, 1);
    await refresh();
    if (updated) {
      Alert.alert(
        `${reminder.icon}  Snoozed`,
        `"${reminder.title}" will remind you again tomorrow.`
      );
    }
  }

  function handleOpenEdit(reminder: Reminder) {
    router.push({ pathname: "/(tabs)/(reminders)/[id]", params: { id: reminder.id } });
  }

  const activeCount = reminders?.length ?? 0;
  const tabs = useMemo(
    () =>
      [
        { key: "active" as const, label: "Your reminders", badge: activeCount },
        { key: "suggested" as const, label: "Suggested" },
      ] as const,
    [activeCount]
  );

  return (
    <View style={{ flex: 1 }}>
      <Stack.Screen
        options={{
          headerRight: () => (
            <Link href="/(tabs)/(reminders)/new" asChild>
              <Pressable hitSlop={10} style={styles.headerBtn}>
                <Text style={styles.headerBtnText}>+ New</Text>
              </Pressable>
            </Link>
          ),
        }}
      />
      <SegmentedTabs tabs={tabs} value={tab} onChange={setTab} />

      {permissionDenied && (
        <View style={styles.warning}>
          <Text style={styles.warningText}>
            Notifications are turned off. Reminders will still track in the
            app, but your phone won&apos;t ping you.
          </Text>
        </View>
      )}

      {tab === "active" ? (
        <ActiveList
          reminders={reminders}
          highlightedId={highlightedId}
          groupBy={groupBy}
          onGroupByChange={setGroupBy}
          onToggle={handleToggle}
          onDelete={handleDelete}
          onMarkDone={handleMarkDone}
          onSnooze={handleSnooze}
          onEdit={handleOpenEdit}
          onBrowseTemplates={() => setTab("suggested")}
        />
      ) : (
        <SuggestedList
          enabledTemplateIds={enabledTemplateIds}
          onAdd={handleAddTemplate}
        />
      )}
    </View>
  );
}

function ActiveList({
  reminders,
  highlightedId,
  groupBy,
  onGroupByChange,
  onToggle,
  onDelete,
  onMarkDone,
  onSnooze,
  onEdit,
  onBrowseTemplates,
}: {
  reminders: Reminder[] | null;
  highlightedId: string | null;
  groupBy: GroupBy;
  onGroupByChange: (g: GroupBy) => void;
  onToggle: (r: Reminder, enabled: boolean) => void;
  onDelete: (r: Reminder) => void;
  onMarkDone: (r: Reminder) => void;
  onSnooze: (r: Reminder) => void;
  onEdit: (r: Reminder) => void;
  onBrowseTemplates: () => void;
}) {
  if (reminders === null) {
    return (
      <View style={styles.listPadding}>
        {[0, 1, 2].map((i) => (
          <View key={i} style={styles.skeleton} />
        ))}
      </View>
    );
  }

  if (reminders.length === 0) {
    return (
      <View style={styles.empty}>
        <View style={styles.emptyIcon}>
          <Text style={styles.emptyIconText}>🔔</Text>
        </View>
        <Text style={styles.emptyTitle}>No reminders yet</Text>
        <Text style={styles.emptyBody}>
          Turn one-time fixes into lasting habits. Pick from our list of common
          home maintenance tasks to get started, or add your own.
        </Text>
        <Pressable onPress={onBrowseTemplates} style={styles.emptyBtn}>
          <Text style={styles.emptyBtnText}>Browse suggested reminders</Text>
        </Pressable>
      </View>
    );
  }

  const groups =
    groupBy === "status"
      ? groupRemindersByStatus(reminders)
      : groupBy === "room"
        ? groupRemindersByRoom(reminders)
        : groupRemindersByCategory(reminders);

  // Float the highlighted reminder to the top of its group so the user sees
  // it immediately after tapping a notification.
  if (highlightedId) {
    for (const g of groups) {
      const idx = g.items.findIndex((r) => r.id === highlightedId);
      if (idx > 0) {
        const [item] = g.items.splice(idx, 1);
        g.items.unshift(item);
      }
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.listPadding}>
      <View style={styles.groupByRow}>
        <Pressable
          onPress={() => onGroupByChange("status")}
          style={[
            styles.groupByChip,
            groupBy === "status" && styles.groupByChipActive,
          ]}
        >
          <Text
            style={[
              styles.groupByChipText,
              groupBy === "status" && styles.groupByChipTextActive,
            ]}
          >
            By status
          </Text>
        </Pressable>
        <Pressable
          onPress={() => onGroupByChange("category")}
          style={[
            styles.groupByChip,
            groupBy === "category" && styles.groupByChipActive,
          ]}
        >
          <Text
            style={[
              styles.groupByChipText,
              groupBy === "category" && styles.groupByChipTextActive,
            ]}
          >
            By category
          </Text>
        </Pressable>
        <Pressable
          onPress={() => onGroupByChange("room")}
          style={[
            styles.groupByChip,
            groupBy === "room" && styles.groupByChipActive,
          ]}
        >
          <Text
            style={[
              styles.groupByChipText,
              groupBy === "room" && styles.groupByChipTextActive,
            ]}
          >
            By room
          </Text>
        </Pressable>
      </View>
      {groups.map((group) => (
        <View key={group.key} style={{ marginBottom: spacing.lg }}>
          <View style={styles.groupHeader}>
            <Text style={styles.groupTitle}>{group.label}</Text>
            <Text style={styles.groupCount}>{group.items.length}</Text>
          </View>
          {group.items.map((r) => {
            const isFocused = r.id === highlightedId;
            return (
              <View
                key={r.id}
                style={[
                  { marginBottom: spacing.sm + 2 },
                  isFocused && styles.highlightRing,
                ]}
              >
                <SwipeableReminder
                  reminder={r}
                  onToggle={(enabled) => onToggle(r, enabled)}
                  onDelete={() => onDelete(r)}
                  onMarkDone={() => onMarkDone(r)}
                  onSnooze={() => onSnooze(r)}
                  onEdit={() => onEdit(r)}
                />
              </View>
            );
          })}
        </View>
      ))}
      <Text style={styles.hintText}>
        Tap a reminder to edit it · Swipe right for Done / Snooze · Swipe
        left to delete · Toggle the switch to pause.
      </Text>
    </ScrollView>
  );
}

type ReminderGroup = {
  key: string;
  label: string;
  items: Reminder[];
};

function groupRemindersByStatus(reminders: Reminder[]): ReminderGroup[] {
  const now = Date.now();
  const WEEK_MS = 7 * DAY_MS;
  const overdue: Reminder[] = [];
  const dueSoon: Reminder[] = [];
  const upcoming: Reminder[] = [];
  const paused: Reminder[] = [];

  for (const r of reminders) {
    if (!r.enabled) paused.push(r);
    else if (r.nextDue <= now) overdue.push(r);
    else if (r.nextDue - now <= WEEK_MS) dueSoon.push(r);
    else upcoming.push(r);
  }

  const bySoonest = (a: Reminder, b: Reminder) => a.nextDue - b.nextDue;
  overdue.sort(bySoonest);
  dueSoon.sort(bySoonest);
  upcoming.sort(bySoonest);
  paused.sort(bySoonest);

  return (
    [
      { key: "overdue", label: "Overdue", items: overdue },
      { key: "dueSoon", label: "Due this week", items: dueSoon },
      { key: "upcoming", label: "Upcoming", items: upcoming },
      { key: "paused", label: "Paused", items: paused },
    ] as ReminderGroup[]
  ).filter((g) => g.items.length > 0);
}

const CATEGORY_ORDER: string[] = [
  "hvac",
  "plumbing",
  "exterior",
  "interior",
  "appliance",
  "safety",
  "yard",
  "general",
];

function groupRemindersByCategory(reminders: Reminder[]): ReminderGroup[] {
  const bySoonest = (a: Reminder, b: Reminder) => a.nextDue - b.nextDue;
  const map = new Map<string, Reminder[]>();
  for (const r of reminders) {
    const cat = r.category ?? "general";
    const list = map.get(cat) ?? [];
    list.push(r);
    map.set(cat, list);
  }

  const groups: ReminderGroup[] = [];
  for (const cat of CATEGORY_ORDER) {
    const items = map.get(cat);
    if (items && items.length > 0) {
      items.sort(bySoonest);
      groups.push({
        key: cat,
        label: CATEGORY_LABEL[cat] ?? cat,
        items,
      });
    }
  }
  // Include any categories not in our predefined order
  for (const [cat, items] of map.entries()) {
    if (!CATEGORY_ORDER.includes(cat) && items.length > 0) {
      items.sort(bySoonest);
      groups.push({
        key: cat,
        label: CATEGORY_LABEL[cat] ?? cat,
        items,
      });
    }
  }
  return groups;
}

function groupRemindersByRoom(reminders: Reminder[]): ReminderGroup[] {
  const bySoonest = (a: Reminder, b: Reminder) => a.nextDue - b.nextDue;
  const map = new Map<string, Reminder[]>();
  for (const r of reminders) {
    const room = r.room || "No room";
    const list = map.get(room) ?? [];
    list.push(r);
    map.set(room, list);
  }

  const groups: ReminderGroup[] = [];
  // Named rooms first (sorted), then "No room" last
  const keys = [...map.keys()].sort((a, b) => {
    if (a === "No room") return 1;
    if (b === "No room") return -1;
    return a.localeCompare(b);
  });
  for (const key of keys) {
    const items = map.get(key)!;
    items.sort(bySoonest);
    groups.push({ key, label: key, items });
  }
  return groups;
}

function SwipeableReminder({
  reminder,
  onToggle,
  onDelete,
  onMarkDone,
  onSnooze,
  onEdit,
}: {
  reminder: Reminder;
  onToggle: (enabled: boolean) => void;
  onDelete: () => void;
  onMarkDone: () => void;
  onSnooze: () => void;
  onEdit: () => void;
}) {
  const swipeRef = useRef<SwipeableMethods>(null);

  function handleDonePress() {
    swipeRef.current?.close();
    onMarkDone();
  }

  function handleSnoozePress() {
    swipeRef.current?.close();
    onSnooze();
  }

  function handleDeletePress() {
    swipeRef.current?.close();
    onDelete();
  }

  return (
    <ReanimatedSwipeable
      ref={swipeRef}
      friction={2}
      leftThreshold={60}
      rightThreshold={60}
      overshootLeft={false}
      overshootRight={false}
      renderLeftActions={() => (
        <View style={styles.leftActionsRow}>
          <Pressable onPress={handleSnoozePress} style={styles.swipeSnoozeAction}>
            <Text style={styles.swipeActionText}>Snooze 1d</Text>
          </Pressable>
          <Pressable onPress={handleDonePress} style={styles.swipeDoneAction}>
            <Text style={styles.swipeActionText}>✓ Done</Text>
          </Pressable>
        </View>
      )}
      renderRightActions={() => (
        <Pressable onPress={handleDeletePress} style={styles.swipeRightAction}>
          <Text style={styles.swipeActionText}>Delete</Text>
        </Pressable>
      )}
    >
      <Pressable onPress={onEdit} style={({ pressed }) => pressed && { opacity: 0.9 }}>
        <ReminderRow
          reminder={reminder}
          onToggle={onToggle}
          onMarkDone={onMarkDone}
        />
      </Pressable>
    </ReanimatedSwipeable>
  );
}

function SuggestedList({
  enabledTemplateIds,
  onAdd,
}: {
  enabledTemplateIds: Set<string>;
  onAdd: (template: MaintenanceTemplate) => void;
}) {
  // Group templates by category for the suggested view.
  const grouped = useMemo(() => {
    const map = new Map<string, MaintenanceTemplate[]>();
    for (const t of MAINTENANCE_TEMPLATES) {
      const list = map.get(t.category) ?? [];
      list.push(t);
      map.set(t.category, list);
    }
    return Array.from(map.entries());
  }, []);

  return (
    <ScrollView contentContainerStyle={styles.listPadding}>
      <Text style={styles.intro}>
        Researched, common home-maintenance tasks. Add any of these and pick a
        start date — we&apos;ll repeat them automatically.
      </Text>
      {grouped.map(([category, items]) => (
        <View key={category} style={{ marginBottom: spacing.lg }}>
          <Text style={styles.groupTitle}>{CATEGORY_LABEL[category]}</Text>
          {items.map((t) => (
            <View key={t.id} style={{ marginBottom: spacing.sm + 2 }}>
              <TemplateRow
                template={t}
                alreadyEnabled={enabledTemplateIds.has(t.id)}
                onPress={() => onAdd(t)}
              />
            </View>
          ))}
        </View>
      ))}
    </ScrollView>
  );
}

const CATEGORY_LABEL: Record<string, string> = {
  hvac: "HVAC",
  plumbing: "Plumbing",
  exterior: "Exterior",
  interior: "Interior",
  appliance: "Appliances",
  safety: "Safety",
  yard: "Yard & outdoor",
  general: "General",
};

const styles = StyleSheet.create({
  listPadding: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl * 2,
  },
  warning: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: "#fde68a",
    backgroundColor: "#fffbeb",
  },
  warningText: {
    fontSize: 12,
    color: "#78350f",
    lineHeight: 17,
  },
  skeleton: {
    height: 92,
    borderRadius: radius.lg,
    backgroundColor: "#f5f5f4",
    marginBottom: spacing.sm,
  },
  empty: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.lg,
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xl,
    gap: spacing.sm,
  },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: radius.pill,
    backgroundColor: colors.brandLight,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyIconText: {
    fontSize: 26,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.text,
  },
  emptyBody: {
    fontSize: 13,
    color: colors.textMuted,
    textAlign: "center",
    maxWidth: 340,
  },
  emptyBtn: {
    marginTop: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.brand,
  },
  emptyBtnText: {
    color: "#ffffff",
    fontWeight: "700",
    fontSize: 14,
  },
  intro: {
    fontSize: 13,
    color: colors.textMuted,
    marginBottom: spacing.lg,
    lineHeight: 19,
  },
  groupHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.sm,
  },
  groupTitle: {
    fontSize: 12,
    fontWeight: "800",
    color: colors.text,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: spacing.sm,
  },
  groupCount: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.textSubtle,
    marginBottom: spacing.sm,
  },
  hintText: {
    fontSize: 11,
    color: colors.textSubtle,
    textAlign: "center",
    marginTop: spacing.md,
  },
  highlightRing: {
    borderRadius: radius.lg + 2,
    borderWidth: 2,
    borderColor: colors.brand,
    padding: 2,
    shadowColor: colors.brand,
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
    elevation: 2,
  },
  leftActionsRow: {
    flexDirection: "row",
    alignItems: "stretch",
    borderRadius: radius.lg,
    overflow: "hidden",
    marginRight: -spacing.md,
    paddingRight: spacing.md,
  },
  swipeSnoozeAction: {
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    backgroundColor: "#f59e0b",
  },
  swipeDoneAction: {
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.success,
  },
  swipeRightAction: {
    flex: 1,
    backgroundColor: colors.danger,
    alignItems: "flex-end",
    justifyContent: "center",
    paddingRight: spacing.xl,
    marginLeft: -spacing.md,
    paddingLeft: spacing.md,
    borderRadius: radius.lg,
  },
  swipeActionText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "800",
  },
  headerBtn: {
    paddingHorizontal: spacing.sm,
  },
  headerBtnText: {
    fontSize: 15,
    fontWeight: "800",
    color: colors.brand,
  },
  groupByRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  groupByChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.pill,
    backgroundColor: "#f5f5f4",
    borderWidth: 1,
    borderColor: colors.border,
  },
  groupByChipActive: {
    backgroundColor: colors.brandLight,
    borderColor: colors.brand,
  },
  groupByChipText: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.textMuted,
  },
  groupByChipTextActive: {
    color: colors.brandDark,
  },
});
