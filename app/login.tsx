import { useRouter } from "expo-router";
import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import PrimaryButton from "@/components/PrimaryButton";
import { resendConfirmation, signIn, signUp } from "@/lib/auth";
import { colors, radius, spacing } from "@/lib/theme";

export default function LoginScreen() {
  const router = useRouter();
  const [mode, setMode] = useState<"sign_in" | "sign_up">("sign_in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showResend, setShowResend] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendStatus, setResendStatus] = useState<string | null>(null);

  const isSignIn = mode === "sign_in";

  async function handleSubmit() {
    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      setError("Please enter your email and password.");
      return;
    }
    setError(null);
    setShowResend(false);
    setResendStatus(null);
    setLoading(true);
    try {
      if (isSignIn) {
        const result = await signIn(trimmedEmail, password);
        if (result.error) {
          setError(result.error);
          if (result.code === "email_not_confirmed") {
            setShowResend(true);
          }
        } else {
          goBack();
        }
      } else {
        const result = await signUp(trimmedEmail, password);
        if (result.error) {
          setError(result.error);
        } else {
          // Email confirmation is required — navigate to the confirm screen.
          router.push({ pathname: "/confirm-email", params: { email: trimmedEmail } });
        }
      }
    } catch {
      setError("Something went wrong. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleResendConfirmation() {
    const trimmedEmail = email.trim();
    if (!trimmedEmail) return;
    setResendLoading(true);
    setResendStatus(null);
    try {
      const result = await resendConfirmation(trimmedEmail);
      if (result.error) {
        setResendStatus(result.error);
      } else {
        setResendStatus("Confirmation email sent. Check your inbox.");
      }
    } catch {
      setResendStatus("Failed to resend. Try again later.");
    } finally {
      setResendLoading(false);
    }
  }

  function goBack() {
    router.replace("/(tabs)/(home)");
  }

  function toggleMode() {
    setMode(isSignIn ? "sign_up" : "sign_in");
    setError(null);
    setShowResend(false);
    setResendStatus(null);
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
            <View
              style={[
                styles.headerIcon,
                isSignIn ? styles.headerIconSignIn : styles.headerIconSignUp,
              ]}
            >
              <Text style={styles.headerIconText}>
                {isSignIn ? "👋" : "🚀"}
              </Text>
            </View>
            <Text style={styles.title}>
              {isSignIn ? "Welcome back" : "Get started"}
            </Text>
            <Text style={styles.subtitle}>
              {isSignIn
                ? "Sign in to access your cloud backup and sync across devices."
                : "Create a free account to back up your data and access it anywhere."}
            </Text>
          </View>

          <View
            style={[
              styles.card,
              isSignIn ? styles.cardSignIn : styles.cardSignUp,
            ]}
          >
            <Text style={styles.cardBanner}>
              {isSignIn ? "SIGN IN" : "NEW ACCOUNT"}
            </Text>
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

            {isSignIn && (
              <Pressable
                onPress={() => router.push("/forgot-password")}
                style={{ marginTop: spacing.sm }}
              >
                <Text style={styles.link}>Forgot password?</Text>
              </Pressable>
            )}

            {error && <Text style={styles.error}>{error}</Text>}

            {showResend && (
              <View style={{ marginTop: spacing.sm }}>
                <PrimaryButton
                  title={resendLoading ? "Sending..." : "Resend confirmation email"}
                  onPress={handleResendConfirmation}
                  loading={resendLoading}
                  variant="secondary"
                />
                {resendStatus && (
                  <Text style={[styles.error, { color: colors.textMuted }]}>
                    {resendStatus}
                  </Text>
                )}
              </View>
            )}

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

          </View>

          <Pressable
            onPress={toggleMode}
            disabled={loading}
            style={[
              styles.toggleCard,
              isSignIn ? styles.toggleCardToSignUp : styles.toggleCardToSignIn,
              loading && { opacity: 0.5 },
            ]}
          >
            <Text style={styles.toggleText}>
              {isSignIn
                ? "New here? "
                : "Already have an account? "}
            </Text>
            <Text style={styles.toggleAction}>
              {isSignIn ? "Create an account" : "Sign in instead"}
            </Text>
          </Pressable>

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
    alignItems: "center",
    marginBottom: spacing.xl,
  },
  headerIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md,
  },
  headerIconSignIn: {
    backgroundColor: colors.brandLight,
  },
  headerIconSignUp: {
    backgroundColor: "#dbeafe",
  },
  headerIconText: {
    fontSize: 30,
  },
  title: {
    fontSize: 26,
    fontWeight: "700",
    color: colors.text,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 14,
    color: colors.textMuted,
    marginTop: spacing.sm,
    lineHeight: 20,
    textAlign: "center",
    maxWidth: 320,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 2,
    padding: spacing.lg,
  },
  cardSignIn: {
    borderColor: colors.brand,
  },
  cardSignUp: {
    borderColor: "#3b82f6",
  },
  cardBanner: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
    color: colors.textSubtle,
    textAlign: "center",
    marginBottom: spacing.md,
  },
  toggleCard: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderStyle: "dashed",
    marginTop: spacing.md,
  },
  toggleCardToSignUp: {
    borderColor: "#93c5fd",
    backgroundColor: "#eff6ff",
  },
  toggleCardToSignIn: {
    borderColor: colors.brandLight,
    backgroundColor: "#fff7ed",
  },
  toggleText: {
    fontSize: 14,
    color: colors.textMuted,
  },
  toggleAction: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.brand,
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
  link: {
    fontSize: 13,
    color: colors.brand,
    fontWeight: "500",
  },
  error: {
    marginTop: spacing.md,
    fontSize: 13,
    color: colors.danger,
    lineHeight: 18,
  },
});
