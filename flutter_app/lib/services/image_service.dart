import 'dart:convert';
import 'dart:io';
import 'dart:math';
import 'dart:typed_data';

import 'package:image/image.dart' as img;
import 'package:image_picker/image_picker.dart';
import 'package:path_provider/path_provider.dart';

enum ImageSourceKind { camera, library }

class ProcessedImage {
  final String uri;
  ProcessedImage(this.uri);
}

/// Pick from camera/library, resize to 1280 wide, persist to app documents.
/// Ported from lib/image.ts.
class ImageService {
  ImageService._();
  static final instance = ImageService._();

  final _picker = ImagePicker();

  Future<Directory> _imagesDir() async {
    final docs = await getApplicationDocumentsDirectory();
    final dir = Directory('${docs.path}/handybot');
    if (!await dir.exists()) {
      await dir.create(recursive: true);
    }
    return dir;
  }

  Future<ProcessedImage?> pickAndProcess(ImageSourceKind source) async {
    final picked = await _picker.pickImage(
      source: source == ImageSourceKind.camera
          ? ImageSource.camera
          : ImageSource.gallery,
      maxWidth: 2400,
      imageQuality: 100,
    );
    if (picked == null) return null;

    final bytes = await picked.readAsBytes();
    final decoded = img.decodeImage(bytes);
    if (decoded == null) {
      // Fall back to saving the original bytes unmodified.
      return ProcessedImage(await _persist(bytes));
    }
    final resized = decoded.width > 1280
        ? img.copyResize(decoded, width: 1280)
        : decoded;
    final jpeg = img.encodeJpg(resized, quality: 82);
    return ProcessedImage(await _persist(Uint8List.fromList(jpeg)));
  }

  Future<String> _persist(Uint8List bytes) async {
    final dir = await _imagesDir();
    final rand = Random().nextInt(1 << 32).toRadixString(36);
    final name = '${DateTime.now().millisecondsSinceEpoch}_$rand.jpg';
    final file = File('${dir.path}/$name');
    await file.writeAsBytes(bytes);
    return file.path;
  }

  /// Reads a persisted image file and returns base64 (for the Claude API).
  Future<String> readAsBase64(String uri) async {
    final path = uri.startsWith('file://') ? uri.substring(7) : uri;
    final bytes = await File(path).readAsBytes();
    return base64Encode(bytes);
  }

  Future<void> wipeImageCache() async {
    try {
      final dir = await _imagesDir();
      if (await dir.exists()) await dir.delete(recursive: true);
    } catch (_) {/* ignore */}
  }
}
