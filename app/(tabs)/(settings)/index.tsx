import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  Alert,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import PrimaryButton from "@/components/PrimaryButton";
import { getSession, signOut as authSignOut } from "@/lib/auth";
import { forceSeedDemoData } from "@/lib/seedData";
import { deleteUserCloudData } from "@/lib/cloud/deleteAccount";
import { runInitialBackfill, type MigrateProgress } from "@/lib/cloud/migrate";
import {
  restoreFromCloud,
  type RestoreProgress,
} from "@/lib/cloud/restore";
import { getActiveHome } from "@/lib/homes";
import { clearUser, ensureUser, wipeAllData } from "@/lib/storage";
import {
  deleteAllHomeData,
  exportHomeBundle,
  importHomeBundle,
  type TransferProgress,
} from "@/lib/transfer";
import {
  hydrateSubscription,
  isCloudBackupEnabled,
  setCloudBackupEnabled,
} from "@/lib/subscription";
import { isSupabaseConfigured } from "@/lib/supabase";
import { colors, radius, spacing } from "@/lib/theme";
import type { User } from "@/lib/types";

const SUPPORT_EMAIL = "support@grnd-lab.com";
const APP_VERSION = "0.1";

export default function SettingsScreen() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [cloudBackup, setCloudBackup] = useState<boolean>(isCloudBackupEnabled());
  const [backupBusy, setBackupBusy] = useState(false);
  const [backupStatus, setBackupStatus] = useState<string | null>(null);
  const [restoreBusy, setRestoreBusy] = useState(false);
  const [restoreStatus, setRestoreStatus] = useState<string | null>(null);
  const [exportBusy, setExportBusy] = useState(false);
  const [exportStatus, setExportStatus] = useState<string | null>(null);
  const [importBusy, setImportBusy] = useState(false);
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [homeName, setHomeName] = useState("this home");
  const [seedBusy, setSeedBusy] = useState(false);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [deleteModalBackupOn, setDeleteModalBackupOn] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");

  useEffect(() => {
    ensureUser().then(setUser);
    hydrateSubscription().then(setCloudBackup);
    getActiveHome().then((h) => {
      if (h) setHomeName(h.name);
    });
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

    // Turning ON — require a Supabase session first. If the user isn't
    // signed in, send them to the login screen. When they come back
    // (Settings re-mounts), they can tap "Turn on" again.
    const session = await getSession();
    if (!session) {
      router.push("/login");
      return;
    }

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

  async function handleRestoreFromCloud() {
    if (restoreBusy || !cloudBackup) return;
    if (!isSupabaseConfigured()) {
      Alert.alert(
        "Cloud backup unavailable",
        "Supabase isn't configured in this build."
      );
      return;
    }

    setRestoreBusy(true);
    setRestoreStatus("Starting restore…");
    try {
      const { itemsRestored } = await restoreFromCloud(
        (p: RestoreProgress) => {
          setRestoreStatus(p.message);
        }
      );
      setRestoreStatus(
        itemsRestored > 0
          ? `Restore complete — ${itemsRestored} items synced from cloud.`
          : "Everything is already up to date."
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      setRestoreStatus(`Restore failed: ${msg}`);
      Alert.alert("Restore failed", msg);
    } finally {
      setRestoreBusy(false);
    }
  }

  async function handleExportHome() {
    if (exportBusy) return;
    setExportBusy(true);
    setExportStatus(null);
    try {
      await exportHomeBundle((p: TransferProgress) => {
        setExportStatus(p.message);
      });
      setExportStatus("Export complete.");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Export failed";
      if (!msg.includes("cancelled") && !msg.includes("canceled")) {
        setExportStatus(`Export failed: ${msg}`);
        Alert.alert("Export failed", msg);
      } else {
        setExportStatus(null);
      }
    } finally {
      setExportBusy(false);
    }
  }

  async function handleImportHome() {
    if (importBusy) return;
    setImportBusy(true);
    setImportStatus(null);
    try {
      const { itemsImported } = await importHomeBundle(
        (p: TransferProgress) => {
          setImportStatus(p.message);
        }
      );
      if (itemsImported > 0) {
        setImportStatus(
          `Imported ${itemsImported} items into a new home. Switch to it from the home picker.`
        );
        Alert.alert(
          "Import complete",
          `${itemsImported} items imported into a new home. You've been switched to it automatically.`
        );
      } else {
        setImportStatus(null);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Import failed";
      setImportStatus(`Import failed: ${msg}`);
      Alert.alert("Import failed", msg);
    } finally {
      setImportBusy(false);
    }
  }

  function handleDeleteHomeData() {
    Alert.alert(
      `Delete all data for "${homeName}"?`,
      "This will permanently remove all repairs, inventory items, reminders, and photos for this home. This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete everything",
          style: "destructive",
          onPress: () => {
            Alert.alert(
              "Last chance",
              `All data for "${homeName}" will be permanently deleted.`,
              [
                { text: "Cancel", style: "cancel" },
                {
                  text: "Delete permanently",
                  style: "destructive",
                  onPress: async () => {
                    setDeleteBusy(true);
                    try {
                      await deleteAllHomeData();
                      Alert.alert(
                        "Data deleted",
                        `All data for "${homeName}" has been removed.`
                      );
                      router.replace("/(tabs)/(home)");
                    } catch (err) {
                      const msg =
                        err instanceof Error ? err.message : "Delete failed";
                      Alert.alert("Delete failed", msg);
                    } finally {
                      setDeleteBusy(false);
                    }
                  },
                },
              ]
            );
          },
        },
      ]
    );
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
          // Sign out of Supabase if a session exists, then clear local user.
          await authSignOut();
          await clearUser();
          router.replace("/(tabs)/(home)");
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

  // Step 2 — show a modal requiring the user to type DELETE to proceed.
  function confirmDeleteAccount(backupOn: boolean) {
    setDeleteModalBackupOn(backupOn);
    setDeleteConfirmText("");
    setDeleteModalVisible(true);
  }

  async function executeDeleteAccount() {
    setDeleteModalVisible(false);
    try {
      if (deleteModalBackupOn) {
        const currentUser = await ensureUser();
        await deleteUserCloudData(currentUser.id);
      }
      await wipeAllData();
      router.replace("/(tabs)/(home)");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      Alert.alert(
        "Couldn't delete cloud data",
        `${msg}\n\nYour local data is unchanged. Check your connection and try again.`
      );
    }
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
        {cloudBackup && (
          <>
            {restoreStatus && (
              <Text style={[styles.cardBody, { marginTop: spacing.sm }]}>
                {restoreStatus}
              </Text>
            )}
            <PrimaryButton
              title={restoreBusy ? "Restoring…" : "Restore from cloud"}
              onPress={handleRestoreFromCloud}
              loading={restoreBusy}
              variant="secondary"
              style={{ marginTop: spacing.sm }}
            />
          </>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Home transfer</Text>
        <Text style={styles.cardBody}>
          Moving? Export your home data for the new owner, or import data from
          a previous owner. Exports include repairs, inventory, reminders, and
          photos.
        </Text>
        {exportStatus && (
          <Text style={[styles.cardBody, { marginTop: spacing.sm }]}>
            {exportStatus}
          </Text>
        )}
        <PrimaryButton
          title={exportBusy ? "Exporting..." : "Export home data"}
          onPress={handleExportHome}
          loading={exportBusy}
          variant="secondary"
          style={{ marginTop: spacing.md }}
        />
        {importStatus && (
          <Text style={[styles.cardBody, { marginTop: spacing.sm }]}>
            {importStatus}
          </Text>
        )}
        <PrimaryButton
          title={importBusy ? "Importing..." : "Import home data"}
          onPress={handleImportHome}
          loading={importBusy}
          variant="secondary"
          style={{ marginTop: spacing.sm }}
        />
        <View style={styles.transferDivider} />
        <PrimaryButton
          title={deleteBusy ? "Deleting..." : `Delete all "${homeName}" data`}
          onPress={handleDeleteHomeData}
          loading={deleteBusy}
          variant="danger"
        />
      </View>

      <Pressable
        onPress={() => router.push("/(tabs)/(inventory)/insurance-export")}
        style={styles.card}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
          <Text style={{ fontSize: 20 }}>🛡</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>Insurance inventory export</Text>
            <Text style={[styles.cardBody, { marginTop: 2 }]}>
              Generate a claim-ready PDF of your home inventory
            </Text>
          </View>
          <Text style={{ fontSize: 18, color: colors.textSubtle }}>›</Text>
        </View>
      </Pressable>

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

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Demo data</Text>
        <Text style={styles.cardBody}>
          Replace your current inventory, repairs, reminders, and recalls with
          sample data so you can explore every feature.
        </Text>
        <PrimaryButton
          title={seedBusy ? "Loading demo data…" : "Load demo data"}
          loading={seedBusy}
          onPress={() => {
            Alert.alert(
              "Load demo data?",
              "This will replace your current inventory, repairs, reminders, and recall alerts with sample data.",
              [
                { text: "Cancel", style: "cancel" },
                {
                  text: "Load demo data",
                  onPress: async () => {
                    setSeedBusy(true);
                    try {
                      const result = await forceSeedDemoData();
                      Alert.alert(
                        "Demo data loaded",
                        `Added ${result.itemsAdded} items, ${result.issuesAdded} repairs, and ${result.remindersAdded} reminders with 3 recall alerts.`
                      );
                    } catch (err) {
                      const msg = err instanceof Error ? err.message : "Failed";
                      Alert.alert("Failed to load demo data", msg);
                    } finally {
                      setSeedBusy(false);
                    }
                  },
                },
              ]
            );
          }}
          variant="secondary"
          style={{ marginTop: spacing.md }}
        />
      </View>

      <Text style={styles.footer}>
        HandyBot v{APP_VERSION} — powered by Claude
      </Text>

      <Modal
        visible={deleteModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setDeleteModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Are you absolutely sure?</Text>
            <Text style={styles.modalBody}>
              {deleteModalBackupOn
                ? "This will immediately wipe your local data AND permanently delete your cloud backup. This cannot be undone."
                : "This will immediately wipe all your local data. This cannot be undone."}
            </Text>
            <Text style={styles.modalBody}>
              Type <Text style={{ fontWeight: "700" }}>DELETE</Text> to confirm.
            </Text>
            <TextInput
              style={styles.modalInput}
              value={deleteConfirmText}
              onChangeText={setDeleteConfirmText}
              placeholder="Type DELETE here"
              placeholderTextColor={colors.textSubtle}
              autoCapitalize="characters"
              autoCorrect={false}
            />
            <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.md }}>
              <Pressable
                onPress={() => setDeleteModalVisible(false)}
                style={[styles.modalBtn, styles.modalBtnCancel]}
              >
                <Text style={styles.modalBtnCancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={executeDeleteAccount}
                disabled={deleteConfirmText !== "DELETE"}
                style={[
                  styles.modalBtn,
                  styles.modalBtnDelete,
                  deleteConfirmText !== "DELETE" && styles.modalBtnDisabled,
                ]}
              >
                <Text style={styles.modalBtnDeleteText}>Delete everything</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
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
  transferDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.md,
  },
  footer: {
    textAlign: "center",
    fontSize: 11,
    color: colors.textSubtle,
    marginTop: spacing.lg,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    padding: spacing.lg,
  },
  modalCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: colors.text,
  },
  modalBody: {
    fontSize: 14,
    color: colors.textMuted,
    marginTop: spacing.sm,
  },
  modalInput: {
    marginTop: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.sm,
    fontSize: 16,
    fontWeight: "700",
    color: colors.text,
    letterSpacing: 2,
    textAlign: "center",
  },
  modalBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: radius.md,
    alignItems: "center",
  },
  modalBtnCancel: {
    backgroundColor: colors.border,
  },
  modalBtnCancelText: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.text,
  },
  modalBtnDelete: {
    backgroundColor: "#dc2626",
  },
  modalBtnDisabled: {
    opacity: 0.4,
  },
  modalBtnDeleteText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#fff",
  },
});
