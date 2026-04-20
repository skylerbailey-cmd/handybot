import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../models/models.dart';
import '../services/homes_service.dart';
import '../theme/app_theme.dart';
import '../widgets/primary_button.dart';

class HomesScreen extends StatefulWidget {
  const HomesScreen({super.key});

  @override
  State<HomesScreen> createState() => _HomesScreenState();
}

class _HomesScreenState extends State<HomesScreen> {
  List<Home> _homes = [];
  String _activeId = 'default';

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final list = await HomesService.instance.loadHomes();
    if (!mounted) return;
    setState(() {
      _homes = list;
      _activeId = HomesService.instance.activeHomeId;
    });
  }

  Future<void> _switch(Home h) async {
    await HomesService.instance.switchHome(h.id);
    if (!mounted) return;
    setState(() => _activeId = h.id);
    context.go('/');
  }

  Future<void> _addHome() async {
    final name = TextEditingController();
    final address = TextEditingController();
    final icon = TextEditingController(text: '🏠');
    final created = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Add a home'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Row(
              children: [
                SizedBox(
                  width: 60,
                  child: TextField(
                    controller: icon,
                    textAlign: TextAlign.center,
                    style: const TextStyle(fontSize: 24),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: TextField(
                    controller: name,
                    decoration: const InputDecoration(labelText: 'Name'),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            TextField(
              controller: address,
              decoration: const InputDecoration(labelText: 'Address (optional)'),
            ),
          ],
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
          FilledButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Add')),
        ],
      ),
    );
    if (created == true && name.text.trim().isNotEmpty) {
      await HomesService.instance.addHome(Home(
        id: generateId(),
        name: name.text.trim(),
        address: address.text.trim(),
        icon: icon.text.trim().isEmpty ? '🏠' : icon.text.trim(),
        createdAt: DateTime.now().millisecondsSinceEpoch,
      ));
      _load();
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('My Homes')),
      body: ListView(
        padding: const EdgeInsets.all(AppSpacing.lg),
        children: [
          for (final h in _homes) ...[
            Container(
              padding: const EdgeInsets.all(AppSpacing.md),
              decoration: BoxDecoration(
                color: AppColors.surface,
                borderRadius: BorderRadius.circular(AppRadius.lg),
                border: Border.all(
                  color: h.id == _activeId ? AppColors.brand : AppColors.border,
                  width: h.id == _activeId ? 2 : 1,
                ),
              ),
              child: Row(
                children: [
                  Text(h.icon, style: const TextStyle(fontSize: 28)),
                  const SizedBox(width: AppSpacing.md),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          h.name,
                          style: const TextStyle(
                            fontSize: 15,
                            fontWeight: FontWeight.w700,
                            color: AppColors.text,
                          ),
                        ),
                        if (h.address.isNotEmpty)
                          Text(
                            h.address,
                            style: const TextStyle(
                              fontSize: 12,
                              color: AppColors.textMuted,
                            ),
                          ),
                      ],
                    ),
                  ),
                  if (h.id == _activeId)
                    const Padding(
                      padding: EdgeInsets.symmetric(horizontal: 6),
                      child: Text(
                        'Active',
                        style: TextStyle(
                          fontSize: 11,
                          color: AppColors.brand,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                    )
                  else
                    TextButton(
                      onPressed: () => _switch(h),
                      child: const Text('Switch'),
                    ),
                ],
              ),
            ),
            const SizedBox(height: AppSpacing.sm),
          ],
          const SizedBox(height: AppSpacing.md),
          PrimaryButton(
            title: '+ Add a home',
            onPressed: _addHome,
          ),
        ],
      ),
    );
  }
}
