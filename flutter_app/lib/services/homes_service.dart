import 'dart:convert';

import 'package:shared_preferences/shared_preferences.dart';

import '../models/models.dart';

/// Multi-home management + namespaced storage prefix. Ported from lib/homes.ts.
class HomesService {
  HomesService._();
  static final instance = HomesService._();

  static const _homesKey = 'handybot:homes';
  static const _activeHomeKey = 'handybot:activeHomeId';
  static const _migratedKey = 'handybot:migratedToMultiHome';
  static const _legacyKeys = [
    'handybot:issues',
    'handybot:reminders',
    'handybot:inventory',
    'handybot:ask_messages',
  ];

  String _activeHomeId = 'default';

  String get activeHomeId => _activeHomeId;

  /// Returns the key prefix all storage functions use. Every piece of user
  /// data is scoped to the active home so switching homes swaps everything.
  String storagePrefix() => 'handybot:$_activeHomeId:';

  Future<List<Home>> loadHomes() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final raw = prefs.getString(_homesKey);
      if (raw == null) return [];
      final parsed = jsonDecode(raw);
      if (parsed is! List) return [];
      return parsed
          .whereType<Map>()
          .map((e) => Home.fromJson(e.cast<String, dynamic>()))
          .toList();
    } catch (_) {
      return [];
    }
  }

  Future<void> _saveHomes(List<Home> homes) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(
      _homesKey,
      jsonEncode(homes.map((h) => h.toJson()).toList()),
    );
  }

  Future<void> addHome(Home home) async {
    final all = await loadHomes();
    all.add(home);
    await _saveHomes(all);
  }

  Future<void> removeHome(String homeId) async {
    final all = (await loadHomes()).where((h) => h.id != homeId).toList();
    await _saveHomes(all);
    if (homeId == _activeHomeId && all.isNotEmpty) {
      await switchHome(all.first.id);
    }
  }

  Future<void> updateHome(String homeId, {String? name, String? address, String? icon}) async {
    final all = await loadHomes();
    final idx = all.indexWhere((h) => h.id == homeId);
    if (idx < 0) return;
    final current = all[idx];
    all[idx] = Home(
      id: current.id,
      name: name ?? current.name,
      address: address ?? current.address,
      icon: icon ?? current.icon,
      createdAt: current.createdAt,
    );
    await _saveHomes(all);
  }

  Future<void> switchHome(String homeId) async {
    _activeHomeId = homeId;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_activeHomeKey, homeId);
  }

  Future<Home?> getActiveHome() async {
    final all = await loadHomes();
    for (final h in all) {
      if (h.id == _activeHomeId) return h;
    }
    return null;
  }

  /// First-launch migration: creates a default home and moves any legacy
  /// un-namespaced data into its namespace. Idempotent.
  Future<void> ensureMultiHomeSetup() async {
    final prefs = await SharedPreferences.getInstance();
    final savedActive = prefs.getString(_activeHomeKey);
    if (savedActive != null && savedActive.isNotEmpty) {
      _activeHomeId = savedActive;
    }

    final homes = await loadHomes();
    if (homes.isNotEmpty) return;

    if (prefs.getString(_migratedKey) != null) return;

    final defaultHome = Home(
      id: 'default',
      name: 'My Home',
      address: '',
      icon: '🏠',
      createdAt: DateTime.now().millisecondsSinceEpoch,
    );
    await _saveHomes([defaultHome]);
    await switchHome('default');

    for (final legacy in _legacyKeys) {
      try {
        final data = prefs.getString(legacy);
        if (data != null) {
          final newKey = legacy.replaceFirst('handybot:', 'handybot:default:');
          await prefs.setString(newKey, data);
          await prefs.remove(legacy);
        }
      } catch (_) {/* best-effort */}
    }

    await prefs.setString(_migratedKey, '1');
  }
}
