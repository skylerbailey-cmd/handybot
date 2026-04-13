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
import { deleteUserCloudData } from "@/lib/cloud/deleteAccount";
import { runInitialBackfill, type MigrateProgress } from "@/lib/cloud/migrate";
import { scheduleTestNotification } from "@/lib/reminders";
import { clearUser, ensureUser, wipeAllData } from "@/lib/storage";
import {
  hydrateSubscription,
  isCloudBackupEnabled,
  setCloudBackupEnabled,
} from "@/lib/subscription";
import { isSupabaseConfigured } from "@/lib/supabase";
import { colors, radius, spacing } from "@/lib/theme";
import type { User } from "@/lib/types";

const TEST_NOTIFICATION_DELAY_SECONDS = 5;
const SUPPORT_EMAIL = "support@grnd-lab.com";
const APP_VERSION = "0.1";

export default function SettingsScreen() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [testPending, setTestPending] = useState(false);
  const [cloudBackup, setCloudBackup] = useState<boolean>(isCloudBackupEnabled());
  const [backupBusy, setBackupBusy] = useState(false);
  const [backupStatus, setBackupStatus] = useState<string | null>(null);

  useEffect(() => {
    ensureUser().then(setUser);
    // Refresh the toggle from AsyncStorage in case it was hydrated after
    // this screen first rendered.
    hydrateSubscription().then(setCloudBackup);
  }, []);

  async function handleToggleCloudBackup() {
    if (backupBusy) return;
    if (!isSupabaseConfigured()) {
      Alert.alert(
        "Cloud backup unavailable",
        "Supabase isn't configured in this build. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in .env and reload the app."
      );
      return;
    }

    if (cloudBackup) {
      // Turning OFF — just flip the flag. The data already in the cloud
      // stays there; the user can re-enable to resume syncing.
      Alert.alert(
        "Turn off cloud backup?",
        "New changes will stay on this device only. Data already uploaded to the cloud will remain there.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Turn off",
            style: "destructive",
            onPress: async () => {
              await setCloudBackupEnabled(false);
              setCloudBackup(false);
              setBackupStatus(null);
            },
          },
        ]
      );
      return;
    }

    // Turning ON — enable the flag first so future writes mirror up, then
    // do the one-time backfill of everything already in local storage.
    setBackupBusy(true);
    setBackupStatus("Starting backup…");
    try {
      await setCloudBackupEnabled(true);
      setCloudBackup(true);
      await runInitialBackfill((p: MigrateProgress) => {
        setBackupStatus(p.message);
      });
      setBackupStatus("Backup complete — all data is synced.");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      setBackupStatus(`Backup failed: ${msg}`);
      Alert.alert(
        "Backup failed",
        `${msg}\n\nYour local data is safe. Toggle cloud backup off and on again to retry.`
      );
    } finally {
      setBackupBusy(false);
    }
  }

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
    // Step 1 — explain EXACTLY what will happen, including cloud deletion
    // if the user is on the paid tier. Many destructive actions on mobile
    // get one-tapped by accident; a two-step confirm for an unrecoverable
    // action is well worth the friction.
    const backupOn = isCloudBackupEnabled();
    const firstMessage = backupOn
      ? "You're about to permanently delete:\n\n" +
        "• All repairs and repair history on this device\n" +
        "• All reminders and home inventory\n" +
        "• Your account and backup in the cloud\n" +
        "• All photos uploaded to the cloud\n\n" +
        "This cannot be undone. You will not be able to recover anything from any device."
      : "You're about to permanently delete:\n\n" +
        "• All repairs and repair history on this device\n" +
        "• All reminders and home inventory\n" +
        "• All photos on this device\n\n" +
        "This cannot be undone.";

    Alert.alert("Delete account and all data?", firstMessage, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Continue",
        style: "destructive",
        onPress: () => confirmDeleteAccount(backupOn),
      },
    ]);
  }

  // Step 2 — final "are you absolutely sure" gate. Separate function so
  // the call stack stays readable.
  function confirmDeleteAccount(backupOn: boolean) {
    Alert.alert(
      "Are you absolutely sure?",
      backupOn
        ? "Last chance. Tapping \"Delete everything\" will immediately wipe your local data AND permanently delete your cloud backup."
        : "Last chance. Tapping \"Delete everything\" will immediately wipe all your local data.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete everything",
          style: "destructive",
          onPress: async () => {
            try {
              // Delete cloud data FIRST — if this fails we want to
              // surface the error and let the user retry. If we wiped
              // local first and cloud deletion failed, they'd be left
              // with orphan data they couldn't clean up from the app.
              if (backupOn) {
                const currentUser = await ensureUser();
                await deleteUserCloudData(currentUser.id);
              }
              await wipeAllData();
              router.replace("/");
            } catch (err) {
              const msg = err instanceof Error ? err.message : "Unknown error";
              Alert.alert(
                "Couldn't delete cloud data",
                `${msg}\n\nYour local data is unchanged. Check your connection and try again.`
              );
            }
          },
        },
      ]
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Cloud backup</Text>
        <Text style={styles.cardBody}>
          {cloudBackup
            ? "Your repairs, reminders, and home inventory are being backed up so you can use HandyBot on any device."
            : "HandyBot stores everything on this device for free. Turn on cloud backup to access your data on multiple devices."}
        </Text>
        <View style={{ marginTop: spacing.md, gap: spacing.xs }}>
          <Row
            label="Status"
            value={cloudBackup ? "On (paid)" : "Off (local only)"}
          />
          <Row
            label="Server"
            value={isSupabaseConfigured() ? "Configured" : "Not configured"}
          />
        </View>
        {backupStatus && (
          <Text style={[styles.cardBody, { marginTop: spacing.sm }]}>
            {backupStatus}
          </Text>
        )}
        <PrimaryButton
          title={
            backupBusy
              ? "Backing up…"
              : cloudBackup
                ? "Turn off cloud backup"
                : "Turn on cloud backup"
          }
          onPress={handleToggleCloudBackup}
          loading={backupBusy}
          variant={cloudBackup ? "secondary" : "primary"}
          style={{ marginTop: spacing.md }}
        />
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Account</Text>
        <Text style={styles.cardBody}>
          {cloudBackup
            ? "Your account is backed up to the cloud."
            : "HandyBot stores your repairs on this device. There\u2019s nothing else to it."}
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
        <Text style={styles.cardBody}>
          {cloudBackup
            ? "Deletes your account, every repair, reminder, and inventory item on this device, and your entire cloud backup (including photos). This cannot be undone and cannot be recovered from another device."
            : "Deletes your account and every repair, reminder, and inventory item on this device. This cannot be undone."}
        </Text>
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
