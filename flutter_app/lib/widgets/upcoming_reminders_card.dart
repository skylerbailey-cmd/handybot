import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../models/models.dart';
import '../services/reminders_service.dart';
import '../theme/app_theme.dart';

class UpcomingRemindersCard extends StatelessWidget {
  final List<Reminder> reminders;
  final void Function(Reminder) onMarkDone;

  const UpcomingRemindersCard({
    super.key,
    required this.reminders,
    required this.onMarkDone,
  });

  @override
  Widget build(BuildContext context) {
    if (reminders.isEmpty) return const SizedBox.shrink();
    return Container(
      margin: const EdgeInsets.only(bottom: AppSpacing.md),
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(AppRadius.lg),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Text(
                'UPCOMING',
                style: TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w800,
                  color: AppColors.textMuted,
                  letterSpacing: 0.6,
                ),
              ),
              const Spacer(),
              TextButton(
                onPressed: () => context.push('/reminders'),
                child: const Text('See all'),
              ),
            ],
          ),
          for (final r in reminders)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 4),
              child: Row(
                children: [
                  Text(r.icon, style: const TextStyle(fontSize: 18)),
                  const SizedBox(width: AppSpacing.sm),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          r.title,
                          style: const TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.w600,
                            color: AppColors.text,
                          ),
                        ),
                        Text(
                          formatDueDate(r),
                          style: const TextStyle(
                            fontSize: 11,
                            color: AppColors.textMuted,
                          ),
                        ),
                      ],
                    ),
                  ),
                  TextButton(
                    onPressed: () => onMarkDone(r),
                    child: const Text('Done'),
                  ),
                ],
              ),
            ),
        ],
      ),
    );
  }
}
