import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  TIERS,
  annualSavingsPercent,
  type TierSlug,
} from "@/lib/tiers";
import { colors, radius, spacing } from "@/lib/theme";

const TIER_ORDER: TierSlug[] = ["pro", "family", "landlord"];

const FEATURE_LISTS: Record<TierSlug, string[]> = {
  free: [],
  pro: [
    "Unlimited AI repair plans",
    "Unlimited Ask HandyBot",
    "AI repair verification",
    "Warranty tracker",
    "Recall monitoring on all items",
    "Up to 3 homes",
    "Unlimited reminders",
    "Cloud sync across devices",
    "Home transfer (export/import)",
    "Insurance inventory PDF",
    "Full repair history",
  ],
  family: [
    "Everything in Pro, plus:",
    "Up to 4 family members",
    "Shared inventory and reminders",
    "Up to 5 homes",
    "Per-user activity log",
    "Kids safe ask mode",
  ],
  landlord: [
    "Everything in Family, plus:",
    "Unlimited properties",
    "Tenant photo report link",
    "Schedule E expense tracking",
    "Annual CSV export",
    "Vendor book per property",
    "Invoice generator PDF",
  ],
};

export default function PaywallScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ context?: string }>();
  const [billing, setBilling] = useState<"yearly" | "monthly">("yearly");
  const [selectedTier, setSelectedTier] = useState<TierSlug>("pro");
  const [purchasing, setPurchasing] = useState(false);

  const contextMessage = params.context;

  async function handleSubscribe() {
    setPurchasing(true);
    // TODO: RevenueCat purchase flow
    // const result = await Purchases.purchasePackage(package);
    // if (result) { await setTier(selectedTier); router.back(); }
    Alert.alert(
      "Coming soon",
      "Subscriptions will be available when the app launches. Thanks for your interest!"
    );
    setPurchasing(false);
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: "",
          headerTransparent: true,
          headerLeft: () => (
            <Pressable onPress={() => router.back()} hitSlop={12}>
              <Text style={styles.closeBtn}>Close</Text>
            </Pressable>
          ),
        }}
      />
      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.container}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.logo}>HandyBot</Text>
          <Text style={styles.headline}>
            Do more with your home
          </Text>
          {contextMessage && (
            <View style={styles.contextBadge}>
              <Text style={styles.contextText}>{contextMessage}</Text>
            </View>
          )}
        </View>

        {/* Billing toggle */}
        <View style={styles.billingToggle}>
          <Pressable
            onPress={() => setBilling("yearly")}
            style={[
              styles.billingOption,
              billing === "yearly" && styles.billingOptionActive,
            ]}
          >
            <Text
              style={[
                styles.billingOptionText,
                billing === "yearly" && styles.billingOptionTextActive,
              ]}
            >
              Yearly
            </Text>
            <View style={styles.saveBadge}>
              <Text style={styles.saveBadgeText}>Best value</Text>
            </View>
          </Pressable>
          <Pressable
            onPress={() => setBilling("monthly")}
            style={[
              styles.billingOption,
              billing === "monthly" && styles.billingOptionActive,
            ]}
          >
            <Text
              style={[
                styles.billingOptionText,
                billing === "monthly" && styles.billingOptionTextActive,
              ]}
            >
              Monthly
            </Text>
          </Pressable>
        </View>

        {/* Tier cards */}
        {TIER_ORDER.map((slug) => {
          const tier = TIERS[slug];
          const selected = selectedTier === slug;
          const price =
            billing === "yearly"
              ? `$${(tier.yearlyPrice / 12).toFixed(2)}/mo`
              : `$${tier.monthlyPrice.toFixed(2)}/mo`;
          const billedNote =
            billing === "yearly"
              ? `Billed $${tier.yearlyPrice}/year`
              : "Billed monthly";
          const savePct = annualSavingsPercent(slug);

          return (
            <Pressable
              key={slug}
              onPress={() => setSelectedTier(slug)}
              style={[
                styles.tierCard,
                selected && styles.tierCardSelected,
                slug === "pro" && styles.tierCardPopular,
              ]}
            >
              {slug === "pro" && (
                <View style={styles.popularBadge}>
                  <Text style={styles.popularBadgeText}>Most popular</Text>
                </View>
              )}
              <View style={styles.tierHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.tierName}>{tier.name}</Text>
                  <Text style={styles.tierTagline}>{tier.tagline}</Text>
                </View>
                <View
                  style={[
                    styles.radio,
                    selected && styles.radioSelected,
                  ]}
                >
                  {selected && <View style={styles.radioInner} />}
                </View>
              </View>

              <View style={styles.priceRow}>
                <Text style={styles.price}>{price}</Text>
                <Text style={styles.billedNote}>{billedNote}</Text>
                {billing === "yearly" && savePct > 0 && (
                  <View style={styles.discountBadge}>
                    <Text style={styles.discountBadgeText}>
                      Save {savePct}%
                    </Text>
                  </View>
                )}
              </View>

              <View style={styles.features}>
                {FEATURE_LISTS[slug].map((feature, i) => (
                  <View key={i} style={styles.featureRow}>
                    <Text style={styles.featureCheck}>
                      {feature.startsWith("Everything") ? "" : "\u2713"}
                    </Text>
                    <Text
                      style={[
                        styles.featureText,
                        feature.startsWith("Everything") &&
                          styles.featureTextBold,
                      ]}
                    >
                      {feature}
                    </Text>
                  </View>
                ))}
              </View>
            </Pressable>
          );
        })}

        {/* Subscribe button */}
        <Pressable
          onPress={handleSubscribe}
          disabled={purchasing}
          style={({ pressed }) => [
            styles.subscribeBtn,
            pressed && { opacity: 0.9 },
            purchasing && { opacity: 0.6 },
          ]}
        >
          <Text style={styles.subscribeBtnText}>
            {purchasing
              ? "Processing..."
              : `Continue with ${TIERS[selectedTier].name}`}
          </Text>
        </Pressable>

        {/* Free plan note */}
        <Pressable onPress={() => router.back()}>
          <Text style={styles.freeNote}>
            Continue with the free plan
          </Text>
        </Pressable>

        {/* Legal */}
        <Text style={styles.legal}>
          Payment will be charged to your Apple ID account at confirmation of
          purchase. Subscription automatically renews unless it is canceled at
          least 24 hours before the end of the current period. You can manage
          and cancel your subscription in your App Store account settings.
        </Text>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#fafaf9",
  },
  container: {
    padding: spacing.lg,
    paddingTop: 80,
    paddingBottom: spacing.xxl * 2,
  },
  closeBtn: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.brand,
    paddingHorizontal: spacing.sm,
  },
  header: {
    alignItems: "center",
    marginBottom: spacing.xl,
  },
  logo: {
    fontSize: 14,
    fontWeight: "900",
    color: colors.brand,
    textTransform: "uppercase",
    letterSpacing: 1.5,
    marginBottom: spacing.xs,
  },
  headline: {
    fontSize: 26,
    fontWeight: "900",
    color: colors.text,
    textAlign: "center",
  },
  contextBadge: {
    marginTop: spacing.md,
    backgroundColor: "#fef3c7",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.pill,
  },
  contextText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#92400e",
    textAlign: "center",
  },
  billingToggle: {
    flexDirection: "row",
    backgroundColor: "#e7e5e4",
    borderRadius: radius.pill,
    padding: 3,
    marginBottom: spacing.lg,
  },
  billingOption: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.pill,
  },
  billingOptionActive: {
    backgroundColor: "#fff",
  },
  billingOptionText: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.textMuted,
  },
  billingOptionTextActive: {
    color: colors.text,
  },
  saveBadge: {
    backgroundColor: "#dcfce7",
    paddingHorizontal: spacing.xs + 2,
    paddingVertical: 1,
    borderRadius: radius.pill,
  },
  saveBadgeText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#15803d",
  },
  tierCard: {
    backgroundColor: "#fff",
    borderRadius: radius.lg,
    borderWidth: 2,
    borderColor: "#e7e5e4",
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  tierCardSelected: {
    borderColor: colors.brand,
  },
  tierCardPopular: {
    position: "relative",
  },
  popularBadge: {
    position: "absolute",
    top: -11,
    alignSelf: "center",
    backgroundColor: colors.brand,
    paddingHorizontal: spacing.md,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  popularBadgeText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#fff",
  },
  tierHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  tierName: {
    fontSize: 18,
    fontWeight: "800",
    color: colors.text,
  },
  tierTagline: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 1,
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: "#d6d3d1",
    alignItems: "center",
    justifyContent: "center",
  },
  radioSelected: {
    borderColor: colors.brand,
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.brand,
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  price: {
    fontSize: 22,
    fontWeight: "900",
    color: colors.text,
  },
  billedNote: {
    fontSize: 12,
    color: colors.textMuted,
  },
  discountBadge: {
    backgroundColor: "#dcfce7",
    paddingHorizontal: spacing.xs + 2,
    paddingVertical: 1,
    borderRadius: radius.pill,
  },
  discountBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#15803d",
  },
  features: {
    gap: spacing.xs + 1,
  },
  featureRow: {
    flexDirection: "row",
    gap: spacing.xs + 2,
  },
  featureCheck: {
    fontSize: 13,
    color: "#15803d",
    fontWeight: "700",
    width: 16,
  },
  featureText: {
    fontSize: 13,
    color: colors.textMuted,
    flex: 1,
  },
  featureTextBold: {
    fontWeight: "700",
    color: colors.text,
  },
  subscribeBtn: {
    backgroundColor: colors.brand,
    borderRadius: radius.md,
    paddingVertical: spacing.md + 2,
    alignItems: "center",
    marginTop: spacing.sm,
  },
  subscribeBtnText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "800",
  },
  freeNote: {
    textAlign: "center",
    fontSize: 14,
    fontWeight: "600",
    color: colors.textMuted,
    marginTop: spacing.md,
    paddingVertical: spacing.sm,
  },
  legal: {
    fontSize: 10,
    color: colors.textSubtle,
    textAlign: "center",
    marginTop: spacing.lg,
    lineHeight: 14,
  },
});
