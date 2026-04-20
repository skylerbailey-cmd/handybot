import 'dart:convert';

import 'package:http/http.dart' as http;

import '../models/models.dart';
import 'claude_prompts.dart';
import 'claude_tools.dart';

const _modelSonnet = 'claude-sonnet-4-6';
const _modelHaiku = 'claude-haiku-4-5-20251001';
const _anthropicVersion = '2023-06-01';
const _endpoint = 'https://api.anthropic.com/v1/messages';

/// API key is passed at build time via --dart-define=ANTHROPIC_API_KEY=...
const _apiKey = String.fromEnvironment('ANTHROPIC_API_KEY');

class ClaudeException implements Exception {
  final String message;
  ClaudeException(this.message);
  @override
  String toString() => message;
}

// --------------------------------------------------------------------------
// Low-level request helpers
// --------------------------------------------------------------------------

List<Map<String, dynamic>> _toApiMessages(List<ChatRequestMessage> messages) {
  return messages.map((m) {
    final content = <Map<String, dynamic>>[];
    if (m.imageBase64 != null && m.imageBase64!.isNotEmpty) {
      content.add({
        'type': 'image',
        'source': {
          'type': 'base64',
          'media_type': m.imageMediaType ?? 'image/jpeg',
          'data': m.imageBase64,
        },
      });
    }
    final text = m.text.trim();
    if (text.isNotEmpty) {
      content.add({'type': 'text', 'text': text});
    } else if (content.isEmpty) {
      content.add({'type': 'text', 'text': '(no message)'});
    }
    return {'role': m.role, 'content': content};
  }).toList();
}

Future<Map<String, dynamic>> _callAnthropic(Map<String, dynamic> body) async {
  if (_apiKey.isEmpty) {
    throw ClaudeException(
      'Missing Anthropic API key. Pass --dart-define=ANTHROPIC_API_KEY=... at build time.',
    );
  }
  final res = await http.post(
    Uri.parse(_endpoint),
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': _apiKey,
      'anthropic-version': _anthropicVersion,
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: jsonEncode(body),
  );
  if (res.statusCode < 200 || res.statusCode >= 300) {
    String errMsg = res.body;
    try {
      final parsed = jsonDecode(res.body) as Map<String, dynamic>;
      final e = parsed['error'];
      if (e is Map && e['message'] is String) errMsg = e['message'] as String;
    } catch (_) {/* ignore */}
    throw ClaudeException('Claude API error (${res.statusCode}): $errMsg');
  }
  return jsonDecode(res.body) as Map<String, dynamic>;
}

Map<String, dynamic>? _findToolUse(Map<String, dynamic> response, String name) {
  final content = response['content'] as List? ?? [];
  for (final block in content) {
    if (block is Map &&
        block['type'] == 'tool_use' &&
        block['name'] == name) {
      return (block['input'] as Map).cast<String, dynamic>();
    }
  }
  return null;
}

String _extractText(Map<String, dynamic> response) {
  final content = response['content'] as List? ?? [];
  final buf = <String>[];
  for (final block in content) {
    if (block is Map && block['type'] == 'text' && block['text'] is String) {
      buf.add(block['text'] as String);
    }
  }
  return buf.join('\n').trim();
}

// --------------------------------------------------------------------------
// Plan generation
// --------------------------------------------------------------------------

class GeneratedPlan {
  final String title;
  final String summary;
  final String openingMessage;
  final RepairPlan plan;

  GeneratedPlan({
    required this.title,
    required this.summary,
    required this.openingMessage,
    required this.plan,
  });
}

List<SuggestedReminder>? _normalizeSuggestedReminders(dynamic raw) {
  if (raw is! List || raw.isEmpty) return null;
  final list = <SuggestedReminder>[];
  for (final r in raw) {
    if (r is! Map) continue;
    final title = (r['title'] ?? '').toString().trim();
    final description = (r['description'] ?? '').toString().trim();
    final freq = (r['frequency_days'] as num?)?.toInt() ?? 0;
    final iconRaw = (r['icon'] ?? '🛠').toString().trim();
    final icon = iconRaw.isEmpty
        ? '🛠'
        : iconRaw.substring(0, iconRaw.length > 4 ? 4 : iconRaw.length);
    if (title.isEmpty || freq <= 0) continue;
    list.add(SuggestedReminder(
      title: title,
      description: description,
      frequencyDays: freq,
      icon: icon,
    ));
  }
  return list.isEmpty ? null : list;
}

RiskAssessment? _normalizeRisk(dynamic raw) {
  if (raw is! Map) return null;
  final headline = (raw['headline'] ?? '').toString().trim();
  final rationale = (raw['rationale'] ?? '').toString().trim();
  if (headline.isEmpty && rationale.isEmpty) return null;

  final severityRaw = (raw['severity'] ?? '').toString().toLowerCase();
  final severity = RiskSeverity.all.contains(severityRaw)
      ? severityRaw
      : RiskSeverity.medium;

  final categoryRaw = (raw['category'] ?? '').toString().toLowerCase();
  final category = RiskCategory.all.contains(categoryRaw)
      ? categoryRaw
      : RiskCategory.general;

  return RiskAssessment(
    severity: severity,
    category: category,
    headline: headline.isNotEmpty
        ? headline
        : '${category[0].toUpperCase()}${category.substring(1)} hazard',
    rationale: rationale,
    callAProRecommended: raw['call_a_pro_recommended'] == true,
  );
}

GeneratedPlan _parsePlan(Map<String, dynamic> raw) {
  final tools = ((raw['tools'] as List?) ?? [])
      .whereType<Map>()
      .map(
        (t) => ToolItem(
          id: generateId(),
          name: (t['name'] ?? '').toString(),
          required: t['required'] == true,
          have: false,
        ),
      )
      .toList();

  final materials = ((raw['materials'] as List?) ?? [])
      .whereType<Map>()
      .map((m) {
        final priceRaw = m['estimated_price_usd'];
        double? price;
        if (priceRaw is num && priceRaw > 0) {
          price = (priceRaw * 100).round() / 100;
        }
        return MaterialItem(
          id: generateId(),
          name: (m['name'] ?? '').toString(),
          quantity: (m['quantity'] ?? '').toString(),
          notes: m['notes']?.toString(),
          estimatedPriceUsd: price,
          have: false,
        );
      }).toList();

  final steps = ((raw['steps'] as List?) ?? [])
      .whereType<Map>()
      .map(
        (s) => PlanStep(
          id: generateId(),
          title: (s['title'] ?? '').toString(),
          detail: (s['detail'] ?? '').toString(),
          estimatedMinutes: (s['estimated_minutes'] as num?)?.toInt(),
          criticalWarning: (s['critical_warning'] as String?)?.trim().isNotEmpty == true
              ? (s['critical_warning'] as String).trim()
              : null,
          completed: false,
        ),
      )
      .toList();

  final savingsRaw = raw['estimated_savings_usd'];
  final savings =
      savingsRaw is num && savingsRaw >= 0 ? savingsRaw.round() : 0;

  return GeneratedPlan(
    title: (raw['title'] ?? 'New repair').toString().trim(),
    summary: (raw['summary'] ?? '').toString().trim(),
    openingMessage: (raw['opening_message'] ?? '').toString().trim(),
    plan: RepairPlan(
      difficulty: Difficulty.normalize((raw['difficulty'] ?? '').toString()),
      estimatedMinutes: (raw['estimated_minutes'] as num?)?.toInt() ?? 0,
      estimatedSavingsUsd: savings,
      tools: tools,
      materials: materials,
      steps: steps,
      safetyNotes: ((raw['safety_notes'] as List?) ?? [])
          .map((s) => s.toString())
          .where((s) => s.isNotEmpty)
          .toList(),
      risk: _normalizeRisk(raw['risk']),
      suggestedReminders: _normalizeSuggestedReminders(raw['suggested_reminders']),
    ),
  );
}

Future<GeneratedPlan> createRepairPlan({
  required String note,
  required String imageBase64,
  String imageMediaType = 'image/jpeg',
}) async {
  final text = note.trim().isNotEmpty
      ? note.trim()
      : "Here's what's broken. Please diagnose it and give me a repair plan I can follow.";
  final msg = ChatRequestMessage(
    role: MessageRole.user,
    text: text,
    imageBase64: imageBase64,
    imageMediaType: imageMediaType,
  );
  final data = await _callAnthropic({
    'model': _modelSonnet,
    'max_tokens': 2500,
    'system': [
      {
        'type': 'text',
        'text': planSystemPrompt,
        'cache_control': {'type': 'ephemeral'},
      },
    ],
    'tools': [createPlanTool],
    'tool_choice': {'type': 'tool', 'name': 'create_repair_plan'},
    'messages': _toApiMessages([msg]),
  });
  final toolInput = _findToolUse(data, 'create_repair_plan');
  if (toolInput == null) {
    throw ClaudeException('Claude did not return a structured plan. Try again.');
  }
  return _parsePlan(toolInput);
}

// --------------------------------------------------------------------------
// Chat
// --------------------------------------------------------------------------

String _formatPlanForContext(RepairPlan plan) {
  final lines = <String>[];
  lines.add('Difficulty: ${plan.difficulty}');
  lines.add('Estimated time: ${plan.estimatedMinutes} minutes');
  if (plan.estimatedSavingsUsd > 0) {
    lines.add(
      'Estimated DIY savings vs hiring a pro: \$${plan.estimatedSavingsUsd}',
    );
  }
  final risk = plan.risk;
  if (risk != null) {
    final pro = risk.callAProRecommended ? ' (pro recommended)' : '';
    lines.add('Risk: ${risk.severity} ${risk.category} — ${risk.headline}$pro');
  }
  if (plan.tools.isNotEmpty) {
    lines.add(
      'Tools: ${plan.tools.map((t) => t.required ? t.name : '${t.name} (optional)').join(', ')}',
    );
  }
  if (plan.materials.isNotEmpty) {
    lines.add(
      'Materials: ${plan.materials.map((m) => '${m.name} (${m.quantity})').join(', ')}',
    );
  }
  lines.add('');
  lines.add('Steps:');
  for (var i = 0; i < plan.steps.length; i++) {
    final s = plan.steps[i];
    final check = s.completed ? 'x' : ' ';
    final mins = s.estimatedMinutes != null ? ' (${s.estimatedMinutes} min)' : '';
    lines.add('${i + 1}. [$check] ${s.title}$mins');
    if (s.criticalWarning != null && s.criticalWarning!.isNotEmpty) {
      lines.add("   ⚠ DON'T MESS UP: ${s.criticalWarning}");
    }
  }
  if (plan.safetyNotes.isNotEmpty) {
    lines.add('');
    lines.add('Safety notes:');
    for (final n in plan.safetyNotes) {
      lines.add('- $n');
    }
  }
  return lines.join('\n');
}

class ChatReply {
  final String text;
  final PlanProposal? proposal;
  ChatReply({required this.text, this.proposal});
}

PlanProposal? _parseProposal(Map<String, dynamic> raw) {
  final rationale = (raw['rationale'] ?? '').toString().trim();
  if (rationale.isEmpty) return null;

  final newSteps = (raw['new_steps'] as List?)
      ?.whereType<Map>()
      .map((s) => ProposedStep(
            title: (s['title'] ?? '').toString(),
            detail: (s['detail'] ?? '').toString(),
            estimatedMinutes: (s['estimated_minutes'] as num?)?.toInt() ?? 0,
            criticalWarning: (s['critical_warning'] as String?)?.trim().isNotEmpty == true
                ? (s['critical_warning'] as String).trim()
                : null,
          ))
      .toList();

  final newTools = (raw['new_tools'] as List?)
      ?.whereType<Map>()
      .map((t) => ProposedTool(
            name: (t['name'] ?? '').toString(),
            required: t['required'] == true,
          ))
      .toList();

  final newMaterials = (raw['new_materials'] as List?)
      ?.whereType<Map>()
      .map((m) => ProposedMaterial(
            name: (m['name'] ?? '').toString(),
            quantity: (m['quantity'] ?? '').toString(),
            notes: m['notes']?.toString(),
          ))
      .toList();

  final newSafetyNotes = (raw['new_safety_notes'] as List?)
      ?.map((n) => n.toString())
      .where((n) => n.isNotEmpty)
      .toList();

  final newDifficulty = raw['new_difficulty'] == null
      ? null
      : Difficulty.normalize(raw['new_difficulty'].toString());

  final newTotalMinutes = (raw['new_total_minutes'] as num?)?.toInt();
  final newTotalSavings = (raw['new_total_savings_usd'] as num?)?.toInt();

  final hasChanges = (newSteps != null && newSteps.isNotEmpty) ||
      (newTools != null && newTools.isNotEmpty) ||
      (newMaterials != null && newMaterials.isNotEmpty) ||
      (newSafetyNotes != null && newSafetyNotes.isNotEmpty) ||
      newDifficulty != null ||
      (newTotalMinutes != null && newTotalMinutes > 0) ||
      newTotalSavings != null;

  if (!hasChanges) return null;

  return PlanProposal(
    rationale: rationale,
    newSteps: (newSteps != null && newSteps.isNotEmpty) ? newSteps : null,
    newTools: (newTools != null && newTools.isNotEmpty) ? newTools : null,
    newMaterials:
        (newMaterials != null && newMaterials.isNotEmpty) ? newMaterials : null,
    newSafetyNotes: (newSafetyNotes != null && newSafetyNotes.isNotEmpty)
        ? newSafetyNotes
        : null,
    newDifficulty: newDifficulty,
    newTotalMinutes: (newTotalMinutes != null && newTotalMinutes > 0)
        ? newTotalMinutes
        : null,
    newTotalSavingsUsd: newTotalSavings,
  );
}

Future<ChatReply> sendProjectChat(
  Issue issue,
  List<ChatRequestMessage> requestMessages,
) async {
  final systemBlocks = [
    {
      'type': 'text',
      'text': chatSystemPrompt,
      'cache_control': {'type': 'ephemeral'},
    },
    {
      'type': 'text',
      'text':
          'CURRENT REPAIR PROJECT: "${issue.title}"\n\n${_formatPlanForContext(issue.plan)}',
    },
  ];
  final data = await _callAnthropic({
    'model': _modelHaiku,
    'max_tokens': 1500,
    'system': systemBlocks,
    'tools': [proposeUpdatesTool],
    'messages': _toApiMessages(requestMessages),
  });

  final text = _extractText(data);
  final toolInput = _findToolUse(data, 'propose_plan_updates');
  final proposal = toolInput == null ? null : _parseProposal(toolInput);

  return ChatReply(
    text: text.isNotEmpty
        ? text
        : (proposal != null
            ? 'I noticed something that might change your plan — take a look below.'
            : ''),
    proposal: proposal,
  );
}

/// Applies a user-accepted proposal to the plan. Additive only.
RepairPlan applyProposalToPlan(RepairPlan plan, PlanProposal proposal) {
  final newStepItems = (proposal.newSteps ?? [])
      .map((s) => PlanStep(
            id: generateId(),
            title: s.title,
            detail: s.detail,
            estimatedMinutes: s.estimatedMinutes,
            criticalWarning: s.criticalWarning,
            completed: false,
          ))
      .toList();
  final newToolItems = (proposal.newTools ?? [])
      .map((t) => ToolItem(
            id: generateId(),
            name: t.name,
            required: t.required,
            have: false,
          ))
      .toList();
  final newMaterialItems = (proposal.newMaterials ?? [])
      .map((m) => MaterialItem(
            id: generateId(),
            name: m.name,
            quantity: m.quantity,
            notes: m.notes,
            have: false,
          ))
      .toList();

  return RepairPlan(
    difficulty: proposal.newDifficulty ?? plan.difficulty,
    estimatedMinutes: proposal.newTotalMinutes ?? plan.estimatedMinutes,
    estimatedSavingsUsd:
        proposal.newTotalSavingsUsd ?? plan.estimatedSavingsUsd,
    tools: [...plan.tools, ...newToolItems],
    materials: [...plan.materials, ...newMaterialItems],
    steps: [...plan.steps, ...newStepItems],
    safetyNotes: [...plan.safetyNotes, ...(proposal.newSafetyNotes ?? [])],
    risk: plan.risk,
    suggestedReminders: plan.suggestedReminders,
    verificationResult: plan.verificationResult,
  );
}

// --------------------------------------------------------------------------
// Verification
// --------------------------------------------------------------------------

class VerifyResult {
  final bool verified;
  final String feedback;
  final List<PlanStep> fixSteps;

  VerifyResult({
    required this.verified,
    required this.feedback,
    required this.fixSteps,
  });
}

Future<VerifyResult> verifyRepair({
  required Issue issue,
  required String imageBase64,
  String imageMediaType = 'image/jpeg',
}) async {
  final planContext = _formatPlanForContext(issue.plan);
  final msg = ChatRequestMessage(
    role: MessageRole.user,
    text:
        'Here is a photo of my finished repair for "${issue.title}". Please verify whether it looks right. If there\'s something I need to fix, give me concrete steps.\n\nFor context, this was the plan I just worked through:\n$planContext',
    imageBase64: imageBase64,
    imageMediaType: imageMediaType,
  );

  final data = await _callAnthropic({
    'model': _modelSonnet,
    'max_tokens': 1500,
    'system': [
      {
        'type': 'text',
        'text': verifySystemPrompt,
        'cache_control': {'type': 'ephemeral'},
      },
    ],
    'tools': [verifyRepairTool],
    'tool_choice': {'type': 'tool', 'name': 'verify_repair_from_photo'},
    'messages': _toApiMessages([msg]),
  });
  final toolInput = _findToolUse(data, 'verify_repair_from_photo');
  if (toolInput == null) {
    throw ClaudeException('Claude did not return a structured verification.');
  }
  final verified = toolInput['verified'] == true;
  final feedback = (toolInput['feedback'] ?? '').toString().trim();
  final rawFix = (toolInput['fix_steps'] as List?) ?? [];
  final fixSteps = verified
      ? <PlanStep>[]
      : rawFix
          .whereType<Map>()
          .map((s) => PlanStep(
                id: generateId(),
                title: (s['title'] ?? '').toString().trim(),
                detail: (s['detail'] ?? '').toString().trim(),
                estimatedMinutes: (s['estimated_minutes'] as num?)?.toInt(),
                criticalWarning: (s['critical_warning'] as String?)?.trim().isNotEmpty ==
                        true
                    ? (s['critical_warning'] as String).trim()
                    : null,
                completed: false,
              ))
          .where((s) => s.title.isNotEmpty)
          .toList();
  return VerifyResult(verified: verified, feedback: feedback, fixSteps: fixSteps);
}

RepairPlan applyVerificationResult(
  RepairPlan plan,
  VerifyResult verify, {
  String? photoUri,
}) {
  final result = VerificationResult(
    verified: verify.verified,
    feedback: verify.feedback,
    verifiedAt: DateTime.now().millisecondsSinceEpoch,
    photoUri: photoUri,
    fixStepsAdded: verify.fixSteps.length,
  );
  return plan.copyWith(
    steps: verify.verified ? plan.steps : [...plan.steps, ...verify.fixSteps],
    verificationResult: result,
  );
}

// --------------------------------------------------------------------------
// Manual repair verification (before + after photos)
// --------------------------------------------------------------------------

class ManualVerifyResult {
  final bool verified;
  final String feedback;
  ManualVerifyResult({required this.verified, required this.feedback});
}

Future<ManualVerifyResult> verifyManualRepair({
  required String title,
  required String description,
  required String beforeImageBase64,
  required String afterImageBase64,
  String imageMediaType = 'image/jpeg',
}) async {
  final userContent = [
    {
      'type': 'text',
      'text':
          'I\'m logging a repair I already did: "$title"${description.isNotEmpty ? ' — $description' : ''}.\n\nHere is the BEFORE photo (the problem):',
    },
    {
      'type': 'image',
      'source': {
        'type': 'base64',
        'media_type': imageMediaType,
        'data': beforeImageBase64,
      },
    },
    {'type': 'text', 'text': 'And here is the AFTER photo (the fix):'},
    {
      'type': 'image',
      'source': {
        'type': 'base64',
        'media_type': imageMediaType,
        'data': afterImageBase64,
      },
    },
    {
      'type': 'text',
      'text':
          'Based on comparing the before and after photos, does the repair look like it was done correctly? Please call the verify_repair_from_photo tool.',
    },
  ];

  final data = await _callAnthropic({
    'model': _modelSonnet,
    'max_tokens': 1500,
    'system': [
      {
        'type': 'text',
        'text': manualVerifySystemPrompt,
        'cache_control': {'type': 'ephemeral'},
      },
    ],
    'tools': [verifyRepairTool],
    'tool_choice': {'type': 'tool', 'name': 'verify_repair_from_photo'},
    'messages': [
      {'role': 'user', 'content': userContent},
    ],
  });
  final toolInput = _findToolUse(data, 'verify_repair_from_photo');
  if (toolInput == null) {
    return ManualVerifyResult(
      verified: false,
      feedback: 'Could not verify — please try again.',
    );
  }
  return ManualVerifyResult(
    verified: toolInput['verified'] == true,
    feedback: (toolInput['feedback'] ?? '').toString().trim(),
  );
}

// --------------------------------------------------------------------------
// Ask HandyBot (general Q&A)
// --------------------------------------------------------------------------

Future<String> askHandyBot(List<ChatRequestMessage> messages) async {
  final data = await _callAnthropic({
    'model': _modelHaiku,
    'max_tokens': 1000,
    'system': [
      {
        'type': 'text',
        'text': askSystemPrompt,
        'cache_control': {'type': 'ephemeral'},
      },
    ],
    'messages': _toApiMessages(messages),
  });
  return _extractText(data);
}

// --------------------------------------------------------------------------
// Home item analysis
// --------------------------------------------------------------------------

class AnalyzedItem {
  final String name;
  final String category;
  final int estimatedAgeYears;
  final int typicalLifespanYears;
  final String condition;
  final String conditionNotes;
  final List<String> maintenanceTips;
  final String icon;
  final List<HomeItemReminder> suggestedReminders;

  AnalyzedItem({
    required this.name,
    required this.category,
    required this.estimatedAgeYears,
    required this.typicalLifespanYears,
    required this.condition,
    required this.conditionNotes,
    required this.maintenanceTips,
    required this.icon,
    required this.suggestedReminders,
  });
}

Future<AnalyzedItem> analyzeHomeItem({
  required String imageBase64,
  String imageMediaType = 'image/jpeg',
  String? note,
}) async {
  final text = (note ?? '').trim().isNotEmpty
      ? note!.trim()
      : 'What is this item? Please analyze its age, condition, and give me maintenance tips.';
  final msg = ChatRequestMessage(
    role: MessageRole.user,
    text: text,
    imageBase64: imageBase64,
    imageMediaType: imageMediaType,
  );

  final data = await _callAnthropic({
    'model': _modelSonnet,
    'max_tokens': 1500,
    'system': [
      {
        'type': 'text',
        'text': analyzeItemSystemPrompt,
        'cache_control': {'type': 'ephemeral'},
      },
    ],
    'tools': [analyzeItemTool],
    'tool_choice': {'type': 'tool', 'name': 'analyze_home_item'},
    'messages': _toApiMessages([msg]),
  });
  final toolInput = _findToolUse(data, 'analyze_home_item');
  if (toolInput == null) {
    throw ClaudeException('Claude did not return item analysis. Try again.');
  }

  const conditions = [
    ItemCondition.good,
    ItemCondition.fair,
    ItemCondition.poor,
    ItemCondition.replaceSoon,
  ];
  final rawCondition = (toolInput['condition'] ?? 'fair').toString();
  final condition =
      conditions.contains(rawCondition) ? rawCondition : ItemCondition.fair;

  final rawReminders = (toolInput['suggested_reminders'] as List?) ?? [];
  final reminders = rawReminders.whereType<Map>().map((r) {
    final iconRaw = (r['icon'] ?? '🛠').toString().trim();
    return HomeItemReminder(
      title: (r['title'] ?? '').toString().trim(),
      description: (r['description'] ?? '').toString().trim(),
      frequencyDays: (r['frequency_days'] as num?)?.toInt() ?? 0,
      icon: iconRaw.isEmpty
          ? '🛠'
          : iconRaw.substring(0, iconRaw.length > 4 ? 4 : iconRaw.length),
    );
  }).where((r) => r.title.isNotEmpty && r.frequencyDays > 0).toList();

  final iconRaw = (toolInput['icon'] ?? '🏠').toString().trim();
  return AnalyzedItem(
    name: (toolInput['name'] ?? 'Unknown item').toString().trim(),
    category: (toolInput['category'] ?? 'other').toString().trim(),
    estimatedAgeYears: (toolInput['estimated_age_years'] as num?)?.toInt() ?? 0,
    typicalLifespanYears:
        (toolInput['typical_lifespan_years'] as num?)?.toInt() ?? 0,
    condition: condition,
    conditionNotes: (toolInput['condition_notes'] ?? '').toString().trim(),
    maintenanceTips: ((toolInput['maintenance_tips'] as List?) ?? [])
        .map((t) => t.toString().trim())
        .where((t) => t.isNotEmpty)
        .toList(),
    icon: iconRaw.isEmpty
        ? '🏠'
        : iconRaw.substring(0, iconRaw.length > 4 ? 4 : iconRaw.length),
    suggestedReminders: reminders,
  );
}
