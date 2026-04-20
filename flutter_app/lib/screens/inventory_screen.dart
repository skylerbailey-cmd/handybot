import 'dart:io';

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../models/models.dart';
import '../services/home_data_service.dart';
import '../theme/app_theme.dart';

class InventoryScreen extends StatefulWidget {
  const InventoryScreen({super.key});

  @override
  State<InventoryScreen> createState() => _InventoryScreenState();
}

class _InventoryScreenState extends State<InventoryScreen> {
  List<HomeItem> _items = [];

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final list = await HomeDataService.instance.loadInventory();
    if (!mounted) return;
    setState(() => _items = list);
  }

  Color _conditionColor(String c) {
    switch (c) {
      case ItemCondition.good:
        return AppColors.success;
      case ItemCondition.fair:
        return const Color(0xFFB45309);
      case ItemCondition.poor:
        return AppColors.danger;
      case ItemCondition.replaceSoon:
        return AppColors.danger;
      default:
        return AppColors.textMuted;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Home Inventory')),
      floatingActionButton: FloatingActionButton.extended(
        backgroundColor: AppColors.brand,
        onPressed: () async {
          await context.push('/inventory-edit');
          _load();
        },
        icon: const Icon(Icons.add, color: Colors.white),
        label: const Text('Add item', style: TextStyle(color: Colors.white)),
      ),
      body: RefreshIndicator(
        onRefresh: _load,
        child: _items.isEmpty
            ? ListView(
                padding: const EdgeInsets.all(AppSpacing.lg),
                children: const [
                  SizedBox(height: 80),
                  Center(child: Text('🏠', style: TextStyle(fontSize: 48))),
                  SizedBox(height: 8),
                  Center(
                    child: Text(
                      'Your home inventory is empty',
                      style: TextStyle(
                          fontSize: 16, fontWeight: FontWeight.w700),
                    ),
                  ),
                  SizedBox(height: 4),
                  Center(
                    child: Padding(
                      padding: EdgeInsets.symmetric(horizontal: 24),
                      child: Text(
                        'Photograph appliances, systems, and fixtures so HandyBot can track their age and condition.',
                        textAlign: TextAlign.center,
                        style: TextStyle(
                          fontSize: 13,
                          color: AppColors.textMuted,
                        ),
                      ),
                    ),
                  ),
                ],
              )
            : ListView.separated(
                padding: const EdgeInsets.all(AppSpacing.lg),
                itemCount: _items.length,
                separatorBuilder: (_, __) => const SizedBox(height: 8),
                itemBuilder: (context, i) {
                  final item = _items[i];
                  return InkWell(
                    borderRadius: BorderRadius.circular(AppRadius.lg),
                    onTap: () async {
                      await context.push('/inventory-edit?id=${item.id}');
                      _load();
                    },
                    child: Container(
                      padding: const EdgeInsets.all(AppSpacing.md),
                      decoration: BoxDecoration(
                        color: AppColors.surface,
                        borderRadius: BorderRadius.circular(AppRadius.lg),
                        border: Border.all(color: AppColors.border),
                      ),
                      child: Row(
                        children: [
                          item.photoUri != null
                              ? ClipRRect(
                                  borderRadius:
                                      BorderRadius.circular(AppRadius.md),
                                  child: Image.file(
                                    File(
                                      item.photoUri!.startsWith('file://')
                                          ? item.photoUri!.substring(7)
                                          : item.photoUri!,
                                    ),
                                    width: 56,
                                    height: 56,
                                    fit: BoxFit.cover,
                                  ),
                                )
                              : Container(
                                  width: 56,
                                  height: 56,
                                  alignment: Alignment.center,
                                  decoration: BoxDecoration(
                                    color: AppColors.chipBg,
                                    borderRadius:
                                        BorderRadius.circular(AppRadius.md),
                                  ),
                                  child: Text(
                                    item.icon,
                                    style: const TextStyle(fontSize: 28),
                                  ),
                                ),
                          const SizedBox(width: AppSpacing.md),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  item.name,
                                  style: const TextStyle(
                                    fontSize: 14,
                                    fontWeight: FontWeight.w700,
                                    color: AppColors.text,
                                  ),
                                ),
                                if (item.room.isNotEmpty)
                                  Text(
                                    item.room,
                                    style: const TextStyle(
                                      fontSize: 12,
                                      color: AppColors.textMuted,
                                    ),
                                  ),
                                const SizedBox(height: 4),
                                Text(
                                  '${item.estimatedAgeYears}/${item.typicalLifespanYears} yrs',
                                  style: TextStyle(
                                    fontSize: 11,
                                    color:
                                        _conditionColor(item.condition),
                                    fontWeight: FontWeight.w700,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                  );
                },
              ),
      ),
    );
  }
}
