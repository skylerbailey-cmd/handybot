import { Alert } from "react-native";
import { router } from "expo-router";

/**
 * Show an alert explaining a tier limit, with a button to open the paywall.
 * Returns false so callers can do `if (!checkSomething()) return;` patterns.
 */
export function showPaywallAlert(message: string): false {
  Alert.alert("Upgrade your plan", message, [
    { text: "Not now", style: "cancel" },
    {
      text: "See plans",
      onPress: () => {
        try {
          router.push({
            pathname: "/paywall",
            params: { context: message },
          });
        } catch {
          /* ignore */
        }
      },
    },
  ]);
  return false;
}
