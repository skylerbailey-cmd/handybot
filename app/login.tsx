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
import { signIn, signUp } from "@/lib/auth";
import { colors, radius, spacing } from "@/lib/theme";

export default function LoginScreen() {
  const router = useRouter();
  const [mode, setMode] = useState<"sign_in" | "sign_up">("sign_in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isSignIn = mode === "sign_in";

  async function handleSubmit() {
    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      setError("Please enter your email and password.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const result = isSignIn
        ? await signIn(trimmedEmail, password)
        : await signUp(trimmedEmail, password);
      if (result.error) {
        setError(result.error);
      } else {
        // Success — go back to wherever the user came from (usually Settings)
        if (router.canGoBack()) {
          router.back();
        } else {
          router.replace("/(tabs)/(settings)");
        }
      }
    } catch {
      setError("Something went wrong. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  function toggleMode() {
    setMode(isSignIn ? "sign_up" : "sign_in");
    setError(null);
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
            <Text style={styles.title}>
              {isSignIn ? "Sign in" : "Create account"}
            </Text>
            <Text style={styles.subtitle}>
              {isSignIn
                ? "Sign in to enable cloud backup and sync your data across devices."
                : "Create an account to back up your data and access it on any device."}
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
            />

            <Text style={[styles.label, { marginTop: spacing.md }]}>
              Password
            </Text>
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              placeholder={isSignIn ? "Your password" : "At least 6 characters"}
              placeholderTextColor={colors.textSubtle}
              secureTextEntry
              textContentType={isSignIn ? "password" : "newPassword"}
              autoComplete={isSignIn ? "password" : "new-password"}
              editable={!loading}
              onSubmitEditing={handleSubmit}
              returnKeyType="go"
            />

            {error && <Text style={styles.error}>{error}</Text>}

            <PrimaryButton
              title={
                loading
                  ? isSignIn
                    ? "Signing in..."
                    : "Creating account..."
                  : isSignIn
                    ? "Sign in"
                    : "Create account"
              }
              onPress={handleSubmit}
              loading={loading}
              style={{ marginTop: spacing.xl }}
            />

            <PrimaryButton
              title={
                isSignIn
                  ? "Don\u2019t have an account? Create one"
                  : "Already have an account? Sign in"
              }
              onPress={toggleMode}
              variant="secondary"
              disabled={loading}
              style={{ marginTop: spacing.sm }}
            />
          </View>

          <PrimaryButton
            title="Skip for now"
            onPress={() => {
              if (router.canGoBack()) {
                router.back();
              } else {
                router.replace("/(tabs)/(home)");
              }
            }}
            variant="secondary"
            disabled={loading}
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
  header: {
    marginBottom: spacing.xl,
  },
  title: {
    fontSize: 26,
    fontWeight: "700",
    color: colors.text,
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
  error: {
    marginTop: spacing.md,
    fontSize: 13,
    color: colors.danger,
    lineHeight: 18,
  },
});
