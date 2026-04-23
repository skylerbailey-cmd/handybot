import { Stack, useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import {
  Alert,
  Linking,
  Pressable,
  ScrollView,
  SectionList,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { isAtLeast } from "@/lib/tiers";
import { showPaywallAlert } from "@/lib/showPaywall";
import { loadVendors, deleteVendor } from "@/lib/vendors";
import { colors, radius, spacing } from "@/lib/theme";
import type { Vendor, VendorSpecialty } from "@/lib/types";

const SPECIALTY_LABEL: Record<VendorSpecialty, string> = {
  plumbing: "Plumbing",
  electrical: "Electrical",
  hvac: "HVAC",
  roofing: "Roofing",
  appliance: "Appliance",
  handyman: "Handyman",
  landscaping: "Landscaping",
  other: "Other",
};

const SPECIALTY_ORDER: VendorSpecialty[] = [
  "plumbing",
  "electrical",
  "hvac",
  "roofing",
  "appliance",
  "handyman",
  "landscaping",
  "other",
];

export default function VendorsListScreen() {
  const router = useRouter();
  const [vendors, setVendors] = useState<Vendor[]>([]);

  useFocusEffect(
    useCallback(() => {
      loadVendors().then(setVendors);
    }, [])
  );

  if (!isAtLeast("landlord")) {
    return (
      <>
        <Stack.Screen options={{ title: "Vendor Book" }} />
        <View style={styles.gateContainer}>
          <Text style={styles.gateIcon}>📒</Text>
          <Text style={styles.gateTitle}>Vendor book is a Landlord feature</Text>
          <Text style={styles.gateBody}>
            Track your go-to plumbers, electricians, and other pros for each
            property.
          </Text>
          <Pressable
            onPress={() =>
              showPaywallAlert(
                "Vendor book is only available on the Landlord plan."
              )
            }
            style={styles.gateBtn}
          >
            <Text style={styles.gateBtnText}>See plans</Text>
          </Pressable>
        </View>
      </>
    );
  }

  // Group by specialty
  const sections = SPECIALTY_ORDER.map((spec) => ({
    title: SPECIALTY_LABEL[spec],
    data: vendors.filter((v) => v.specialty === spec),
  })).filter((s) => s.data.length > 0);

  function handleDelete(vendor: Vendor) {
    Alert.alert(
      "Delete vendor?",
      `Remove ${vendor.name} from your vendor book?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            await deleteVendor(vendor.id);
            setVendors((prev) => prev.filter((v) => v.id !== vendor.id));
          },
        },
      ]
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: "Vendor Book" }} />
      {vendors.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>📒</Text>
          <Text style={styles.emptyTitle}>No vendors yet</Text>
          <Text style={styles.emptyBody}>
            Add your trusted plumbers, electricians, and other pros. They'll
            show up when HandyBot recommends calling a professional.
          </Text>
          <Pressable
            onPress={() => router.push("/(tabs)/(settings)/vendors/new")}
            style={styles.addBtn}
          >
            <Text style={styles.addBtnText}>+ Add a vendor</Text>
          </Pressable>
        </View>
      ) : (
        <>
          <SectionList
            sections={sections}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.list}
            renderSectionHeader={({ section }) => (
              <Text style={styles.sectionHeader}>{section.title}</Text>
            )}
            renderItem={({ item }) => (
              <Pressable
                onPress={() =>
                  router.push({
                    pathname: "/(tabs)/(settings)/vendors/[id]",
                    params: { id: item.id },
                  })
                }
                onLongPress={() => handleDelete(item)}
                style={({ pressed }) => [
                  styles.vendorRow,
                  pressed && { opacity: 0.9 },
                ]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.vendorName}>{item.name}</Text>
                  {item.phone && (
                    <Text style={styles.vendorSub}>{item.phone}</Text>
                  )}
                </View>
                <View style={styles.actionBtns}>
                  {item.phone && (
                    <>
                      <Pressable
                        onPress={(e) => {
                          e.stopPropagation();
                          Linking.openURL(`tel:${item.phone}`);
                        }}
                        style={styles.actionBtn}
                      >
                        <Text style={styles.actionBtnText}>Call</Text>
                      </Pressable>
                      <Pressable
                        onPress={(e) => {
                          e.stopPropagation();
                          Linking.openURL(`sms:${item.phone}`);
                        }}
                        style={styles.actionBtn}
                      >
                        <Text style={styles.actionBtnText}>Text</Text>
                      </Pressable>
                    </>
                  )}
                  {item.email && (
                    <Pressable
                      onPress={(e) => {
                        e.stopPropagation();
                        Linking.openURL(`mailto:${item.email}`);
                      }}
                      style={styles.actionBtn}
                    >
                      <Text style={styles.actionBtnText}>Email</Text>
                    </Pressable>
                  )}
                </View>
              </Pressable>
            )}
            ListFooterComponent={
              <Pressable
                onPress={() => router.push("/(tabs)/(settings)/vendors/new")}
                style={styles.addBtnBottom}
              >
                <Text style={styles.addBtnText}>+ Add a vendor</Text>
              </Pressable>
            }
          />
        </>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  gateContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
    gap: spacing.md,
  },
  gateIcon: { fontSize: 48 },
  gateTitle: { fontSize: 18, fontWeight: "800", color: colors.text, textAlign: "center" },
  gateBody: { fontSize: 14, color: colors.textMuted, textAlign: "center", maxWidth: 300 },
  gateBtn: {
    backgroundColor: colors.brand,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    marginTop: spacing.sm,
  },
  gateBtnText: { color: "#fff", fontSize: 15, fontWeight: "800" },
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
    gap: spacing.sm,
  },
  emptyIcon: { fontSize: 48 },
  emptyTitle: { fontSize: 18, fontWeight: "800", color: colors.text },
  emptyBody: {
    fontSize: 13,
    color: colors.textMuted,
    textAlign: "center",
    maxWidth: 300,
    lineHeight: 19,
  },
  addBtn: {
    backgroundColor: colors.brand,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    marginTop: spacing.sm,
  },
  addBtnBottom: {
    backgroundColor: colors.brand,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    alignItems: "center",
    margin: spacing.lg,
  },
  addBtnText: { color: "#fff", fontSize: 15, fontWeight: "800" },
  list: { paddingBottom: spacing.xxl },
  sectionHeader: {
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    color: colors.textSubtle,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xs,
    backgroundColor: colors.background,
  },
  vendorRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderColor: colors.border,
    gap: spacing.md,
  },
  vendorName: { fontSize: 15, fontWeight: "700", color: colors.text },
  vendorSub: { fontSize: 12, color: colors.textMuted, marginTop: 1 },
  actionBtns: { flexDirection: "row", gap: spacing.xs },
  actionBtn: {
    backgroundColor: colors.brandLight,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs,
    borderRadius: radius.md,
  },
  actionBtnText: { fontSize: 12, fontWeight: "700", color: colors.brandDark },
});
