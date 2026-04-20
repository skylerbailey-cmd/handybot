import 'dart:io';

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../models/models.dart';
import '../theme/app_theme.dart';
import 'difficulty_badge.dart';

class IssueCard extends StatelessWidget {
  final Issue issue;
  const IssueCard({super.key, required this.issue});

  @override
  Widget build(BuildContext context) {
    final saved = formatMoney(issue.plan.estimatedSavingsUsd);
    final statusLabel = _statusLabel(issue.status);
    return InkWell(
      borderRadius: BorderRadius.circular(AppRadius.lg),
      onTap: () => context.push('/issue/${issue.id}'),
      child: Container(
        padding: const EdgeInsets.all(AppSpacing.md),
        decoration: BoxDecoration(
          color: AppColors.surface,
          borderRadius: BorderRadius.circular(AppRadius.lg),
          border: Border.all(color: AppColors.border),
        ),
        child: Row(
          children: [
            if (issue.coverImageUri != null)
              ClipRRect(
                borderRadius: BorderRadius.circular(AppRadius.md),
                child: _thumb(issue.coverImageUri!),
              )
            else
              Container(
                width: 64,
                height: 64,
                decoration: BoxDecoration(
                  color: AppColors.brandLight,
                  borderRadius: BorderRadius.circular(AppRadius.md),
                ),
                alignment: Alignment.center,
                child: const Text('🔧', style: TextStyle(fontSize: 28)),
              ),
            const SizedBox(width: AppSpacing.md),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    issue.title,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w700,
                      color: AppColors.text,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    issue.summary,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      fontSize: 12,
                      color: AppColors.textMuted,
                      height: 1.3,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Wrap(
                    spacing: 6,
                    runSpacing: 4,
                    children: [
                      DifficultyBadge(difficulty: issue.plan.difficulty),
                      if (saved.isNotEmpty)
                        Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 8, vertical: 3),
                          decoration: BoxDecoration(
                            color: AppColors.successBg,
                            borderRadius:
                                BorderRadius.circular(AppRadius.pill),
                          ),
                          child: Text(
                            '$saved saved',
                            style: const TextStyle(
                              color: AppColors.success,
                              fontSize: 11,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ),
                      if (statusLabel != null)
                        Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 8, vertical: 3),
                          decoration: BoxDecoration(
                            color: AppColors.chipBg,
                            borderRadius:
                                BorderRadius.circular(AppRadius.pill),
                          ),
                          child: Text(
                            statusLabel,
                            style: const TextStyle(
                              color: AppColors.textMuted,
                              fontSize: 11,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _thumb(String uri) {
    final path = uri.startsWith('file://') ? uri.substring(7) : uri;
    if (path.startsWith('http')) {
      return Image.network(path, width: 64, height: 64, fit: BoxFit.cover);
    }
    return Image.file(File(path), width: 64, height: 64, fit: BoxFit.cover);
  }

  String? _statusLabel(String status) {
    switch (status) {
      case IssueStatus.completed:
        return 'Completed';
      case IssueStatus.verified:
        return '✓ Verified';
      default:
        return null;
    }
  }
}
