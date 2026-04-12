import { useEffect, useMemo, useRef, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { colors, formatDuration, formatMoney, radius, spacing } from "@/lib/theme";
import type { PlanStep } from "@/lib/types";

interface Props {
  steps: PlanStep[];
  /** USD saved by doing this repair themselves vs hiring a pro. */
  savingsAmount?: number;
  /** Set a specific step's completed flag. */
  onSetStepCompleted: (stepId: string, completed: boolean) => void;
  /** Opens the step help modal for the given step. */
  onRequestStepHelp?: (stepId: string) => void;
}

/**
 * Walks the user through the plan one step at a time.
 *
 * - Shows the active step in a big card with a "Mark complete & continue"
 *   button.
 * - Displays a horizontal stepper indicator (tappable circles) so the user
 *   can jump to any step at any time.
 * - Surfaces clear progress: "Step X of Y · N complete".
 * - When all steps are done, shows a completion banner.
 */
export default function InteractiveStepper({
  steps,
  savingsAmount,
  onSetStepCompleted,
  onRequestStepHelp,
}: Props) {
  const total = steps.length;
  const doneCount = useMemo(
    () => steps.filter((s) => s.completed).length,
    [steps]
  );
  const allDone = total > 0 && doneCount === total;

  const firstIncompleteIndex = useMemo(() => {
    const i = steps.findIndex((s) => !s.completed);
    return i === -1 ? Math.max(total - 1, 0) : i;
  }, [steps, total]);

  const [currentIdx, setCurrentIdx] = useState<number>(firstIncompleteIndex);

  // If the underlying steps list length changes (shouldn't mid-session, but be
  // defensive) or if the current index slides out of range, clamp it.
  useEffect(() => {
    if (currentIdx >= total) setCurrentIdx(Math.max(total - 1, 0));
  }, [total, currentIdx]);

  const indicatorsRef = useRef<ScrollView>(null);
  useEffect(() => {
    // Keep the active indicator visible.
    if (!indicatorsRef.current) return;
    const approxItemWidth = 44;
    indicatorsRef.current.scrollTo({
      x: Math.max(0, currentIdx * approxItemWidth - 80),
      animated: true,
    });
  }, [currentIdx]);

  if (total === 0) return null;

  const step = steps[currentIdx];
  const progressPct = Math.round((doneCount / total) * 100);

  function markCompleteAndAdvance() {
    if (!step.completed) onSetStepCompleted(step.id, true);
    if (currentIdx < total - 1) setCurrentIdx(currentIdx + 1);
  }

  function undoCurrent() {
    if (step.completed) onSetStepCompleted(step.id, false);
  }

  function goPrev() {
    if (currentIdx > 0) setCurrentIdx(currentIdx - 1);
  }

  function goNext() {
    if (currentIdx < total - 1) setCurrentIdx(currentIdx + 1);
  }

  return (
    <View>
      {/* Progress header */}
      <View style={styles.progressHeader}>
        <Text style={styles.progressLabel}>
          Step <Text style={styles.progressLabelStrong}>{currentIdx + 1}</Text>{" "}
          of {total}
        </Text>
        <Text style={styles.progressRight}>
          {doneCount} of {total} complete
        </Text>
      </View>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${progressPct}%` }]} />
      </View>

      {/* Stepper dots (tap to jump) */}
      <ScrollView
        ref={indicatorsRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.indicatorRow}
      >
        {steps.map((s, i) => {
          const isActive = i === currentIdx;
          return (
            <View key={s.id} style={styles.indicatorCell}>
              <Pressable
                onPress={() => setCurrentIdx(i)}
                style={[
                  styles.dot,
                  s.completed && styles.dotDone,
                  isActive && styles.dotActive,
                  isActive && s.completed && styles.dotActiveDone,
                ]}
              >
                <Text
                  style={[
                    styles.dotText,
                    (s.completed || isActive) && styles.dotTextOn,
                  ]}
                >
                  {s.completed ? "✓" : i + 1}
                </Text>
              </Pressable>
              {i < total - 1 && (
                <View
                  style={[
                    styles.connector,
                    s.completed && styles.connectorDone,
                  ]}
                />
              )}
            </View>
          );
        })}
      </ScrollView>

      {/* Active step card */}
      <View style={[styles.stepCard, step.completed && styles.stepCardDone]}>
        <View style={styles.stepCardHeader}>
          <View style={styles.stepNumberBadge}>
            <Text style={styles.stepNumberText}>{currentIdx + 1}</Text>
          </View>
          <Text style={styles.stepTitle}>{step.title}</Text>
          {step.estimatedMinutes ? (
            <View style={styles.timePill}>
              <Text style={styles.timePillText}>
                ⏱ {formatDuration(step.estimatedMinutes)}
              </Text>
            </View>
          ) : null}
          {onRequestStepHelp && (
            <Pressable
              onPress={() => onRequestStepHelp(step.id)}
              hitSlop={8}
              style={({ pressed }) => [
                styles.helpBtn,
                pressed && { opacity: 0.7 },
              ]}
            >
              <Text style={styles.helpBtnText}>?</Text>
            </Pressable>
          )}
        </View>

        <Text style={styles.stepDetail}>{step.detail}</Text>

        {step.criticalWarning && (
          <View style={styles.criticalCard}>
            <View style={styles.criticalIconWrap}>
              <Text style={styles.criticalIcon}>⚠</Text>
            </View>
            <View style={styles.criticalBody}>
              <Text style={styles.criticalLabel}>DON&apos;T MESS THIS UP</Text>
              <Text style={styles.criticalText}>{step.criticalWarning}</Text>
            </View>
          </View>
        )}

        {step.completed && (
          <View style={styles.doneStatus}>
            <Text style={styles.doneStatusText}>Completed</Text>
          </View>
        )}

        {/* Primary action */}
        {!step.completed ? (
          <Pressable
            onPress={markCompleteAndAdvance}
            style={({ pressed }) => [
              styles.primaryAction,
              pressed && styles.primaryActionPressed,
            ]}
          >
            <Text style={styles.primaryActionText}>
              {currentIdx < total - 1
                ? "Mark complete & continue →"
                : "Mark final step complete"}
            </Text>
          </Pressable>
        ) : (
          <View style={styles.doneActions}>
            <Pressable
              onPress={undoCurrent}
              style={({ pressed }) => [
                styles.secondaryAction,
                pressed && { opacity: 0.7 },
              ]}
            >
              <Text style={styles.secondaryActionText}>Undo</Text>
            </Pressable>
            {currentIdx < total - 1 && (
              <Pressable
                onPress={goNext}
                style={({ pressed }) => [
                  styles.primaryActionInline,
                  pressed && styles.primaryActionPressed,
                ]}
              >
                <Text style={styles.primaryActionText}>Next step →</Text>
              </Pressable>
            )}
          </View>
        )}
      </View>

      {/* Prev/Next nav */}
      <View style={styles.navRow}>
        <Pressable
          onPress={goPrev}
          disabled={currentIdx === 0}
          style={({ pressed }) => [
            styles.navBtn,
            currentIdx === 0 && styles.navBtnDisabled,
            pressed && currentIdx > 0 && { opacity: 0.7 },
          ]}
        >
          <Text
            style={[
              styles.navBtnText,
              currentIdx === 0 && styles.navBtnTextDisabled,
            ]}
          >
            ← Previous
          </Text>
        </Pressable>
        <Pressable
          onPress={goNext}
          disabled={currentIdx === total - 1}
          style={({ pressed }) => [
            styles.navBtn,
            currentIdx === total - 1 && styles.navBtnDisabled,
            pressed && currentIdx < total - 1 && { opacity: 0.7 },
          ]}
        >
          <Text
            style={[
              styles.navBtnText,
              currentIdx === total - 1 && styles.navBtnTextDisabled,
            ]}
          >
            Next →
          </Text>
        </Pressable>
      </View>

      {allDone && (
        <View style={styles.completeBanner}>
          <Text style={styles.completeBannerTitle}>
            🎉 All steps complete!
          </Text>
          {savingsAmount && savingsAmount > 0 ? (
            <View style={styles.savingsBadge}>
              <Text style={styles.savingsBadgeText}>
                You saved {formatMoney(savingsAmount)} fixing this yourself
              </Text>
            </View>
          ) : null}
          <Text style={styles.completeBannerBody}>
            Nice work. Mark this repair as resolved from the overflow menu when
            you&apos;re happy with the result.
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  progressHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.sm,
  },
  progressLabel: {
    fontSize: 13,
    color: colors.textMuted,
  },
  progressLabelStrong: {
    color: colors.text,
    fontWeight: "700",
  },
  progressRight: {
    fontSize: 12,
    color: colors.textSubtle,
    fontWeight: "600",
  },
  progressTrack: {
    height: 6,
    borderRadius: radius.pill,
    backgroundColor: "#f5f5f4",
    overflow: "hidden",
    marginBottom: spacing.md,
  },
  progressFill: {
    height: "100%",
    backgroundColor: colors.brand,
  },
  indicatorRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.sm,
    paddingRight: spacing.md,
  },
  indicatorCell: {
    flexDirection: "row",
    alignItems: "center",
  },
  dot: {
    width: 32,
    height: 32,
    borderRadius: radius.pill,
    borderWidth: 2,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  dotDone: {
    backgroundColor: colors.success,
    borderColor: colors.success,
  },
  dotActive: {
    borderColor: colors.brand,
    backgroundColor: colors.brandLight,
  },
  dotActiveDone: {
    backgroundColor: colors.success,
    borderColor: colors.brand,
  },
  dotText: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.textMuted,
  },
  dotTextOn: {
    color: "#ffffff",
  },
  connector: {
    width: 18,
    height: 2,
    backgroundColor: colors.border,
  },
  connectorDone: {
    backgroundColor: colors.success,
  },
  stepCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginTop: spacing.sm,
    gap: spacing.md,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  stepCardDone: {
    backgroundColor: "#f0fdf4",
    borderColor: "#bbf7d0",
  },
  stepCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  stepNumberBadge: {
    width: 30,
    height: 30,
    borderRadius: radius.pill,
    backgroundColor: colors.brand,
    alignItems: "center",
    justifyContent: "center",
  },
  stepNumberText: {
    color: "#ffffff",
    fontWeight: "800",
    fontSize: 14,
  },
  stepTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: "700",
    color: colors.text,
  },
  timePill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
    backgroundColor: colors.brandLight,
  },
  timePillText: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.brandDark,
  },
  helpBtn: {
    width: 28,
    height: 28,
    borderRadius: radius.pill,
    borderWidth: 2,
    borderColor: colors.brand,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
  },
  helpBtnText: {
    fontSize: 14,
    fontWeight: "900",
    color: colors.brand,
  },
  stepDetail: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.text,
  },
  criticalCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm + 2,
    backgroundColor: "#fff7ed",
    borderLeftWidth: 4,
    borderLeftColor: "#ea580c",
    borderWidth: 1,
    borderColor: "#fed7aa",
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.xs,
  },
  criticalIconWrap: {
    width: 32,
    height: 32,
    borderRadius: radius.pill,
    backgroundColor: "#ea580c",
    alignItems: "center",
    justifyContent: "center",
  },
  criticalIcon: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "800",
  },
  criticalBody: {
    flex: 1,
    minWidth: 0,
  },
  criticalLabel: {
    fontSize: 11,
    fontWeight: "900",
    color: "#9a3412",
    letterSpacing: 0.8,
    marginBottom: 3,
  },
  criticalText: {
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 20,
    color: "#7c2d12",
  },
  doneStatus: {
    alignSelf: "flex-start",
    backgroundColor: colors.successBg,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  doneStatusText: {
    color: colors.success,
    fontSize: 12,
    fontWeight: "700",
  },
  primaryAction: {
    backgroundColor: colors.brand,
    borderRadius: radius.md,
    paddingVertical: spacing.md + 2,
    alignItems: "center",
    justifyContent: "center",
    marginTop: spacing.xs,
  },
  primaryActionInline: {
    flex: 1,
    backgroundColor: colors.brand,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryActionPressed: {
    opacity: 0.85,
  },
  primaryActionText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "700",
  },
  doneActions: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  secondaryAction: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryActionText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "600",
  },
  navRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  navBtn: {
    flex: 1,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingVertical: spacing.md,
    alignItems: "center",
  },
  navBtnDisabled: {
    opacity: 0.4,
  },
  navBtnText: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.textMuted,
  },
  navBtnTextDisabled: {
    color: colors.textSubtle,
  },
  completeBanner: {
    marginTop: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: "#a7f3d0",
    backgroundColor: "#ecfdf5",
    alignItems: "center",
    gap: spacing.sm,
  },
  completeBannerTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#065f46",
  },
  completeBannerBody: {
    fontSize: 13,
    color: "#047857",
    textAlign: "center",
  },
  savingsBadge: {
    backgroundColor: "#065f46",
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md + 2,
    paddingVertical: spacing.sm,
  },
  savingsBadgeText: {
    color: "#ffffff",
    fontWeight: "800",
    fontSize: 14,
  },
});
