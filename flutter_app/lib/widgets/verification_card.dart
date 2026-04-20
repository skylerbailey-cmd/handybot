import 'dart:io';

import 'package:flutter/material.dart';

import '../models/models.dart';
import '../theme/app_theme.dart';

class VerificationCard extends StatelessWidget {
  final VerificationResult result;
  const VerificationCard({super.key, required this.result});

  @override
  Widget build(BuildContext context) {
    final ok = result.verified;
    return Container(
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: ok ? AppColors.successBg : AppColors.dangerBg,
        borderRadius: BorderRadius.circular(AppRadius.lg),
        border: Border.all(
          color: ok
              ? AppColors.success.withValues(alpha: 0.3)
              : AppColors.danger.withValues(alpha: 0.3),
        ),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (result.photoUri != null)
            ClipRRect(
              borderRadius: BorderRadius.circular(AppRadius.md),
              child: Image.file(
                File(
                  result.photoUri!.startsWith('file://')
                      ? result.photoUri!.substring(7)
                      : result.photoUri!,
                ),
                width: 56,
                height: 56,
                fit: BoxFit.cover,
              ),
            )
          else
            Text(
              ok ? '✓' : '⚠',
              style: TextStyle(
                fontSize: 28,
                color: ok ? AppColors.success : AppColors.danger,
              ),
            ),
          const SizedBox(width: AppSpacing.sm + 2),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  ok ? 'Verified' : 'Needs follow-up',
                  style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w800,
                    color: ok ? AppColors.success : AppColors.danger,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  result.feedback,
                  style: const TextStyle(
                    fontSize: 13,
                    color: AppColors.text,
                    height: 1.4,
                  ),
                ),
                if (result.fixStepsAdded != null &&
                    result.fixStepsAdded! > 0) ...[
                  const SizedBox(height: 4),
                  Text(
                    'Added ${result.fixStepsAdded} fix-up step${result.fixStepsAdded == 1 ? '' : 's'}',
                    style: const TextStyle(
                      fontSize: 12,
                      color: AppColors.danger,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}
