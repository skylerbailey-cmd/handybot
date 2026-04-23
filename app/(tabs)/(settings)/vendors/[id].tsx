import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { loadVendors, saveVendor, deleteVendor } from "@/lib/vendors";
import { colors, radius, spacing } from "@/lib/theme";
import type { Vendor, VendorSpecialty } from "@/lib/types";

const SPECIALTIES: { value: VendorSpecialty; label: string }[] = [
  { value: "plumbing", label: "Plumbing" },
  { value: "electrical", label: "Electrical" },
  { value: "hvac", label: "HVAC" },
  { value: "roofing", label: "Roofing" },
  { value: "appliance", label: "Appliance" },
  { value: "handyman", label: "Handyman" },
  { value: "landscaping", label: "Landscaping" },
  { value: "other", label: "Other" },
];

export default function VendorDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [specialty, setSpecialty] = useState<VendorSpecialty>("handyman");
  const [hourlyRate, setHourlyRate] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadVendors().then((all) => {
      const found = all.find((v) => v.id === id);
      if (found) {
        setVendor(found);
        setName(found.name);
        setPhone(found.phone ?? "");
        setEmail(found.email ?? "");
        setSpecialty(found.specialty);
        setHourlyRate(found.hourlyRateUsd ? String(found.hourlyRateUsd) : "");
        setNotes(found.notes ?? "");
      }
    });
  }, [id]);

  async function handleSave() {
    if (!vendor) return;
    const trimmedName = name.trim();
    if (!trimmedName) {
      Alert.alert("Name required", "Enter the vendor's name.");
      return;
    }
    setSaving(true);
    try {
      await saveVendor({
        ...vendor,
        name: trimmedName,
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
        specialty,
        hourlyRateUsd: parseFloat(hourlyRate) || undefined,
        notes: notes.trim() || undefined,
      });
      router.back();
    } catch {
      Alert.alert("Failed", "Could not save vendor.");
    } finally {
      setSaving(false);
    }
  }

  function handleDelete() {
    if (!vendor) return;
    Alert.alert("Delete vendor?", `Remove ${vendor.name}?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await deleteVendor(vendor.id, vendor.homeId);
          router.back();
        },
      },
    ]);
  }

  if (!vendor) {
    return (
      <>
        <Stack.Screen options={{ title: "Vendor" }} />
        <View style={styles.loading}>
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: vendor.name || "Vendor" }} />
      <ScrollView contentContainerStyle={styles.container}>
        {/* Quick actions */}
        <View style={styles.quickActions}>
          {vendor.phone && (
            <>
              <Pressable
                onPress={() => Linking.openURL(`tel:${vendor.phone}`)}
                style={styles.quickBtn}
              >
                <Text style={styles.quickBtnText}>Call</Text>
              </Pressable>
              <Pressable
                onPress={() => Linking.openURL(`sms:${vendor.phone}`)}
                style={styles.quickBtn}
              >
                <Text style={styles.quickBtnText}>Text</Text>
              </Pressable>
            </>
          )}
          {vendor.email && (
            <Pressable
              onPress={() => Linking.openURL(`mailto:${vendor.email}`)}
              style={styles.quickBtn}
            >
              <Text style={styles.quickBtnText}>Email</Text>
            </Pressable>
          )}
        </View>

        <Text style={styles.label}>Name *</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholderTextColor={colors.textSubtle}
        />

        <Text style={styles.label}>Phone</Text>
        <TextInput
          style={styles.input}
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
          placeholderTextColor={colors.textSubtle}
        />

        <Text style={styles.label}>Email</Text>
        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          placeholderTextColor={colors.textSubtle}
        />

        <Text style={styles.label}>Specialty</Text>
        <View style={styles.specialtyGrid}>
          {SPECIALTIES.map((s) => (
            <Pressable
              key={s.value}
              onPress={() => setSpecialty(s.value)}
              style={[
                styles.specialtyChip,
                specialty === s.value && styles.specialtyChipActive,
              ]}
            >
              <Text
                style={[
                  styles.specialtyChipText,
                  specialty === s.value && styles.specialtyChipTextActive,
                ]}
              >
                {s.label}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.label}>Hourly rate (USD)</Text>
        <TextInput
          style={styles.input}
          value={hourlyRate}
          onChangeText={setHourlyRate}
          keyboardType="numeric"
          placeholderTextColor={colors.textSubtle}
        />

        <Text style={styles.label}>Notes</Text>
        <TextInput
          style={[styles.input, { minHeight: 80, textAlignVertical: "top" }]}
          value={notes}
          onChangeText={setNotes}
          multiline
          placeholderTextColor={colors.textSubtle}
        />

        <Pressable
          onPress={handleSave}
          disabled={saving}
          style={[styles.saveBtn, saving && { opacity: 0.6 }]}
        >
          <Text style={styles.saveBtnText}>
            {saving ? "Saving..." : "Save Changes"}
          </Text>
        </Pressable>

        <Pressable onPress={handleDelete} style={styles.deleteBtn}>
          <Text style={styles.deleteBtnText}>Delete Vendor</Text>
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
  loading: { flex: 1, alignItems: "center", justifyContent: "center" },
  loadingText: { color: colors.textMuted },
  quickActions: {
    flexDirection: "row",
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  quickBtn: {
    flex: 1,
    backgroundColor: colors.brand,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: "center",
  },
  quickBtnText: { color: "#fff", fontSize: 14, fontWeight: "800" },
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
  specialtyGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
  },
  specialtyChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  specialtyChipActive: {
    backgroundColor: colors.brand,
    borderColor: colors.brand,
  },
  specialtyChipText: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.textMuted,
  },
  specialtyChipTextActive: { color: "#fff" },
  saveBtn: {
    backgroundColor: colors.brand,
    borderRadius: radius.md,
    paddingVertical: spacing.md + 2,
    alignItems: "center",
    marginTop: spacing.md,
  },
  saveBtnText: { color: "#fff", fontSize: 16, fontWeight: "800" },
  deleteBtn: {
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: "center",
    marginTop: spacing.sm,
  },
  deleteBtnText: { color: "#dc2626", fontSize: 14, fontWeight: "700" },
});
