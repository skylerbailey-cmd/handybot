import 'package:flutter/material.dart';

import '../models/models.dart';
import '../services/reminders_service.dart';
import '../theme/app_theme.dart';

class ReminderRow extends StatelessWidget {
  final Reminder reminder;
  final bool highlighted;
  final VoidCallback? onTap;
  final ValueChanged<bool>? onEnabledChanged;
  final VoidCallback? onMarkDone;

  const ReminderRow({
    super.key,
    required this.reminder,
    this.highlighted = false,
    this.onTap,
    this.onEnabledChanged,
    this.onMarkDone,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(AppRadius.lg),
        border: Border.all(
          color: highlighted ? AppColors.brand : AppColors.border,
          width: highlighted ? 2 : 1,
        ),
      ),
      child: InkWell(
        borderRadius: BorderRadius.circular(AppRadius.lg),
        onTap: onTap,
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(reminder.icon, style: const TextStyle(fontSize: 28)),
            const SizedBox(width: AppSpacing.md),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    reminder.title,
                    style: const TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w700,
                      color: AppColors.text,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    '${formatDueDate(reminder)} · ${formatFrequency(reminder.frequencyDays)}',
                    style: const TextStyle(
                      fontSize: 12,
                      color: AppColors.textMuted,
                    ),
                  ),
                  if (onMarkDone != null) ...[
                    const SizedBox(height: AppSpacing.sm),
                    TextButton(
                      style: TextButton.styleFrom(
                        padding: EdgeInsets.zero,
                        minimumSize: const Size(0, 28),
                        tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                      ),
                      onPressed: onMarkDone,
                      child: const Text('Mark done'),
                    ),
                  ],
                ],
              ),
            ),
            if (onEnabledChanged != null)
              Switch(
                value: reminder.enabled,
                activeColor: AppColors.brand,
                onChanged: onEnabledChanged,
              ),
          ],
        ),
      ),
    );
  }
}
