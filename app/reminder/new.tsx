import { useRouter } from "expo-router";
import { useState } from "react";
import { Alert } from "react-native";
import ReminderForm, { type ReminderFormValues } from "@/components/ReminderForm";
import { createCustomReminder } from "@/lib/reminders";

export default function NewReminderScreen() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

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
      submitLabel="Create reminder"
      submitting={submitting}
      onSubmit={handleSubmit}
      startLabel="Start on"
    />
  );
}
