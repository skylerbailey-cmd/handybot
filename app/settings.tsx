import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, View } from "react-native";
import PrimaryButton from "@/components/PrimaryButton";
import { clearUser, ensureUser, wipeAllData } from "@/lib/storage";
import { colors, radius, spacing } from "@/lib/theme";
import type { User } from "@/lib/types";

export default function SettingsScreen() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    ensureUser().then(setUser);
  }, []);

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

      <View style={[styles.card, { gap: spacing.md }]}>
        <PrimaryButton title="Sign out" onPress={handleSignOut} variant="secondary" />
        <PrimaryButton
          title="Delete account"
          onPress={handleDeleteAccount}
          variant="danger"
        />
      </View>

      <Text style={styles.footer}>HandyBot v0.1 — powered by Claude</Text>
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
