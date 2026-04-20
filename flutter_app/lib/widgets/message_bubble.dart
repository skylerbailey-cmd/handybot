import 'dart:io';

import 'package:flutter/material.dart';

import '../models/models.dart';
import '../theme/app_theme.dart';

class MessageBubble extends StatelessWidget {
  final String role;
  final String text;
  final String? imageUri;

  const MessageBubble({
    super.key,
    required this.role,
    required this.text,
    this.imageUri,
  });

  @override
  Widget build(BuildContext context) {
    final isUser = role == MessageRole.user;
    final bg = isUser ? AppColors.brand : AppColors.surface;
    final fg = isUser ? Colors.white : AppColors.text;
    final align = isUser ? CrossAxisAlignment.end : CrossAxisAlignment.start;

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Column(
        crossAxisAlignment: align,
        children: [
          if (imageUri != null)
            Padding(
              padding: const EdgeInsets.only(bottom: 6),
              child: ClipRRect(
                borderRadius: BorderRadius.circular(AppRadius.md),
                child: _image(imageUri!),
              ),
            ),
          if (text.isNotEmpty)
            ConstrainedBox(
              constraints: BoxConstraints(
                maxWidth: MediaQuery.of(context).size.width * 0.78,
              ),
              child: Container(
                padding: const EdgeInsets.symmetric(
                    horizontal: AppSpacing.md, vertical: AppSpacing.sm + 2),
                decoration: BoxDecoration(
                  color: bg,
                  borderRadius: BorderRadius.circular(AppRadius.lg),
                  border: isUser
                      ? null
                      : Border.all(color: AppColors.border),
                ),
                child: Text(
                  text,
                  style: TextStyle(color: fg, fontSize: 14, height: 1.4),
                ),
              ),
            ),
        ],
      ),
    );
  }

  Widget _image(String uri) {
    final path = uri.startsWith('file://') ? uri.substring(7) : uri;
    final w = 220.0;
    if (path.startsWith('http')) {
      return Image.network(path, width: w, fit: BoxFit.cover);
    }
    return Image.file(File(path), width: w, fit: BoxFit.cover);
  }
}
