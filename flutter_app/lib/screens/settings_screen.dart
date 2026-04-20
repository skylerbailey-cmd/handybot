import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../services/image_service.dart';
import '../services/reminders_service.dart';
import '../services/storage_service.dart';
import '../services/subscription_service.dart';
import '../theme/app_theme.dart';

class SettingsScreen extends StatefulWidget {
  const SettingsScreen({super.key});

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  bool _cloud = false;

  @override
  void initState() {
    super.initState();
    _cloud = SubscriptionService.instance.isCloudBackupEnabled;
  }

  Future<void> _toggleCloud(bool v) async {
    await SubscriptionService.instance.setCloudBackupEnabled(v);
    if (!mounted) return;
    setState(() => _cloud = v);
  }

  Future<void> _sendTestNotif() async {
    final ok = await RemindersService.instance.scheduleTestNotification();
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
      content: Text(ok
          ? 'Test notification scheduled for 5s from now'
          : 'Couldn\'t schedule — check notification permissions'),
    ));
  }

  Future<void> _wipeAll() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Delete all data?'),
        content: const Text(
          'This removes every repair, reminder, inventory item, and image from this device. This cannot be undone.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancel'),
          ),
          FilledButton.tonal(
            style: FilledButton.styleFrom(
              backgroundColor: AppColors.dangerBg,
              foregroundColor: AppColors.danger,
            ),
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Delete everything'),
          ),
        ],
      ),
    );
    if (confirmed != true) return;
    await StorageService.instance.wipeAllData();
    await ImageService.instance.wipeImageCache();
    if (!mounted) return;
    context.go('/');
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Settings')),
      body: ListView(
        padding: const EdgeInsets.all(AppSpacing.lg),
        children: [
          _section('ACCOUNT', [
            SwitchListTile(
              activeColor: AppColors.brand,
              title: const Text('Cloud backup'),
              subtitle: const Text(
                'Sync repairs, reminders, and inventory to Supabase (paid tier).',
              ),
              value: _cloud,
              onChanged: _toggleCloud,
            ),
          ]),
          const SizedBox(height: AppSpacing.md),
          _section('NOTIFICATIONS', [
            ListTile(
              leading: const Icon(Icons.notifications_active_outlined),
              title: const Text('Send test notification'),
              subtitle: const Text('Fires in 5 seconds to confirm setup'),
              onTap: _sendTestNotif,
            ),
          ]),
          const SizedBox(height: AppSpacing.md),
          _section('DANGER ZONE', [
            ListTile(
              leading: const Icon(Icons.delete_forever_outlined,
                  color: AppColors.danger),
              title: const Text('Delete all local data',
                  style: TextStyle(color: AppColors.danger)),
              subtitle: const Text(
                'Wipe every repair, reminder, and inventory item from this device.',
              ),
              onTap: _wipeAll,
            ),
          ]),
          const SizedBox(height: AppSpacing.xl),
          const Center(
            child: Text(
              'HandyBot · Flutter port',
              style: TextStyle(fontSize: 12, color: AppColors.textSubtle),
            ),
          ),
        ],
      ),
    );
  }

  Widget _section(String title, List<Widget> children) {
    return Container(
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(AppRadius.lg),
        border: Border.all(color: AppColors.border),
      ),
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
            child: Text(
              title,
              style: const TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w800,
                color: AppColors.textMuted,
                letterSpacing: 0.6,
              ),
            ),
          ),
          ...children,
        ],
      ),
    );
  }
}
