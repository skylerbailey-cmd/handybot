import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
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
import {
  analyzeHomeItem,
  analyzeWarrantyDocument,
} from "@/lib/claude";
import {
  addHomeItem,
  loadInventory,
  removeHomeItem,
  updateHomeItem,
} from "@/lib/homeData";
import { promptAndPickImage, readImageAsBase64 } from "@/lib/image";
import { addCustomRoom, loadRoomLabels } from "@/lib/rooms";
import { generateId } from "@/lib/storage";
import { colors, radius, spacing } from "@/lib/theme";
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
  const [analyzingWarranty, setAnalyzingWarranty] = useState(false);
  const [warrantyRegistered, setWarrantyRegistered] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);

  // Animated analyzing messages
  const ANALYZING_MESSAGES = [
    "Analyzing your photo...",
    "Identifying the item...",
    "Estimating age and condition...",
    "Checking for wear and damage...",
    "Building maintenance tips...",
    "Almost done...",
  ];
  const [msgIndex, setMsgIndex] = useState(0);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!analyzing) {
      setMsgIndex(0);
      return;
    }
    const interval = setInterval(() => {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start(() => {
        setMsgIndex((prev) => (prev + 1) % ANALYZING_MESSAGES.length);
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }).start();
      });
    }, 3000);
    return () => clearInterval(interval);
  }, [analyzing, fadeAnim]);

  const [room, setRoom] = useState("");
  const [roomOptions, setRoomOptions] = useState<string[]>([]);
  const [showCustomRoom, setShowCustomRoom] = useState(false);
  const [customRoomDraft, setCustomRoomDraft] = useState("");

  // Fields we keep from analysis but don't expose for editing
  const [category, setCategory] = useState("other");
  const [icon, setIcon] = useState("🏠");
  const [maintenanceTips, setMaintenanceTips] = useState<string[]>([]);
  const [suggestedReminders, setSuggestedReminders] = useState<
    HomeItem["suggestedReminders"]
  >(undefined);
  const [existingItem, setExistingItem] = useState<HomeItem | null>(null);

  // Load room labels
  useEffect(() => {
    loadRoomLabels().then(setRoomOptions);
  }, []);

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
        if (data.suggestedRoom) setRoom(data.suggestedRoom);
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

  async function handleTakePhoto() {
    if (analyzing) return;
    try {
      const picked = await promptAndPickImage("Photograph a home item");
      if (!picked) return;
      setPhotoUri(picked.uri);
      setPhotoFailed(false);
      setAnalyzing(true);

      const base64 = await readImageAsBase64(picked.uri);
      const data = await analyzeHomeItem({
        imageBase64: base64,
        imageMediaType: "image/jpeg",
      });

      // Fill in all the fields from the analysis
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
      if (data.suggestedRoom && !room) setRoom(data.suggestedRoom);
      if (data.purchaseDateHint) setPurchaseDate(data.purchaseDateHint);
      if (data.warrantyYearsHint && data.purchaseDateHint) {
        const pd = new Date(data.purchaseDateHint);
        pd.setFullYear(pd.getFullYear() + data.warrantyYearsHint);
        setWarrantyExpiration(pd.toISOString().split("T")[0]);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not analyze item";
      Alert.alert("Something went wrong", msg);
    } finally {
      setAnalyzing(false);
    }
  }

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
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        await addHomeItem(item);
      } else if (params.itemId) {
        await updateHomeItem(params.itemId, {
          name: name.trim(),
          category,
          icon,
          room,
          photoUri,
          make: make.trim() || undefined,
          model: model.trim() || undefined,
          serialNumber: serialNumber.trim() || undefined,
          yearInstalled: yearNum || undefined,
          conditionNotes: conditionNotes.trim(),
          estimatedAgeYears: ageNum,
          typicalLifespanYears: lifespanNum,
          condition,
          maintenanceTips,
          suggestedReminders,
          purchaseDate: purchaseDateMs || undefined,
          warrantyExpiration: warrantyExpirationMs || undefined,
          warrantyProvider: warrantyProvider.trim() || undefined,
          warrantyCoverageNotes: warrantyCoverageNotes.trim() || undefined,
          warrantyPhotoUri,
          receiptPhotoUri,
          warrantyRegistered,
        });
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
            <Pressable onPress={handleTakePhoto} disabled={analyzing}>
              <Image
                source={{ uri: photoUri }}
                style={styles.photo}
                onError={() => setPhotoFailed(true)}
              />
              {analyzing && (
                <View style={styles.analyzingOverlay}>
                  <ActivityIndicator color="#fff" size="large" />
                  <Animated.Text
                    style={[styles.analyzingOverlayText, { opacity: fadeAnim }]}
                  >
                    {ANALYZING_MESSAGES[msgIndex]}
                  </Animated.Text>
                  <View style={styles.analyzingDots}>
                    {ANALYZING_MESSAGES.map((_, i) => (
                      <View
                        key={i}
                        style={[
                          styles.analyzingDot,
                          i === msgIndex && styles.analyzingDotActive,
                          i < msgIndex && styles.analyzingDotPast,
                        ]}
                      />
                    ))}
                  </View>
                </View>
              )}
            </Pressable>
          ) : (
            <Pressable
              onPress={handleTakePhoto}
              disabled={analyzing}
              style={styles.cameraPlaceholder}
            >
              <Text style={styles.cameraIcon}>📷</Text>
              <Text style={styles.cameraTitle}>Take a photo</Text>
              <Text style={styles.cameraHint}>
                AI will identify the item and fill in the details
              </Text>
            </Pressable>
          )}

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

          {/* Room */}
          <View style={styles.card}>
            <Text style={styles.label}>Room</Text>
            <View style={styles.roomChips}>
              {roomOptions.map((r) => {
                const active = room === r;
                return (
                  <Pressable
                    key={r}
                    onPress={() => setRoom(active ? "" : r)}
                    style={[
                      styles.roomChip,
                      active && styles.roomChipActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.roomChipText,
                        active && styles.roomChipTextActive,
                      ]}
                    >
                      {r}
                    </Text>
                  </Pressable>
                );
              })}
              <Pressable
                onPress={() => setShowCustomRoom(!showCustomRoom)}
                style={[
                  styles.roomChip,
                  styles.roomChipAdd,
                ]}
              >
                <Text style={styles.roomChipAddText}>+ Custom</Text>
              </Pressable>
            </View>
            {showCustomRoom && (
              <View style={styles.customRoomRow}>
                <TextInput
                  value={customRoomDraft}
                  onChangeText={setCustomRoomDraft}
                  placeholder="e.g. Sun Room, Workshop"
                  placeholderTextColor={colors.textSubtle}
                  style={[styles.input, { flex: 1 }]}
                  autoFocus
                />
                <Pressable
                  onPress={async () => {
                    const label = customRoomDraft.trim();
                    if (!label) return;
                    await addCustomRoom(label);
                    setRoom(label);
                    setCustomRoomDraft("");
                    setShowCustomRoom(false);
                    setRoomOptions(await loadRoomLabels());
                  }}
                  style={styles.customRoomAddBtn}
                >
                  <Text style={styles.customRoomAddBtnText}>Add</Text>
                </Pressable>
              </View>
            )}
            {room ? (
              <Text style={styles.roomSelected}>Selected: {room}</Text>
            ) : null}
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
                  "Warranty card or certificate",
                  { includeFiles: true }
                );
                if (!result) return;
                setWarrantyPhotoUri(result.uri);
                setAnalyzingWarranty(true);
                try {
                  const base64 = await readImageAsBase64(result.uri);
                  const analysis = await analyzeWarrantyDocument({
                    imageBase64: base64,
                    imageMediaType: "image/jpeg",
                    itemName: name.trim() || undefined,
                  });
                  if (analysis.purchaseDate && !purchaseDate)
                    setPurchaseDate(analysis.purchaseDate);
                  if (analysis.warrantyExpiration && !warrantyExpiration)
                    setWarrantyExpiration(analysis.warrantyExpiration);
                  if (analysis.warrantyProvider && !warrantyProvider)
                    setWarrantyProvider(analysis.warrantyProvider);
                  if (analysis.coverageNotes && !warrantyCoverageNotes)
                    setWarrantyCoverageNotes(analysis.coverageNotes);
                } catch {
                  /* analysis is best-effort — photo is still saved */
                } finally {
                  setAnalyzingWarranty(false);
                }
              }}
              disabled={analyzingWarranty}
              style={styles.warrantyPhotoBtn}
            >
              <Text style={styles.warrantyPhotoBtnText}>
                {analyzingWarranty
                  ? "Analyzing warranty..."
                  : warrantyPhotoUri
                    ? "Change Warranty Photo"
                    : "+ Add Warranty Photo"}
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
                  "Purchase receipt",
                  { includeFiles: true }
                );
                if (!result) return;
                setReceiptPhotoUri(result.uri);
                setAnalyzingWarranty(true);
                try {
                  const base64 = await readImageAsBase64(result.uri);
                  const analysis = await analyzeWarrantyDocument({
                    imageBase64: base64,
                    imageMediaType: "image/jpeg",
                    itemName: name.trim() || undefined,
                  });
                  if (analysis.purchaseDate && !purchaseDate)
                    setPurchaseDate(analysis.purchaseDate);
                  if (analysis.warrantyExpiration && !warrantyExpiration)
                    setWarrantyExpiration(analysis.warrantyExpiration);
                  if (analysis.warrantyProvider && !warrantyProvider)
                    setWarrantyProvider(analysis.warrantyProvider);
                  if (analysis.coverageNotes && !warrantyCoverageNotes)
                    setWarrantyCoverageNotes(analysis.coverageNotes);
                } catch {
                  /* analysis is best-effort — photo is still saved */
                } finally {
                  setAnalyzingWarranty(false);
                }
              }}
              disabled={analyzingWarranty}
              style={styles.warrantyPhotoBtn}
            >
              <Text style={styles.warrantyPhotoBtnText}>
                {analyzingWarranty
                  ? "Analyzing receipt..."
                  : receiptPhotoUri
                    ? "Change Receipt Photo"
                    : "+ Add Receipt Photo"}
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
  cameraPlaceholder: {
    width: "100%",
    height: 180,
    borderRadius: radius.lg,
    backgroundColor: colors.brandLighter,
    borderWidth: 2,
    borderColor: colors.brandLight,
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
  },
  cameraIcon: {
    fontSize: 36,
  },
  cameraTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: colors.brand,
  },
  cameraHint: {
    fontSize: 12,
    color: colors.textMuted,
    textAlign: "center",
    maxWidth: 220,
  },
  analyzingOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: radius.lg,
    backgroundColor: "rgba(28,25,23,0.6)",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
  },
  analyzingOverlayText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#fff",
    textAlign: "center",
    minHeight: 20,
  },
  analyzingDots: {
    flexDirection: "row",
    gap: 6,
    marginTop: spacing.xs,
  },
  analyzingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#e7e5e4",
  },
  analyzingDotActive: {
    backgroundColor: colors.brand,
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  analyzingDotPast: {
    backgroundColor: colors.brandLight,
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
  roomChips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs + 2,
  },
  roomChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
  },
  roomChipActive: {
    backgroundColor: colors.brandLight,
    borderColor: colors.brand,
  },
  roomChipText: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.textMuted,
  },
  roomChipTextActive: {
    color: colors.brandDark,
    fontWeight: "800",
  },
  roomChipAdd: {
    borderStyle: "dashed",
  },
  roomChipAddText: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.brand,
  },
  customRoomRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  customRoomAddBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.brand,
  },
  customRoomAddBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#ffffff",
  },
  roomSelected: {
    fontSize: 12,
    color: colors.textSubtle,
    marginTop: spacing.xs,
  },
});
