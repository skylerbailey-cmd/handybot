import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../models/models.dart';
import '../services/claude_service.dart';
import '../services/home_data_service.dart';
import '../services/image_service.dart';
import '../theme/app_theme.dart';
import '../widgets/image_picker_button.dart';
import '../widgets/primary_button.dart';

class InventoryEditScreen extends StatefulWidget {
  final String? itemId;
  const InventoryEditScreen({super.key, this.itemId});

  @override
  State<InventoryEditScreen> createState() => _InventoryEditScreenState();
}

class _InventoryEditScreenState extends State<InventoryEditScreen> {
  HomeItem? _existing;
  final _name = TextEditingController();
  final _room = TextEditingController();
  final _notes = TextEditingController();
  String _condition = ItemCondition.fair;
  String? _photo;
  bool _analyzing = false;
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    if (widget.itemId == null) return;
    final all = await HomeDataService.instance.loadInventory();
    final existing = all.where((i) => i.id == widget.itemId).firstOrNull;
    if (existing == null || !mounted) return;
    setState(() {
      _existing = existing;
      _name.text = existing.name;
      _room.text = existing.room;
      _notes.text = existing.conditionNotes;
      _condition = existing.condition;
      _photo = existing.photoUri;
    });
  }

  Future<void> _analyze() async {
    if (_photo == null || _analyzing) return;
    setState(() => _analyzing = true);
    try {
      final base64 = await ImageService.instance.readAsBase64(_photo!);
      final result = await analyzeHomeItem(imageBase64: base64);
      setState(() {
        _name.text = result.name;
        _notes.text = result.conditionNotes;
        _condition = result.condition;
      });
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(e.toString())));
    } finally {
      if (mounted) setState(() => _analyzing = false);
    }
  }

  Future<void> _save() async {
    if (_name.text.trim().isEmpty || _saving) return;
    setState(() => _saving = true);
    try {
      if (_existing != null) {
        await HomeDataService.instance.updateHomeItem(
          _existing!.id,
          name: _name.text.trim(),
          room: _room.text.trim(),
          condition: _condition,
          conditionNotes: _notes.text.trim(),
        );
      } else {
        await HomeDataService.instance.addHomeItem(HomeItem(
          id: generateId(),
          name: _name.text.trim(),
          category: 'other',
          icon: '🏠',
          room: _room.text.trim(),
          photoUri: _photo,
          estimatedAgeYears: 0,
          typicalLifespanYears: 0,
          condition: _condition,
          conditionNotes: _notes.text.trim(),
          maintenanceTips: const [],
          createdAt: DateTime.now().millisecondsSinceEpoch,
          updatedAt: DateTime.now().millisecondsSinceEpoch,
        ));
      }
      if (!mounted) return;
      context.pop();
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(_existing == null ? 'Add item' : 'Edit item'),
        actions: [
          if (_existing != null)
            IconButton(
              icon: const Icon(Icons.delete_outline),
              onPressed: () async {
                await HomeDataService.instance.removeHomeItem(_existing!.id);
                if (!mounted) return;
                context.pop();
              },
            ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.all(AppSpacing.lg),
        children: [
          ImagePickerButton(
            value: _photo,
            onChanged: (uri) => setState(() => _photo = uri),
            label: 'Photo of the item',
          ),
          if (_photo != null && _existing == null) ...[
            const SizedBox(height: AppSpacing.sm),
            OutlinedButton.icon(
              onPressed: _analyzing ? null : _analyze,
              icon: _analyzing
                  ? const SizedBox(
                      width: 14,
                      height: 14,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Icon(Icons.auto_awesome, size: 16),
              label: Text(_analyzing ? 'Analyzing…' : 'Analyze with HandyBot'),
            ),
          ],
          const SizedBox(height: AppSpacing.md),
          TextField(
            controller: _name,
            decoration: const InputDecoration(labelText: 'Name'),
          ),
          const SizedBox(height: AppSpacing.md),
          TextField(
            controller: _room,
            decoration:
                const InputDecoration(labelText: 'Room (e.g. Basement)'),
          ),
          const SizedBox(height: AppSpacing.md),
          const Text(
            'CONDITION',
            style: TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w800,
              color: AppColors.textMuted,
              letterSpacing: 0.6,
            ),
          ),
          const SizedBox(height: 6),
          Wrap(
            spacing: 6,
            children: [
              for (final c in const [
                ItemCondition.good,
                ItemCondition.fair,
                ItemCondition.poor,
                ItemCondition.replaceSoon,
              ])
                ChoiceChip(
                  label: Text(c == ItemCondition.replaceSoon
                      ? 'Replace soon'
                      : c[0].toUpperCase() + c.substring(1)),
                  selected: _condition == c,
                  onSelected: (_) => setState(() => _condition = c),
                ),
            ],
          ),
          const SizedBox(height: AppSpacing.md),
          TextField(
            controller: _notes,
            maxLines: 4,
            decoration: const InputDecoration(labelText: 'Notes'),
          ),
          const SizedBox(height: AppSpacing.lg),
          PrimaryButton(
            title: _saving ? 'Saving…' : 'Save',
            loading: _saving,
            onPressed: _name.text.trim().isEmpty ? null : _save,
          ),
        ],
      ),
    );
  }
}

extension<T> on Iterable<T> {
  T? get firstOrNull => isEmpty ? null : first;
}
