import 'dart:async';

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../models/models.dart';
import '../services/claude_service.dart';
import '../services/image_service.dart';
import '../services/storage_service.dart';
import '../theme/app_theme.dart';
import '../widgets/image_picker_button.dart';
import '../widgets/primary_button.dart';

const _loadingMessages = <String>[
  'Analyzing your photo...',
  'Identifying the problem...',
  'Researching the best fix...',
  'Building your step-by-step plan...',
  'Estimating tools and materials...',
  'Checking for safety concerns...',
  "Calculating how much you'll save...",
  'Almost there — putting it all together...',
];

class NewIssueScreen extends StatefulWidget {
  const NewIssueScreen({super.key});

  @override
  State<NewIssueScreen> createState() => _NewIssueScreenState();
}

class _NewIssueScreenState extends State<NewIssueScreen> {
  String? _imageUri;
  final _note = TextEditingController();
  bool _submitting = false;
  String? _error;
  int _loadingIndex = 0;
  Timer? _timer;

  @override
  void initState() {
    super.initState();
  }

  @override
  void dispose() {
    _timer?.cancel();
    _note.dispose();
    super.dispose();
  }

  void _startRotating() {
    _timer?.cancel();
    _timer = Timer.periodic(const Duration(seconds: 3), (_) {
      if (!mounted) return;
      setState(() =>
          _loadingIndex = (_loadingIndex + 1) % _loadingMessages.length);
    });
  }

  Future<void> _submit() async {
    final uri = _imageUri;
    if (uri == null || _submitting) return;
    setState(() {
      _submitting = true;
      _error = null;
      _loadingIndex = 0;
    });
    _startRotating();

    try {
      final userText = _note.text.trim().isEmpty
          ? "Here's what's broken. What should I do?"
          : _note.text.trim();
      final base64 = await ImageService.instance.readAsBase64(uri);
      final generated = await createRepairPlan(
        note: userText,
        imageBase64: base64,
      );

      final id = generateId();
      final now = DateTime.now().millisecondsSinceEpoch;
      final firstUser = ChatMessage(
        id: generateId(),
        role: MessageRole.user,
        text: userText,
        imageUri: uri,
        createdAt: now,
      );
      final assistant = ChatMessage(
        id: generateId(),
        role: MessageRole.assistant,
        text: generated.openingMessage.isNotEmpty
            ? generated.openingMessage
            : "I've put together a plan for this repair. Check the Plan tab and let me know if you have questions.",
        createdAt: DateTime.now().millisecondsSinceEpoch,
      );

      final issue = Issue(
        id: id,
        title: generated.title,
        summary: generated.summary,
        status: IssueStatus.inProgress,
        createdAt: now,
        updatedAt: DateTime.now().millisecondsSinceEpoch,
        coverImageUri: uri,
        plan: generated.plan,
        messages: [firstUser, assistant],
      );
      await StorageService.instance.upsertIssue(issue);
      if (!mounted) return;
      context.go('/issue/$id');
    } catch (e) {
      _timer?.cancel();
      if (!mounted) return;
      setState(() {
        _submitting = false;
        _error = e.toString();
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('New repair')),
      body: Stack(
        children: [
          ListView(
            padding: const EdgeInsets.all(AppSpacing.lg),
            children: [
              _card(
                '1. Show HandyBot what’s wrong',
                'Take a photo of the broken thing. Close-ups help.',
                child: ImagePickerButton(
                  value: _imageUri,
                  onChanged: (uri) => setState(() => _imageUri = uri),
                ),
              ),
              const SizedBox(height: AppSpacing.md),
              _card(
                '2. Add a quick note (optional)',
                "Anything you know about the problem — when it started, sounds, smells, what you've already tried.",
                child: TextField(
                  controller: _note,
                  maxLines: 4,
                  decoration: const InputDecoration(
                    hintText:
                        'e.g. My kitchen faucet started dripping last night...',
                  ),
                ),
              ),
              const SizedBox(height: AppSpacing.md),
              Container(
                padding: const EdgeInsets.all(AppSpacing.lg),
                decoration: BoxDecoration(
                  color: AppColors.brandLighter,
                  border: Border.all(color: const Color(0xFFFED7AA)),
                  borderRadius: BorderRadius.circular(AppRadius.lg),
                ),
                child: const Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      "WHAT YOU'LL GET",
                      style: TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w700,
                        color: AppColors.brandDark,
                        letterSpacing: 0.5,
                      ),
                    ),
                    SizedBox(height: 4),
                    Text(
                      "HandyBot will analyze your photo and build you a complete repair project: difficulty rating, time estimate, tools needed, materials list, and a step-by-step checklist you can tick off as you work.",
                      style: TextStyle(
                        fontSize: 13,
                        color: Color(0xFF7C2D12),
                        height: 1.45,
                      ),
                    ),
                  ],
                ),
              ),
              if (_error != null) ...[
                const SizedBox(height: AppSpacing.md),
                Container(
                  padding: const EdgeInsets.all(AppSpacing.md),
                  decoration: BoxDecoration(
                    color: AppColors.dangerBg,
                    border: Border.all(color: const Color(0xFFFECACA)),
                    borderRadius: BorderRadius.circular(AppRadius.md),
                  ),
                  child: Text(
                    _error!,
                    style: const TextStyle(
                        color: AppColors.danger, fontSize: 13),
                  ),
                ),
              ],
              const SizedBox(height: AppSpacing.md),
              PrimaryButton(
                title:
                    _submitting ? 'Building your plan...' : 'Generate repair plan',
                loading: _submitting,
                onPressed: _imageUri == null ? null : _submit,
              ),
              TextButton(
                onPressed: () => context.push('/manual-repair'),
                child: const Text('Create manual entry'),
              ),
              const SizedBox(height: AppSpacing.xl),
            ],
          ),
          if (_submitting)
            Container(
              color: Colors.black54,
              child: Center(
                child: Container(
                  margin: const EdgeInsets.symmetric(horizontal: AppSpacing.xl),
                  padding: const EdgeInsets.all(AppSpacing.xl),
                  decoration: BoxDecoration(
                    color: AppColors.surface,
                    borderRadius: BorderRadius.circular(AppRadius.xl),
                  ),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const CircularProgressIndicator(color: AppColors.brand),
                      const SizedBox(height: AppSpacing.md),
                      Text(
                        _loadingMessages[_loadingIndex],
                        textAlign: TextAlign.center,
                        style: const TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w700,
                          color: AppColors.text,
                        ),
                      ),
                      const SizedBox(height: AppSpacing.sm),
                      const Text(
                        'This usually takes 10–20 seconds',
                        style: TextStyle(
                          fontSize: 12,
                          color: AppColors.textSubtle,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }

  Widget _card(String title, String help, {required Widget child}) {
    return Container(
      padding: const EdgeInsets.all(AppSpacing.lg),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(AppRadius.lg),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(title, style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 4),
          Text(help, style: const TextStyle(fontSize: 13, color: AppColors.textMuted)),
          const SizedBox(height: AppSpacing.md),
          child,
        ],
      ),
    );
  }
}
