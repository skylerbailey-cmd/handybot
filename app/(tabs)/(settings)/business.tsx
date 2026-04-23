import { Stack } from "expo-router";
import { useEffect, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  loadBusinessProfile,
  saveBusinessProfile,
  type BusinessProfile,
} from "@/lib/businessProfile";
import { colors, radius, spacing } from "@/lib/theme";

export default function BusinessProfileScreen() {
  const [profile, setProfile] = useState<BusinessProfile | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadBusinessProfile().then(setProfile);
  }, []);

  function update(fields: Partial<BusinessProfile>) {
    if (!profile) return;
    setProfile({ ...profile, ...fields });
  }

  async function handleSave() {
    if (!profile) return;
    if (!profile.businessName.trim()) {
      Alert.alert("Business name required", "Enter your business or personal name.");
      return;
    }
    setSaving(true);
    try {
      await saveBusinessProfile(profile);
      Alert.alert("Saved", "Your business profile has been updated.");
    } catch {
      Alert.alert("Failed", "Could not save profile.");
    } finally {
      setSaving(false);
    }
  }

  if (!profile) return null;

  return (
    <>
      <Stack.Screen options={{ title: "Invoicing & Business Info" }} />
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.desc}>
          This info appears on invoices you generate for tenants, HOAs, or
          insurance claims. Stored locally on your device only.
        </Text>

        <Text style={styles.label}>Business / your name *</Text>
        <TextInput
          style={styles.input}
          value={profile.businessName}
          onChangeText={(v) => update({ businessName: v })}
          placeholder="e.g. Bailey Property Management"
          placeholderTextColor={colors.textSubtle}
        />

        <Text style={styles.label}>Owner name</Text>
        <TextInput
          style={styles.input}
          value={profile.ownerName}
          onChangeText={(v) => update({ ownerName: v })}
          placeholder="Your full name"
          placeholderTextColor={colors.textSubtle}
        />

        <Text style={styles.label}>Address</Text>
        <TextInput
          style={[styles.input, { minHeight: 60, textAlignVertical: "top" }]}
          value={profile.address}
          onChangeText={(v) => update({ address: v })}
          placeholder="123 Main St, City, State ZIP"
          placeholderTextColor={colors.textSubtle}
          multiline
        />

        <Text style={styles.label}>Phone</Text>
        <TextInput
          style={styles.input}
          value={profile.phone}
          onChangeText={(v) => update({ phone: v })}
          placeholder="(555) 123-4567"
          placeholderTextColor={colors.textSubtle}
          keyboardType="phone-pad"
        />

        <Text style={styles.label}>Email</Text>
        <TextInput
          style={styles.input}
          value={profile.email}
          onChangeText={(v) => update({ email: v })}
          placeholder="you@example.com"
          placeholderTextColor={colors.textSubtle}
          keyboardType="email-address"
          autoCapitalize="none"
        />

        <Text style={styles.label}>Hourly rate (USD)</Text>
        <TextInput
          style={styles.input}
          value={profile.hourlyRateUsd ? String(profile.hourlyRateUsd) : ""}
          onChangeText={(v) =>
            update({ hourlyRateUsd: parseFloat(v) || 0 })
          }
          placeholder="e.g. 85"
          placeholderTextColor={colors.textSubtle}
          keyboardType="decimal-pad"
        />

        <Text style={styles.label}>Tax rate (%)</Text>
        <TextInput
          style={styles.input}
          value={
            profile.taxRatePercent ? String(profile.taxRatePercent) : ""
          }
          onChangeText={(v) =>
            update({ taxRatePercent: parseFloat(v) || 0 })
          }
          placeholder="e.g. 8.25"
          placeholderTextColor={colors.textSubtle}
          keyboardType="decimal-pad"
        />

        <Pressable
          onPress={handleSave}
          disabled={saving}
          style={[styles.saveBtn, saving && { opacity: 0.6 }]}
        >
          <Text style={styles.saveBtnText}>
            {saving ? "Saving..." : "Save Profile"}
          </Text>
        </Pressable>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.lg,
    gap: spacing.sm,
    paddingBottom: spacing.xxl * 2,
  },
  desc: {
    fontSize: 13,
    color: colors.textMuted,
    lineHeight: 19,
    marginBottom: spacing.sm,
  },
  label: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.textSubtle,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginTop: spacing.sm,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.sm + 2,
    fontSize: 15,
    color: colors.text,
    backgroundColor: colors.surface,
  },
  saveBtn: {
    backgroundColor: colors.brand,
    borderRadius: radius.md,
    paddingVertical: spacing.md + 2,
    alignItems: "center",
    marginTop: spacing.lg,
  },
  saveBtnText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "800",
  },
});
