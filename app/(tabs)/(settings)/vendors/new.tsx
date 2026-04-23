import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import * as Contacts from "expo-contacts";
import { getActiveHomeId } from "@/lib/homes";
import { createBlankVendor, saveVendor } from "@/lib/vendors";
import { colors, radius, spacing } from "@/lib/theme";
import type { VendorSpecialty } from "@/lib/types";

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

export default function NewVendorScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ specialty?: string }>();
  const homeId = getActiveHomeId();

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [specialty, setSpecialty] = useState<VendorSpecialty>(
    (params.specialty as VendorSpecialty) ?? "handyman"
  );
  const [hourlyRate, setHourlyRate] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleImportContact() {
    try {
      const { status } = await Contacts.requestPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Permission needed",
          "Allow HandyBot to access your contacts to import vendor info."
        );
        return;
      }

      const result = await Contacts.presentContactPickerAsync();
      if (!result) return;

      if (result.name) {
        const parts = [result.firstName, result.lastName].filter(Boolean);
        setName(parts.join(" ") || result.name);
      }
      if (result.phoneNumbers?.[0]?.number) {
        setPhone(result.phoneNumbers[0].number);
      }
      if (result.emails?.[0]?.email) {
        setEmail(result.emails[0].email);
      }
    } catch {
      Alert.alert("Could not open contacts", "Try entering the info manually.");
    }
  }

  async function handleSave() {
    const trimmedName = name.trim();
    if (!trimmedName) {
      Alert.alert("Name required", "Enter the vendor's name.");
      return;
    }
    setSaving(true);
    try {
      const vendor = createBlankVendor(homeId, specialty);
      vendor.name = trimmedName;
      vendor.phone = phone.trim() || undefined;
      vendor.email = email.trim() || undefined;
      vendor.hourlyRateUsd = parseFloat(hourlyRate) || undefined;
      vendor.notes = notes.trim() || undefined;
      await saveVendor(vendor);
      router.back();
    } catch {
      Alert.alert("Failed", "Could not save vendor.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Stack.Screen options={{ title: "Add Vendor" }} />
      <ScrollView contentContainerStyle={styles.container}>
        <Pressable onPress={handleImportContact} style={styles.importBtn}>
          <Text style={styles.importBtnText}>Import from Contacts</Text>
        </Pressable>

        <Text style={styles.label}>Name *</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="e.g. Joe's Plumbing"
          placeholderTextColor={colors.textSubtle}
        />

        <Text style={styles.label}>Phone</Text>
        <TextInput
          style={styles.input}
          value={phone}
          onChangeText={setPhone}
          placeholder="(555) 123-4567"
          placeholderTextColor={colors.textSubtle}
          keyboardType="phone-pad"
        />

        <Text style={styles.label}>Email</Text>
        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          placeholder="joe@plumbing.com"
          placeholderTextColor={colors.textSubtle}
          keyboardType="email-address"
          autoCapitalize="none"
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
          placeholder="e.g. 85"
          placeholderTextColor={colors.textSubtle}
          keyboardType="numeric"
        />

        <Text style={styles.label}>Notes</Text>
        <TextInput
          style={[styles.input, { minHeight: 80, textAlignVertical: "top" }]}
          value={notes}
          onChangeText={setNotes}
          placeholder="Availability, specialties, license #, etc."
          placeholderTextColor={colors.textSubtle}
          multiline
        />

        <Pressable
          onPress={handleSave}
          disabled={saving}
          style={[styles.saveBtn, saving && { opacity: 0.6 }]}
        >
          <Text style={styles.saveBtnText}>
            {saving ? "Saving..." : "Save Vendor"}
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
  importBtn: {
    borderWidth: 1,
    borderColor: colors.brand,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  importBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.brand,
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
  specialtyChipTextActive: {
    color: "#fff",
  },
  saveBtn: {
    backgroundColor: colors.brand,
    borderRadius: radius.md,
    paddingVertical: spacing.md + 2,
    alignItems: "center",
    marginTop: spacing.md,
  },
  saveBtnText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "800",
  },
});
