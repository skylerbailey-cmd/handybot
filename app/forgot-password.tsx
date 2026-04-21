import { useRouter } from "expo-router";
import { useState } from "react";
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
import { requestPasswordReset } from "@/lib/auth";
import { colors, radius, spacing } from "@/lib/theme";

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function handleSubmit() {
    const trimmed = email.trim();
    if (!trimmed) {
      setError("Please enter your email address.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const result = await requestPasswordReset(trimmed);
      if (result.error) {
        setError(result.error);
      } else {
        setSent(true);
      }
    } catch {
      setError("Something went wrong. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <SafeAreaView style={styles.safe}>
        <ScrollView contentContainerStyle={styles.scrollCenter}>
          <View style={styles.card}>
            <Text style={styles.icon}>{'✉️'}</Text>
            <Text style={styles.title}>Check your email</Text>
            <Text style={styles.body}>
              We sent a password reset link to{" "}
              <Text style={{ fontWeight: "600" }}>{email.trim()}</Text>. Click
              the link and you'll be able to set a new password.
            </Text>
            <PrimaryButton
              title="Back to sign in"
              onPress={() => {
                if (router.canGoBack()) {
                  router.back();
                } else {
                  router.replace("/login");
                }
              }}
              variant="secondary"
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
            <Text style={styles.title}>Reset password</Text>
            <Text style={styles.subtitle}>
              Enter the email address you used to create your account. We'll
              send you a link to set a new password.
            </Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              placeholderTextColor={colors.textSubtle}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              textContentType="emailAddress"
              autoComplete="email"
              editable={!loading}
              onSubmitEditing={handleSubmit}
              returnKeyType="go"
            />

            {error && <Text style={styles.error}>{error}</Text>}

            <PrimaryButton
              title={loading ? "Sending..." : "Send reset link"}
              onPress={handleSubmit}
              loading={loading}
              style={{ marginTop: spacing.xl }}
            />
          </View>

          <PrimaryButton
            title="Back to sign in"
            onPress={() => {
              if (router.canGoBack()) {
                router.back();
              } else {
                router.replace("/login");
              }
            }}
            variant="secondary"
            style={{ marginTop: spacing.sm }}
          />
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
  icon: {
    fontSize: 48,
    marginBottom: spacing.md,
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
