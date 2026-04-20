import 'package:flutter/material.dart';

import '../models/models.dart';
import '../theme/app_theme.dart';

class PlanProposalCard extends StatelessWidget {
  final PlanProposal proposal;
  final VoidCallback? onAccept;
  final VoidCallback? onDismiss;

  const PlanProposalCard({
    super.key,
    required this.proposal,
    this.onAccept,
    this.onDismiss,
  });

  @override
  Widget build(BuildContext context) {
    final bullets = <String>[];
    if (proposal.newSteps != null) {
      bullets.add('${proposal.newSteps!.length} new step(s)');
    }
    if (proposal.newTools != null) {
      bullets.add('${proposal.newTools!.length} new tool(s)');
    }
    if (proposal.newMaterials != null) {
      bullets.add('${proposal.newMaterials!.length} new material(s)');
    }
    if (proposal.newSafetyNotes != null) {
      bullets.add('${proposal.newSafetyNotes!.length} safety note(s)');
    }
    if (proposal.newDifficulty != null) {
      bullets.add('Difficulty → ${proposal.newDifficulty}');
    }
    if (proposal.newTotalMinutes != null) {
      bullets.add('Time → ${proposal.newTotalMinutes} min');
    }

    final isActioned = proposal.status != ProposalStatus.pending;

    return Container(
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: AppColors.brandLighter,
        borderRadius: BorderRadius.circular(AppRadius.lg),
        border: Border.all(color: AppColors.brandLight, width: 1.5),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'PLAN UPDATE SUGGESTED',
            style: TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w800,
              color: AppColors.brandDark,
              letterSpacing: 0.6,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            proposal.rationale,
            style: const TextStyle(
              fontSize: 14,
              color: AppColors.text,
              height: 1.4,
            ),
          ),
          if (bullets.isNotEmpty) ...[
            const SizedBox(height: 8),
            Wrap(
              spacing: 6,
              runSpacing: 4,
              children: bullets
                  .map(
                    (b) => Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 8, vertical: 3),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(AppRadius.pill),
                        border: Border.all(color: AppColors.brandLight),
                      ),
                      child: Text(
                        b,
                        style: const TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w700,
                          color: AppColors.brandDark,
                        ),
                      ),
                    ),
                  )
                  .toList(),
            ),
          ],
          const SizedBox(height: AppSpacing.sm),
          if (isActioned)
            Text(
              proposal.status == ProposalStatus.accepted
                  ? '✓ Accepted'
                  : 'Dismissed',
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w700,
                color: proposal.status == ProposalStatus.accepted
                    ? AppColors.success
                    : AppColors.textSubtle,
              ),
            )
          else
            Row(
              children: [
                TextButton(
                  onPressed: onDismiss,
                  child: const Text('Dismiss'),
                ),
                const SizedBox(width: 8),
                FilledButton(
                  style: FilledButton.styleFrom(
                    backgroundColor: AppColors.brand,
                  ),
                  onPressed: onAccept,
                  child: const Text('Accept'),
                ),
              ],
            ),
        ],
      ),
    );
  }
}
