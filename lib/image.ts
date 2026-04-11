import * as FileSystem from "expo-file-system";
import * as ImageManipulator from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import { ActionSheetIOS, Alert, Platform } from "react-native";

const IMAGES_DIR = `${FileSystem.documentDirectory}handybot/`;

async function ensureImagesDir() {
  const info = await FileSystem.getInfoAsync(IMAGES_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(IMAGES_DIR, { intermediates: true });
  }
}

export type ImageSource = "camera" | "library";

export interface ProcessedImage {
  /** file:// URI of the persisted, resized JPEG on disk. */
  uri: string;
}

/**
 * Launches the camera or photo library, lets the user pick an image, resizes
 * it, and copies it into the app's documents directory so it survives
 * process restarts. Returns null if the user canceled.
 */
export async function pickAndProcessImage(
  source: ImageSource
): Promise<ProcessedImage | null> {
  if (source === "camera") {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      throw new Error("Camera permission is required to take a photo.");
    }
  } else {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      throw new Error("Photo library permission is required.");
    }
  }

  const result =
    source === "camera"
      ? await ImagePicker.launchCameraAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          quality: 1,
          allowsEditing: false,
        })
      : await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          quality: 1,
          allowsEditing: false,
        });

  if (result.canceled || !result.assets || result.assets.length === 0) {
    return null;
  }

  const asset = result.assets[0];

  const manipulated = await ImageManipulator.manipulateAsync(
    asset.uri,
    [{ resize: { width: 1280 } }],
    { compress: 0.82, format: ImageManipulator.SaveFormat.JPEG }
  );

  await ensureImagesDir();
  const persistentUri = `${IMAGES_DIR}${Date.now()}_${Math.random()
    .toString(36)
    .slice(2, 8)}.jpg`;
  await FileSystem.copyAsync({ from: manipulated.uri, to: persistentUri });

  return { uri: persistentUri };
}

/**
 * Reads a persisted image file and returns its base64-encoded body, for
 * sending to the Claude vision API.
 */
export async function readImageAsBase64(uri: string): Promise<string> {
  return await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
}

/**
 * Prompts the user to choose between the camera and the photo library and
 * resolves with their choice (or null if they cancel). Uses a native iOS
 * ActionSheet and an Android-friendly Alert so every caller — new repair,
 * chat composer, verification flow — gets the same picker.
 */
export function promptForImageSource(
  title: string = "Add a photo"
): Promise<ImageSource | null> {
  return new Promise((resolve) => {
    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          title,
          options: ["Cancel", "Take Photo", "Choose from Library"],
          cancelButtonIndex: 0,
        },
        (idx) => {
          if (idx === 1) resolve("camera");
          else if (idx === 2) resolve("library");
          else resolve(null);
        }
      );
    } else {
      Alert.alert(title, undefined, [
        {
          text: "Cancel",
          style: "cancel",
          onPress: () => resolve(null),
        },
        { text: "Take Photo", onPress: () => resolve("camera") },
        { text: "Choose from Library", onPress: () => resolve("library") },
      ]);
    }
  });
}

/**
 * Convenience: prompt for a source and then run the picker. Resolves to
 * null if the user cancels at either stage.
 */
export async function promptAndPickImage(
  title?: string
): Promise<ProcessedImage | null> {
  const source = await promptForImageSource(title);
  if (!source) return null;
  return pickAndProcessImage(source);
}
