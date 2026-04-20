import 'dart:io';

import 'package:flutter/material.dart';

import '../services/image_service.dart';
import '../theme/app_theme.dart';

class ImagePickerButton extends StatefulWidget {
  final String? value;
  final ValueChanged<String?> onChanged;
  final String? label;

  const ImagePickerButton({
    super.key,
    required this.value,
    required this.onChanged,
    this.label,
  });

  @override
  State<ImagePickerButton> createState() => _ImagePickerButtonState();
}

class _ImagePickerButtonState extends State<ImagePickerButton> {
  bool _busy = false;

  Future<void> _pick(ImageSourceKind source) async {
    setState(() => _busy = true);
    try {
      final result = await ImageService.instance.pickAndProcess(source);
      if (result != null) widget.onChanged(result.uri);
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(e.toString())));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _sheet() async {
    final choice = await showModalBottomSheet<ImageSourceKind>(
      context: context,
      builder: (ctx) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              leading: const Icon(Icons.camera_alt),
              title: const Text('Take photo'),
              onTap: () => Navigator.pop(ctx, ImageSourceKind.camera),
            ),
            ListTile(
              leading: const Icon(Icons.photo_library),
              title: const Text('Choose from library'),
              onTap: () => Navigator.pop(ctx, ImageSourceKind.library),
            ),
            ListTile(
              leading: const Icon(Icons.close),
              title: const Text('Cancel'),
              onTap: () => Navigator.pop(ctx),
            ),
          ],
        ),
      ),
    );
    if (choice != null) await _pick(choice);
  }

  @override
  Widget build(BuildContext context) {
    final uri = widget.value;
    return GestureDetector(
      onTap: _busy ? null : _sheet,
      child: Container(
        height: 180,
        decoration: BoxDecoration(
          color: AppColors.brandLighter,
          borderRadius: BorderRadius.circular(AppRadius.lg),
          border: Border.all(color: AppColors.brandLight, width: 2),
        ),
        clipBehavior: Clip.antiAlias,
        child: uri == null
            ? Center(
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Text(
                      _busy ? '…' : '📷',
                      style: const TextStyle(fontSize: 36),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      widget.label ?? 'Tap to add photo',
                      style: const TextStyle(
                        color: AppColors.brandDark,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ],
                ),
              )
            : Stack(
                fit: StackFit.expand,
                children: [
                  Image.file(
                    File(uri.startsWith('file://') ? uri.substring(7) : uri),
                    fit: BoxFit.cover,
                  ),
                  Positioned(
                    top: 8,
                    right: 8,
                    child: Material(
                      color: Colors.black54,
                      shape: const CircleBorder(),
                      child: IconButton(
                        icon: const Icon(Icons.close, color: Colors.white),
                        onPressed: () => widget.onChanged(null),
                      ),
                    ),
                  ),
                ],
              ),
      ),
    );
  }
}
