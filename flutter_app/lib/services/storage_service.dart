import 'dart:convert';
import 'dart:io';

import 'package:shared_preferences/shared_preferences.dart';

import '../models/models.dart';
import 'homes_service.dart';

/// Issue + user persistence. Ported from lib/storage.ts.
class StorageService {
  StorageService._();
  static final instance = StorageService._();

  static const _userKey = 'handybot:user';

  String _issuesKey() => '${HomesService.instance.storagePrefix()}issues';

  Future<List<Issue>> loadIssues() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final raw = prefs.getString(_issuesKey());
      if (raw == null) return [];
      final parsed = jsonDecode(raw);
      if (parsed is! List) return [];
      return parsed
          .whereType<Map>()
          .map((e) => Issue.fromJson(e.cast<String, dynamic>()))
          .toList();
    } catch (e) {
      return [];
    }
  }

  Future<void> saveIssues(List<Issue> issues) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(
      _issuesKey(),
      jsonEncode(issues.map((i) => i.toJson()).toList()),
    );
    // TODO: mirror to Supabase when isCloudBackupEnabled (deferred port).
  }

  Future<Issue?> getIssue(String id) async {
    final all = await loadIssues();
    for (final i in all) {
      if (i.id == id) return i;
    }
    return null;
  }

  Future<void> upsertIssue(Issue issue) async {
    final all = await loadIssues();
    final idx = all.indexWhere((i) => i.id == issue.id);
    if (idx >= 0) {
      all[idx] = issue;
      all.sort((a, b) => b.updatedAt.compareTo(a.updatedAt));
    } else {
      all.insert(0, issue);
    }
    await saveIssues(all);
  }

  Future<void> deleteIssue(String id) async {
    final all = await loadIssues();
    Issue? target;
    for (final i in all) {
      if (i.id == id) {
        target = i;
        break;
      }
    }
    await saveIssues(all.where((i) => i.id != id).toList());

    if (target != null) {
      final files = <String>[];
      if (target.coverImageUri != null) files.add(target.coverImageUri!);
      for (final m in target.messages) {
        if (m.imageUri != null) files.add(m.imageUri!);
      }
      for (final uri in files) {
        try {
          final path = uri.startsWith('file://') ? uri.substring(7) : uri;
          final file = File(path);
          if (await file.exists()) await file.delete();
        } catch (_) {/* ignore */}
      }
    }
  }

  Future<User?> loadUser() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final raw = prefs.getString(_userKey);
      if (raw == null) return null;
      return User.fromJson(jsonDecode(raw) as Map<String, dynamic>);
    } catch (_) {
      return null;
    }
  }

  Future<void> saveUser(User user) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_userKey, jsonEncode(user.toJson()));
  }

  Future<void> clearUser() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_userKey);
  }

  Future<User> ensureUser() async {
    var user = await loadUser();
    if (user == null) {
      user = User(
        id: generateId(),
        name: 'You',
        createdAt: DateTime.now().millisecondsSinceEpoch,
      );
      await saveUser(user);
    }
    return user;
  }

  Future<void> wipeAllData() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_issuesKey());
    await prefs.remove(_userKey);
  }
}
