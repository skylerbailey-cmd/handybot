import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../services/reminder_templates.dart';
import '../services/reminders_service.dart';
import '../widgets/reminder_form.dart';

class NewReminderScreen extends StatelessWidget {
  final String? templateId;
  const NewReminderScreen({super.key, this.templateId});

  @override
  Widget build(BuildContext context) {
    final template = templateId == null
        ? null
        : maintenanceTemplates.where((t) => t.id == templateId).firstOrNull;

    return Scaffold(
      appBar: AppBar(title: const Text('New reminder')),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: ReminderForm(
          initialTitle: template?.title,
          initialDescription: template?.description,
          initialIcon: template?.icon,
          initialFrequencyDays: template?.frequencyDays ?? 90,
          initialNextDue:
              DateTime.now().add(Duration(days: template?.frequencyDays ?? 1)),
          submitLabel: 'Create reminder',
          onSubmit: ({
            required String title,
            required String description,
            required String icon,
            required int frequencyDays,
            required DateTime nextDue,
          }) async {
            if (template != null) {
              await RemindersService.instance
                  .createFromTemplate(template, nextDue);
            } else {
              await RemindersService.instance.createCustom(
                title: title,
                description: description,
                icon: icon,
                frequencyDays: frequencyDays,
                startDate: nextDue,
              );
            }
            if (context.mounted) context.pop();
          },
        ),
      ),
    );
  }
}

extension<T> on Iterable<T> {
  T? get firstOrNull => isEmpty ? null : first;
}
