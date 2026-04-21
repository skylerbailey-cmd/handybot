import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import PrimaryButton from "@/components/PrimaryButton";
import { resendConfirmation } from "@/lib/auth";
import { colors, radius, spacing } from "@/lib/theme";

const COOLDOWN_SECONDS = 30;

export default function ConfirmEmailScreen() {
  const router = useRouter();
  const { email } = useLocalSearchParams<{ email?: string }>();
  const [resendLoading, setResendLoading] = useState(false);
  const [resendStatus, setResendStatus] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  function startCooldown() {
    setCooldown(COOLDOWN_SECONDS);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setCooldown((prev) => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }

  async function handleResend() {
    if (!email || resendLoading || cooldown > 0) return;
    setResendLoading(true);
    setResendStatus(null);
    try {
      const result = await resendConfirmation(email);
      if (result.error) {
        setResendStatus(result.error);
      } else {
        setResendStatus("Email sent! Check your inbox.");
        startCooldown();
      }
    } catch {
      setResendStatus("Failed to resend. Try again later.");
    } finally {
      setResendLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.card}>
          <Text style={styles.icon}>{'✉️'}</Text>
          <Text style={styles.title}>Check your email</Text>
          <Text style={styles.body}>
            We sent a confirmation link to{" "}
            <Text style={{ fontWeight: "600" }}>{email ?? "your email"}</Text>.
            Click the link to activate your account, then come back and sign in.
          </Text>

          {resendStatus && (
            <Text style={[styles.body, { marginTop: spacing.sm }]}>
              {resendStatus}
            </Text>
          )}

          <PrimaryButton
            title={
              resendLoading
                ? "Sending..."
                : cooldown > 0
                  ? `Resend in ${cooldown}s`
                  : "Resend confirmation email"
            }
            onPress={handleResend}
            loading={resendLoading}
            disabled={cooldown > 0}
            variant="secondary"
            style={{ marginTop: spacing.xl }}
          />

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
        </View>
      </ScrollView>
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
    justifyContent: "center",
    flexGrow: 1,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xl,
    alignItems: "center",
  },
  icon: {
    fontSize: 48,
    marginBottom: spacing.md,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: colors.text,
    textAlign: "center",
  },
  body: {
    fontSize: 14,
    color: colors.textMuted,
    marginTop: spacing.sm,
    lineHeight: 20,
    textAlign: "center",
  },
});
