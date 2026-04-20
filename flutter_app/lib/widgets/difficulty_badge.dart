import 'package:flutter/material.dart';

import '../theme/app_theme.dart';

class DifficultyBadge extends StatelessWidget {
  final String difficulty;
  const DifficultyBadge({super.key, required this.difficulty});

  @override
  Widget build(BuildContext context) {
    final (bg, fg) = DifficultyColors.forDifficulty(difficulty);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(AppRadius.pill),
      ),
      child: Text(
        difficulty,
        style: TextStyle(
          color: fg,
          fontWeight: FontWeight.w700,
          fontSize: 11,
        ),
      ),
    );
  }
}
