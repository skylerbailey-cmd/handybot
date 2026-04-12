import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  Alert,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import PrimaryButton from "@/components/PrimaryButton";
import { scheduleTestNotification } from "@/lib/reminders";
import { clearUser, ensureUser, wipeAllData } from "@/lib/storage";
import { colors, radius, spacing } from "@/lib/theme";
import type { User } from "@/lib/types";

const TEST_NOTIFICATION_DELAY_SECONDS = 5;
const SUPPORT_EMAIL = "support@grnd-lab.com";
const APP_VERSION = "0.1";

export default function SettingsScreen() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [testPending, setTestPending] = useState(false);

  useEffect(() => {
    ensureUser().then(setUser);
  }, []);

  async function handleTestNotification() {
    if (testPending) return;
    setTestPending(true);
    try {
      const ok = await scheduleTestNotification(TEST_NOTIFICATION_DELAY_SECONDS);
      if (!ok) {
        Alert.alert(
          "Notifications disabled",
          "HandyBot needs notification permission to ping you. Enable notifications for HandyBot in your device Settings and try again."
        );
        return;
      }
      Alert.alert(
        "Test notification scheduled",
        `You'll see a notification in ${TEST_NOTIFICATION_DELAY_SECONDS} seconds. Put HandyBot in the background (or lock your phone) to see it pop up.`
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Something went wrong";
      Alert.alert("Could not schedule", msg);
    } finally {
      setTestPending(false);
    }
  }

  async function handleContactSupport() {
    const subject = "HandyBot feedback";
    const body =
      "\n\n---\nApp version: " +
      APP_VERSION +
      "\nPlatform: " +
      Platform.OS +
      (user ? "\nUser ID: " + user.id.slice(0, 10) : "");
    const url =
      "mailto:" +
      SUPPORT_EMAIL +
      "?subject=" +
      encodeURIComponent(subject) +
      "&body=" +
      encodeURIComponent(body);

    try {
      const canOpen = await Linking.canOpenURL(url);
      if (!canOpen) {
        Alert.alert(
          "No email app found",
          "We couldn't open your email app. Drop us a line at " +
            SUPPORT_EMAIL +
            " and we'll get back to you."
        );
        return;
      }
      await Linking.openURL(url);
    } catch {
      Alert.alert(
        "Couldn't open email",
        "Email us directly at " + SUPPORT_EMAIL + "."
      );
    }
  }

  function handleSignOut() {
    Alert.alert("Sign out?", "You can sign back in any time.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign out",
        onPress: async () => {
          await clearUser();
          router.replace("/");
        },
      },
    ]);
  }

  function handleDeleteAccount() {
    Alert.alert(
      "Delete account?",
      "This will permanently delete your account and all of your repairs. This can't be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete everything",
          style: "destructive",
          onPress: async () => {
            await wipeAllData();
            router.replace("/");
          },
        },
      ]
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Account</Text>
        <Text style={styles.cardBody}>
          HandyBot stores your repairs on this device. There&apos;s nothing
          else to it.
        </Text>
        {user && (
          <View style={{ marginTop: spacing.md, gap: spacing.xs }}>
            <Row label="User ID" value={user.id.slice(0, 10)} mono />
            <Row
              label="Joined"
              value={new Date(user.createdAt).toLocaleDateString()}
            />
          </View>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Notifications</Text>
        <Text style={styles.cardBody}>
          HandyBot uses local notifications to remind you about recurring
          home-maintenance tasks. Tap below to make sure they&apos;re working
          — you&apos;ll get a test ping in a few seconds.
        </Text>
        <PrimaryButton
          title={
            testPending
              ? "Scheduling..."
              : `Send test notification (${TEST_NOTIFICATION_DELAY_SECONDS}s)`
          }
          onPress={handleTestNotification}
          loading={testPending}
          variant="secondary"
          style={{ marginTop: spacing.md }}
        />
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Contact us</Text>
        <Text style={styles.cardBody}>
          Found a bug? Have an idea? Something HandyBot got wrong? We&apos;d
          love to hear from you.
        </Text>
        <PrimaryButton
          title={`Email ${SUPPORT_EMAIL}`}
          onPress={handleContactSupport}
          variant="secondary"
          style={{ marginTop: spacing.md }}
        />
      </View>

      <View style={[styles.card, { gap: spacing.md }]}>
        <PrimaryButton title="Sign out" onPress={handleSignOut} variant="secondary" />
        <PrimaryButton
          title="Delete account"
          onPress={handleDeleteAccount}
          variant="danger"
        />
      </View>

      <Text style={styles.footer}>
        HandyBot v{APP_VERSION} — powered by Claude
      </Text>
    </ScrollView>
  );
}

function Row({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={[styles.rowValue, mono && { fontFamily: "Courier" }]}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.text,
  },
  cardBody: {
    marginTop: spacing.xs,
    fontSize: 13,
    color: colors.textMuted,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  rowLabel: {
    fontSize: 13,
    color: colors.textSubtle,
  },
  rowValue: {
    fontSize: 13,
    color: colors.text,
  },
  footer: {
    textAlign: "center",
    fontSize: 11,
    color: colors.textSubtle,
    marginTop: spacing.lg,
  },
});
