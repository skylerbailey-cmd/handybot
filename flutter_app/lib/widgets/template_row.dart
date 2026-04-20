import 'package:flutter/material.dart';

import '../models/models.dart';
import '../services/reminders_service.dart';
import '../theme/app_theme.dart';

class TemplateRow extends StatelessWidget {
  final MaintenanceTemplate template;
  final VoidCallback? onTap;

  const TemplateRow({super.key, required this.template, this.onTap});

  @override
  Widget build(BuildContext context) {
    return InkWell(
      borderRadius: BorderRadius.circular(AppRadius.lg),
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(AppSpacing.md),
        decoration: BoxDecoration(
          color: AppColors.surface,
          borderRadius: BorderRadius.circular(AppRadius.lg),
          border: Border.all(color: AppColors.border),
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(template.icon, style: const TextStyle(fontSize: 26)),
            const SizedBox(width: AppSpacing.md),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    template.title,
                    style: const TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w700,
                      color: AppColors.text,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    template.description,
                    style: const TextStyle(
                      fontSize: 12,
                      color: AppColors.textMuted,
                      height: 1.3,
                    ),
                  ),
                  const SizedBox(height: 6),
                  Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 8, vertical: 2),
                    decoration: BoxDecoration(
                      color: AppColors.chipBg,
                      borderRadius: BorderRadius.circular(AppRadius.pill),
                    ),
                    child: Text(
                      formatFrequency(template.frequencyDays),
                      style: const TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w700,
                        color: AppColors.textMuted,
                      ),
                    ),
                  ),
                ],
              ),
            ),
            const Icon(Icons.add, color: AppColors.brand),
          ],
        ),
      ),
    );
  }
}
