import 'package:flutter/material.dart';

import '../models/models.dart';
import '../services/claude_service.dart';
import '../services/home_data_service.dart';
import '../services/image_service.dart';
import '../theme/app_theme.dart';
import '../widgets/message_bubble.dart';
import '../widgets/typing_indicator.dart';

class AskScreen extends StatefulWidget {
  const AskScreen({super.key});

  @override
  State<AskScreen> createState() => _AskScreenState();
}

class _AskScreenState extends State<AskScreen> {
  List<AskMessage> _messages = [];
  final _input = TextEditingController();
  String? _pendingImage;
  bool _sending = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _input.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    final list = await HomeDataService.instance.loadAskMessages();
    if (!mounted) return;
    setState(() => _messages = list);
  }

  Future<void> _send() async {
    final text = _input.text.trim();
    final img = _pendingImage;
    if ((text.isEmpty && img == null) || _sending) return;
    _input.clear();
    final user = AskMessage(
      id: generateId(),
      role: MessageRole.user,
      text: text,
      imageUri: img,
      createdAt: DateTime.now().millisecondsSinceEpoch,
    );
    setState(() {
      _messages = [..._messages, user];
      _sending = true;
      _pendingImage = null;
    });
    await HomeDataService.instance.saveAskMessages(_messages);

    try {
      final req = <ChatRequestMessage>[];
      for (final m in _messages) {
        String? b64;
        if (m.imageUri != null && m.role == MessageRole.user) {
          try {
            b64 = await ImageService.instance.readAsBase64(m.imageUri!);
          } catch (_) {}
        }
        req.add(
            ChatRequestMessage(role: m.role, text: m.text, imageBase64: b64));
      }
      final text = await askHandyBot(req);
      final assistant = AskMessage(
        id: generateId(),
        role: MessageRole.assistant,
        text: text,
        createdAt: DateTime.now().millisecondsSinceEpoch,
      );
      final updated = [..._messages, assistant];
      await HomeDataService.instance.saveAskMessages(updated);
      if (!mounted) return;
      setState(() {
        _messages = updated;
        _sending = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() => _sending = false);
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(e.toString())));
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Ask HandyBot'),
        actions: [
          if (_messages.isNotEmpty)
            IconButton(
              tooltip: 'Clear chat',
              icon: const Icon(Icons.delete_outline),
              onPressed: () async {
                await HomeDataService.instance.clearAskMessages();
                setState(() => _messages = []);
              },
            ),
        ],
      ),
      body: Column(
        children: [
          Expanded(
            child: _messages.isEmpty
                ? _emptyHint()
                : ListView(
                    padding: const EdgeInsets.all(AppSpacing.lg),
                    children: [
                      for (final m in _messages)
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
          SafeArea(
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
                      if (img != null) {
                        setState(() => _pendingImage = img.uri);
                      }
                    },
                  ),
                  Expanded(
                    child: TextField(
                      controller: _input,
                      maxLines: null,
                      decoration: InputDecoration(
                        hintText: _pendingImage == null
                            ? 'Ask anything about your home…'
                            : '[Photo attached] Add a question',
                      ),
                      onSubmitted: (_) => _send(),
                    ),
                  ),
                  const SizedBox(width: 8),
                  IconButton.filled(
                    style: IconButton.styleFrom(backgroundColor: AppColors.brand),
                    icon: const Icon(Icons.send, color: Colors.white),
                    onPressed: _sending ? null : _send,
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _emptyHint() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.xl),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: const [
            Text('💬', style: TextStyle(fontSize: 42)),
            SizedBox(height: 8),
            Text(
              'Ask HandyBot anything',
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.w700,
                color: AppColors.text,
              ),
            ),
            SizedBox(height: 6),
            Text(
              "Weird noises, maintenance questions, product recommendations — snap a photo or just describe what's going on.",
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 13, color: AppColors.textMuted),
            ),
          ],
        ),
      ),
    );
  }
}
