import 'package:flutter/material.dart';

import '../models/models.dart';
import '../theme/app_theme.dart';

class SuggestedRemindersCard extends StatelessWidget {
  final List<SuggestedReminder> suggestions;
  final void Function(SuggestedReminder) onEnable;

  const SuggestedRemindersCard({
    super.key,
    required this.suggestions,
    required this.onEnable,
  });

  @override
  Widget build(BuildContext context) {
    if (suggestions.isEmpty) return const SizedBox.shrink();
    return Container(
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: AppColors.brandLighter,
        borderRadius: BorderRadius.circular(AppRadius.lg),
        border: Border.all(color: AppColors.brandLight),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'KEEP IT FIXED',
            style: TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w800,
              color: AppColors.brandDark,
              letterSpacing: 0.6,
            ),
          ),
          const SizedBox(height: 6),
          const Text(
            'Turn these follow-ups into reminders so a one-time fix becomes a habit.',
            style: TextStyle(fontSize: 13, color: AppColors.text, height: 1.35),
          ),
          const SizedBox(height: AppSpacing.sm),
          for (final s in suggestions)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 4),
              child: Row(
                children: [
                  Text(s.icon, style: const TextStyle(fontSize: 20)),
                  const SizedBox(width: AppSpacing.sm),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          s.title,
                          style: const TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.w700,
                            color: AppColors.text,
                          ),
                        ),
                        Text(
                          'Every ${s.frequencyDays} days',
                          style: const TextStyle(
                            fontSize: 11,
                            color: AppColors.textMuted,
                          ),
                        ),
                      ],
                    ),
                  ),
                  TextButton(
                    onPressed: () => onEnable(s),
                    child: const Text('+ Add'),
                  ),
                ],
              ),
            ),
        ],
      ),
    );
  }
}
