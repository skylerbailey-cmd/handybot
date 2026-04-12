import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { Alert } from "react-native";
import ReminderForm, { type ReminderFormValues } from "@/components/ReminderForm";
import { createCustomReminder } from "@/lib/reminders";

const DAY_MS = 24 * 60 * 60 * 1000;

export default function NewReminderScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    prefillTitle?: string;
    prefillDescription?: string;
    prefillIcon?: string;
    prefillFrequencyDays?: string;
    sourceItemId?: string;
  }>();
  const [submitting, setSubmitting] = useState(false);

  const initial = useMemo(() => {
    if (!params.prefillTitle) return undefined;
    const freqDays = Number(params.prefillFrequencyDays) || 90;
    return {
      title: params.prefillTitle,
      description: params.prefillDescription ?? "",
      icon: params.prefillIcon ?? "🛠",
      frequencyDays: freqDays,
      nextDue: Date.now() + freqDays * DAY_MS,
    };
  }, [params]);

  async function handleSubmit(values: ReminderFormValues) {
    if (submitting) return;
    setSubmitting(true);
    try {
      await createCustomReminder({
        title: values.title,
        description: values.description,
        icon: values.icon,
        frequencyDays: values.frequencyDays,
        startDate: new Date(values.nextDue),
        sourceIssueId: params.sourceItemId,
      });
      router.back();
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Could not save reminder.";
      Alert.alert("Something went wrong", msg);
      setSubmitting(false);
    }
  }

  return (
    <ReminderForm
      initial={initial}
      submitLabel="Create reminder"
      submitting={submitting}
      onSubmit={handleSubmit}
      startLabel="Start on"
    />
  );
}
