import 'dart:convert';

import 'package:shared_preferences/shared_preferences.dart';

import '../models/models.dart';
import 'homes_service.dart';

/// Ask HandyBot conversation + home inventory persistence.
/// Ported from lib/homeData.ts.
class HomeDataService {
  HomeDataService._();
  static final instance = HomeDataService._();

  String _askKey() => '${HomesService.instance.storagePrefix()}ask_messages';
  String _inventoryKey() =>
      '${HomesService.instance.storagePrefix()}inventory';

  // --- Ask conversation --------------------------------------------------

  Future<List<AskMessage>> loadAskMessages() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final raw = prefs.getString(_askKey());
      if (raw == null) return [];
      final parsed = jsonDecode(raw);
      if (parsed is! List) return [];
      return parsed
          .whereType<Map>()
          .map((e) => AskMessage.fromJson(e.cast<String, dynamic>()))
          .toList();
    } catch (_) {
      return [];
    }
  }

  Future<void> saveAskMessages(List<AskMessage> messages) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(
      _askKey(),
      jsonEncode(messages.map((m) => m.toJson()).toList()),
    );
  }

  Future<void> clearAskMessages() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_askKey());
  }

  // --- Home inventory ----------------------------------------------------

  Future<List<HomeItem>> loadInventory() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final raw = prefs.getString(_inventoryKey());
      if (raw == null) return [];
      final parsed = jsonDecode(raw);
      if (parsed is! List) return [];
      return parsed
          .whereType<Map>()
          .map((e) => HomeItem.fromJson(e.cast<String, dynamic>()))
          .toList();
    } catch (_) {
      return [];
    }
  }

  Future<void> saveInventory(List<HomeItem> items) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(
      _inventoryKey(),
      jsonEncode(items.map((i) => i.toJson()).toList()),
    );
  }

  Future<void> addHomeItem(HomeItem item) async {
    final all = await loadInventory();
    all.insert(0, item);
    await saveInventory(all);
  }

  Future<void> removeHomeItem(String itemId) async {
    final all = (await loadInventory()).where((i) => i.id != itemId).toList();
    await saveInventory(all);
  }

  Future<HomeItem?> updateHomeItem(
    String itemId, {
    String? name,
    String? room,
    String? condition,
    String? conditionNotes,
  }) async {
    final all = await loadInventory();
    final idx = all.indexWhere((i) => i.id == itemId);
    if (idx < 0) return null;
    all[idx] = all[idx].copyWith(
      name: name,
      room: room,
      condition: condition,
      conditionNotes: conditionNotes,
    );
    await saveInventory(all);
    return all[idx];
  }

  /// Items near or past their expected lifespan. Surfaced on the home screen
  /// as proactive alerts.
  List<HomeItem> getItemsNeedingAttention(List<HomeItem> items) {
    return items.where((item) {
      if (item.condition == ItemCondition.replaceSoon ||
          item.condition == ItemCondition.poor) {
        return true;
      }
      final remaining = item.typicalLifespanYears - item.estimatedAgeYears;
      return remaining <= 1;
    }).toList();
  }
}
