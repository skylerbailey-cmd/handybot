import 'package:flutter/material.dart';

import '../models/models.dart';
import '../theme/app_theme.dart';
import 'checklist_row.dart';
import 'difficulty_badge.dart';
import 'risk_card.dart';
import 'verification_card.dart';

/// Full structured view of a RepairPlan. Used inside the Plan tab of the
/// issue screen.
class PlanView extends StatelessWidget {
  final RepairPlan plan;
  final void Function(String toolId) onToggleTool;
  final void Function(String materialId) onToggleMaterial;

  const PlanView({
    super.key,
    required this.plan,
    required this.onToggleTool,
    required this.onToggleMaterial,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _headerCard(),
        const SizedBox(height: AppSpacing.md),
        if (plan.risk != null) ...[
          RiskCard(risk: plan.risk!),
          const SizedBox(height: AppSpacing.md),
        ],
        if (plan.verificationResult != null) ...[
          VerificationCard(result: plan.verificationResult!),
          const SizedBox(height: AppSpacing.md),
        ],
        if (plan.tools.isNotEmpty) _section(
          'TOOLS',
          Column(
            children: plan.tools
                .map(
                  (t) => ChecklistRow(
                    checked: t.have,
                    label: t.name,
                    requiredMarker: t.required,
                    onToggle: () => onToggleTool(t.id),
                  ),
                )
                .toList(),
          ),
        ),
        if (plan.materials.isNotEmpty) _section(
          'MATERIALS',
          Column(
            children: plan.materials
                .map(
                  (m) => ChecklistRow(
                    checked: m.have,
                    label: '${m.name} · ${m.quantity}',
                    sublabel: [
                      if (m.estimatedPriceUsd != null &&
                          m.estimatedPriceUsd! > 0)
                        '~${formatMoney(m.estimatedPriceUsd)}',
                      if (m.notes != null && m.notes!.isNotEmpty) m.notes!,
                    ].join(' · '),
                    requiredMarker: true,
                    onToggle: () => onToggleMaterial(m.id),
                  ),
                )
                .toList(),
          ),
        ),
        if (plan.safetyNotes.isNotEmpty) _section(
          'SAFETY NOTES',
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: plan.safetyNotes
                .map(
                  (s) => Padding(
                    padding: const EdgeInsets.symmetric(vertical: 4),
                    child: Text('• $s',
                        style: const TextStyle(
                            fontSize: 13,
                            color: AppColors.text,
                            height: 1.4)),
                  ),
                )
                .toList(),
          ),
        ),
      ],
    );
  }

  Widget _headerCard() {
    return Container(
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(AppRadius.lg),
        border: Border.all(color: AppColors.border),
      ),
      child: Row(
        children: [
          DifficultyBadge(difficulty: plan.difficulty),
          const SizedBox(width: AppSpacing.sm),
          _chip('⏱  ${formatDuration(plan.estimatedMinutes)}'),
          const SizedBox(width: AppSpacing.sm),
          if (plan.estimatedSavingsUsd > 0)
            _chip(
              '💰  ${formatMoney(plan.estimatedSavingsUsd)} saved',
              color: AppColors.success,
              bg: AppColors.successBg,
            ),
        ],
      ),
    );
  }

  Widget _chip(String text, {Color? color, Color? bg}) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: bg ?? AppColors.chipBg,
        borderRadius: BorderRadius.circular(AppRadius.pill),
      ),
      child: Text(
        text,
        style: TextStyle(
          color: color ?? AppColors.textMuted,
          fontSize: 11,
          fontWeight: FontWeight.w700,
        ),
      ),
    );
  }

  Widget _section(String title, Widget child) {
    return Padding(
      padding: const EdgeInsets.only(bottom: AppSpacing.md),
      child: Container(
        padding: const EdgeInsets.all(AppSpacing.md),
        decoration: BoxDecoration(
          color: AppColors.surface,
          borderRadius: BorderRadius.circular(AppRadius.lg),
          border: Border.all(color: AppColors.border),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              title,
              style: const TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w800,
                color: AppColors.textMuted,
                letterSpacing: 0.6,
              ),
            ),
            const SizedBox(height: AppSpacing.xs),
            child,
          ],
        ),
      ),
    );
  }
}
