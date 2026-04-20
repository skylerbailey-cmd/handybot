import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../models/models.dart';
import '../services/homes_service.dart';
import '../services/reminders_service.dart';
import '../services/storage_service.dart';
import '../theme/app_theme.dart';
import '../widgets/issue_card.dart';
import '../widgets/primary_button.dart';
import '../widgets/upcoming_reminders_card.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> with RouteAware {
  List<Issue>? _issues;
  List<Reminder> _reminders = [];
  Home? _activeHome;

  @override
  void initState() {
    super.initState();
    _refresh();
  }

  Future<void> _refresh() async {
    await StorageService.instance.ensureUser();
    final loadedIssues = await StorageService.instance.loadIssues();
    final loadedReminders = await RemindersService.instance.loadReminders();
    final home = await HomesService.instance.getActiveHome();
    if (!mounted) return;
    setState(() {
      _issues = loadedIssues;
      _reminders = loadedReminders;
      _activeHome = home;
    });
  }

  int get _totalSaved {
    final issues = _issues ?? const [];
    return issues
        .where((i) => i.status == IssueStatus.completed ||
            i.status == IssueStatus.verified)
        .fold<int>(0, (sum, i) => sum + i.plan.estimatedSavingsUsd);
  }

  List<Reminder> get _upcoming {
    final list = _reminders.where((r) => r.enabled).toList()
      ..sort((a, b) => a.nextDue.compareTo(b.nextDue));
    return list.take(3).toList();
  }

  Future<void> _handleReminderDone(Reminder r) async {
    final updated = await RemindersService.instance.markDone(r.id);
    await _refresh();
    if (!mounted || updated == null) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          '${r.icon}  "${r.title}" marked done. Next: ${formatDueDate(updated)}.',
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final issues = _issues;
    final ongoing = (issues ?? [])
        .where((i) => i.status == IssueStatus.inProgress)
        .toList();
    final completed = (issues ?? [])
        .where((i) =>
            i.status == IssueStatus.completed ||
            i.status == IssueStatus.verified)
        .toList();
    final home = _activeHome;

    return Scaffold(
      appBar: AppBar(
        title: Text(home != null ? '${home.icon} ${home.name}' : 'HandyBot'),
        leading: Padding(
          padding: const EdgeInsets.only(left: AppSpacing.md),
          child: Center(
            child: InkWell(
              onTap: () => context.push('/homes'),
              borderRadius: BorderRadius.circular(AppRadius.pill),
              child: Container(
                padding: const EdgeInsets.symmetric(
                    horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: AppColors.brandLight,
                  borderRadius: BorderRadius.circular(AppRadius.pill),
                ),
                child: const Text(
                  'Switch',
                  style: TextStyle(
                    color: AppColors.brandDark,
                    fontSize: 12,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ),
            ),
          ),
        ),
        leadingWidth: 80,
        actions: [
          IconButton(
            tooltip: 'Reminders',
            icon: const Text('🔔', style: TextStyle(fontSize: 22)),
            onPressed: () => context.push('/reminders'),
          ),
          IconButton(
            tooltip: 'Settings',
            icon: const Text('⚙︎', style: TextStyle(fontSize: 22)),
            onPressed: () => context.push('/settings'),
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: _refresh,
        child: ListView(
          padding: const EdgeInsets.all(AppSpacing.lg),
          children: [
            _heroCard(),
            if (_totalSaved > 0) ...[
              const SizedBox(height: AppSpacing.md),
              _savedCard(),
            ],
            const SizedBox(height: AppSpacing.md),
            _quickNav(),
            const SizedBox(height: AppSpacing.md),
            UpcomingRemindersCard(
              reminders: _upcoming,
              onMarkDone: _handleReminderDone,
            ),
            if (issues == null)
              const Padding(
                padding: EdgeInsets.only(top: AppSpacing.lg),
                child: Center(child: CircularProgressIndicator()),
              )
            else if (issues.isEmpty)
              _emptyState()
            else ...[
              if (ongoing.isNotEmpty) _sectionHeader('Ongoing', ongoing.length),
              for (final i in ongoing) ...[
                IssueCard(issue: i),
                const SizedBox(height: 8),
              ],
              if (completed.isNotEmpty) ...[
                const SizedBox(height: AppSpacing.md),
                _sectionHeader(
                  'Completed',
                  completed.length,
                  trailing: _totalSaved > 0
                      ? '✓ Saved ${formatMoney(_totalSaved)} total'
                      : null,
                ),
              ],
              for (final i in completed) ...[
                IssueCard(issue: i),
                const SizedBox(height: 8),
              ],
            ],
            const SizedBox(height: AppSpacing.xxl),
          ],
        ),
      ),
    );
  }

  Widget _heroCard() {
    return Container(
      padding: const EdgeInsets.all(AppSpacing.lg + 4),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(AppRadius.lg),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const Text(
            'What needs fixing today?',
            style: TextStyle(
              fontSize: 22,
              fontWeight: FontWeight.w700,
              color: AppColors.text,
            ),
          ),
          const SizedBox(height: AppSpacing.sm),
          const Text(
            "Snap a photo of something broken in your home and I'll walk you through how to fix it, step by step.",
            style: TextStyle(
              fontSize: 14,
              height: 1.45,
              color: AppColors.textMuted,
            ),
          ),
          const SizedBox(height: AppSpacing.lg),
          PrimaryButton(
            title: '+ New repair',
            onPressed: () async {
              await context.push('/new');
              _refresh();
            },
          ),
        ],
      ),
    );
  }

  Widget _savedCard() {
    return Container(
      padding: const EdgeInsets.all(AppSpacing.lg),
      decoration: BoxDecoration(
        color: const Color(0xFFECFDF5),
        border: Border.all(color: const Color(0xFFA7F3D0)),
        borderRadius: BorderRadius.circular(AppRadius.lg),
      ),
      child: Row(
        children: [
          const Text('💰', style: TextStyle(fontSize: 32)),
          const SizedBox(width: AppSpacing.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  '${formatMoney(_totalSaved)} saved',
                  style: const TextStyle(
                    fontSize: 22,
                    fontWeight: FontWeight.w900,
                    color: Color(0xFF065F46),
                  ),
                ),
                const Text(
                  'by doing repairs yourself instead of hiring pros',
                  style: TextStyle(
                    fontSize: 12,
                    color: Color(0xFF047857),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _quickNav() {
    Widget btn(String icon, String label, String route) {
      return Expanded(
        child: InkWell(
          borderRadius: BorderRadius.circular(AppRadius.lg),
          onTap: () async {
            await context.push(route);
            _refresh();
          },
          child: Container(
            padding: const EdgeInsets.symmetric(vertical: 14),
            decoration: BoxDecoration(
              color: AppColors.surface,
              border: Border.all(color: AppColors.border),
              borderRadius: BorderRadius.circular(AppRadius.lg),
            ),
            child: Column(
              children: [
                Text(icon, style: const TextStyle(fontSize: 24)),
                const SizedBox(height: 4),
                Text(
                  label,
                  style: const TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                    color: AppColors.textMuted,
                  ),
                  textAlign: TextAlign.center,
                ),
              ],
            ),
          ),
        ),
      );
    }

    return Row(
      children: [
        btn('💬', 'Ask HandyBot', '/ask'),
        const SizedBox(width: AppSpacing.sm),
        btn('🏠', 'Home inventory', '/inventory'),
        const SizedBox(width: AppSpacing.sm),
        btn('📋', 'Repair history', '/history'),
      ],
    );
  }

  Widget _sectionHeader(String title, int count, {String? trailing}) {
    return Padding(
      padding: const EdgeInsets.only(top: AppSpacing.md, bottom: 6),
      child: Row(
        children: [
          Text(
            title.toUpperCase(),
            style: const TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w800,
              color: AppColors.text,
              letterSpacing: 0.6,
            ),
          ),
          const Spacer(),
          if (trailing != null)
            Padding(
              padding: const EdgeInsets.only(right: 8),
              child: Text(
                trailing,
                style: const TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w700,
                  color: AppColors.success,
                ),
              ),
            ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
            decoration: BoxDecoration(
              color: const Color(0xFFE7E5E4),
              borderRadius: BorderRadius.circular(AppRadius.pill),
            ),
            child: Text(
              '$count',
              style: const TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w700,
                color: AppColors.textMuted,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _emptyState() {
    return Container(
      margin: const EdgeInsets.only(top: AppSpacing.md),
      padding: const EdgeInsets.all(AppSpacing.xl),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(AppRadius.lg),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        children: [
          Container(
            width: 56,
            height: 56,
            decoration: BoxDecoration(
              color: AppColors.brandLight,
              borderRadius: BorderRadius.circular(AppRadius.pill),
            ),
            alignment: Alignment.center,
            child: const Text('🧰', style: TextStyle(fontSize: 26)),
          ),
          const SizedBox(height: 8),
          const Text(
            'No repairs yet',
            style: TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w600,
              color: AppColors.text,
            ),
          ),
          const SizedBox(height: 4),
          const Text(
            "Tap the button above to take a photo of what's broken and get started.",
            textAlign: TextAlign.center,
            style: TextStyle(fontSize: 13, color: AppColors.textMuted),
          ),
          const SizedBox(height: AppSpacing.md),
          SizedBox(
            width: double.infinity,
            child: PrimaryButton(
              title: '+ New repair',
              onPressed: () async {
                await context.push('/new');
                _refresh();
              },
            ),
          ),
        ],
      ),
    );
  }
}
