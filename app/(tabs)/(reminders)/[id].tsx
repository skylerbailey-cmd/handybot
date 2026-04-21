import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";
import PrimaryButton from "@/components/PrimaryButton";
import ReminderForm, { type ReminderFormValues } from "@/components/ReminderForm";
import {
  deleteReminder,
  getReminder,
  updateReminder,
} from "@/lib/reminders";
import { colors, spacing } from "@/lib/theme";
import type { Reminder } from "@/lib/types";

export default function EditReminderScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [reminder, setReminder] = useState<Reminder | null | undefined>(
    undefined
  );
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!id) return;
    getReminder(id).then((r) => setReminder(r ?? null));
  }, [id]);

  async function handleSubmit(values: ReminderFormValues) {
    if (!reminder || submitting) return;
    setSubmitting(true);
    try {
      await updateReminder({
        reminderId: reminder.id,
        title: values.title,
        description: values.description,
        icon: values.icon,
        frequencyDays: values.frequencyDays,
        nextDue: values.nextDue,
      });
      router.back();
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Could not save reminder.";
      Alert.alert("Something went wrong", msg);
      setSubmitting(false);
    }
  }

  function handleDelete() {
    if (!reminder) return;
    Alert.alert(
      "Delete reminder?",
      `"${reminder.title}" will be removed and any scheduled notification canceled.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            await deleteReminder(reminder.id);
            router.back();
          },
        },
      ]
    );
  }

  if (reminder === undefined) {
    return (
      <View style={styles.centered}>
        <Text style={styles.loading}>Loading...</Text>
      </View>
    );
  }

  if (reminder === null) {
    return (
      <View style={styles.centered}>
        <Text style={styles.missing}>Reminder not found</Text>
      </View>
    );
  }

  return (
    <ReminderForm
      initial={{
        title: reminder.title,
        description: reminder.description ?? "",
        icon: reminder.icon,
        frequencyDays: reminder.frequencyDays,
        nextDue: reminder.nextDue,
      }}
      submitLabel="Save changes"
      submitting={submitting}
      onSubmit={handleSubmit}
      startLabel="Next due"
      renderExtraActions={() => (
        <PrimaryButton
          title="Delete reminder"
          onPress={handleDelete}
          variant="danger"
          style={{ marginBottom: spacing.sm }}
        />
      )}
    />
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
  },
  loading: {
    fontSize: 14,
    color: colors.textMuted,
  },
  missing: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.text,
  },
});
