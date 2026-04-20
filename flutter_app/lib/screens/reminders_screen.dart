import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../models/models.dart';
import '../services/reminder_templates.dart';
import '../services/reminders_service.dart';
import '../theme/app_theme.dart';
import '../widgets/reminder_row.dart';
import '../widgets/template_row.dart';

class RemindersScreen extends StatefulWidget {
  final String? highlight;
  const RemindersScreen({super.key, this.highlight});

  @override
  State<RemindersScreen> createState() => _RemindersScreenState();
}

class _RemindersScreenState extends State<RemindersScreen> {
  List<Reminder> _reminders = [];

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final list = await RemindersService.instance.loadReminders();
    if (!mounted) return;
    setState(() => _reminders = list);
  }

  Future<void> _toggle(Reminder r, bool enabled) async {
    await RemindersService.instance.setEnabled(r.id, enabled);
    _load();
  }

  Future<void> _markDone(Reminder r) async {
    await RemindersService.instance.markDone(r.id);
    _load();
  }

  List<(String label, List<Reminder> items)> _grouped() {
    final now = DateTime.now().millisecondsSinceEpoch;
    final day = 24 * 60 * 60 * 1000;
    final overdue = <Reminder>[];
    final dueThisWeek = <Reminder>[];
    final dueThisMonth = <Reminder>[];
    final later = <Reminder>[];
    final disabled = <Reminder>[];

    for (final r in _reminders) {
      if (!r.enabled) {
        disabled.add(r);
        continue;
      }
      final diff = r.nextDue - now;
      if (diff < 0) {
        overdue.add(r);
      } else if (diff <= 7 * day) {
        dueThisWeek.add(r);
      } else if (diff <= 30 * day) {
        dueThisMonth.add(r);
      } else {
        later.add(r);
      }
    }
    return [
      if (overdue.isNotEmpty) ('Overdue', overdue),
      if (dueThisWeek.isNotEmpty) ('This week', dueThisWeek),
      if (dueThisMonth.isNotEmpty) ('This month', dueThisMonth),
      if (later.isNotEmpty) ('Later', later),
      if (disabled.isNotEmpty) ('Off', disabled),
    ];
  }

  @override
  Widget build(BuildContext context) {
    final groups = _grouped();
    return Scaffold(
      appBar: AppBar(title: const Text('Reminders')),
      floatingActionButton: FloatingActionButton.extended(
        backgroundColor: AppColors.brand,
        onPressed: () async {
          await context.push('/reminder/new');
          _load();
        },
        icon: const Icon(Icons.add, color: Colors.white),
        label: const Text('New', style: TextStyle(color: Colors.white)),
      ),
      body: RefreshIndicator(
        onRefresh: _load,
        child: ListView(
          padding: const EdgeInsets.all(AppSpacing.lg),
          children: [
            for (final (label, items) in groups) ...[
              Padding(
                padding:
                    const EdgeInsets.symmetric(vertical: AppSpacing.sm),
                child: Text(
                  label.toUpperCase(),
                  style: const TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w800,
                    color: AppColors.textMuted,
                    letterSpacing: 0.6,
                  ),
                ),
              ),
              for (final r in items) ...[
                ReminderRow(
                  reminder: r,
                  highlighted: r.id == widget.highlight,
                  onTap: () async {
                    await context.push('/reminder/${r.id}');
                    _load();
                  },
                  onEnabledChanged: (v) => _toggle(r, v),
                  onMarkDone: r.enabled ? () => _markDone(r) : null,
                ),
                const SizedBox(height: AppSpacing.sm),
              ],
            ],
            const SizedBox(height: AppSpacing.lg),
            const Text(
              'TEMPLATES',
              style: TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w800,
                color: AppColors.textMuted,
                letterSpacing: 0.6,
              ),
            ),
            const SizedBox(height: AppSpacing.sm),
            for (final tpl in maintenanceTemplates) ...[
              TemplateRow(
                template: tpl,
                onTap: () async {
                  await context.push('/reminder/new?templateId=${tpl.id}');
                  _load();
                },
              ),
              const SizedBox(height: AppSpacing.sm),
            ],
            const SizedBox(height: 80),
          ],
        ),
      ),
    );
  }
}
