import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import PrimaryButton from "@/components/PrimaryButton";
import {
  addHome,
  getActiveHomeId,
  type Home,
  loadHomes,
  removeHome,
  switchHome,
} from "@/lib/homes";
import { generateId } from "@/lib/storage";
import { colors, radius, spacing } from "@/lib/theme";

const HOME_ICONS = ["🏠", "🏡", "🏢", "🏘", "🏗", "🏛", "⛺", "🏖", "🏔", "🛖"];

export default function HomesScreen() {
  const router = useRouter();
  const [homes, setHomes] = useState<Home[]>([]);
  const [activeId, setActiveId] = useState<string>("");
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [newAddress, setNewAddress] = useState("");
  const [newIcon, setNewIcon] = useState("🏠");

  const refresh = useCallback(async () => {
    setHomes(await loadHomes());
    setActiveId(getActiveHomeId());
  }, []);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  async function handleSwitch(home: Home) {
    if (home.id === activeId) return;
    await switchHome(home.id);
    router.replace("/(tabs)/(home)");
  }

  async function handleAdd() {
    const name = newName.trim();
    if (!name) {
      Alert.alert("Name required", "Give this home a name.");
      return;
    }
    const home: Home = {
      id: generateId(),
      name,
      address: newAddress.trim(),
      icon: newIcon,
      createdAt: Date.now(),
    };
    await addHome(home);
    setShowAdd(false);
    setNewName("");
    setNewAddress("");
    setNewIcon("🏠");
    await refresh();
    // Optionally switch to the new home right away
    await switchHome(home.id);
    router.replace("/(tabs)/(home)");
  }

  function handleRemove(home: Home) {
    if (homes.length <= 1) {
      Alert.alert("Can't remove", "You need at least one home.");
      return;
    }
    Alert.alert(
      `Remove ${home.name}?`,
      "All repairs, reminders, and inventory for this home will stay in storage but won't be accessible anymore.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            await removeHome(home.id);
            await refresh();
            if (home.id === activeId) {
              router.replace("/(tabs)/(home)");
            }
          },
        },
      ]
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.heading}>Your homes</Text>
      <Text style={styles.sub}>
        All repairs, reminders, inventory, and chat history are stored per
        home. Tap a home to switch to it.
      </Text>

      {homes.map((home) => {
        const isActive = home.id === activeId;
        return (
          <Pressable
            key={home.id}
            onPress={() => handleSwitch(home)}
            onLongPress={() => handleRemove(home)}
            style={({ pressed }) => [
              styles.homeCard,
              isActive && styles.homeCardActive,
              pressed && { opacity: 0.85 },
            ]}
          >
            <Text style={styles.homeIcon}>{home.icon}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.homeName}>{home.name}</Text>
              {home.address.length > 0 && (
                <Text style={styles.homeAddress} numberOfLines={1}>
                  {home.address}
                </Text>
              )}
            </View>
            {isActive && (
              <View style={styles.activeBadge}>
                <Text style={styles.activeBadgeText}>Active</Text>
              </View>
            )}
          </Pressable>
        );
      })}

      <Text style={styles.hint}>Long-press a home to remove it.</Text>

      {!showAdd ? (
        <PrimaryButton
          title="+ Add another home"
          onPress={() => setShowAdd(true)}
          variant="secondary"
          style={{ marginTop: spacing.md }}
        />
      ) : (
        <View style={styles.addCard}>
          <Text style={styles.addTitle}>New home</Text>

          <Text style={styles.fieldLabel}>Name</Text>
          <TextInput
            value={newName}
            onChangeText={setNewName}
            placeholder="e.g. Lake House"
            placeholderTextColor={colors.textSubtle}
            style={styles.input}
          />

          <Text style={styles.fieldLabel}>Address (optional)</Text>
          <TextInput
            value={newAddress}
            onChangeText={setNewAddress}
            placeholder="e.g. 456 Lake Rd, Austin, TX"
            placeholderTextColor={colors.textSubtle}
            style={styles.input}
          />

          <Text style={styles.fieldLabel}>Icon</Text>
          <View style={styles.iconGrid}>
            {HOME_ICONS.map((ic) => (
              <Pressable
                key={ic}
                onPress={() => setNewIcon(ic)}
                style={[
                  styles.iconChoice,
                  newIcon === ic && styles.iconChoiceActive,
                ]}
              >
                <Text style={styles.iconChoiceText}>{ic}</Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.addActions}>
            <PrimaryButton
              title="Cancel"
              onPress={() => setShowAdd(false)}
              variant="secondary"
              style={{ flex: 1 }}
            />
            <PrimaryButton
              title="Add home"
              onPress={handleAdd}
              disabled={!newName.trim()}
              style={{ flex: 1 }}
            />
          </View>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl * 2,
  },
  heading: {
    fontSize: 20,
    fontWeight: "800",
    color: colors.text,
  },
  sub: {
    fontSize: 13,
    color: colors.textMuted,
    lineHeight: 19,
    marginTop: spacing.xs,
    marginBottom: spacing.lg,
  },
  homeCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md + 2,
    marginBottom: spacing.sm + 2,
  },
  homeCardActive: {
    borderColor: colors.brand,
    borderWidth: 2,
    backgroundColor: colors.brandLighter,
  },
  homeIcon: {
    fontSize: 32,
  },
  homeName: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.text,
  },
  homeAddress: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  activeBadge: {
    backgroundColor: colors.brand,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  activeBadgeText: {
    color: "#ffffff",
    fontSize: 11,
    fontWeight: "800",
  },
  hint: {
    textAlign: "center",
    fontSize: 11,
    color: colors.textSubtle,
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  addCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  addTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.text,
    marginBottom: spacing.xs,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  input: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    fontSize: 15,
    color: colors.text,
  },
  iconGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs + 2,
  },
  iconChoice: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "#f5f5f4",
    alignItems: "center",
    justifyContent: "center",
  },
  iconChoiceActive: {
    borderColor: colors.brand,
    backgroundColor: colors.brandLight,
    borderWidth: 2,
  },
  iconChoiceText: {
    fontSize: 22,
  },
  addActions: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
});
