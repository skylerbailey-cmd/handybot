import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import DifficultyBadge from "./DifficultyBadge";
import { colors, formatDuration, formatMoney, radius, spacing } from "@/lib/theme";
import type { PlanProposal } from "@/lib/types";

interface Props {
  proposal: PlanProposal;
  onAccept: () => void;
  onDismiss: () => void;
}

export default function PlanProposalCard({
  proposal,
  onAccept,
  onDismiss,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const resolved = proposal.status !== "pending";

  const summaryChips: string[] = [];
  if (proposal.newSteps?.length) {
    summaryChips.push(
      `+${proposal.newSteps.length} ${proposal.newSteps.length === 1 ? "step" : "steps"}`
    );
  }
  if (proposal.newTools?.length) {
    summaryChips.push(
      `+${proposal.newTools.length} ${proposal.newTools.length === 1 ? "tool" : "tools"}`
    );
  }
  if (proposal.newMaterials?.length) {
    summaryChips.push(
      `+${proposal.newMaterials.length} ${proposal.newMaterials.length === 1 ? "material" : "materials"}`
    );
  }
  if (proposal.newSafetyNotes?.length) {
    summaryChips.push(
      `+${proposal.newSafetyNotes.length} safety ${proposal.newSafetyNotes.length === 1 ? "note" : "notes"}`
    );
  }
  if (proposal.newTotalMinutes) {
    summaryChips.push(`New time: ${formatDuration(proposal.newTotalMinutes)}`);
  }
  if (proposal.newTotalSavingsUsd !== undefined) {
    const label = formatMoney(proposal.newTotalSavingsUsd);
    summaryChips.push(
      label ? `New savings: ${label}` : "Savings updated"
    );
  }

  const hasDetailSections =
    !!proposal.newSteps?.length ||
    !!proposal.newTools?.length ||
    !!proposal.newMaterials?.length ||
    !!proposal.newSafetyNotes?.length;

  return (
    <View style={[styles.card, resolved && styles.cardResolved]}>
      <View style={styles.header}>
        <View style={styles.iconBadge}>
          <Text style={styles.iconText}>⚡</Text>
        </View>
        <Text style={styles.title}>Plan update suggested</Text>
      </View>

      <Text style={styles.rationale}>{proposal.rationale}</Text>

      <View style={styles.chipRow}>
        {proposal.newDifficulty && (
          <View style={styles.chipDifficulty}>
            <Text style={styles.chipDifficultyLabel}>New difficulty:</Text>
            <DifficultyBadge difficulty={proposal.newDifficulty} />
          </View>
        )}
        {summaryChips.map((c) => (
          <View key={c} style={styles.chip}>
            <Text style={styles.chipText}>{c}</Text>
          </View>
        ))}
      </View>

      {hasDetailSections && (
        <Pressable
          onPress={() => setExpanded((v) => !v)}
          hitSlop={6}
          style={styles.expandToggle}
        >
          <Text style={styles.expandToggleText}>
            {expanded ? "Hide details" : "See details"}
          </Text>
        </Pressable>
      )}

      {expanded && (
        <View style={styles.detailBlock}>
          {proposal.newSteps?.length ? (
            <DetailSection title="New steps">
              {proposal.newSteps.map((s, i) => (
                <Text key={i} style={styles.detailLine}>
                  • <Text style={styles.detailStrong}>{s.title}</Text>
                  {s.estimatedMinutes
                    ? ` (${formatDuration(s.estimatedMinutes)})`
                    : ""}
                  {"\n   "}
                  {s.detail}
                </Text>
              ))}
            </DetailSection>
          ) : null}

          {proposal.newTools?.length ? (
            <DetailSection title="New tools">
              {proposal.newTools.map((t, i) => (
                <Text key={i} style={styles.detailLine}>
                  • {t.name}
                  {t.required ? "" : " (optional)"}
                </Text>
              ))}
            </DetailSection>
          ) : null}

          {proposal.newMaterials?.length ? (
            <DetailSection title="New materials">
              {proposal.newMaterials.map((m, i) => (
                <Text key={i} style={styles.detailLine}>
                  • {m.name} —{" "}
                  <Text style={styles.detailMuted}>{m.quantity}</Text>
                  {m.notes ? ` · ${m.notes}` : ""}
                </Text>
              ))}
            </DetailSection>
          ) : null}

          {proposal.newSafetyNotes?.length ? (
            <DetailSection title="New safety notes">
              {proposal.newSafetyNotes.map((n, i) => (
                <Text key={i} style={styles.detailLine}>
                  ⚠︎ {n}
                </Text>
              ))}
            </DetailSection>
          ) : null}
        </View>
      )}

      {resolved ? (
        <View
          style={[
            styles.resolvedBanner,
            proposal.status === "accepted"
              ? styles.resolvedAccepted
              : styles.resolvedDismissed,
          ]}
        >
          <Text
            style={[
              styles.resolvedBannerText,
              proposal.status === "accepted"
                ? styles.resolvedAcceptedText
                : styles.resolvedDismissedText,
            ]}
          >
            {proposal.status === "accepted"
              ? "✓ Added to your plan"
              : "Dismissed"}
          </Text>
        </View>
      ) : (
        <View style={styles.actions}>
          <Pressable
            onPress={onDismiss}
            style={({ pressed }) => [
              styles.dismissBtn,
              pressed && { opacity: 0.7 },
            ]}
          >
            <Text style={styles.dismissText}>Not now</Text>
          </Pressable>
          <Pressable
            onPress={onAccept}
            style={({ pressed }) => [
              styles.acceptBtn,
              pressed && { opacity: 0.85 },
            ]}
          >
            <Text style={styles.acceptText}>Add to plan</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

function DetailSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View style={{ marginBottom: spacing.sm }}>
      <Text style={styles.detailSectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginLeft: spacing.sm,
    marginBottom: spacing.md,
    backgroundColor: colors.brandLighter,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: "#fed7aa",
    padding: spacing.md,
    gap: spacing.sm,
    maxWidth: "92%",
  },
  cardResolved: {
    backgroundColor: "#fafaf9",
    borderColor: colors.border,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  iconBadge: {
    width: 26,
    height: 26,
    borderRadius: radius.pill,
    backgroundColor: colors.brand,
    alignItems: "center",
    justifyContent: "center",
  },
  iconText: {
    color: "#fff",
    fontSize: 13,
  },
  title: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.brandDark,
  },
  rationale: {
    fontSize: 14,
    lineHeight: 20,
    color: "#7c2d12",
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs + 2,
  },
  chip: {
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 3,
    backgroundColor: "#ffffff",
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: "#fed7aa",
  },
  chipText: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.brandDark,
  },
  chipDifficulty: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 3,
    backgroundColor: "#ffffff",
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: "#fed7aa",
  },
  chipDifficultyLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.brandDark,
  },
  expandToggle: {
    alignSelf: "flex-start",
  },
  expandToggleText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.brandDark,
    textDecorationLine: "underline",
  },
  detailBlock: {
    backgroundColor: "#ffffff",
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: "#fed7aa",
    padding: spacing.md,
    gap: spacing.xs,
  },
  detailSectionTitle: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.brandDark,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  detailLine: {
    fontSize: 13,
    lineHeight: 19,
    color: colors.text,
    marginBottom: 4,
  },
  detailStrong: {
    fontWeight: "700",
  },
  detailMuted: {
    color: colors.textMuted,
  },
  actions: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  dismissBtn: {
    flex: 1,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: "#ffffff",
    paddingVertical: spacing.sm + 2,
    alignItems: "center",
  },
  dismissText: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.textMuted,
  },
  acceptBtn: {
    flex: 1,
    borderRadius: radius.md,
    backgroundColor: colors.brand,
    paddingVertical: spacing.sm + 2,
    alignItems: "center",
  },
  acceptText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#ffffff",
  },
  resolvedBanner: {
    alignSelf: "flex-start",
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  resolvedAccepted: {
    backgroundColor: colors.successBg,
  },
  resolvedDismissed: {
    backgroundColor: "#f5f5f4",
  },
  resolvedBannerText: {
    fontSize: 12,
    fontWeight: "700",
  },
  resolvedAcceptedText: {
    color: colors.success,
  },
  resolvedDismissedText: {
    color: colors.textMuted,
  },
});
