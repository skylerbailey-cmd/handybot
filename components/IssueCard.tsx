import { Link } from "expo-router";
import { useState } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import DifficultyBadge from "./DifficultyBadge";
import { usePhotoUri } from "@/hooks/usePhotoUri";
import {
  colors,
  formatDuration,
  formatMoney,
  radius,
  spacing,
} from "@/lib/theme";
import type { Issue } from "@/lib/types";

function timeAgo(ts: number) {
  const diffMs = Date.now() - ts;
  const sec = Math.floor(diffMs / 1000);
  if (sec < 60) return "just now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d ago`;
  return new Date(ts).toLocaleDateString();
}

const RISK_ICON: Record<string, string> = {
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

const RISK_BG: Record<string, string> = {
  low: "#fef3c7",
  medium: "#ffedd5",
  high: "#fee2e2",
};

const RISK_FG: Record<string, string> = {
  low: "#b45309",
  medium: "#c2410c",
  high: "#b91c1c",
};

export default function IssueCard({ issue }: { issue: Issue }) {
  const resolvedCover = usePhotoUri(issue.coverImageUri);
  const [imageFailed, setImageFailed] = useState(false);
  const stepsDone = issue.plan.steps.filter((s) => s.completed).length;
  const stepsTotal = issue.plan.steps.length;
  const progressPct =
    stepsTotal === 0 ? 0 : Math.round((stepsDone / stepsTotal) * 100);
  const isComplete =
    issue.status === "completed" ||
    issue.status === "verified" ||
    (stepsTotal > 0 && stepsDone === stepsTotal);
  const savingsLabel = formatMoney(issue.plan.estimatedSavingsUsd ?? 0);
  const risk = issue.plan.risk;

  return (
    <Link href={`/(tabs)/(repair)/issue/${issue.id}`} asChild>
      <Pressable
        style={({ pressed }) => [styles.card, pressed && styles.pressed]}
      >
        <View style={styles.thumb}>
          {resolvedCover && !imageFailed ? (
            <Image
              source={{ uri: resolvedCover }}
              style={styles.thumbImage}
              onError={() => setImageFailed(true)}
            />
          ) : (
            <View style={styles.thumbPlaceholder}>
              <Text style={styles.thumbPlaceholderText}>📷</Text>
            </View>
          )}
          {risk && (
            <View
              style={[
                styles.riskBadge,
                { backgroundColor: RISK_BG[risk.severity] },
              ]}
            >
              <Text
                style={[styles.riskBadgeText, { color: RISK_FG[risk.severity] }]}
              >
                {RISK_ICON[risk.category] ?? "⚠︎"}
              </Text>
            </View>
          )}
        </View>
        <View style={styles.body}>
          <View style={styles.titleRow}>
            <Text style={styles.title} numberOfLines={1}>
              {issue.title || "Untitled repair"}
            </Text>
            {issue.status === "verified" ? (
              <View style={styles.verifiedBadge}>
                <Text style={styles.verifiedBadgeText}>Verified</Text>
              </View>
            ) : issue.status === "completed" ? (
              <View style={styles.completedBadge}>
                <Text style={styles.completedBadgeText}>Completed</Text>
              </View>
            ) : null}
          </View>
          <Text style={styles.summary} numberOfLines={2}>
            {issue.summary || "Tap to continue the conversation."}
          </Text>

          <View style={styles.metaRow}>
            <DifficultyBadge difficulty={issue.plan.difficulty} />
            <Text style={styles.metaDot}>·</Text>
            <Text style={styles.metaText}>
              {formatDuration(issue.plan.estimatedMinutes)}
            </Text>
            {stepsTotal > 0 && (
              <>
                <Text style={styles.metaDot}>·</Text>
                <Text style={styles.metaText}>
                  {stepsDone}/{stepsTotal}
                </Text>
              </>
            )}
          </View>

          <View style={styles.progressTrack}>
            <View
              style={[styles.progressFill, { width: `${progressPct}%` }]}
            />
          </View>

          <View style={styles.footerRow}>
            <Text style={styles.timestamp}>Updated {timeAgo(issue.updatedAt)}</Text>
            {savingsLabel.length > 0 && (
              <View
                style={[
                  styles.savingsChip,
                  isComplete && styles.savingsChipComplete,
                ]}
              >
                <Text
                  style={[
                    styles.savingsChipText,
                    isComplete && styles.savingsChipTextComplete,
                  ]}
                >
                  {isComplete ? `✓ Saved ${savingsLabel}` : `Save ~${savingsLabel}`}
                </Text>
              </View>
            )}
          </View>
        </View>
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.995 }],
  },
  thumb: {
    width: 72,
    height: 72,
    borderRadius: radius.md,
    overflow: "hidden",
    backgroundColor: "#f5f5f4",
    position: "relative",
  },
  riskBadge: {
    position: "absolute",
    top: 4,
    left: 4,
    minWidth: 22,
    height: 22,
    paddingHorizontal: 4,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  riskBadgeText: {
    fontSize: 12,
    fontWeight: "800",
  },
  thumbImage: {
    width: "100%",
    height: "100%",
  },
  thumbPlaceholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  thumbPlaceholderText: {
    fontSize: 28,
  },
  body: {
    flex: 1,
    minWidth: 0,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  title: {
    flex: 1,
    fontSize: 16,
    fontWeight: "600",
    color: colors.text,
  },
  completedBadge: {
    backgroundColor: "#e0e7ff",
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  completedBadgeText: {
    color: "#4338ca",
    fontSize: 11,
    fontWeight: "600",
  },
  verifiedBadge: {
    backgroundColor: colors.successBg,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  verifiedBadgeText: {
    color: colors.success,
    fontSize: 11,
    fontWeight: "600",
  },
  summary: {
    marginTop: 2,
    fontSize: 13,
    color: colors.textMuted,
    lineHeight: 18,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs + 2,
    marginTop: spacing.sm,
  },
  metaText: {
    fontSize: 12,
    color: colors.textMuted,
    fontWeight: "600",
  },
  metaDot: {
    fontSize: 12,
    color: colors.textSubtle,
  },
  progressTrack: {
    height: 4,
    borderRadius: radius.pill,
    backgroundColor: "#f5f5f4",
    overflow: "hidden",
    marginTop: spacing.sm,
  },
  progressFill: {
    height: "100%",
    backgroundColor: colors.brand,
  },
  timestamp: {
    fontSize: 11,
    color: colors.textSubtle,
  },
  footerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 4,
    gap: spacing.sm,
  },
  savingsChip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
    backgroundColor: "#f5f5f4",
  },
  savingsChipComplete: {
    backgroundColor: colors.successBg,
  },
  savingsChipText: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.textMuted,
  },
  savingsChipTextComplete: {
    color: colors.success,
  },
});
