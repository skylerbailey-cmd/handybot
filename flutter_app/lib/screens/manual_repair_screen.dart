import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../models/models.dart';
import '../services/claude_service.dart';
import '../services/image_service.dart';
import '../services/storage_service.dart';
import '../theme/app_theme.dart';
import '../widgets/image_picker_button.dart';
import '../widgets/primary_button.dart';

class ManualRepairScreen extends StatefulWidget {
  const ManualRepairScreen({super.key});

  @override
  State<ManualRepairScreen> createState() => _ManualRepairScreenState();
}

class _ManualRepairScreenState extends State<ManualRepairScreen> {
  final _title = TextEditingController();
  final _desc = TextEditingController();
  String? _before;
  String? _after;
  bool _saving = false;

  @override
  void dispose() {
    _title.dispose();
    _desc.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    final title = _title.text.trim();
    if (title.isEmpty || _before == null || _after == null || _saving) return;
    setState(() => _saving = true);
    try {
      String feedback = '';
      bool verified = false;
      try {
        final beforeB64 = await ImageService.instance.readAsBase64(_before!);
        final afterB64 = await ImageService.instance.readAsBase64(_after!);
        final result = await verifyManualRepair(
          title: title,
          description: _desc.text.trim(),
          beforeImageBase64: beforeB64,
          afterImageBase64: afterB64,
        );
        verified = result.verified;
        feedback = result.feedback;
      } catch (_) {/* keep going even if verify fails */}

      final id = generateId();
      final now = DateTime.now().millisecondsSinceEpoch;
      final issue = Issue(
        id: id,
        title: title,
        summary: _desc.text.trim(),
        status: verified ? IssueStatus.verified : IssueStatus.completed,
        createdAt: now,
        updatedAt: now,
        coverImageUri: _after,
        plan: RepairPlan(
          difficulty: Difficulty.medium,
          estimatedMinutes: 0,
          estimatedSavingsUsd: 0,
          tools: const [],
          materials: const [],
          steps: const [],
          safetyNotes: const [],
          verificationResult: feedback.isEmpty
              ? null
              : VerificationResult(
                  verified: verified,
                  feedback: feedback,
                  verifiedAt: DateTime.now().millisecondsSinceEpoch,
                  photoUri: _after,
                ),
        ),
        messages: [
          ChatMessage(
            id: generateId(),
            role: MessageRole.user,
            text:
                'Logged a manual repair. Before and after photos attached.${_desc.text.trim().isNotEmpty ? '\n\n${_desc.text.trim()}' : ''}',
            imageUri: _before,
            createdAt: now,
          ),
        ],
      );
      await StorageService.instance.upsertIssue(issue);
      if (!mounted) return;
      context.go('/issue/$id');
    } catch (e) {
      if (!mounted) return;
      setState(() => _saving = false);
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(e.toString())));
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Log a Repair')),
      body: ListView(
        padding: const EdgeInsets.all(AppSpacing.lg),
        children: [
          TextField(
            controller: _title,
            decoration: const InputDecoration(labelText: 'Title'),
          ),
          const SizedBox(height: AppSpacing.md),
          TextField(
            controller: _desc,
            maxLines: 3,
            decoration:
                const InputDecoration(labelText: 'What did you fix? (optional)'),
          ),
          const SizedBox(height: AppSpacing.md),
          const Text(
            'BEFORE',
            style: TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w800,
              color: AppColors.textMuted,
              letterSpacing: 0.6,
            ),
          ),
          const SizedBox(height: 4),
          ImagePickerButton(
            value: _before,
            onChanged: (uri) => setState(() => _before = uri),
            label: 'Before photo',
          ),
          const SizedBox(height: AppSpacing.md),
          const Text(
            'AFTER',
            style: TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w800,
              color: AppColors.textMuted,
              letterSpacing: 0.6,
            ),
          ),
          const SizedBox(height: 4),
          ImagePickerButton(
            value: _after,
            onChanged: (uri) => setState(() => _after = uri),
            label: 'After photo',
          ),
          const SizedBox(height: AppSpacing.lg),
          PrimaryButton(
            title: _saving ? 'Saving…' : 'Log repair',
            loading: _saving,
            onPressed: _title.text.trim().isEmpty ||
                    _before == null ||
                    _after == null
                ? null
                : _save,
          ),
        ],
      ),
    );
  }
}
