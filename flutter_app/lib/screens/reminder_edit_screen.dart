import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../models/models.dart';
import '../services/reminders_service.dart';
import '../widgets/reminder_form.dart';

class ReminderEditScreen extends StatefulWidget {
  final String reminderId;
  const ReminderEditScreen({super.key, required this.reminderId});

  @override
  State<ReminderEditScreen> createState() => _ReminderEditScreenState();
}

class _ReminderEditScreenState extends State<ReminderEditScreen> {
  Reminder? _reminder;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final r = await RemindersService.instance.get(widget.reminderId);
    if (!mounted) return;
    setState(() => _reminder = r);
  }

  @override
  Widget build(BuildContext context) {
    final r = _reminder;
    return Scaffold(
      appBar: AppBar(
        title: const Text('Edit reminder'),
        actions: [
          if (r != null)
            IconButton(
              icon: const Icon(Icons.delete_outline),
              onPressed: () async {
                final confirmed = await showDialog<bool>(
                  context: context,
                  builder: (ctx) => AlertDialog(
                    title: Text('Delete "${r.title}"?'),
                    actions: [
                      TextButton(
                        onPressed: () => Navigator.pop(ctx, false),
                        child: const Text('Cancel'),
                      ),
                      FilledButton.tonal(
                        onPressed: () => Navigator.pop(ctx, true),
                        child: const Text('Delete'),
                      ),
                    ],
                  ),
                );
                if (confirmed == true) {
                  await RemindersService.instance.delete(r.id);
                  if (context.mounted) context.pop();
                }
              },
            ),
        ],
      ),
      body: r == null
          ? const Center(child: CircularProgressIndicator())
          : SingleChildScrollView(
              padding: const EdgeInsets.all(16),
              child: ReminderForm(
                initialTitle: r.title,
                initialDescription: r.description,
                initialIcon: r.icon,
                initialFrequencyDays: r.frequencyDays,
                initialNextDue:
                    DateTime.fromMillisecondsSinceEpoch(r.nextDue),
                submitLabel: 'Save',
                onSubmit: ({
                  required String title,
                  required String description,
                  required String icon,
                  required int frequencyDays,
                  required DateTime nextDue,
                }) async {
                  await RemindersService.instance.update(
                    reminderId: r.id,
                    title: title,
                    description: description,
                    icon: icon,
                    frequencyDays: frequencyDays,
                    nextDue: nextDue.millisecondsSinceEpoch,
                  );
                  if (context.mounted) context.pop();
                },
              ),
            ),
    );
  }
}
