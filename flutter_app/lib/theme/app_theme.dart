import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../models/models.dart';

/// HandyBot design tokens ported from `lib/theme.ts`.
class AppColors {
  static const background = Color(0xFFFAFAF9);
  static const surface = Color(0xFFFFFFFF);
  static const border = Color(0xFFE7E5E4);
  static const borderStrong = Color(0xFFD6D3D1);
  static const text = Color(0xFF1C1917);
  static const textMuted = Color(0xFF57534E);
  static const textSubtle = Color(0xFFA8A29E);
  static const brand = Color(0xFFEA580C);
  static const brandDark = Color(0xFFC2410C);
  static const brandLight = Color(0xFFFFEDD5);
  static const brandLighter = Color(0xFFFFF7ED);
  static const danger = Color(0xFFB91C1C);
  static const dangerBg = Color(0xFFFEF2F2);
  static const success = Color(0xFF059669);
  static const successBg = Color(0xFFD1FAE5);
  static const chipBg = Color(0xFFF5F5F4);
}

class AppRadius {
  static const sm = 8.0;
  static const md = 12.0;
  static const lg = 16.0;
  static const xl = 20.0;
  static const pill = 999.0;
}

class AppSpacing {
  static const xs = 4.0;
  static const sm = 8.0;
  static const md = 12.0;
  static const lg = 16.0;
  static const xl = 24.0;
  static const xxl = 32.0;
}

class DifficultyColors {
  static const _easyBg = Color(0xFFD1FAE5);
  static const _easyFg = Color(0xFF047857);
  static const _medBg = Color(0xFFFEF3C7);
  static const _medFg = Color(0xFFB45309);
  static const _hardBg = Color(0xFFFEE2E2);
  static const _hardFg = Color(0xFFB91C1C);
  static const _proBg = Color(0xFFE0E7FF);
  static const _proFg = Color(0xFF4338CA);

  static (Color bg, Color fg) forDifficulty(String d) {
    switch (d) {
      case Difficulty.easy:
        return (_easyBg, _easyFg);
      case Difficulty.medium:
        return (_medBg, _medFg);
      case Difficulty.hard:
        return (_hardBg, _hardFg);
      case Difficulty.callAPro:
        return (_proBg, _proFg);
      default:
        return (_medBg, _medFg);
    }
  }
}

/// Minutes → "1h 30m" style string. Matches `formatDuration` in theme.ts.
String formatDuration(int minutes) {
  if (minutes <= 0) return '—';
  if (minutes < 60) return '$minutes min';
  final hours = minutes ~/ 60;
  final mins = minutes % 60;
  if (mins == 0) return '$hours hr';
  return '${hours}h ${mins}m';
}

/// USD amount → "$1,234" or empty string for zero/negative. Matches theme.ts.
String formatMoney(num? usd) {
  if (usd == null || usd <= 0) return '';
  final rounded = usd.round();
  final f = NumberFormat.decimalPattern('en_US');
  return '\$${f.format(rounded)}';
}

ThemeData buildTheme() {
  const textTheme = TextTheme(
    displayLarge:
        TextStyle(fontSize: 22, fontWeight: FontWeight.w700, color: AppColors.text),
    headlineMedium:
        TextStyle(fontSize: 18, fontWeight: FontWeight.w700, color: AppColors.text),
    titleMedium:
        TextStyle(fontSize: 15, fontWeight: FontWeight.w600, color: AppColors.text),
    bodyLarge: TextStyle(fontSize: 14, color: AppColors.text),
    bodyMedium: TextStyle(fontSize: 13, color: AppColors.textMuted, height: 1.4),
    labelMedium: TextStyle(
        fontSize: 12, fontWeight: FontWeight.w700, color: AppColors.textMuted),
    labelSmall: TextStyle(
        fontSize: 11, fontWeight: FontWeight.w700, color: AppColors.textMuted),
  );

  return ThemeData(
    useMaterial3: true,
    brightness: Brightness.light,
    scaffoldBackgroundColor: AppColors.background,
    colorScheme: ColorScheme.fromSeed(
      seedColor: AppColors.brand,
      primary: AppColors.brand,
      onPrimary: Colors.white,
      surface: AppColors.surface,
      onSurface: AppColors.text,
    ),
    textTheme: textTheme,
    appBarTheme: const AppBarTheme(
      backgroundColor: AppColors.background,
      foregroundColor: AppColors.text,
      elevation: 0,
      scrolledUnderElevation: 0,
      surfaceTintColor: Colors.transparent,
      titleTextStyle: TextStyle(
        color: AppColors.text,
        fontSize: 17,
        fontWeight: FontWeight.w700,
      ),
      iconTheme: IconThemeData(color: AppColors.text),
    ),
    dividerTheme: const DividerThemeData(
      color: AppColors.border,
      thickness: 1,
      space: 1,
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: AppColors.surface,
      contentPadding: const EdgeInsets.all(AppSpacing.md),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(AppRadius.md),
        borderSide: const BorderSide(color: AppColors.borderStrong),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(AppRadius.md),
        borderSide: const BorderSide(color: AppColors.borderStrong),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(AppRadius.md),
        borderSide: const BorderSide(color: AppColors.brand, width: 1.5),
      ),
      hintStyle: const TextStyle(color: AppColors.textSubtle),
    ),
  );
}
