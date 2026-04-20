import 'package:flutter/material.dart';

import '../models/models.dart';
import '../services/storage_service.dart';
import '../theme/app_theme.dart';
import '../widgets/issue_card.dart';

class HistoryScreen extends StatefulWidget {
  const HistoryScreen({super.key});

  @override
  State<HistoryScreen> createState() => _HistoryScreenState();
}

class _HistoryScreenState extends State<HistoryScreen> {
  List<Issue> _issues = [];

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final list = await StorageService.instance.loadIssues();
    if (!mounted) return;
    setState(() => _issues = list);
  }

  @override
  Widget build(BuildContext context) {
    final totalSaved = _issues
        .where((i) =>
            i.status == IssueStatus.completed ||
            i.status == IssueStatus.verified)
        .fold<int>(0, (s, i) => s + i.plan.estimatedSavingsUsd);

    return Scaffold(
      appBar: AppBar(title: const Text('Repair History')),
      body: _issues.isEmpty
          ? const Center(child: Text('No repairs yet.'))
          : ListView(
              padding: const EdgeInsets.all(AppSpacing.lg),
              children: [
                if (totalSaved > 0)
                  Container(
                    padding: const EdgeInsets.all(AppSpacing.md),
                    decoration: BoxDecoration(
                      color: const Color(0xFFECFDF5),
                      border: Border.all(color: const Color(0xFFA7F3D0)),
                      borderRadius: BorderRadius.circular(AppRadius.lg),
                    ),
                    child: Row(
                      children: [
                        const Text('💰', style: TextStyle(fontSize: 28)),
                        const SizedBox(width: AppSpacing.md),
                        Expanded(
                          child: Text(
                            '${formatMoney(totalSaved)} saved lifetime',
                            style: const TextStyle(
                              fontSize: 17,
                              fontWeight: FontWeight.w900,
                              color: Color(0xFF065F46),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                const SizedBox(height: AppSpacing.md),
                for (final i in _issues) ...[
                  IssueCard(issue: i),
                  const SizedBox(height: AppSpacing.sm),
                ],
              ],
            ),
    );
  }
}
