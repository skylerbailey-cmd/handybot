import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import PrimaryButton from "@/components/PrimaryButton";
import { estimateReplacementCost } from "@/lib/claude";
import {
  addHomeItem,
  loadInventory,
  removeHomeItem,
  updateHomeItem,
} from "@/lib/homeData";
import { promptAndPickImage } from "@/lib/image";
import { generateId } from "@/lib/storage";
import { colors, formatMoney, radius, spacing } from "@/lib/theme";
import type { HomeItem, ItemCondition } from "@/lib/types";
import { getRegistrationUrl, openRegistrationPage } from "@/lib/warrantyRegistry";

const CONDITIONS: Array<{ value: ItemCondition; label: string }> = [
  { value: "good", label: "Good" },
  { value: "fair", label: "Fair" },
  { value: "poor", label: "Poor" },
  { value: "replace_soon", label: "Replace soon" },
];

const CONDITION_COLOR: Record<string, { bg: string; fg: string }> = {
  good: { bg: "#d1fae5", fg: "#047857" },
  fair: { bg: "#fef3c7", fg: "#b45309" },
  poor: { bg: "#fee2e2", fg: "#b91c1c" },
  replace_soon: { bg: "#fee2e2", fg: "#b91c1c" },
};

export default function InventoryEditScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    itemId?: string;
    analyzedData?: string;
    photoUri?: string;
  }>();

  const isNew = !params.itemId;

  const [name, setName] = useState("");
  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [serialNumber, setSerialNumber] = useState("");
  const [yearInstalled, setYearInstalled] = useState("");
  const [conditionNotes, setConditionNotes] = useState("");
  const [estimatedAgeYears, setEstimatedAgeYears] = useState("");
  const [typicalLifespanYears, setTypicalLifespanYears] = useState("");
  const [condition, setCondition] = useState<ItemCondition>("fair");
  const [photoUri, setPhotoUri] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);
  const [photoFailed, setPhotoFailed] = useState(false);

  // Warranty fields
  const [purchaseDate, setPurchaseDate] = useState("");
  const [warrantyExpiration, setWarrantyExpiration] = useState("");
  const [warrantyProvider, setWarrantyProvider] = useState("");
  const [warrantyCoverageNotes, setWarrantyCoverageNotes] = useState("");
  const [warrantyPhotoUri, setWarrantyPhotoUri] = useState<string | undefined>();
  const [warrantyPhotoFailed, setWarrantyPhotoFailed] = useState(false);
  const [receiptPhotoUri, setReceiptPhotoUri] = useState<string | undefined>();
  const [receiptPhotoFailed, setReceiptPhotoFailed] = useState(false);
  const [warrantyRegistered, setWarrantyRegistered] = useState(false);
  const [replacementCostUsd, setReplacementCostUsd] = useState<number | undefined>();
  const [costRationale, setCostRationale] = useState<string | undefined>();
  const [estimatingCost, setEstimatingCost] = useState(false);

  // Fields we keep from analysis but don't expose for editing
  const [category, setCategory] = useState("other");
  const [icon, setIcon] = useState("🏠");
  const [room, setRoom] = useState("");
  const [maintenanceTips, setMaintenanceTips] = useState<string[]>([]);
  const [suggestedReminders, setSuggestedReminders] = useState<
    HomeItem["suggestedReminders"]
  >(undefined);
  const [existingItem, setExistingItem] = useState<HomeItem | null>(null);

  // Load data based on mode (new vs edit)
  useEffect(() => {
    if (params.itemId) {
      // Editing an existing item — load from storage
      loadInventory().then((items) => {
        const found = items.find((i) => i.id === params.itemId);
        if (found) {
          setExistingItem(found);
          setName(found.name);
          setMake(found.make ?? "");
          setModel(found.model ?? "");
          setSerialNumber(found.serialNumber ?? "");
          setYearInstalled(found.yearInstalled ? String(found.yearInstalled) : "");
          setConditionNotes(found.conditionNotes);
          setEstimatedAgeYears(String(found.estimatedAgeYears));
          setTypicalLifespanYears(String(found.typicalLifespanYears));
          setCondition(found.condition);
          setPhotoUri(found.photoUri);
          setCategory(found.category);
          setIcon(found.icon);
          setRoom(found.room);
          setMaintenanceTips(found.maintenanceTips);
          setSuggestedReminders(found.suggestedReminders);
          setPurchaseDate(
            found.purchaseDate
              ? new Date(found.purchaseDate).toISOString().split("T")[0]
              : ""
          );
          setWarrantyExpiration(
            found.warrantyExpiration
              ? new Date(found.warrantyExpiration).toISOString().split("T")[0]
              : ""
          );
          setWarrantyProvider(found.warrantyProvider ?? "");
          setWarrantyCoverageNotes(found.warrantyCoverageNotes ?? "");
          setWarrantyPhotoUri(found.warrantyPhotoUri);
          setReceiptPhotoUri(found.receiptPhotoUri);
          setWarrantyRegistered(found.warrantyRegistered ?? false);
          setReplacementCostUsd(found.replacementCostUsd);
        }
      });
    } else if (params.analyzedData) {
      // New item — populate from Claude analysis
      try {
        const data = JSON.parse(params.analyzedData);
        setName(data.name ?? "");
        setMake(data.make ?? "");
        setModel(data.model ?? "");
        setSerialNumber(data.serialNumber ?? "");
        setYearInstalled(data.yearInstalled ? String(data.yearInstalled) : "");
        setConditionNotes(data.conditionNotes ?? "");
        setEstimatedAgeYears(String(data.estimatedAgeYears ?? 0));
        setTypicalLifespanYears(String(data.typicalLifespanYears ?? 0));
        setCondition(data.condition ?? "fair");
        setCategory(data.category ?? "other");
        setIcon(data.icon ?? "🏠");
        setMaintenanceTips(data.maintenanceTips ?? []);
        setSuggestedReminders(data.suggestedReminders);
        if (data.purchaseDateHint) setPurchaseDate(data.purchaseDateHint);
        if (data.warrantyYearsHint && data.purchaseDateHint) {
          const pd = new Date(data.purchaseDateHint);
          pd.setFullYear(pd.getFullYear() + data.warrantyYearsHint);
          setWarrantyExpiration(pd.toISOString().split("T")[0]);
        }
        if (params.photoUri) {
          setPhotoUri(params.photoUri);
        }
      } catch {
        // If parsing fails, leave defaults
      }
    }
  }, [params.itemId, params.analyzedData, params.photoUri]);

  const canSave =
    name.trim().length > 0 &&
    estimatedAgeYears.length > 0 &&
    typicalLifespanYears.length > 0;

  const handleSave = useCallback(async () => {
    if (!canSave || saving) return;
    setSaving(true);
    try {
      const ageNum = Math.max(0, Number(estimatedAgeYears) || 0);
      const lifespanNum = Math.max(1, Number(typicalLifespanYears) || 1);

      const yearNum = Number(yearInstalled) || 0;
      const purchaseDateMs = purchaseDate
        ? new Date(purchaseDate).getTime()
        : undefined;
      const warrantyExpirationMs = warrantyExpiration
        ? new Date(warrantyExpiration).getTime()
        : undefined;

      if (isNew) {
        const item: HomeItem = {
          id: generateId(),
          name: name.trim(),
          category,
          icon,
          room,
          photoUri,
          make: make.trim() || undefined,
          model: model.trim() || undefined,
          serialNumber: serialNumber.trim() || undefined,
          yearInstalled: yearNum || undefined,
          estimatedAgeYears: ageNum,
          typicalLifespanYears: lifespanNum,
          condition,
          conditionNotes: conditionNotes.trim(),
          maintenanceTips,
          suggestedReminders,
          purchaseDate: purchaseDateMs || undefined,
          warrantyExpiration: warrantyExpirationMs || undefined,
          warrantyProvider: warrantyProvider.trim() || undefined,
          warrantyCoverageNotes: warrantyCoverageNotes.trim() || undefined,
          warrantyPhotoUri,
          receiptPhotoUri,
          warrantyRegistered,
          replacementCostUsd,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        await addHomeItem(item);

        // Background: estimate replacement cost if not already set
        if (!replacementCostUsd && name.trim()) {
          void estimateReplacementCost({
            name: name.trim(),
            make: make.trim() || undefined,
            model: model.trim() || undefined,
            category: category || undefined,
            yearInstalled: yearNum || undefined,
          })
            .then((est) => {
              if (est.replacementCostUsd > 0) {
                void updateHomeItem(item.id, {
                  replacementCostUsd: est.replacementCostUsd,
                });
              }
            })
            .catch(() => {
              /* non-blocking */
            });
        }
      } else if (params.itemId) {
        await updateHomeItem(params.itemId, {
          name: name.trim(),
          make: make.trim() || undefined,
          model: model.trim() || undefined,
          serialNumber: serialNumber.trim() || undefined,
          yearInstalled: yearNum || undefined,
          conditionNotes: conditionNotes.trim(),
          estimatedAgeYears: ageNum,
          typicalLifespanYears: lifespanNum,
          condition,
          purchaseDate: purchaseDateMs || undefined,
          warrantyExpiration: warrantyExpirationMs || undefined,
          warrantyProvider: warrantyProvider.trim() || undefined,
          warrantyCoverageNotes: warrantyCoverageNotes.trim() || undefined,
          warrantyPhotoUri,
          receiptPhotoUri,
          warrantyRegistered,
          replacementCostUsd,
        });

        // Background: estimate replacement cost if not already set
        if (!replacementCostUsd && name.trim()) {
          void estimateReplacementCost({
            name: name.trim(),
            make: make.trim() || undefined,
            model: model.trim() || undefined,
            category: category || undefined,
            yearInstalled: yearNum || undefined,
          })
            .then((est) => {
              if (est.replacementCostUsd > 0) {
                void updateHomeItem(params.itemId!, {
                  replacementCostUsd: est.replacementCostUsd,
                });
              }
            })
            .catch(() => {
              /* non-blocking */
            });
        }
      }
      router.back();
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Could not save item";
      Alert.alert("Something went wrong", msg);
    } finally {
      setSaving(false);
    }
  }, [
    canSave,
    saving,
    isNew,
    name,
    make,
    model,
    serialNumber,
    yearInstalled,
    category,
    icon,
    room,
    photoUri,
    estimatedAgeYears,
    typicalLifespanYears,
    condition,
    conditionNotes,
    maintenanceTips,
    suggestedReminders,
    purchaseDate,
    warrantyExpiration,
    warrantyProvider,
    warrantyCoverageNotes,
    warrantyPhotoUri,
    receiptPhotoUri,
    warrantyRegistered,
    replacementCostUsd,
    params.itemId,
    router,
  ]);

  return (
    <>
      <Stack.Screen
        options={{
          title: isNew ? "Review Item" : "Edit Item",
        }}
      />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
        >
          {photoUri && !photoFailed ? (
            <Image
              source={{ uri: photoUri }}
              style={styles.photo}
              onError={() => setPhotoFailed(true)}
            />
          ) : photoUri && photoFailed ? (
            <View style={styles.photoPlaceholder}>
              <Text style={{ fontSize: 32 }}>{icon || "📷"}</Text>
              <Text style={{ fontSize: 12, color: colors.textSubtle }}>
                Photo unavailable
              </Text>
            </View>
          ) : null}

          {/* Name / Title */}
          <View style={styles.card}>
            <Text style={styles.label}>Name</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="e.g. Kitchen Refrigerator"
              placeholderTextColor={colors.textSubtle}
              style={styles.input}
            />
          </View>

          {/* Make / Model / Serial / Year */}
          <View style={styles.card}>
            <Text style={styles.label}>Details</Text>
            <View style={styles.detailRow}>
              <View style={styles.detailField}>
                <Text style={styles.detailLabel}>Brand</Text>
                <TextInput
                  value={make}
                  onChangeText={setMake}
                  placeholder="e.g. GE, Rheem"
                  placeholderTextColor={colors.textSubtle}
                  style={styles.input}
                />
              </View>
              <View style={styles.detailField}>
                <Text style={styles.detailLabel}>Model</Text>
                <TextInput
                  value={model}
                  onChangeText={setModel}
                  placeholder="e.g. GDF535"
                  placeholderTextColor={colors.textSubtle}
                  style={styles.input}
                />
              </View>
            </View>
            <View style={styles.detailRow}>
              <View style={styles.detailField}>
                <Text style={styles.detailLabel}>Serial Number</Text>
                <TextInput
                  value={serialNumber}
                  onChangeText={setSerialNumber}
                  placeholder="If known"
                  placeholderTextColor={colors.textSubtle}
                  style={styles.input}
                  autoCapitalize="characters"
                />
              </View>
              <View style={styles.detailFieldSmall}>
                <Text style={styles.detailLabel}>Year</Text>
                <TextInput
                  value={yearInstalled}
                  onChangeText={setYearInstalled}
                  placeholder="e.g. 2019"
                  placeholderTextColor={colors.textSubtle}
                  keyboardType="number-pad"
                  maxLength={4}
                  style={styles.input}
                />
              </View>
            </View>
          </View>

          {/* Description / Condition Notes */}
          <View style={styles.card}>
            <Text style={styles.label}>Description</Text>
            <TextInput
              value={conditionNotes}
              onChangeText={setConditionNotes}
              placeholder="Notes about the item's current condition"
              placeholderTextColor={colors.textSubtle}
              multiline
              style={styles.textarea}
            />
          </View>

          {/* Condition */}
          <View style={styles.card}>
            <Text style={styles.label}>Condition</Text>
            <View style={styles.conditionRow}>
              {CONDITIONS.map((c) => {
                const active = c.value === condition;
                const col = CONDITION_COLOR[c.value];
                return (
                  <Pressable
                    key={c.value}
                    onPress={() => setCondition(c.value)}
                    style={[
                      styles.conditionChip,
                      active && { backgroundColor: col.bg, borderColor: col.fg },
                    ]}
                  >
                    <Text
                      style={[
                        styles.conditionChipText,
                        active && { color: col.fg },
                      ]}
                    >
                      {c.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Age & Lifespan */}
          <View style={styles.card}>
            <Text style={styles.label}>Estimated Age</Text>
            <View style={styles.numberRow}>
              <TextInput
                value={estimatedAgeYears}
                onChangeText={setEstimatedAgeYears}
                placeholder="0"
                keyboardType="number-pad"
                style={styles.numberInput}
                placeholderTextColor={colors.textSubtle}
              />
              <Text style={styles.unit}>years</Text>
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.label}>Typical Lifespan</Text>
            <View style={styles.numberRow}>
              <TextInput
                value={typicalLifespanYears}
                onChangeText={setTypicalLifespanYears}
                placeholder="0"
                keyboardType="number-pad"
                style={styles.numberInput}
                placeholderTextColor={colors.textSubtle}
              />
              <Text style={styles.unit}>years</Text>
            </View>
          </View>

          {/* Maintenance tips (read-only preview for new items) */}
          {maintenanceTips.length > 0 && (
            <View style={styles.card}>
              <Text style={styles.label}>Maintenance Tips</Text>
              {maintenanceTips.map((tip, i) => (
                <Text key={i} style={styles.tipText}>
                  {"\u2022"} {tip}
                </Text>
              ))}
            </View>
          )}

          {/* Warranty */}
          <View style={styles.card}>
            <Text style={styles.label}>Warranty</Text>
            <View style={styles.detailRow}>
              <View style={styles.detailField}>
                <Text style={styles.detailLabel}>Purchase Date</Text>
                <TextInput
                  value={purchaseDate}
                  onChangeText={setPurchaseDate}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={colors.textSubtle}
                  style={styles.input}
                />
              </View>
              <View style={styles.detailField}>
                <Text style={styles.detailLabel}>Warranty Expires</Text>
                <TextInput
                  value={warrantyExpiration}
                  onChangeText={setWarrantyExpiration}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={colors.textSubtle}
                  style={styles.input}
                />
              </View>
            </View>
            <View style={{ gap: spacing.xs }}>
              <Text style={styles.detailLabel}>Provider</Text>
              <TextInput
                value={warrantyProvider}
                onChangeText={setWarrantyProvider}
                placeholder="e.g. Samsung, Home Depot"
                placeholderTextColor={colors.textSubtle}
                style={styles.input}
              />
            </View>
            <View style={{ gap: spacing.xs }}>
              <Text style={styles.detailLabel}>Coverage Notes</Text>
              <TextInput
                value={warrantyCoverageNotes}
                onChangeText={setWarrantyCoverageNotes}
                placeholder="What does the warranty cover?"
                placeholderTextColor={colors.textSubtle}
                multiline
                style={styles.textarea}
              />
            </View>
            {warrantyPhotoUri && !warrantyPhotoFailed ? (
              <Image
                source={{ uri: warrantyPhotoUri }}
                style={styles.warrantyPhoto}
                onError={() => setWarrantyPhotoFailed(true)}
              />
            ) : warrantyPhotoUri && warrantyPhotoFailed ? (
              <View style={styles.warrantyPhotoPlaceholder}>
                <Text style={{ fontSize: 12, color: colors.textSubtle }}>
                  Warranty photo unavailable
                </Text>
              </View>
            ) : null}
            <Pressable
              onPress={async () => {
                const result = await promptAndPickImage(
                  "Photograph receipt or warranty card"
                );
                if (result) setWarrantyPhotoUri(result.uri);
              }}
              style={styles.warrantyPhotoBtn}
            >
              <Text style={styles.warrantyPhotoBtnText}>
                {warrantyPhotoUri ? "Change Warranty Photo" : "+ Add Warranty Photo"}
              </Text>
            </Pressable>

            {/* Receipt photo */}
            {receiptPhotoUri && !receiptPhotoFailed ? (
              <Image
                source={{ uri: receiptPhotoUri }}
                style={styles.warrantyPhoto}
                onError={() => setReceiptPhotoFailed(true)}
              />
            ) : receiptPhotoUri && receiptPhotoFailed ? (
              <View style={styles.warrantyPhotoPlaceholder}>
                <Text style={{ fontSize: 12, color: colors.textSubtle }}>
                  Receipt photo unavailable
                </Text>
              </View>
            ) : null}
            <Pressable
              onPress={async () => {
                const result = await promptAndPickImage(
                  "Photograph your receipt"
                );
                if (result) setReceiptPhotoUri(result.uri);
              }}
              style={styles.warrantyPhotoBtn}
            >
              <Text style={styles.warrantyPhotoBtnText}>
                {receiptPhotoUri ? "Change Receipt Photo" : "+ Add Receipt Photo"}
              </Text>
            </Pressable>

            {/* Warranty Registration */}
            <View style={styles.registrationSection}>
              <View style={styles.registrationHeader}>
                <Text style={styles.detailLabel}>Product Registration</Text>
                <Pressable
                  onPress={() => setWarrantyRegistered(!warrantyRegistered)}
                  style={[
                    styles.registrationToggle,
                    warrantyRegistered && styles.registrationToggleActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.registrationToggleText,
                      warrantyRegistered && styles.registrationToggleTextActive,
                    ]}
                  >
                    {warrantyRegistered ? "✓ Registered" : "Not registered"}
                  </Text>
                </Pressable>
              </View>
              {!warrantyRegistered && make.trim().length > 0 && (
                <Pressable
                  onPress={() => {
                    // Build a temporary item object for the registration helper
                    const tempItem: HomeItem = {
                      id: params.itemId ?? "temp",
                      name: name.trim(),
                      category,
                      icon,
                      room,
                      make: make.trim() || undefined,
                      model: model.trim() || undefined,
                      serialNumber: serialNumber.trim() || undefined,
                      yearInstalled: Number(yearInstalled) || undefined,
                      estimatedAgeYears: Number(estimatedAgeYears) || 0,
                      typicalLifespanYears: Number(typicalLifespanYears) || 1,
                      condition,
                      conditionNotes: conditionNotes.trim(),
                      maintenanceTips: [],
                      purchaseDate: purchaseDate
                        ? new Date(purchaseDate).getTime()
                        : undefined,
                      createdAt: Date.now(),
                      updatedAt: Date.now(),
                    };
                    openRegistrationPage(tempItem).then(() => {
                      Alert.alert(
                        "Mark as registered?",
                        "Did you complete the warranty registration?",
                        [
                          { text: "Not yet", style: "cancel" },
                          {
                            text: "Yes, registered",
                            onPress: () => setWarrantyRegistered(true),
                          },
                        ]
                      );
                    });
                  }}
                  style={styles.registerActionBtn}
                >
                  <Text style={styles.registerActionBtnText}>
                    📋 Register with {make.trim()}
                  </Text>
                  {getRegistrationUrl(make.trim()) ? (
                    <Text style={styles.registerActionBtnHint}>
                      Opens manufacturer registration page & copies details
                    </Text>
                  ) : (
                    <Text style={styles.registerActionBtnHint}>
                      Searches for registration page & copies details
                    </Text>
                  )}
                </Pressable>
              )}
            </View>
          </View>

          {/* Replacement Cost (for insurance export) */}
          <View style={styles.card}>
            <Text style={styles.label}>Replacement Cost</Text>
            {replacementCostUsd ? (
              <View style={styles.costDisplay}>
                <Text style={styles.costAmount}>
                  {formatMoney(replacementCostUsd)}
                </Text>
                {costRationale ? (
                  <Text style={styles.costRationale}>{costRationale}</Text>
                ) : null}
                <Pressable
                  onPress={async () => {
                    if (estimatingCost) return;
                    setEstimatingCost(true);
                    try {
                      const est = await estimateReplacementCost({
                        name: name.trim(),
                        make: make.trim() || undefined,
                        model: model.trim() || undefined,
                        category: category || undefined,
                        yearInstalled: Number(yearInstalled) || undefined,
                      });
                      if (est.replacementCostUsd > 0) {
                        setReplacementCostUsd(est.replacementCostUsd);
                        setCostRationale(est.rationale);
                      }
                    } catch {
                      Alert.alert("Estimate failed", "Could not get an estimate. Try again later.");
                    } finally {
                      setEstimatingCost(false);
                    }
                  }}
                  style={styles.refreshCostBtn}
                >
                  <Text style={styles.refreshCostBtnText}>
                    {estimatingCost ? "Estimating..." : "↻ Re-estimate"}
                  </Text>
                </Pressable>
              </View>
            ) : (
              <View style={styles.costDisplay}>
                <Text style={styles.costHint}>
                  AI-estimated replacement cost for insurance documentation.
                </Text>
                <Pressable
                  onPress={async () => {
                    if (estimatingCost || !name.trim()) return;
                    setEstimatingCost(true);
                    try {
                      const est = await estimateReplacementCost({
                        name: name.trim(),
                        make: make.trim() || undefined,
                        model: model.trim() || undefined,
                        category: category || undefined,
                        yearInstalled: Number(yearInstalled) || undefined,
                      });
                      if (est.replacementCostUsd > 0) {
                        setReplacementCostUsd(est.replacementCostUsd);
                        setCostRationale(est.rationale);
                      } else {
                        Alert.alert("Could not estimate", est.rationale || "Try adding more details.");
                      }
                    } catch {
                      Alert.alert("Estimate failed", "Could not get an estimate. Try again later.");
                    } finally {
                      setEstimatingCost(false);
                    }
                  }}
                  disabled={estimatingCost || !name.trim()}
                  style={[
                    styles.registerActionBtn,
                    (!name.trim() || estimatingCost) && { opacity: 0.5 },
                  ]}
                >
                  <Text style={styles.registerActionBtnText}>
                    {estimatingCost ? "Estimating..." : "💰 Estimate Replacement Cost"}
                  </Text>
                </Pressable>
              </View>
            )}
          </View>

          <PrimaryButton
            title={isNew ? "Save to Inventory" : "Save Changes"}
            onPress={handleSave}
            disabled={!canSave}
            loading={saving}
          />

          {!isNew && params.itemId && (
            <Pressable
              onPress={() => {
                Alert.alert(
                  "Delete item?",
                  `"${name}" will be permanently removed from your inventory.`,
                  [
                    { text: "Cancel", style: "cancel" },
                    {
                      text: "Delete",
                      style: "destructive",
                      onPress: async () => {
                        await removeHomeItem(params.itemId!);
                        router.back();
                      },
                    },
                  ]
                );
              }}
              style={styles.deleteBtn}
            >
              <Text style={styles.deleteBtnText}>Delete Item</Text>
            </Pressable>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.lg,
    gap: spacing.md,
    paddingBottom: spacing.xxl * 2,
  },
  photo: {
    width: "100%",
    height: 180,
    borderRadius: radius.lg,
    backgroundColor: colors.border,
  },
  photoPlaceholder: {
    width: "100%",
    height: 180,
    borderRadius: radius.lg,
    backgroundColor: "#f5f5f4",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  label: {
    fontSize: 13,
    fontWeight: "800",
    color: colors.text,
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
    backgroundColor: colors.surface,
  },
  textarea: {
    minHeight: 80,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    padding: spacing.md,
    fontSize: 14,
    color: colors.text,
    textAlignVertical: "top",
    backgroundColor: colors.surface,
  },
  conditionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs + 2,
  },
  conditionChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
  },
  conditionChipText: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.textMuted,
  },
  numberRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  numberInput: {
    width: 80,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.sm + 2,
    fontSize: 15,
    color: colors.text,
    backgroundColor: colors.surface,
  },
  unit: {
    fontSize: 14,
    color: colors.textMuted,
  },
  detailRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  detailField: {
    flex: 1,
    gap: spacing.xs,
  },
  detailFieldSmall: {
    width: 100,
    gap: spacing.xs,
  },
  detailLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.textMuted,
  },
  tipText: {
    fontSize: 13,
    color: colors.textMuted,
    lineHeight: 18,
  },
  warrantyPhoto: {
    width: "100%",
    height: 120,
    borderRadius: radius.md,
    backgroundColor: colors.border,
  },
  warrantyPhotoPlaceholder: {
    width: "100%",
    height: 60,
    borderRadius: radius.md,
    backgroundColor: "#f5f5f4",
    alignItems: "center",
    justifyContent: "center",
  },
  warrantyPhotoBtn: {
    alignItems: "center",
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderStyle: "dashed",
  },
  warrantyPhotoBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.brand,
  },
  costDisplay: {
    gap: spacing.sm,
  },
  costAmount: {
    fontSize: 24,
    fontWeight: "800",
    color: colors.text,
  },
  costRationale: {
    fontSize: 12,
    color: colors.textMuted,
    lineHeight: 16,
  },
  costHint: {
    fontSize: 12,
    color: colors.textMuted,
    lineHeight: 16,
  },
  refreshCostBtn: {
    alignSelf: "flex-start",
    paddingVertical: spacing.xs,
  },
  refreshCostBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.brand,
  },
  registrationSection: {
    borderTopWidth: 1,
    borderColor: colors.border,
    paddingTop: spacing.sm,
    gap: spacing.sm,
  },
  registrationHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  registrationToggle: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
  },
  registrationToggleActive: {
    backgroundColor: "#d1fae5",
    borderColor: "#047857",
  },
  registrationToggleText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.textMuted,
  },
  registrationToggleTextActive: {
    color: "#047857",
  },
  registerActionBtn: {
    backgroundColor: colors.brandLighter,
    borderWidth: 1,
    borderColor: colors.brandLight,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.md,
    gap: 2,
  },
  registerActionBtnText: {
    fontSize: 13,
    fontWeight: "800",
    color: colors.brand,
  },
  registerActionBtnHint: {
    fontSize: 11,
    color: colors.textMuted,
    lineHeight: 15,
  },
  deleteBtn: {
    alignItems: "center",
    paddingVertical: spacing.md,
    marginTop: spacing.sm,
  },
  deleteBtnText: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.danger,
  },
});
