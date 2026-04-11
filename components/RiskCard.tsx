import { StyleSheet, Text, View } from "react-native";
import { colors, radius, spacing } from "@/lib/theme";
import type { RiskAssessment, RiskCategory, RiskSeverity } from "@/lib/types";

interface Props {
  risk: RiskAssessment;
}

const CATEGORY_ICON: Record<RiskCategory, string> = {
  electrical: "⚡",
  plumbing: "🚰",
  gas: "🔥",
  structural: "🏗",
  height: "🪜",
  chemical: "⚗",
  fire: "🔥",
  sharps: "🔪",
  general: "⚠︎",
};

const CATEGORY_LABEL: Record<RiskCategory, string> = {
  electrical: "Electrical hazard",
  plumbing: "Plumbing hazard",
  gas: "Gas hazard",
  structural: "Structural hazard",
  height: "Fall hazard",
  chemical: "Chemical hazard",
  fire: "Fire hazard",
  sharps: "Cut hazard",
  general: "Safety hazard",
};

const SEVERITY_STYLES: Record<
  RiskSeverity,
  { bg: string; border: string; accent: string; text: string; sub: string; pill: string; pillText: string }
> = {
  low: {
    bg: "#fffbeb",
    border: "#fde68a",
    accent: "#b45309",
    text: "#78350f",
    sub: "#92400e",
    pill: "#fef3c7",
    pillText: "#b45309",
  },
  medium: {
    bg: "#fff7ed",
    border: "#fed7aa",
    accent: "#c2410c",
    text: "#7c2d12",
    sub: "#9a3412",
    pill: "#ffedd5",
    pillText: "#c2410c",
  },
  high: {
    bg: "#fef2f2",
    border: "#fecaca",
    accent: "#b91c1c",
    text: "#7f1d1d",
    sub: "#991b1b",
    pill: "#fee2e2",
    pillText: "#b91c1c",
  },
};

const SEVERITY_LABEL: Record<RiskSeverity, string> = {
  low: "Low risk",
  medium: "Medium risk",
  high: "High risk",
};

export default function RiskCard({ risk }: Props) {
  const s = SEVERITY_STYLES[risk.severity];
  const icon = CATEGORY_ICON[risk.category];
  const categoryLabel = CATEGORY_LABEL[risk.category];

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: s.bg, borderColor: s.border },
      ]}
    >
      <View style={styles.headerRow}>
        <View style={[styles.iconBadge, { backgroundColor: s.accent }]}>
          <Text style={styles.iconText}>{icon}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.category, { color: s.sub }]}>
            {categoryLabel}
          </Text>
          <Text style={[styles.headline, { color: s.text }]} numberOfLines={2}>
            {risk.headline}
          </Text>
        </View>
        <View style={[styles.severityPill, { backgroundColor: s.pill }]}>
          <Text style={[styles.severityPillText, { color: s.pillText }]}>
            {SEVERITY_LABEL[risk.severity]}
          </Text>
        </View>
      </View>

      {risk.rationale.length > 0 && (
        <Text style={[styles.rationale, { color: s.text }]}>
          {risk.rationale}
        </Text>
      )}

      {risk.callAProRecommended && (
        <View style={[styles.callProBanner, { backgroundColor: s.accent }]}>
          <Text style={styles.callProText}>
            👷 We strongly recommend hiring a licensed {proLabelFor(risk.category)}.
          </Text>
          <Text style={styles.callProSub}>
            You can still walk through the steps below — this is advisory.
          </Text>
        </View>
      )}
    </View>
  );
}

function proLabelFor(category: RiskCategory): string {
  switch (category) {
    case "electrical":
      return "electrician";
    case "plumbing":
      return "plumber";
    case "gas":
      return "gas technician";
    case "structural":
      return "contractor or structural engineer";
    case "height":
      return "roofer or contractor";
    case "chemical":
      return "professional";
    case "fire":
      return "professional";
    case "sharps":
      return "professional";
    default:
      return "professional";
  }
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.md + 2,
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm + 2,
  },
  iconBadge: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  iconText: {
    fontSize: 20,
  },
  category: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  headline: {
    fontSize: 16,
    fontWeight: "800",
    marginTop: 1,
  },
  severityPill: {
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  severityPillText: {
    fontSize: 11,
    fontWeight: "800",
  },
  rationale: {
    fontSize: 13,
    lineHeight: 19,
  },
  callProBanner: {
    borderRadius: radius.md,
    padding: spacing.md,
    gap: 2,
  },
  callProText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "700",
  },
  callProSub: {
    color: "#ffffff",
    fontSize: 12,
    opacity: 0.9,
  },
});
