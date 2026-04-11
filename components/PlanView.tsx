import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import ChecklistRow from "./ChecklistRow";
import DifficultyBadge from "./DifficultyBadge";
import InteractiveStepper from "./InteractiveStepper";
import RiskCard from "./RiskCard";
import {
  colors,
  formatDuration,
  formatMoney,
  radius,
  spacing,
} from "@/lib/theme";
import type { Issue } from "@/lib/types";

interface Props {
  issue: Issue;
  onSetStepCompleted: (stepId: string, completed: boolean) => void;
  onToggleTool: (toolId: string) => void;
  onToggleMaterial: (materialId: string) => void;
  onRegenerate?: () => void;
  regenerating?: boolean;
}

export default function PlanView({
  issue,
  onSetStepCompleted,
  onToggleTool,
  onToggleMaterial,
  onRegenerate,
  regenerating,
}: Props) {
  const { plan } = issue;
  const stepsTotal = plan.steps.length;
  const stepsDone = plan.steps.filter((s) => s.completed).length;
  const allDone = stepsTotal > 0 && stepsDone === stepsTotal;
  const savingsAmount = plan.estimatedSavingsUsd ?? 0;
  const savingsLabel = formatMoney(savingsAmount);

  return (
    <ScrollView
      contentContainerStyle={styles.scroll}
      showsVerticalScrollIndicator={false}
    >
      {plan.risk && <RiskCard risk={plan.risk} />}

      <View style={styles.headerCard}>
        <Text style={styles.summary}>{issue.summary}</Text>

        <View style={styles.metaRow}>
          <DifficultyBadge difficulty={plan.difficulty} />
          <MetaChip icon="⏱" label={formatDuration(plan.estimatedMinutes)} />
          <MetaChip icon="📋" label={`${plan.steps.length} steps`} />
          {savingsLabel.length > 0 && (
            <MetaChip
              icon="💰"
              label={
                allDone
                  ? `Saved ${savingsLabel}`
                  : `Save ~${savingsLabel}`
              }
              highlight={allDone}
            />
          )}
        </View>
      </View>

      {plan.safetyNotes.length > 0 && (
        <Section title="Safety">
          <View style={styles.safetyCard}>
            {plan.safetyNotes.map((note, i) => (
              <View key={i} style={styles.safetyRow}>
                <Text style={styles.safetyIcon}>⚠︎</Text>
                <Text style={styles.safetyText}>{note}</Text>
              </View>
            ))}
          </View>
        </Section>
      )}

      {plan.tools.length > 0 && (
        <Section
          title="Tools"
          count={plan.tools.length}
          subtitle="Check off what you already have."
        >
          <View style={styles.card}>
            {plan.tools.map((tool, i) => (
              <View key={tool.id}>
                {i > 0 && <View style={styles.divider} />}
                <ChecklistRow
                  checked={tool.have}
                  onToggle={() => onToggleTool(tool.id)}
                  title={tool.name}
                  badge={tool.required ? undefined : "Optional"}
                />
              </View>
            ))}
          </View>
        </Section>
      )}

      {plan.materials.length > 0 && (
        <Section
          title="Materials"
          count={plan.materials.length}
          subtitle="Shopping list for this repair."
        >
          <View style={styles.card}>
            {plan.materials.map((material, i) => (
              <View key={material.id}>
                {i > 0 && <View style={styles.divider} />}
                <ChecklistRow
                  checked={material.have}
                  onToggle={() => onToggleMaterial(material.id)}
                  title={material.name}
                  subtitle={material.notes}
                  rightText={material.quantity}
                />
              </View>
            ))}
          </View>
        </Section>
      )}

      {plan.steps.length > 0 && (
        <Section
          title="Step-by-step walkthrough"
          subtitle="Work through each step in order. Tap a dot to jump around."
        >
          <InteractiveStepper
            steps={plan.steps}
            savingsAmount={savingsAmount}
            onSetStepCompleted={onSetStepCompleted}
          />
        </Section>
      )}

      {onRegenerate && (
        <View style={styles.regenSection}>
          <Text style={styles.regenLabel}>
            Plan not quite right? Rebuild it from your original photo.
          </Text>
          <Pressable
            onPress={onRegenerate}
            disabled={regenerating}
            style={({ pressed }) => [
              styles.regenBtn,
              pressed && { opacity: 0.7 },
              regenerating && { opacity: 0.5 },
            ]}
          >
            <Text style={styles.regenIcon}>↻</Text>
            <Text style={styles.regenBtnText}>
              {regenerating ? "Regenerating..." : "Regenerate plan"}
            </Text>
          </Pressable>
        </View>
      )}

      <View style={{ height: spacing.xxl }} />
    </ScrollView>
  );
}

function MetaChip({
  icon,
  label,
  highlight,
}: {
  icon: string;
  label: string;
  highlight?: boolean;
}) {
  return (
    <View style={[styles.chip, highlight && styles.chipHighlight]}>
      <Text style={styles.chipIcon}>{icon}</Text>
      <Text style={[styles.chipLabel, highlight && styles.chipLabelHighlight]}>
        {label}
      </Text>
    </View>
  );
}

function Section({
  title,
  count,
  subtitle,
  children,
}: {
  title: string;
  count?: number;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>
          {title}
          {count !== undefined && (
            <Text style={styles.sectionCount}> ({count})</Text>
          )}
        </Text>
      </View>
      {subtitle && <Text style={styles.sectionSub}>{subtitle}</Text>}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: {
    padding: spacing.lg,
    paddingTop: 0,
  },
  headerCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.md,
  },
  summary: {
    fontSize: 14,
    color: colors.textMuted,
    lineHeight: 20,
  },
  metaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    alignItems: "center",
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 4,
    backgroundColor: "#f5f5f4",
    borderRadius: radius.pill,
  },
  chipHighlight: {
    backgroundColor: colors.successBg,
  },
  chipIcon: {
    fontSize: 13,
  },
  chipLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.textMuted,
  },
  chipLabelHighlight: {
    color: colors.success,
  },
  section: {
    marginTop: spacing.lg,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    paddingHorizontal: 4,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.text,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  sectionCount: {
    color: colors.textSubtle,
    fontWeight: "600",
  },
  sectionSub: {
    fontSize: 12,
    color: colors.textSubtle,
    paddingHorizontal: 4,
    marginTop: 2,
    marginBottom: spacing.sm,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginLeft: 40,
  },
  safetyCard: {
    backgroundColor: "#fff7ed",
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: "#fed7aa",
    padding: spacing.md,
    gap: spacing.sm,
  },
  safetyRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  safetyIcon: {
    fontSize: 16,
    color: "#c2410c",
    marginTop: 1,
  },
  safetyText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
    color: "#7c2d12",
  },
  regenSection: {
    marginTop: spacing.xl,
    paddingTop: spacing.lg,
    borderTopWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    gap: spacing.sm,
  },
  regenLabel: {
    fontSize: 12,
    color: colors.textSubtle,
    textAlign: "center",
    maxWidth: 280,
  },
  regenBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs + 2,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  regenIcon: {
    fontSize: 16,
    color: colors.text,
    fontWeight: "700",
  },
  regenBtnText: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.text,
  },
});
