import 'package:flutter/material.dart';

import '../theme/app_theme.dart';

class ChecklistRow extends StatelessWidget {
  final bool checked;
  final String label;
  final String? sublabel;
  final bool requiredMarker;
  final VoidCallback onToggle;

  const ChecklistRow({
    super.key,
    required this.checked,
    required this.label,
    this.sublabel,
    this.requiredMarker = false,
    required this.onToggle,
  });

  @override
  Widget build(BuildContext context) {
    return InkWell(
      borderRadius: BorderRadius.circular(AppRadius.sm),
      onTap: onToggle,
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 8),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              width: 22,
              height: 22,
              decoration: BoxDecoration(
                color: checked ? AppColors.brand : Colors.transparent,
                borderRadius: BorderRadius.circular(6),
                border: Border.all(
                  color: checked ? AppColors.brand : AppColors.borderStrong,
                  width: 2,
                ),
              ),
              child: checked
                  ? const Icon(Icons.check, color: Colors.white, size: 16)
                  : null,
            ),
            const SizedBox(width: AppSpacing.sm + 2),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Flexible(
                        child: Text(
                          label,
                          style: TextStyle(
                            fontSize: 14,
                            fontWeight: FontWeight.w600,
                            color: AppColors.text,
                            decoration:
                                checked ? TextDecoration.lineThrough : null,
                          ),
                        ),
                      ),
                      if (!requiredMarker) ...[
                        const SizedBox(width: 6),
                        const Text(
                          'optional',
                          style: TextStyle(
                            fontSize: 10,
                            color: AppColors.textSubtle,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ],
                    ],
                  ),
                  if (sublabel != null && sublabel!.isNotEmpty)
                    Padding(
                      padding: const EdgeInsets.only(top: 2),
                      child: Text(
                        sublabel!,
                        style: const TextStyle(
                          fontSize: 12,
                          color: AppColors.textMuted,
                        ),
                      ),
                    ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
