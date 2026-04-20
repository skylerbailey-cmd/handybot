import 'package:flutter/material.dart';

import '../services/reminders_service.dart';
import '../theme/app_theme.dart';

/// Editable reminder form: title, icon, frequency, next due. Used by
/// new_reminder_screen and reminder_edit_screen.
class ReminderForm extends StatefulWidget {
  final String? initialTitle;
  final String? initialDescription;
  final String? initialIcon;
  final int? initialFrequencyDays;
  final DateTime? initialNextDue;
  final void Function({
    required String title,
    required String description,
    required String icon,
    required int frequencyDays,
    required DateTime nextDue,
  }) onSubmit;
  final String submitLabel;

  const ReminderForm({
    super.key,
    this.initialTitle,
    this.initialDescription,
    this.initialIcon,
    this.initialFrequencyDays,
    this.initialNextDue,
    required this.onSubmit,
    this.submitLabel = 'Save',
  });

  @override
  State<ReminderForm> createState() => _ReminderFormState();
}

class _ReminderFormState extends State<ReminderForm> {
  late final TextEditingController _title;
  late final TextEditingController _desc;
  late final TextEditingController _icon;
  int _frequencyDays = 90;
  late DateTime _nextDue;

  static const _freqOptions = <int>[7, 14, 30, 90, 180, 365];

  @override
  void initState() {
    super.initState();
    _title = TextEditingController(text: widget.initialTitle ?? '');
    _desc = TextEditingController(text: widget.initialDescription ?? '');
    _icon = TextEditingController(text: widget.initialIcon ?? '🛠');
    _frequencyDays = widget.initialFrequencyDays ?? 90;
    _nextDue = widget.initialNextDue ?? DateTime.now();
  }

  @override
  void dispose() {
    _title.dispose();
    _desc.dispose();
    _icon.dispose();
    super.dispose();
  }

  Future<void> _pickDate() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: _nextDue,
      firstDate: DateTime.now().subtract(const Duration(days: 1)),
      lastDate: DateTime.now().add(const Duration(days: 365 * 5)),
    );
    if (picked != null) setState(() => _nextDue = picked);
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          children: [
            SizedBox(
              width: 60,
              child: TextField(
                controller: _icon,
                textAlign: TextAlign.center,
                style: const TextStyle(fontSize: 24),
                decoration: const InputDecoration(hintText: '🛠'),
              ),
            ),
            const SizedBox(width: AppSpacing.sm),
            Expanded(
              child: TextField(
                controller: _title,
                decoration: const InputDecoration(labelText: 'Title'),
              ),
            ),
          ],
        ),
        const SizedBox(height: AppSpacing.md),
        TextField(
          controller: _desc,
          maxLines: 3,
          decoration: const InputDecoration(labelText: 'Description (optional)'),
        ),
        const SizedBox(height: AppSpacing.md),
        const Text(
          'FREQUENCY',
          style: TextStyle(
            fontSize: 11,
            fontWeight: FontWeight.w800,
            color: AppColors.textMuted,
            letterSpacing: 0.6,
          ),
        ),
        const SizedBox(height: 6),
        Wrap(
          spacing: 6,
          runSpacing: 6,
          children: _freqOptions.map((d) {
            final active = d == _frequencyDays;
            return GestureDetector(
              onTap: () => setState(() => _frequencyDays = d),
              child: Container(
                padding: const EdgeInsets.symmetric(
                    horizontal: 12, vertical: 6),
                decoration: BoxDecoration(
                  color: active ? AppColors.brand : AppColors.chipBg,
                  borderRadius: BorderRadius.circular(AppRadius.pill),
                ),
                child: Text(
                  formatFrequency(d),
                  style: TextStyle(
                    color: active ? Colors.white : AppColors.textMuted,
                    fontSize: 12,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
            );
          }).toList(),
        ),
        const SizedBox(height: AppSpacing.md),
        const Text(
          'NEXT DUE',
          style: TextStyle(
            fontSize: 11,
            fontWeight: FontWeight.w800,
            color: AppColors.textMuted,
            letterSpacing: 0.6,
          ),
        ),
        const SizedBox(height: 6),
        OutlinedButton.icon(
          onPressed: _pickDate,
          icon: const Icon(Icons.calendar_today, size: 16),
          label: Text(
            '${_nextDue.year}-${_nextDue.month.toString().padLeft(2, '0')}-${_nextDue.day.toString().padLeft(2, '0')}',
          ),
        ),
        const SizedBox(height: AppSpacing.lg),
        FilledButton(
          style: FilledButton.styleFrom(
            backgroundColor: AppColors.brand,
            minimumSize: const Size.fromHeight(52),
          ),
          onPressed: () {
            if (_title.text.trim().isEmpty) return;
            widget.onSubmit(
              title: _title.text.trim(),
              description: _desc.text.trim(),
              icon: _icon.text.trim().isEmpty ? '🛠' : _icon.text.trim(),
              frequencyDays: _frequencyDays,
              nextDue: _nextDue,
            );
          },
          child: Text(widget.submitLabel),
        ),
      ],
    );
  }
}
