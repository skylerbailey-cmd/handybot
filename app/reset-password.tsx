import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import PrimaryButton from "@/components/PrimaryButton";
import { getSession, updatePassword } from "@/lib/auth";
import { colors, radius, spacing } from "@/lib/theme";

export default function ResetPasswordScreen() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expired, setExpired] = useState(false);
  const [checking, setChecking] = useState(true);

  // When the user arrives via the reset deep-link, Supabase's JS client
  // automatically exchanges the tokens in the URL fragment for a session.
  // We just need to verify that a session exists.
  useEffect(() => {
    const timer = setTimeout(async () => {
      const session = await getSession();
      if (!session) {
        setExpired(true);
      }
      setChecking(false);
    }, 500); // small delay to let Supabase process the URL tokens
    return () => clearTimeout(timer);
  }, []);

  async function handleSubmit() {
    if (!password) {
      setError("Please enter a new password.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords don\u2019t match.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const result = await updatePassword(password);
      if (result.error) {
        setError(result.error);
      } else {
        // Password updated — send user home.
        router.replace("/(tabs)/(home)");
      }
    } catch {
      setError("Something went wrong. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  if (checking) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={[styles.scrollCenter, { alignItems: "center" }]}>
          <Text style={styles.body}>Verifying reset link...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (expired) {
    return (
      <SafeAreaView style={styles.safe}>
        <ScrollView contentContainerStyle={styles.scrollCenter}>
          <View style={styles.card}>
            <Text style={styles.title}>Link expired</Text>
            <Text style={styles.body}>
              This password reset link is no longer valid. Please request a new
              one.
            </Text>
            <PrimaryButton
              title="Request new reset link"
              onPress={() => router.replace("/forgot-password")}
              style={{ marginTop: spacing.xl }}
            />
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.header}>
            <Text style={styles.title}>Set new password</Text>
            <Text style={styles.subtitle}>
              Choose a new password for your account.
            </Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.label}>New password</Text>
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              placeholder="At least 6 characters"
              placeholderTextColor={colors.textSubtle}
              secureTextEntry
              textContentType="newPassword"
              autoComplete="new-password"
              editable={!loading}
            />

            <Text style={[styles.label, { marginTop: spacing.md }]}>
              Confirm password
            </Text>
            <TextInput
              style={styles.input}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder="Type it again"
              placeholderTextColor={colors.textSubtle}
              secureTextEntry
              textContentType="newPassword"
              autoComplete="new-password"
              editable={!loading}
              onSubmitEditing={handleSubmit}
              returnKeyType="go"
            />

            {error && <Text style={styles.error}>{error}</Text>}

            <PrimaryButton
              title={loading ? "Updating..." : "Update password"}
              onPress={handleSubmit}
              loading={loading}
              style={{ marginTop: spacing.xl }}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    padding: spacing.lg,
    paddingTop: spacing.xxl,
  },
  scrollCenter: {
    padding: spacing.lg,
    paddingTop: spacing.xxl,
    justifyContent: "center",
    flexGrow: 1,
  },
  header: {
    marginBottom: spacing.xl,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: colors.text,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 14,
    color: colors.textMuted,
    marginTop: spacing.sm,
    lineHeight: 20,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.text,
    marginBottom: spacing.xs,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    fontSize: 16,
    color: colors.text,
    backgroundColor: colors.background,
  },
  body: {
    fontSize: 14,
    color: colors.textMuted,
    marginTop: spacing.sm,
    lineHeight: 20,
    textAlign: "center",
  },
  error: {
    marginTop: spacing.md,
    fontSize: 13,
    color: colors.danger,
    lineHeight: 18,
  },
});
