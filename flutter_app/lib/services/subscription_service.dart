import 'package:shared_preferences/shared_preferences.dart';

/// Subscription / tier gating. Ported from lib/subscription.ts.
///
/// Free tier  → all data stays on device.
/// Paid tier  → same local cache plus background sync to Supabase.
class SubscriptionService {
  SubscriptionService._();
  static final instance = SubscriptionService._();

  static const _key = 'handybot:cloudBackupEnabled';

  bool _enabled = false;
  bool _hydrated = false;
  final _listeners = <void Function(bool)>{};

  Future<bool> hydrate() async {
    if (_hydrated) return _enabled;
    try {
      final prefs = await SharedPreferences.getInstance();
      _enabled = prefs.getString(_key) == '1';
    } catch (_) {
      _enabled = false;
    }
    _hydrated = true;
    return _enabled;
  }

  /// Synchronous check. Only reliable after [hydrate] has resolved.
  bool get isCloudBackupEnabled => _enabled;

  Future<void> setCloudBackupEnabled(bool enabled) async {
    _enabled = enabled;
    _hydrated = true;
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(_key, enabled ? '1' : '0');
    } catch (_) {/* non-fatal */}
    for (final fn in List.of(_listeners)) {
      try {
        fn(enabled);
      } catch (_) {/* ignore */}
    }
  }

  void Function() subscribe(void Function(bool) fn) {
    _listeners.add(fn);
    return () => _listeners.remove(fn);
  }
}
