import 'package:flutter/material.dart';

import '../theme/app_theme.dart';

class PrimaryButton extends StatelessWidget {
  final String title;
  final VoidCallback? onPressed;
  final bool loading;
  final IconData? icon;

  const PrimaryButton({
    super.key,
    required this.title,
    this.onPressed,
    this.loading = false,
    this.icon,
  });

  @override
  Widget build(BuildContext context) {
    final disabled = onPressed == null || loading;
    return Opacity(
      opacity: disabled ? 0.6 : 1,
      child: Material(
        color: AppColors.brand,
        borderRadius: BorderRadius.circular(AppRadius.md),
        child: InkWell(
          borderRadius: BorderRadius.circular(AppRadius.md),
          onTap: disabled ? null : onPressed,
          child: Container(
            height: 52,
            alignment: Alignment.center,
            padding: const EdgeInsets.symmetric(horizontal: AppSpacing.lg),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                if (loading) ...[
                  const SizedBox(
                    width: 18,
                    height: 18,
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      valueColor: AlwaysStoppedAnimation(Colors.white),
                    ),
                  ),
                  const SizedBox(width: 12),
                ] else if (icon != null) ...[
                  Icon(icon, color: Colors.white, size: 18),
                  const SizedBox(width: 8),
                ],
                Flexible(
                  child: Text(
                    title,
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 15,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
