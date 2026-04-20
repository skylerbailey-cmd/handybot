import 'package:flutter/material.dart';

import '../theme/app_theme.dart';

class SegmentedTabs extends StatelessWidget {
  final List<String> options;
  final int selectedIndex;
  final ValueChanged<int> onSelect;

  const SegmentedTabs({
    super.key,
    required this.options,
    required this.selectedIndex,
    required this.onSelect,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(
        color: AppColors.chipBg,
        borderRadius: BorderRadius.circular(AppRadius.md),
      ),
      child: Row(
        children: [
          for (int i = 0; i < options.length; i++)
            Expanded(
              child: GestureDetector(
                onTap: () => onSelect(i),
                child: Container(
                  padding: const EdgeInsets.symmetric(vertical: 8),
                  decoration: BoxDecoration(
                    color: selectedIndex == i ? Colors.white : Colors.transparent,
                    borderRadius: BorderRadius.circular(AppRadius.sm),
                    boxShadow: selectedIndex == i
                        ? [
                            BoxShadow(
                              color: Colors.black.withValues(alpha: 0.08),
                              blurRadius: 4,
                              offset: const Offset(0, 1),
                            )
                          ]
                        : null,
                  ),
                  alignment: Alignment.center,
                  child: Text(
                    options[i],
                    style: TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w700,
                      color: selectedIndex == i
                          ? AppColors.text
                          : AppColors.textMuted,
                    ),
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}
