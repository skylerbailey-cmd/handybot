import 'package:uuid/uuid.dart';

const _uuid = Uuid();

String generateId() => _uuid.v4();

// ---------------------------------------------------------------------------
// Enum-like string constants (to match original TS string unions without
// forcing a runtime enum type).
// ---------------------------------------------------------------------------

class MessageRole {
  static const user = 'user';
  static const assistant = 'assistant';
}

class ProposalStatus {
  static const pending = 'pending';
  static const accepted = 'accepted';
  static const dismissed = 'dismissed';
}

class IssueStatus {
  static const inProgress = 'in_progress';
  static const completed = 'completed';
  static const verified = 'verified';
}

class Difficulty {
  static const easy = 'Easy';
  static const medium = 'Medium';
  static const hard = 'Hard';
  static const callAPro = 'Call a pro';

  static const all = [easy, medium, hard, callAPro];

  static String normalize(String raw) {
    final lower = raw.trim().toLowerCase();
    for (final d in all) {
      if (d.toLowerCase() == lower) return d;
    }
    return medium;
  }
}

class RiskSeverity {
  static const low = 'low';
  static const medium = 'medium';
  static const high = 'high';
  static const all = [low, medium, high];
}

class RiskCategory {
  static const electrical = 'electrical';
  static const plumbing = 'plumbing';
  static const gas = 'gas';
  static const structural = 'structural';
  static const height = 'height';
  static const chemical = 'chemical';
  static const fire = 'fire';
  static const sharps = 'sharps';
  static const general = 'general';
  static const all = [
    electrical,
    plumbing,
    gas,
    structural,
    height,
    chemical,
    fire,
    sharps,
    general,
  ];
}

class ReminderCategory {
  static const hvac = 'hvac';
  static const plumbing = 'plumbing';
  static const exterior = 'exterior';
  static const interior = 'interior';
  static const appliance = 'appliance';
  static const safety = 'safety';
  static const yard = 'yard';
  static const general = 'general';
}

class ItemCondition {
  static const good = 'good';
  static const fair = 'fair';
  static const poor = 'poor';
  static const replaceSoon = 'replace_soon';
}

// ---------------------------------------------------------------------------
// Chat / plan proposal
// ---------------------------------------------------------------------------

class ProposedStep {
  final String title;
  final String detail;
  final int estimatedMinutes;
  final String? criticalWarning;

  ProposedStep({
    required this.title,
    required this.detail,
    required this.estimatedMinutes,
    this.criticalWarning,
  });

  factory ProposedStep.fromJson(Map<String, dynamic> j) => ProposedStep(
        title: j['title'] as String,
        detail: j['detail'] as String,
        estimatedMinutes: (j['estimatedMinutes'] as num).toInt(),
        criticalWarning: j['criticalWarning'] as String?,
      );

  Map<String, dynamic> toJson() => {
        'title': title,
        'detail': detail,
        'estimatedMinutes': estimatedMinutes,
        if (criticalWarning != null) 'criticalWarning': criticalWarning,
      };
}

class ProposedTool {
  final String name;
  final bool required;

  ProposedTool({required this.name, required this.required});

  factory ProposedTool.fromJson(Map<String, dynamic> j) => ProposedTool(
        name: j['name'] as String,
        required: j['required'] as bool,
      );

  Map<String, dynamic> toJson() => {'name': name, 'required': required};
}

class ProposedMaterial {
  final String name;
  final String quantity;
  final String? notes;

  ProposedMaterial({required this.name, required this.quantity, this.notes});

  factory ProposedMaterial.fromJson(Map<String, dynamic> j) => ProposedMaterial(
        name: j['name'] as String,
        quantity: j['quantity'] as String,
        notes: j['notes'] as String?,
      );

  Map<String, dynamic> toJson() => {
        'name': name,
        'quantity': quantity,
        if (notes != null) 'notes': notes,
      };
}

class PlanProposal {
  final String rationale;
  final List<ProposedStep>? newSteps;
  final List<ProposedTool>? newTools;
  final List<ProposedMaterial>? newMaterials;
  final List<String>? newSafetyNotes;
  final String? newDifficulty;
  final int? newTotalMinutes;
  final int? newTotalSavingsUsd;
  final String status;

  PlanProposal({
    required this.rationale,
    this.newSteps,
    this.newTools,
    this.newMaterials,
    this.newSafetyNotes,
    this.newDifficulty,
    this.newTotalMinutes,
    this.newTotalSavingsUsd,
    this.status = ProposalStatus.pending,
  });

  PlanProposal copyWith({String? status}) => PlanProposal(
        rationale: rationale,
        newSteps: newSteps,
        newTools: newTools,
        newMaterials: newMaterials,
        newSafetyNotes: newSafetyNotes,
        newDifficulty: newDifficulty,
        newTotalMinutes: newTotalMinutes,
        newTotalSavingsUsd: newTotalSavingsUsd,
        status: status ?? this.status,
      );

  factory PlanProposal.fromJson(Map<String, dynamic> j) => PlanProposal(
        rationale: j['rationale'] as String,
        newSteps: (j['newSteps'] as List?)
            ?.map((e) => ProposedStep.fromJson(e as Map<String, dynamic>))
            .toList(),
        newTools: (j['newTools'] as List?)
            ?.map((e) => ProposedTool.fromJson(e as Map<String, dynamic>))
            .toList(),
        newMaterials: (j['newMaterials'] as List?)
            ?.map((e) => ProposedMaterial.fromJson(e as Map<String, dynamic>))
            .toList(),
        newSafetyNotes: (j['newSafetyNotes'] as List?)?.cast<String>(),
        newDifficulty: j['newDifficulty'] as String?,
        newTotalMinutes: (j['newTotalMinutes'] as num?)?.toInt(),
        newTotalSavingsUsd: (j['newTotalSavingsUsd'] as num?)?.toInt(),
        status: j['status'] as String? ?? ProposalStatus.pending,
      );

  Map<String, dynamic> toJson() => {
        'rationale': rationale,
        if (newSteps != null)
          'newSteps': newSteps!.map((e) => e.toJson()).toList(),
        if (newTools != null)
          'newTools': newTools!.map((e) => e.toJson()).toList(),
        if (newMaterials != null)
          'newMaterials': newMaterials!.map((e) => e.toJson()).toList(),
        if (newSafetyNotes != null) 'newSafetyNotes': newSafetyNotes,
        if (newDifficulty != null) 'newDifficulty': newDifficulty,
        if (newTotalMinutes != null) 'newTotalMinutes': newTotalMinutes,
        if (newTotalSavingsUsd != null)
          'newTotalSavingsUsd': newTotalSavingsUsd,
        'status': status,
      };
}

class ChatMessage {
  final String id;
  final String role;
  final String text;
  final String? imageUri;
  final int createdAt;
  final PlanProposal? proposal;
  final String? relatedStepId;

  ChatMessage({
    required this.id,
    required this.role,
    required this.text,
    this.imageUri,
    required this.createdAt,
    this.proposal,
    this.relatedStepId,
  });

  ChatMessage copyWith({PlanProposal? proposal, String? imageUri}) =>
      ChatMessage(
        id: id,
        role: role,
        text: text,
        imageUri: imageUri ?? this.imageUri,
        createdAt: createdAt,
        proposal: proposal ?? this.proposal,
        relatedStepId: relatedStepId,
      );

  factory ChatMessage.fromJson(Map<String, dynamic> j) => ChatMessage(
        id: j['id'] as String,
        role: j['role'] as String,
        text: j['text'] as String,
        imageUri: j['imageUri'] as String?,
        createdAt: (j['createdAt'] as num).toInt(),
        proposal: j['proposal'] == null
            ? null
            : PlanProposal.fromJson(j['proposal'] as Map<String, dynamic>),
        relatedStepId: j['relatedStepId'] as String?,
      );

  Map<String, dynamic> toJson() => {
        'id': id,
        'role': role,
        'text': text,
        if (imageUri != null) 'imageUri': imageUri,
        'createdAt': createdAt,
        if (proposal != null) 'proposal': proposal!.toJson(),
        if (relatedStepId != null) 'relatedStepId': relatedStepId,
      };
}

// ---------------------------------------------------------------------------
// Repair plan
// ---------------------------------------------------------------------------

class RiskAssessment {
  final String severity;
  final String category;
  final String headline;
  final String rationale;
  final bool callAProRecommended;

  RiskAssessment({
    required this.severity,
    required this.category,
    required this.headline,
    required this.rationale,
    required this.callAProRecommended,
  });

  factory RiskAssessment.fromJson(Map<String, dynamic> j) => RiskAssessment(
        severity: j['severity'] as String,
        category: j['category'] as String,
        headline: j['headline'] as String,
        rationale: j['rationale'] as String,
        callAProRecommended: j['callAProRecommended'] as bool,
      );

  Map<String, dynamic> toJson() => {
        'severity': severity,
        'category': category,
        'headline': headline,
        'rationale': rationale,
        'callAProRecommended': callAProRecommended,
      };
}

class ToolItem {
  final String id;
  final String name;
  final bool required;
  final bool have;

  ToolItem({
    required this.id,
    required this.name,
    required this.required,
    required this.have,
  });

  ToolItem copyWith({bool? have}) => ToolItem(
        id: id,
        name: name,
        required: required,
        have: have ?? this.have,
      );

  factory ToolItem.fromJson(Map<String, dynamic> j) => ToolItem(
        id: j['id'] as String,
        name: j['name'] as String,
        required: j['required'] as bool,
        have: j['have'] as bool? ?? false,
      );

  Map<String, dynamic> toJson() => {
        'id': id,
        'name': name,
        'required': required,
        'have': have,
      };
}

class MaterialItem {
  final String id;
  final String name;
  final String quantity;
  final String? notes;
  final double? estimatedPriceUsd;
  final bool have;

  MaterialItem({
    required this.id,
    required this.name,
    required this.quantity,
    this.notes,
    this.estimatedPriceUsd,
    required this.have,
  });

  MaterialItem copyWith({bool? have}) => MaterialItem(
        id: id,
        name: name,
        quantity: quantity,
        notes: notes,
        estimatedPriceUsd: estimatedPriceUsd,
        have: have ?? this.have,
      );

  factory MaterialItem.fromJson(Map<String, dynamic> j) => MaterialItem(
        id: j['id'] as String,
        name: j['name'] as String,
        quantity: j['quantity'] as String,
        notes: j['notes'] as String?,
        estimatedPriceUsd: (j['estimatedPriceUsd'] as num?)?.toDouble(),
        have: j['have'] as bool? ?? false,
      );

  Map<String, dynamic> toJson() => {
        'id': id,
        'name': name,
        'quantity': quantity,
        if (notes != null) 'notes': notes,
        if (estimatedPriceUsd != null) 'estimatedPriceUsd': estimatedPriceUsd,
        'have': have,
      };
}

class PlanStep {
  final String id;
  final String title;
  final String detail;
  final int? estimatedMinutes;
  final String? criticalWarning;
  final bool completed;

  PlanStep({
    required this.id,
    required this.title,
    required this.detail,
    this.estimatedMinutes,
    this.criticalWarning,
    required this.completed,
  });

  PlanStep copyWith({bool? completed}) => PlanStep(
        id: id,
        title: title,
        detail: detail,
        estimatedMinutes: estimatedMinutes,
        criticalWarning: criticalWarning,
        completed: completed ?? this.completed,
      );

  factory PlanStep.fromJson(Map<String, dynamic> j) => PlanStep(
        id: j['id'] as String,
        title: j['title'] as String,
        detail: j['detail'] as String,
        estimatedMinutes: (j['estimatedMinutes'] as num?)?.toInt(),
        criticalWarning: j['criticalWarning'] as String?,
        completed: j['completed'] as bool? ?? false,
      );

  Map<String, dynamic> toJson() => {
        'id': id,
        'title': title,
        'detail': detail,
        if (estimatedMinutes != null) 'estimatedMinutes': estimatedMinutes,
        if (criticalWarning != null) 'criticalWarning': criticalWarning,
        'completed': completed,
      };
}

class SuggestedReminder {
  final String title;
  final String description;
  final int frequencyDays;
  final String icon;

  SuggestedReminder({
    required this.title,
    required this.description,
    required this.frequencyDays,
    required this.icon,
  });

  factory SuggestedReminder.fromJson(Map<String, dynamic> j) =>
      SuggestedReminder(
        title: j['title'] as String,
        description: j['description'] as String,
        frequencyDays: (j['frequencyDays'] as num).toInt(),
        icon: j['icon'] as String? ?? '🛠',
      );

  Map<String, dynamic> toJson() => {
        'title': title,
        'description': description,
        'frequencyDays': frequencyDays,
        'icon': icon,
      };
}

class VerificationResult {
  final bool verified;
  final String feedback;
  final int verifiedAt;
  final String? photoUri;
  final int? fixStepsAdded;

  VerificationResult({
    required this.verified,
    required this.feedback,
    required this.verifiedAt,
    this.photoUri,
    this.fixStepsAdded,
  });

  factory VerificationResult.fromJson(Map<String, dynamic> j) =>
      VerificationResult(
        verified: j['verified'] as bool,
        feedback: j['feedback'] as String,
        verifiedAt: (j['verifiedAt'] as num).toInt(),
        photoUri: j['photoUri'] as String?,
        fixStepsAdded: (j['fixStepsAdded'] as num?)?.toInt(),
      );

  Map<String, dynamic> toJson() => {
        'verified': verified,
        'feedback': feedback,
        'verifiedAt': verifiedAt,
        if (photoUri != null) 'photoUri': photoUri,
        if (fixStepsAdded != null) 'fixStepsAdded': fixStepsAdded,
      };
}

class RepairPlan {
  final String difficulty;
  final int estimatedMinutes;
  final int estimatedSavingsUsd;
  final List<ToolItem> tools;
  final List<MaterialItem> materials;
  final List<PlanStep> steps;
  final List<String> safetyNotes;
  final RiskAssessment? risk;
  final List<SuggestedReminder>? suggestedReminders;
  final VerificationResult? verificationResult;

  RepairPlan({
    required this.difficulty,
    required this.estimatedMinutes,
    required this.estimatedSavingsUsd,
    required this.tools,
    required this.materials,
    required this.steps,
    required this.safetyNotes,
    this.risk,
    this.suggestedReminders,
    this.verificationResult,
  });

  RepairPlan copyWith({
    String? difficulty,
    int? estimatedMinutes,
    int? estimatedSavingsUsd,
    List<ToolItem>? tools,
    List<MaterialItem>? materials,
    List<PlanStep>? steps,
    List<String>? safetyNotes,
    RiskAssessment? risk,
    List<SuggestedReminder>? suggestedReminders,
    VerificationResult? verificationResult,
  }) =>
      RepairPlan(
        difficulty: difficulty ?? this.difficulty,
        estimatedMinutes: estimatedMinutes ?? this.estimatedMinutes,
        estimatedSavingsUsd: estimatedSavingsUsd ?? this.estimatedSavingsUsd,
        tools: tools ?? this.tools,
        materials: materials ?? this.materials,
        steps: steps ?? this.steps,
        safetyNotes: safetyNotes ?? this.safetyNotes,
        risk: risk ?? this.risk,
        suggestedReminders: suggestedReminders ?? this.suggestedReminders,
        verificationResult: verificationResult ?? this.verificationResult,
      );

  factory RepairPlan.fromJson(Map<String, dynamic> j) => RepairPlan(
        difficulty: j['difficulty'] as String,
        estimatedMinutes: (j['estimatedMinutes'] as num?)?.toInt() ?? 0,
        estimatedSavingsUsd:
            (j['estimatedSavingsUsd'] as num?)?.toInt() ?? 0,
        tools: (j['tools'] as List? ?? [])
            .map((e) => ToolItem.fromJson(e as Map<String, dynamic>))
            .toList(),
        materials: (j['materials'] as List? ?? [])
            .map((e) => MaterialItem.fromJson(e as Map<String, dynamic>))
            .toList(),
        steps: (j['steps'] as List? ?? [])
            .map((e) => PlanStep.fromJson(e as Map<String, dynamic>))
            .toList(),
        safetyNotes: (j['safetyNotes'] as List? ?? []).cast<String>(),
        risk: j['risk'] == null
            ? null
            : RiskAssessment.fromJson(j['risk'] as Map<String, dynamic>),
        suggestedReminders: (j['suggestedReminders'] as List?)
            ?.map(
              (e) => SuggestedReminder.fromJson(e as Map<String, dynamic>),
            )
            .toList(),
        verificationResult: j['verificationResult'] == null
            ? null
            : VerificationResult.fromJson(
                j['verificationResult'] as Map<String, dynamic>,
              ),
      );

  Map<String, dynamic> toJson() => {
        'difficulty': difficulty,
        'estimatedMinutes': estimatedMinutes,
        'estimatedSavingsUsd': estimatedSavingsUsd,
        'tools': tools.map((e) => e.toJson()).toList(),
        'materials': materials.map((e) => e.toJson()).toList(),
        'steps': steps.map((e) => e.toJson()).toList(),
        'safetyNotes': safetyNotes,
        if (risk != null) 'risk': risk!.toJson(),
        if (suggestedReminders != null)
          'suggestedReminders':
              suggestedReminders!.map((e) => e.toJson()).toList(),
        if (verificationResult != null)
          'verificationResult': verificationResult!.toJson(),
      };
}

// ---------------------------------------------------------------------------
// Issue
// ---------------------------------------------------------------------------

class Issue {
  final String id;
  final String title;
  final String summary;
  final String status;
  final int createdAt;
  final int updatedAt;
  final String? coverImageUri;
  final RepairPlan plan;
  final List<ChatMessage> messages;

  Issue({
    required this.id,
    required this.title,
    required this.summary,
    required this.status,
    required this.createdAt,
    required this.updatedAt,
    this.coverImageUri,
    required this.plan,
    required this.messages,
  });

  Issue copyWith({
    String? title,
    String? summary,
    String? status,
    int? updatedAt,
    String? coverImageUri,
    RepairPlan? plan,
    List<ChatMessage>? messages,
  }) =>
      Issue(
        id: id,
        title: title ?? this.title,
        summary: summary ?? this.summary,
        status: status ?? this.status,
        createdAt: createdAt,
        updatedAt: updatedAt ?? this.updatedAt,
        coverImageUri: coverImageUri ?? this.coverImageUri,
        plan: plan ?? this.plan,
        messages: messages ?? this.messages,
      );

  factory Issue.fromJson(Map<String, dynamic> j) => Issue(
        id: j['id'] as String,
        title: j['title'] as String,
        summary: j['summary'] as String? ?? '',
        // Normalize legacy "resolved" → "verified"
        status: (j['status'] as String) == 'resolved'
            ? IssueStatus.verified
            : j['status'] as String,
        createdAt: (j['createdAt'] as num).toInt(),
        updatedAt: (j['updatedAt'] as num).toInt(),
        coverImageUri: j['coverImageUri'] as String?,
        plan: RepairPlan.fromJson(j['plan'] as Map<String, dynamic>),
        messages: (j['messages'] as List? ?? [])
            .map((e) => ChatMessage.fromJson(e as Map<String, dynamic>))
            .toList(),
      );

  Map<String, dynamic> toJson() => {
        'id': id,
        'title': title,
        'summary': summary,
        'status': status,
        'createdAt': createdAt,
        'updatedAt': updatedAt,
        if (coverImageUri != null) 'coverImageUri': coverImageUri,
        'plan': plan.toJson(),
        'messages': messages.map((e) => e.toJson()).toList(),
      };
}

// ---------------------------------------------------------------------------
// User
// ---------------------------------------------------------------------------

class User {
  final String id;
  final String name;
  final int createdAt;

  User({required this.id, required this.name, required this.createdAt});

  factory User.fromJson(Map<String, dynamic> j) => User(
        id: j['id'] as String,
        name: j['name'] as String,
        createdAt: (j['createdAt'] as num).toInt(),
      );

  Map<String, dynamic> toJson() =>
      {'id': id, 'name': name, 'createdAt': createdAt};
}

// ---------------------------------------------------------------------------
// Reminders
// ---------------------------------------------------------------------------

class MaintenanceTemplate {
  final String id;
  final String title;
  final String description;
  final String category;
  final String icon;
  final int frequencyDays;

  const MaintenanceTemplate({
    required this.id,
    required this.title,
    required this.description,
    required this.category,
    required this.icon,
    required this.frequencyDays,
  });
}

class Reminder {
  final String id;
  final String? templateId;
  final String title;
  final String? description;
  final String icon;
  final String category;
  final int frequencyDays;
  final int nextDue;
  final bool enabled;
  final int? notificationId;
  final String? sourceIssueId;
  final int createdAt;

  Reminder({
    required this.id,
    this.templateId,
    required this.title,
    this.description,
    required this.icon,
    required this.category,
    required this.frequencyDays,
    required this.nextDue,
    required this.enabled,
    this.notificationId,
    this.sourceIssueId,
    required this.createdAt,
  });

  Reminder copyWith({
    String? title,
    String? description,
    String? icon,
    int? frequencyDays,
    int? nextDue,
    bool? enabled,
    int? notificationId,
  }) =>
      Reminder(
        id: id,
        templateId: templateId,
        title: title ?? this.title,
        description: description ?? this.description,
        icon: icon ?? this.icon,
        category: category,
        frequencyDays: frequencyDays ?? this.frequencyDays,
        nextDue: nextDue ?? this.nextDue,
        enabled: enabled ?? this.enabled,
        notificationId: notificationId,
        sourceIssueId: sourceIssueId,
        createdAt: createdAt,
      );

  factory Reminder.fromJson(Map<String, dynamic> j) => Reminder(
        id: j['id'] as String,
        templateId: j['templateId'] as String?,
        title: j['title'] as String,
        description: j['description'] as String?,
        icon: j['icon'] as String,
        category: j['category'] as String? ?? ReminderCategory.general,
        frequencyDays: (j['frequencyDays'] as num).toInt(),
        nextDue: (j['nextDue'] as num).toInt(),
        enabled: j['enabled'] as bool? ?? true,
        notificationId: (j['notificationId'] as num?)?.toInt(),
        sourceIssueId: j['sourceIssueId'] as String?,
        createdAt: (j['createdAt'] as num).toInt(),
      );

  Map<String, dynamic> toJson() => {
        'id': id,
        if (templateId != null) 'templateId': templateId,
        'title': title,
        if (description != null) 'description': description,
        'icon': icon,
        'category': category,
        'frequencyDays': frequencyDays,
        'nextDue': nextDue,
        'enabled': enabled,
        if (notificationId != null) 'notificationId': notificationId,
        if (sourceIssueId != null) 'sourceIssueId': sourceIssueId,
        'createdAt': createdAt,
      };
}

// ---------------------------------------------------------------------------
// Home (property)
// ---------------------------------------------------------------------------

class Home {
  final String id;
  final String name;
  final String address;
  final String icon;
  final int createdAt;

  Home({
    required this.id,
    required this.name,
    required this.address,
    required this.icon,
    required this.createdAt,
  });

  factory Home.fromJson(Map<String, dynamic> j) => Home(
        id: j['id'] as String,
        name: j['name'] as String,
        address: j['address'] as String? ?? '',
        icon: j['icon'] as String? ?? '🏠',
        createdAt: (j['createdAt'] as num).toInt(),
      );

  Map<String, dynamic> toJson() => {
        'id': id,
        'name': name,
        'address': address,
        'icon': icon,
        'createdAt': createdAt,
      };
}

// ---------------------------------------------------------------------------
// Home inventory
// ---------------------------------------------------------------------------

class HomeItemReminder {
  final String title;
  final String description;
  final int frequencyDays;
  final String icon;

  HomeItemReminder({
    required this.title,
    required this.description,
    required this.frequencyDays,
    required this.icon,
  });

  factory HomeItemReminder.fromJson(Map<String, dynamic> j) => HomeItemReminder(
        title: j['title'] as String,
        description: j['description'] as String,
        frequencyDays: (j['frequencyDays'] as num).toInt(),
        icon: j['icon'] as String? ?? '🛠',
      );

  Map<String, dynamic> toJson() => {
        'title': title,
        'description': description,
        'frequencyDays': frequencyDays,
        'icon': icon,
      };
}

class HomeItem {
  final String id;
  final String name;
  final String category;
  final String icon;
  final String room;
  final String? photoUri;
  final int estimatedAgeYears;
  final int typicalLifespanYears;
  final String condition;
  final String conditionNotes;
  final List<String> maintenanceTips;
  final List<HomeItemReminder>? suggestedReminders;
  final int createdAt;
  final int updatedAt;

  HomeItem({
    required this.id,
    required this.name,
    required this.category,
    required this.icon,
    required this.room,
    this.photoUri,
    required this.estimatedAgeYears,
    required this.typicalLifespanYears,
    required this.condition,
    required this.conditionNotes,
    required this.maintenanceTips,
    this.suggestedReminders,
    required this.createdAt,
    required this.updatedAt,
  });

  HomeItem copyWith({
    String? name,
    String? room,
    String? condition,
    String? conditionNotes,
  }) =>
      HomeItem(
        id: id,
        name: name ?? this.name,
        category: category,
        icon: icon,
        room: room ?? this.room,
        photoUri: photoUri,
        estimatedAgeYears: estimatedAgeYears,
        typicalLifespanYears: typicalLifespanYears,
        condition: condition ?? this.condition,
        conditionNotes: conditionNotes ?? this.conditionNotes,
        maintenanceTips: maintenanceTips,
        suggestedReminders: suggestedReminders,
        createdAt: createdAt,
        updatedAt: DateTime.now().millisecondsSinceEpoch,
      );

  factory HomeItem.fromJson(Map<String, dynamic> j) => HomeItem(
        id: j['id'] as String,
        name: j['name'] as String,
        category: j['category'] as String? ?? 'other',
        icon: j['icon'] as String? ?? '🏠',
        room: j['room'] as String? ?? '',
        photoUri: j['photoUri'] as String?,
        estimatedAgeYears: (j['estimatedAgeYears'] as num?)?.toInt() ?? 0,
        typicalLifespanYears:
            (j['typicalLifespanYears'] as num?)?.toInt() ?? 0,
        condition: j['condition'] as String? ?? ItemCondition.fair,
        conditionNotes: j['conditionNotes'] as String? ?? '',
        maintenanceTips:
            (j['maintenanceTips'] as List? ?? []).cast<String>(),
        suggestedReminders: (j['suggestedReminders'] as List?)
            ?.map(
              (e) => HomeItemReminder.fromJson(e as Map<String, dynamic>),
            )
            .toList(),
        createdAt: (j['createdAt'] as num).toInt(),
        updatedAt: (j['updatedAt'] as num).toInt(),
      );

  Map<String, dynamic> toJson() => {
        'id': id,
        'name': name,
        'category': category,
        'icon': icon,
        'room': room,
        if (photoUri != null) 'photoUri': photoUri,
        'estimatedAgeYears': estimatedAgeYears,
        'typicalLifespanYears': typicalLifespanYears,
        'condition': condition,
        'conditionNotes': conditionNotes,
        'maintenanceTips': maintenanceTips,
        if (suggestedReminders != null)
          'suggestedReminders':
              suggestedReminders!.map((e) => e.toJson()).toList(),
        'createdAt': createdAt,
        'updatedAt': updatedAt,
      };
}

// ---------------------------------------------------------------------------
// Ask HandyBot
// ---------------------------------------------------------------------------

class AskMessage {
  final String id;
  final String role;
  final String text;
  final String? imageUri;
  final int createdAt;

  AskMessage({
    required this.id,
    required this.role,
    required this.text,
    this.imageUri,
    required this.createdAt,
  });

  factory AskMessage.fromJson(Map<String, dynamic> j) => AskMessage(
        id: j['id'] as String,
        role: j['role'] as String,
        text: j['text'] as String,
        imageUri: j['imageUri'] as String?,
        createdAt: (j['createdAt'] as num).toInt(),
      );

  Map<String, dynamic> toJson() => {
        'id': id,
        'role': role,
        'text': text,
        if (imageUri != null) 'imageUri': imageUri,
        'createdAt': createdAt,
      };
}

class ChatRequestMessage {
  final String role;
  final String text;
  final String? imageBase64;
  final String? imageMediaType;

  ChatRequestMessage({
    required this.role,
    required this.text,
    this.imageBase64,
    this.imageMediaType,
  });
}
