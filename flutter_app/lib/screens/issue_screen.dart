import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../models/models.dart';
import '../services/claude_service.dart';
import '../services/image_service.dart';
import '../services/reminders_service.dart';
import '../services/storage_service.dart';
import '../theme/app_theme.dart';
import '../widgets/image_picker_button.dart';
import '../widgets/interactive_stepper.dart';
import '../widgets/message_bubble.dart';
import '../widgets/plan_proposal_card.dart';
import '../widgets/plan_view.dart';
import '../widgets/primary_button.dart';
import '../widgets/segmented_tabs.dart';
import '../widgets/step_help_modal.dart';
import '../widgets/suggested_reminders_card.dart';
import '../widgets/typing_indicator.dart';

class IssueScreen extends StatefulWidget {
  final String issueId;
  const IssueScreen({super.key, required this.issueId});

  @override
  State<IssueScreen> createState() => _IssueScreenState();
}

class _IssueScreenState extends State<IssueScreen> {
  Issue? _issue;
  int _tab = 0; // 0 = plan, 1 = chat
  String? _composerImage;
  final _composer = TextEditingController();
  bool _sending = false;
  bool _verifying = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _composer.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    final issue = await StorageService.instance.getIssue(widget.issueId);
    if (!mounted) return;
    setState(() => _issue = issue);
  }

  Future<void> _save(Issue updated) async {
    await StorageService.instance
        .upsertIssue(updated.copyWith(updatedAt: DateTime.now().millisecondsSinceEpoch));
    if (!mounted) return;
    setState(() => _issue = updated);
  }

  void _toggleTool(String id) {
    final issue = _issue!;
    final tools = issue.plan.tools
        .map((t) => t.id == id ? t.copyWith(have: !t.have) : t)
        .toList();
    _save(issue.copyWith(plan: issue.plan.copyWith(tools: tools)));
  }

  void _toggleMaterial(String id) {
    final issue = _issue!;
    final materials = issue.plan.materials
        .map((m) => m.id == id ? m.copyWith(have: !m.have) : m)
        .toList();
    _save(issue.copyWith(plan: issue.plan.copyWith(materials: materials)));
  }

  void _toggleStep(String id, bool completed) {
    final issue = _issue!;
    final steps = issue.plan.steps
        .map((s) => s.id == id ? s.copyWith(completed: completed) : s)
        .toList();
    final allDone = steps.every((s) => s.completed);
    _save(issue.copyWith(
      plan: issue.plan.copyWith(steps: steps),
      status: allDone ? IssueStatus.completed : IssueStatus.inProgress,
    ));
  }

  Future<void> _askAboutStep(PlanStep step) async {
    final stepMsgs = _issue!.messages
        .where((m) => m.relatedStepId == step.id)
        .toList();
    final updated = await showStepHelpModal(
      context: context,
      issue: _issue!,
      step: step,
      existingStepMessages: stepMsgs,
    );
    final existingOther = _issue!.messages
        .where((m) => m.relatedStepId != step.id)
        .toList();
    _save(_issue!.copyWith(messages: [...existingOther, ...updated]));
  }

  Future<void> _sendMessage() async {
    final text = _composer.text.trim();
    final img = _composerImage;
    if ((text.isEmpty && img == null) || _sending) return;
    _composer.clear();
    final userMsg = ChatMessage(
      id: generateId(),
      role: MessageRole.user,
      text: text,
      imageUri: img,
      createdAt: DateTime.now().millisecondsSinceEpoch,
    );
    final issue = _issue!.copyWith(messages: [..._issue!.messages, userMsg]);
    setState(() {
      _issue = issue;
      _sending = true;
      _composerImage = null;
    });
    await StorageService.instance.upsertIssue(issue);
    try {
      final req = <ChatRequestMessage>[];
      for (final m in issue.messages) {
        if (m.relatedStepId != null) continue;
        String? b64;
        if (m.imageUri != null && m.role == MessageRole.user) {
          try {
            b64 = await ImageService.instance.readAsBase64(m.imageUri!);
          } catch (_) {}
        }
        req.add(ChatRequestMessage(
          role: m.role,
          text: m.text,
          imageBase64: b64,
        ));
      }
      final reply = await sendProjectChat(issue, req);
      final assistant = ChatMessage(
        id: generateId(),
        role: MessageRole.assistant,
        text: reply.text,
        createdAt: DateTime.now().millisecondsSinceEpoch,
        proposal: reply.proposal,
      );
      final withReply = issue.copyWith(
        messages: [...issue.messages, assistant],
      );
      await _save(withReply);
      if (!mounted) return;
      setState(() => _sending = false);
    } catch (e) {
      if (!mounted) return;
      setState(() => _sending = false);
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(e.toString())));
    }
  }

  Future<void> _acceptProposal(ChatMessage msg) async {
    final prop = msg.proposal;
    if (prop == null) return;
    final newPlan = applyProposalToPlan(_issue!.plan, prop);
    final updatedMessages = _issue!.messages
        .map((m) => m.id == msg.id
            ? m.copyWith(proposal: prop.copyWith(status: ProposalStatus.accepted))
            : m)
        .toList();
    await _save(_issue!.copyWith(plan: newPlan, messages: updatedMessages));
  }

  Future<void> _dismissProposal(ChatMessage msg) async {
    final prop = msg.proposal;
    if (prop == null) return;
    final updatedMessages = _issue!.messages
        .map((m) => m.id == msg.id
            ? m.copyWith(
                proposal: prop.copyWith(status: ProposalStatus.dismissed),
              )
            : m)
        .toList();
    await _save(_issue!.copyWith(messages: updatedMessages));
  }

  Future<void> _verifyWithPhoto() async {
    if (_verifying) return;
    final img = await ImageService.instance
        .pickAndProcess(ImageSourceKind.library);
    if (img == null) return;
    setState(() => _verifying = true);
    try {
      final base64 = await ImageService.instance.readAsBase64(img.uri);
      final result = await verifyRepair(
        issue: _issue!,
        imageBase64: base64,
      );
      final newPlan = applyVerificationResult(
        _issue!.plan,
        result,
        photoUri: img.uri,
      );
      final next = _issue!.copyWith(
        plan: newPlan,
        status: result.verified ? IssueStatus.verified : _issue!.status,
      );
      await _save(next);
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(e.toString())));
    } finally {
      if (mounted) setState(() => _verifying = false);
    }
  }

  Future<void> _enableSuggestedReminder(SuggestedReminder s) async {
    await RemindersService.instance.createFromSuggestion(
      suggestion: s,
      startDate:
          DateTime.now().add(Duration(days: s.frequencyDays)),
      sourceIssueId: _issue!.id,
    );
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text('${s.icon}  "${s.title}" reminder scheduled')),
    );
  }

  @override
  Widget build(BuildContext context) {
    final issue = _issue;
    if (issue == null) {
      return Scaffold(
        appBar: AppBar(title: const Text('Repair')),
        body: const Center(child: CircularProgressIndicator()),
      );
    }
    return Scaffold(
      appBar: AppBar(
        title: Text(
          issue.title,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
        ),
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.symmetric(
                horizontal: AppSpacing.lg, vertical: AppSpacing.sm),
            child: SegmentedTabs(
              options: const ['Plan', 'Chat'],
              selectedIndex: _tab,
              onSelect: (i) => setState(() => _tab = i),
            ),
          ),
          Expanded(
            child: _tab == 0 ? _planTab(issue) : _chatTab(issue),
          ),
          if (_tab == 1) _composerBar(),
        ],
      ),
    );
  }

  Widget _planTab(Issue issue) {
    final hasSteps = issue.plan.steps.isNotEmpty;
    final suggested = issue.plan.suggestedReminders ?? const [];
    final completedAll = issue.plan.steps.isNotEmpty &&
        issue.plan.steps.every((s) => s.completed);
    return ListView(
      padding: const EdgeInsets.all(AppSpacing.lg),
      children: [
        if (hasSteps) ...[
          InteractiveStepper(
            steps: issue.plan.steps,
            onToggleStep: _toggleStep,
            onAskAboutStep: _askAboutStep,
          ),
          const SizedBox(height: AppSpacing.md),
        ],
        PlanView(
          plan: issue.plan,
          onToggleTool: _toggleTool,
          onToggleMaterial: _toggleMaterial,
        ),
        if (completedAll && issue.plan.verificationResult == null) ...[
          const SizedBox(height: AppSpacing.md),
          PrimaryButton(
            title: _verifying ? 'Verifying…' : '📸 Verify with photo',
            loading: _verifying,
            onPressed: _verifyWithPhoto,
          ),
        ],
        if (suggested.isNotEmpty) ...[
          const SizedBox(height: AppSpacing.md),
          SuggestedRemindersCard(
            suggestions: suggested,
            onEnable: _enableSuggestedReminder,
          ),
        ],
        const SizedBox(height: AppSpacing.xl),
      ],
    );
  }

  Widget _chatTab(Issue issue) {
    final threadMsgs =
        issue.messages.where((m) => m.relatedStepId == null).toList();
    return ListView(
      padding: const EdgeInsets.all(AppSpacing.lg),
      children: [
        for (final m in threadMsgs) ...[
          MessageBubble(role: m.role, text: m.text, imageUri: m.imageUri),
          if (m.proposal != null) ...[
            const SizedBox(height: AppSpacing.sm),
            PlanProposalCard(
              proposal: m.proposal!,
              onAccept: () => _acceptProposal(m),
              onDismiss: () => _dismissProposal(m),
            ),
          ],
        ],
        if (_sending)
          const Align(
            alignment: Alignment.centerLeft,
            child: TypingIndicator(),
          ),
      ],
    );
  }

  Widget _composerBar() {
    return SafeArea(
      top: false,
      child: Container(
        padding: const EdgeInsets.all(AppSpacing.sm),
        decoration: const BoxDecoration(
          color: AppColors.surface,
          border: Border(top: BorderSide(color: AppColors.border)),
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            IconButton(
              icon: const Icon(Icons.add_a_photo_outlined),
              onPressed: () async {
                final img = await ImageService.instance
                    .pickAndProcess(ImageSourceKind.library);
                if (img != null) setState(() => _composerImage = img.uri);
              },
            ),
            Expanded(
              child: TextField(
                controller: _composer,
                maxLines: null,
                decoration: InputDecoration(
                  hintText: _composerImage == null
                      ? 'Message…'
                      : '[Photo attached] Add a note',
                ),
                onSubmitted: (_) => _sendMessage(),
              ),
            ),
            const SizedBox(width: 8),
            IconButton.filled(
              style: IconButton.styleFrom(backgroundColor: AppColors.brand),
              icon: const Icon(Icons.send, color: Colors.white),
              onPressed: _sending ? null : _sendMessage,
            ),
          ],
        ),
      ),
    );
  }
}
