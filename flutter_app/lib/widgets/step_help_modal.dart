import 'package:flutter/material.dart';

import '../models/models.dart';
import '../services/claude_service.dart';
import '../theme/app_theme.dart';
import 'message_bubble.dart';
import 'typing_indicator.dart';

/// Shows a bottom-sheet modal for asking about a specific step.
Future<List<ChatMessage>> showStepHelpModal({
  required BuildContext context,
  required Issue issue,
  required PlanStep step,
  required List<ChatMessage> existingStepMessages,
}) async {
  final messages = List<ChatMessage>.from(existingStepMessages);

  await showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    builder: (ctx) {
      return Padding(
        padding:
            EdgeInsets.only(bottom: MediaQuery.of(ctx).viewInsets.bottom),
        child: _StepHelpSheet(
          issue: issue,
          step: step,
          seed: messages,
          onMessagesChanged: (updated) {
            messages
              ..clear()
              ..addAll(updated);
          },
        ),
      );
    },
  );

  return messages;
}

class _StepHelpSheet extends StatefulWidget {
  final Issue issue;
  final PlanStep step;
  final List<ChatMessage> seed;
  final ValueChanged<List<ChatMessage>> onMessagesChanged;

  const _StepHelpSheet({
    required this.issue,
    required this.step,
    required this.seed,
    required this.onMessagesChanged,
  });

  @override
  State<_StepHelpSheet> createState() => _StepHelpSheetState();
}

class _StepHelpSheetState extends State<_StepHelpSheet> {
  final _input = TextEditingController();
  late List<ChatMessage> _messages;
  bool _sending = false;

  @override
  void initState() {
    super.initState();
    _messages = List.of(widget.seed);
  }

  @override
  void dispose() {
    _input.dispose();
    super.dispose();
  }

  Future<void> _send() async {
    final text = _input.text.trim();
    if (text.isEmpty || _sending) return;
    _input.clear();
    final userMsg = ChatMessage(
      id: generateId(),
      role: MessageRole.user,
      text: text,
      createdAt: DateTime.now().millisecondsSinceEpoch,
      relatedStepId: widget.step.id,
    );
    setState(() {
      _messages.add(userMsg);
      _sending = true;
    });
    widget.onMessagesChanged(_messages);

    try {
      final req = _messages
          .where((m) =>
              m.relatedStepId == widget.step.id && m.text.trim().isNotEmpty)
          .map((m) => ChatRequestMessage(role: m.role, text: m.text))
          .toList();
      final reply = await sendProjectChat(widget.issue, req);
      final assistantMsg = ChatMessage(
        id: generateId(),
        role: MessageRole.assistant,
        text: reply.text,
        createdAt: DateTime.now().millisecondsSinceEpoch,
        relatedStepId: widget.step.id,
      );
      setState(() {
        _messages.add(assistantMsg);
        _sending = false;
      });
      widget.onMessagesChanged(_messages);
    } catch (e) {
      setState(() => _sending = false);
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(e.toString())));
    }
  }

  @override
  Widget build(BuildContext context) {
    final stepMsgs = _messages
        .where((m) => m.relatedStepId == widget.step.id)
        .toList();
    return Container(
      constraints: BoxConstraints(
        maxHeight: MediaQuery.of(context).size.height * 0.85,
      ),
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: const BoxDecoration(
        color: AppColors.surface,
        borderRadius:
            BorderRadius.vertical(top: Radius.circular(AppRadius.xl)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  'Step help · ${widget.step.title}',
                  style: const TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w700,
                    color: AppColors.text,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              IconButton(
                onPressed: () => Navigator.pop(context),
                icon: const Icon(Icons.close),
              ),
            ],
          ),
          const Divider(),
          Flexible(
            child: ListView(
              children: [
                for (final m in stepMsgs)
                  MessageBubble(
                    role: m.role,
                    text: m.text,
                    imageUri: m.imageUri,
                  ),
                if (_sending)
                  const Align(
                    alignment: Alignment.centerLeft,
                    child: TypingIndicator(),
                  ),
              ],
            ),
          ),
          const SizedBox(height: AppSpacing.sm),
          Row(
            children: [
              Expanded(
                child: TextField(
                  controller: _input,
                  maxLines: null,
                  decoration: const InputDecoration(
                    hintText: 'Ask about this step…',
                  ),
                  onSubmitted: (_) => _send(),
                ),
              ),
              const SizedBox(width: AppSpacing.sm),
              IconButton.filled(
                onPressed: _sending ? null : _send,
                style: IconButton.styleFrom(backgroundColor: AppColors.brand),
                icon: const Icon(Icons.send, color: Colors.white),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
