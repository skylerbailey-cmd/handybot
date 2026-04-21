import { Stack, useFocusEffect, useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
  Alert,
  Image,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";
import DifficultyBadge from "@/components/DifficultyBadge";
import IssueCard from "@/components/IssueCard";
import PrimaryButton from "@/components/PrimaryButton";
import {
  formatDueDate,
  loadReminders,
  markReminderDone,
} from "@/lib/reminders";
import { ensureUser, loadIssues } from "@/lib/storage";
import {
  colors,
  formatDuration,
  formatMoney,
  radius,
  spacing,
} from "@/lib/theme";
import type { Issue, Reminder } from "@/lib/types";

export default function RepairScreen() {
  const router = useRouter();
  const [issues, setIssues] = useState<Issue[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Export modal state
  const [showExportPicker, setShowExportPicker] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [exportFields, setExportFields] = useState({
    status: true,
    difficulty: true,
    time: true,
    steps: true,
    savings: true,
    summary: true,
  });

  const refresh = useCallback(async () => {
    const [, loadedIssues] = await Promise.all([
      ensureUser(),
      loadIssues(),
    ]);
    setIssues(loadedIssues);
  }, []);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  async function onPullToRefresh() {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }

  const ongoing = useMemo(
    () => (issues ?? []).filter((i) => i.status === "in_progress"),
    [issues]
  );

  const completed = useMemo(
    () =>
      (issues ?? [])
        .filter((i) => i.status === "completed" || i.status === "verified")
        .sort((a, b) => b.updatedAt - a.updatedAt),
    [issues]
  );

  const totalSaved = useMemo(
    () => completed.reduce((s, i) => s + (i.plan.estimatedSavingsUsd ?? 0), 0),
    [completed]
  );

  const stats = useMemo(() => {
    const all = issues ?? [];
    const totalMinutes = completed.reduce(
      (s, i) => s + (i.plan.estimatedMinutes ?? 0),
      0
    );
    return {
      total: all.length,
      finished: completed.length,
      totalSaved,
      totalMinutes,
    };
  }, [issues, completed, totalSaved]);

  // Export logic
  const sortedByDate = useMemo(
    () => [...(issues ?? [])].sort((a, b) => b.createdAt - a.createdAt),
    [issues]
  );

  function toggleExportField(field: keyof typeof exportFields) {
    setExportFields((prev) => ({ ...prev, [field]: !prev[field] }));
  }

  function openExportPicker() {
    setSelectedIds(new Set(sortedByDate.map((i) => i.id)));
    setShowExportPicker(true);
  }

  function toggleSelected(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selectedIds.size === sortedByDate.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(sortedByDate.map((i) => i.id)));
    }
  }

  async function handleExport() {
    const selected = sortedByDate.filter((i) => selectedIds.has(i.id));
    if (selected.length === 0) return;
    const finished = selected.filter(
      (i) => i.status === "completed" || i.status === "verified"
    );
    const exportTotalSaved = finished.reduce(
      (s, i) => s + (i.plan.estimatedSavingsUsd ?? 0),
      0
    );
    const lines: string[] = [];
    lines.push("HANDYBOT — HOME MAINTENANCE HISTORY");
    lines.push(`Exported: ${new Date().toLocaleDateString()}`);
    lines.push(`Repairs included: ${selected.length}`);
    if (exportFields.status) lines.push(`Completed: ${finished.length}`);
    if (exportFields.savings)
      lines.push(`Total saved: ${formatMoney(exportTotalSaved)}`);
    lines.push("");
    for (const issue of selected) {
      const date = new Date(issue.createdAt).toLocaleDateString();
      lines.push("---");
      lines.push(`${issue.title} (${date})`);
      if (exportFields.status) lines.push(`Status: ${issue.status}`);
      if (exportFields.difficulty || exportFields.time) {
        const parts: string[] = [];
        if (exportFields.difficulty)
          parts.push(`Difficulty: ${issue.plan.difficulty}`);
        if (exportFields.time)
          parts.push(`Time: ${formatDuration(issue.plan.estimatedMinutes)}`);
        lines.push(parts.join(" · "));
      }
      if (exportFields.steps) {
        const stepsDone = issue.plan.steps.filter((s) => s.completed).length;
        lines.push(`Steps: ${stepsDone}/${issue.plan.steps.length}`);
      }
      if (exportFields.savings && issue.plan.estimatedSavingsUsd)
        lines.push(`Saved: ${formatMoney(issue.plan.estimatedSavingsUsd)}`);
      if (exportFields.summary) lines.push(`Summary: ${issue.summary}`);
      lines.push("");
    }
    setShowExportPicker(false);
    await Share.share({
      message: lines.join("\n"),
      title: "HandyBot Maintenance History",
    });
  }

  return (
    <>
      <Stack.Screen
        options={{
          headerRight: () => (
            <Pressable
              onPress={() => router.push("/(tabs)/(repair)/new")}
              hitSlop={10}
              style={styles.headerBtn}
            >
              <Text style={styles.headerBtnText}>+ New</Text>
            </Pressable>
          ),
        }}
      />
      <ScrollView
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onPullToRefresh}
            tintColor={colors.brand}
          />
        }
      >
        {/* Hero */}
        <View style={styles.heroCard}>
          <Text style={styles.heroTitle}>What needs fixing?</Text>
          <Text style={styles.heroSub}>
            Snap a photo of something broken and I&apos;ll walk you through how
            to fix it, step by step.
          </Text>
          <View style={styles.heroActions}>
            <PrimaryButton
              title="+ New repair"
              onPress={() => router.push("/(tabs)/(repair)/new")}
              style={{ flex: 1 }}
            />
            <PrimaryButton
              title="Ask HandyBot"
              onPress={() => router.push("/(tabs)/(repair)/ask")}
              variant="secondary"
              style={{ flex: 1 }}
            />
          </View>
        </View>

        {totalSaved > 0 && (
          <View style={styles.totalSavedCard}>
            <Text style={styles.totalSavedIcon}>💰</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.totalSavedAmount}>
                {formatMoney(totalSaved)} saved
              </Text>
              <Text style={styles.totalSavedSub}>
                by doing repairs yourself
              </Text>
            </View>
          </View>
        )}

        {/* Ongoing */}
        {ongoing.length > 0 && (
          <View style={{ marginTop: spacing.md }}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Ongoing projects</Text>
              <Text style={styles.sectionCount}>{ongoing.length}</Text>
            </View>
            {ongoing.map((issue) => (
              <View key={issue.id} style={{ marginBottom: spacing.sm + 4 }}>
                <IssueCard issue={issue} />
              </View>
            ))}
          </View>
        )}

        {/* Completed timeline */}
        {completed.length > 0 && (
          <View style={{ marginTop: spacing.lg }}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Repair history</Text>
              <View style={styles.sectionMeta}>
                {totalSaved > 0 && (
                  <Text style={styles.savedTotal}>
                    ✓ {formatMoney(totalSaved)} saved
                  </Text>
                )}
                <Text style={styles.sectionCount}>{completed.length}</Text>
              </View>
            </View>

            {stats.finished > 0 && (
              <View style={styles.statsCard}>
                <View style={styles.statsGrid}>
                  <StatBox label="Repairs" value={String(stats.total)} />
                  <StatBox label="Finished" value={String(stats.finished)} />
                  <StatBox
                    label="Saved"
                    value={formatMoney(stats.totalSaved) || "$0"}
                    highlight
                  />
                  <StatBox
                    label="Time spent"
                    value={formatDuration(stats.totalMinutes)}
                  />
                </View>
                <PrimaryButton
                  title="Export history"
                  onPress={openExportPicker}
                  variant="secondary"
                  style={{ marginTop: spacing.md }}
                />
              </View>
            )}

            {completed.map((issue) => (
              <Pressable
                key={issue.id}
                onPress={() =>
                  router.push({
                    pathname: "/(tabs)/(repair)/issue/[id]",
                    params: { id: issue.id },
                  })
                }
                style={({ pressed }) => [
                  styles.timelineCard,
                  pressed && { opacity: 0.9 },
                ]}
              >
                <View style={styles.timelineDot}>
                  <View
                    style={[
                      styles.dot,
                      issue.status === "verified"
                        ? styles.dotVerified
                        : styles.dotCompleted,
                    ]}
                  />
                  <View style={styles.connector} />
                </View>
                <View style={styles.timelineBody}>
                  <Text style={styles.timelineDate}>
                    {new Date(issue.createdAt).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </Text>
                  <View style={styles.timelineRow}>
                    {issue.coverImageUri && (
                      <Image
                        source={{ uri: issue.coverImageUri }}
                        style={styles.timelineThumb}
                      />
                    )}
                    <View style={{ flex: 1 }}>
                      <Text style={styles.timelineTitle2} numberOfLines={1}>
                        {issue.title}
                      </Text>
                      <Text style={styles.timelineSummary} numberOfLines={2}>
                        {issue.summary}
                      </Text>
                      <View style={styles.timelineMeta}>
                        <DifficultyBadge difficulty={issue.plan.difficulty} />
                        <Text style={styles.timelineMetaText}>
                          {formatDuration(issue.plan.estimatedMinutes)}
                        </Text>
                        {(issue.plan.estimatedSavingsUsd ?? 0) > 0 && (
                          <Text style={styles.timelineSaved}>
                            {formatMoney(issue.plan.estimatedSavingsUsd)} saved
                          </Text>
                        )}
                      </View>
                    </View>
                  </View>
                  <View style={styles.statusRow}>
                    <View
                      style={[
                        styles.statusPill,
                        issue.status === "verified"
                          ? styles.statusVerified
                          : styles.statusCompleted,
                      ]}
                    >
                      <Text
                        style={[
                          styles.statusPillText,
                          issue.status === "verified"
                            ? styles.statusVerifiedText
                            : styles.statusCompletedText,
                        ]}
                      >
                        {issue.status === "verified" ? "Verified" : "Completed"}
                      </Text>
                    </View>
                  </View>
                </View>
              </Pressable>
            ))}
          </View>
        )}

        {/* Empty state */}
        {issues !== null && issues.length === 0 && (
          <View style={styles.empty}>
            <View style={styles.emptyIcon}>
              <Text style={{ fontSize: 26 }}>🧰</Text>
            </View>
            <Text style={styles.emptyTitle}>No repairs yet</Text>
            <Text style={styles.emptyBody}>
              Tap &quot;+ New repair&quot; to take a photo of what&apos;s broken
              and get started.
            </Text>
          </View>
        )}

        {issues === null && (
          <View style={{ gap: spacing.sm, marginTop: spacing.md }}>
            {[0, 1, 2].map((i) => (
              <View key={i} style={styles.skeleton} />
            ))}
          </View>
        )}
      </ScrollView>

      {/* Export modal */}
      <Modal
        visible={showExportPicker}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowExportPicker(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Pressable
              onPress={() => setShowExportPicker(false)}
              hitSlop={10}
            >
              <Text style={styles.modalCancel}>Cancel</Text>
            </Pressable>
            <Text style={styles.modalTitle}>Export History</Text>
            <View style={{ width: 50 }} />
          </View>
          <ScrollView contentContainerStyle={styles.modalList}>
            <Text style={styles.modalSectionLabel}>Include in export</Text>
            <View style={styles.fieldToggles}>
              {(
                [
                  { key: "status", label: "Status" },
                  { key: "difficulty", label: "Difficulty" },
                  { key: "time", label: "Time" },
                  { key: "steps", label: "Steps" },
                  { key: "savings", label: "Savings" },
                  { key: "summary", label: "Summary" },
                ] as const
              ).map((f) => {
                const on = exportFields[f.key];
                return (
                  <Pressable
                    key={f.key}
                    onPress={() => toggleExportField(f.key)}
                    style={[styles.fieldChip, on && styles.fieldChipActive]}
                  >
                    <Text
                      style={[
                        styles.fieldChipText,
                        on && styles.fieldChipTextActive,
                      ]}
                    >
                      {f.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <View style={styles.modalDivider} />
            <View style={styles.modalSectionHeader}>
              <Text style={styles.modalSectionLabel}>Repairs</Text>
              <Pressable onPress={toggleSelectAll} hitSlop={10}>
                <Text style={styles.modalSelectAll}>
                  {selectedIds.size === sortedByDate.length
                    ? "Deselect all"
                    : "Select all"}
                </Text>
              </Pressable>
            </View>
            {sortedByDate.map((issue) => {
              const checked = selectedIds.has(issue.id);
              const date = new Date(issue.createdAt).toLocaleDateString(
                "en-US",
                { month: "short", day: "numeric", year: "numeric" }
              );
              return (
                <Pressable
                  key={issue.id}
                  onPress={() => toggleSelected(issue.id)}
                  style={[
                    styles.modalRow,
                    checked && styles.modalRowSelected,
                  ]}
                >
                  <View
                    style={[
                      styles.checkbox,
                      checked && styles.checkboxChecked,
                    ]}
                  >
                    {checked && <Text style={styles.checkmark}>✓</Text>}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.modalRowTitle} numberOfLines={1}>
                      {issue.title}
                    </Text>
                    <Text style={styles.modalRowMeta}>
                      {date} · {issue.plan.difficulty}
                      {(issue.plan.estimatedSavingsUsd ?? 0) > 0
                        ? ` · ${formatMoney(issue.plan.estimatedSavingsUsd)} saved`
                        : ""}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.modalStatusDot,
                      issue.status === "verified"
                        ? styles.dotVerified
                        : issue.status === "completed"
                          ? styles.dotCompleted
                          : styles.dotOngoing,
                    ]}
                  />
                </Pressable>
              );
            })}
          </ScrollView>
          <View style={styles.modalFooter}>
            <PrimaryButton
              title={
                selectedIds.size === 0
                  ? "Select repairs to export"
                  : `Export ${selectedIds.size} repair${selectedIds.size !== 1 ? "s" : ""}`
              }
              onPress={handleExport}
              disabled={selectedIds.size === 0}
            />
          </View>
        </View>
      </Modal>
    </>
  );
}

function StatBox({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <View style={styles.statBox}>
      <Text style={[styles.statValue, highlight && styles.statValueHighlight]}>
        {value}
      </Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl * 2,
  },
  headerBtn: { paddingHorizontal: spacing.sm },
  headerBtnText: { fontSize: 15, fontWeight: "800", color: colors.brand },
  heroCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg + 4,
    marginBottom: spacing.md,
  },
  heroTitle: { fontSize: 22, fontWeight: "700", color: colors.text },
  heroSub: {
    marginTop: spacing.sm,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textMuted,
  },
  heroActions: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 2,
    paddingBottom: spacing.sm,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: colors.text,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  sectionMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  savedTotal: { fontSize: 12, fontWeight: "700", color: colors.success },
  sectionCount: {
    minWidth: 22,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: radius.pill,
    backgroundColor: "#e7e5e4",
    fontSize: 11,
    fontWeight: "700",
    color: colors.textMuted,
    textAlign: "center",
    overflow: "hidden",
  },
  totalSavedCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: "#ecfdf5",
    borderWidth: 1,
    borderColor: "#a7f3d0",
  },
  totalSavedIcon: { fontSize: 32 },
  totalSavedAmount: { fontSize: 22, fontWeight: "900", color: "#065f46" },
  totalSavedSub: { fontSize: 12, color: "#047857", marginTop: 2 },
  statsCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  statBox: {
    flex: 1,
    minWidth: "40%",
    backgroundColor: "#f5f5f4",
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: "center",
  },
  statValue: { fontSize: 24, fontWeight: "900", color: colors.text },
  statValueHighlight: { color: colors.success },
  statLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.textSubtle,
    textTransform: "uppercase",
    letterSpacing: 0.4,
    marginTop: 2,
  },
  timelineCard: { flexDirection: "row", marginBottom: spacing.sm },
  timelineDot: { alignItems: "center", width: 24, paddingTop: 6 },
  dot: { width: 12, height: 12, borderRadius: 6 },
  dotVerified: { backgroundColor: colors.success },
  dotCompleted: { backgroundColor: "#6366f1" },
  dotOngoing: { backgroundColor: colors.brand },
  connector: {
    flex: 1,
    width: 2,
    backgroundColor: colors.border,
    marginTop: 4,
  },
  timelineBody: {
    flex: 1,
    marginLeft: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
  },
  timelineDate: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.textSubtle,
  },
  timelineRow: { flexDirection: "row", gap: spacing.md },
  timelineThumb: {
    width: 56,
    height: 56,
    borderRadius: radius.md,
    backgroundColor: "#f5f5f4",
  },
  timelineTitle2: { fontSize: 15, fontWeight: "700", color: colors.text },
  timelineSummary: {
    fontSize: 12,
    color: colors.textMuted,
    lineHeight: 17,
    marginTop: 2,
  },
  timelineMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  timelineMetaText: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.textSubtle,
  },
  timelineSaved: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.success,
  },
  statusRow: { flexDirection: "row" },
  statusPill: {
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  statusVerified: { backgroundColor: "#d1fae5" },
  statusCompleted: { backgroundColor: "#e0e7ff" },
  statusPillText: { fontSize: 11, fontWeight: "700" },
  statusVerifiedText: { color: "#047857" },
  statusCompletedText: { color: "#4338ca" },
  skeleton: { height: 88, borderRadius: radius.lg, backgroundColor: "#f5f5f4" },
  empty: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xl,
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: radius.pill,
    backgroundColor: colors.brandLight,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: { fontSize: 16, fontWeight: "600", color: colors.text },
  emptyBody: {
    fontSize: 13,
    color: colors.textMuted,
    textAlign: "center",
    maxWidth: 320,
  },
  // Export modal
  modalContainer: { flex: 1, backgroundColor: colors.background },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  modalCancel: { fontSize: 15, color: colors.textMuted, fontWeight: "600" },
  modalTitle: { fontSize: 16, fontWeight: "800", color: colors.text },
  modalSelectAll: { fontSize: 13, fontWeight: "700", color: colors.brand },
  modalSectionLabel: {
    fontSize: 12,
    fontWeight: "800",
    color: colors.text,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  modalSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  modalDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.xs,
  },
  fieldToggles: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  fieldChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.pill,
    backgroundColor: "#f5f5f4",
    borderWidth: 1,
    borderColor: colors.border,
  },
  fieldChipActive: {
    backgroundColor: colors.brandLight,
    borderColor: colors.brand,
  },
  fieldChipText: { fontSize: 13, fontWeight: "600", color: colors.textMuted },
  fieldChipTextActive: { color: colors.brandDark },
  modalList: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl * 3,
    gap: spacing.sm,
  },
  modalRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  modalRowSelected: {
    borderColor: colors.brand,
    backgroundColor: colors.brandLighter,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: radius.sm,
    borderWidth: 2,
    borderColor: colors.borderStrong,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxChecked: { backgroundColor: colors.brand, borderColor: colors.brand },
  checkmark: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "800",
    marginTop: -1,
  },
  modalRowTitle: { fontSize: 15, fontWeight: "700", color: colors.text },
  modalRowMeta: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  modalStatusDot: { width: 10, height: 10, borderRadius: 5 },
  modalFooter: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderColor: colors.border,
  },
});
