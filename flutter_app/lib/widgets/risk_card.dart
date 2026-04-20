import 'package:flutter/material.dart';

import '../models/models.dart';
import '../theme/app_theme.dart';

class RiskCard extends StatelessWidget {
  final RiskAssessment risk;
  const RiskCard({super.key, required this.risk});

  static const _icons = {
    RiskCategory.electrical: '⚡',
    RiskCategory.plumbing: '💧',
    RiskCategory.gas: '🔥',
    RiskCategory.structural: '🏗',
    RiskCategory.height: '🪜',
    RiskCategory.chemical: '⚗',
    RiskCategory.fire: '🔥',
    RiskCategory.sharps: '🔪',
    RiskCategory.general: '⚠️',
  };

  @override
  Widget build(BuildContext context) {
    final color = switch (risk.severity) {
      RiskSeverity.high => const Color(0xFFDC2626),
      RiskSeverity.medium => const Color(0xFFD97706),
      _ => const Color(0xFFCA8A04),
    };
    final bg = switch (risk.severity) {
      RiskSeverity.high => const Color(0xFFFEF2F2),
      RiskSeverity.medium => const Color(0xFFFFFBEB),
      _ => const Color(0xFFFEFCE8),
    };
    final icon = _icons[risk.category] ?? '⚠️';
    final severityLabel = switch (risk.severity) {
      RiskSeverity.high => 'HIGH RISK',
      RiskSeverity.medium => 'MEDIUM RISK',
      _ => 'LOW RISK',
    };
    return Container(
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(AppRadius.lg),
        border: Border.all(color: color.withValues(alpha: 0.3)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(icon, style: const TextStyle(fontSize: 22)),
          const SizedBox(width: AppSpacing.sm + 2),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Text(
                      severityLabel,
                      style: TextStyle(
                        fontSize: 10,
                        fontWeight: FontWeight.w800,
                        color: color,
                        letterSpacing: 0.6,
                      ),
                    ),
                    if (risk.callAProRecommended) ...[
                      const SizedBox(width: 8),
                      Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 6, vertical: 2),
                        decoration: BoxDecoration(
                          color: color,
                          borderRadius: BorderRadius.circular(AppRadius.pill),
                        ),
                        child: const Text(
                          'Call a pro',
                          style: TextStyle(
                            color: Colors.white,
                            fontSize: 10,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                      ),
                    ],
                  ],
                ),
                const SizedBox(height: 4),
                Text(
                  risk.headline,
                  style: TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w700,
                    color: color,
                  ),
                ),
                if (risk.rationale.isNotEmpty) ...[
                  const SizedBox(height: 4),
                  Text(
                    risk.rationale,
                    style: TextStyle(
                      fontSize: 13,
                      color: color.withValues(alpha: 0.9),
                      height: 1.35,
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
