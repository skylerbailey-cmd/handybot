import 'package:flutter/material.dart';

import '../models/models.dart';
import '../theme/app_theme.dart';

/// Step-by-step walkthrough widget. Shows the current step in a large card,
/// a progress bar / dots, and navigation buttons. Step-scoped help opens a
/// modal (handled by parent via [onAskAboutStep]).
class InteractiveStepper extends StatefulWidget {
  final List<PlanStep> steps;
  final void Function(String stepId, bool completed) onToggleStep;
  final void Function(PlanStep step)? onAskAboutStep;

  const InteractiveStepper({
    super.key,
    required this.steps,
    required this.onToggleStep,
    this.onAskAboutStep,
  });

  @override
  State<InteractiveStepper> createState() => _InteractiveStepperState();
}

class _InteractiveStepperState extends State<InteractiveStepper> {
  late int _current;

  @override
  void initState() {
    super.initState();
    _current = _firstIncomplete();
  }

  int _firstIncomplete() {
    for (var i = 0; i < widget.steps.length; i++) {
      if (!widget.steps[i].completed) return i;
    }
    return widget.steps.length - 1;
  }

  @override
  void didUpdateWidget(InteractiveStepper oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (_current >= widget.steps.length) {
      _current = widget.steps.length - 1;
    }
  }

  @override
  Widget build(BuildContext context) {
    if (widget.steps.isEmpty) {
      return const Padding(
        padding: EdgeInsets.all(AppSpacing.md),
        child: Text('No steps yet.'),
      );
    }
    final total = widget.steps.length;
    final done = widget.steps.where((s) => s.completed).length;
    final step = widget.steps[_current];

    return Container(
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(AppRadius.lg),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Text(
                'STEP ${_current + 1} OF $total',
                style: const TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w800,
                  color: AppColors.brandDark,
                  letterSpacing: 0.6,
                ),
              ),
              const Spacer(),
              Text(
                '$done / $total done',
                style: const TextStyle(
                  fontSize: 11,
                  color: AppColors.textMuted,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.sm),
          ClipRRect(
            borderRadius: BorderRadius.circular(AppRadius.pill),
            child: LinearProgressIndicator(
              value: total == 0 ? 0 : done / total,
              backgroundColor: AppColors.chipBg,
              valueColor:
                  const AlwaysStoppedAnimation<Color>(AppColors.brand),
              minHeight: 6,
            ),
          ),
          const SizedBox(height: AppSpacing.md),
          Text(
            step.title,
            style: const TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.w800,
              color: AppColors.text,
            ),
          ),
          if (step.estimatedMinutes != null) ...[
            const SizedBox(height: 4),
            Text(
              '~${formatDuration(step.estimatedMinutes!)}',
              style: const TextStyle(
                fontSize: 12,
                color: AppColors.textMuted,
                fontWeight: FontWeight.w700,
              ),
            ),
          ],
          const SizedBox(height: AppSpacing.sm),
          Text(
            step.detail,
            style: const TextStyle(
                fontSize: 14, color: AppColors.text, height: 1.5),
          ),
          if (step.criticalWarning != null &&
              step.criticalWarning!.isNotEmpty) ...[
            const SizedBox(height: AppSpacing.sm),
            Container(
              padding: const EdgeInsets.all(AppSpacing.sm + 2),
              decoration: BoxDecoration(
                color: AppColors.dangerBg,
                borderRadius: BorderRadius.circular(AppRadius.md),
                border:
                    Border.all(color: AppColors.danger.withValues(alpha: 0.3)),
              ),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('⚠', style: TextStyle(fontSize: 18)),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          "DON'T MESS THIS UP",
                          style: TextStyle(
                            fontSize: 10,
                            fontWeight: FontWeight.w800,
                            color: AppColors.danger,
                            letterSpacing: 0.6,
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          step.criticalWarning!,
                          style: const TextStyle(
                            fontSize: 13,
                            color: AppColors.text,
                            height: 1.4,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ],
          const SizedBox(height: AppSpacing.md),
          Row(
            children: [
              OutlinedButton.icon(
                onPressed: _current > 0
                    ? () => setState(() => _current--)
                    : null,
                icon: const Icon(Icons.arrow_back, size: 16),
                label: const Text('Back'),
              ),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: FilledButton.icon(
                  style: FilledButton.styleFrom(
                    backgroundColor:
                        step.completed ? AppColors.success : AppColors.brand,
                  ),
                  onPressed: () {
                    widget.onToggleStep(step.id, !step.completed);
                    if (!step.completed && _current < total - 1) {
                      setState(() => _current++);
                    }
                  },
                  icon: Icon(
                    step.completed ? Icons.undo : Icons.check,
                    size: 16,
                  ),
                  label: Text(step.completed ? 'Undo' : 'Mark done'),
                ),
              ),
              const SizedBox(width: AppSpacing.sm),
              OutlinedButton.icon(
                onPressed: _current < total - 1
                    ? () => setState(() => _current++)
                    : null,
                icon: const Icon(Icons.arrow_forward, size: 16),
                label: const Text('Next'),
              ),
            ],
          ),
          if (widget.onAskAboutStep != null) ...[
            const SizedBox(height: AppSpacing.sm),
            Align(
              alignment: Alignment.centerRight,
              child: TextButton.icon(
                onPressed: () => widget.onAskAboutStep!(step),
                icon: const Icon(Icons.chat_bubble_outline, size: 14),
                label: const Text('Ask about this step'),
              ),
            ),
          ],
          if (total > 1) ...[
            const SizedBox(height: AppSpacing.sm),
            Wrap(
              alignment: WrapAlignment.center,
              spacing: 6,
              runSpacing: 6,
              children: List.generate(total, (i) {
                final s = widget.steps[i];
                final active = i == _current;
                return GestureDetector(
                  onTap: () => setState(() => _current = i),
                  child: Container(
                    width: 22,
                    height: 22,
                    alignment: Alignment.center,
                    decoration: BoxDecoration(
                      color: s.completed
                          ? AppColors.success
                          : active
                              ? AppColors.brand
                              : AppColors.chipBg,
                      borderRadius: BorderRadius.circular(AppRadius.pill),
                    ),
                    child: Text(
                      s.completed ? '✓' : '${i + 1}',
                      style: TextStyle(
                        fontSize: 10,
                        fontWeight: FontWeight.w800,
                        color: (s.completed || active)
                            ? Colors.white
                            : AppColors.textMuted,
                      ),
                    ),
                  ),
                );
              }),
            ),
          ],
        ],
      ),
    );
  }
}
