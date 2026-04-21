import * as Clipboard from "expo-clipboard";
import { Alert, Linking } from "react-native";
import type { HomeItem } from "./types";

// ---------------------------------------------------------------------------
// Manufacturer → product registration URL lookup
// ---------------------------------------------------------------------------

/**
 * Maps normalized manufacturer names to their product registration URLs.
 * Keys are lowercase, trimmed brand names. Values are the best publicly
 * available registration page URL for that manufacturer.
 */
const REGISTRY: Record<string, string> = {
  // Major appliance brands
  ge: "https://www.geappliances.com/register",
  "ge profile": "https://www.geappliances.com/register",
  "ge cafe": "https://www.geappliances.com/register",
  "ge monogram": "https://www.geappliances.com/register",
  samsung: "https://www.samsung.com/us/support/product-registration/",
  lg: "https://www.lg.com/us/support/product-registration",
  whirlpool: "https://www.whirlpool.com/register.html",
  maytag: "https://www.maytag.com/register.html",
  kitchenaid: "https://www.kitchenaid.com/register.html",
  frigidaire: "https://www.frigidaire.com/register-your-product/",
  electrolux: "https://www.electrolux.com/support/product-registration/",
  bosch: "https://www.bosch-home.com/us/register-product",
  "bosch home": "https://www.bosch-home.com/us/register-product",
  thermador: "https://www.thermador.com/us/register-product",
  miele: "https://www.mieleusa.com/domestic/register-product-3498.htm",
  "fisher & paykel": "https://www.fisherpaykel.com/us/register-my-product.html",
  "fisher paykel": "https://www.fisherpaykel.com/us/register-my-product.html",

  // HVAC
  carrier: "https://www.carrier.com/residential/en/us/product-registration/",
  trane: "https://www.trane.com/residential/en/for-owners/product-registration/",
  lennox: "https://www.lennox.com/owners/product-registration",
  rheem: "https://www.rheem.com/product-registration/",
  goodman: "https://www.goodmanmfg.com/product-registration",
  daikin: "https://www.daikincomfort.com/product-registration",
  "american standard": "https://www.americanstandardair.com/for-owners/product-registration/",
  york: "https://www.yorkhvac.com/residential/product-registration",
  bryant: "https://www.bryant.com/en/us/for-owners/product-registration/",
  amana: "https://www.amana-hac.com/product-registration",

  // Water heaters
  "a.o. smith": "https://www.hotwater.com/support/product-registration/",
  "ao smith": "https://www.hotwater.com/support/product-registration/",
  bradford: "https://www.bradfordwhite.com/product-registration",
  "bradford white": "https://www.bradfordwhite.com/product-registration",
  rinnai: "https://www.rinnai.us/product-registration",
  navien: "https://www.navieninc.com/warranty/registration",
  ecosmart: "https://www.ecosmartus.com/product-registration",

  // Power tools / outdoor
  dewalt: "https://www.dewalt.com/product-registration",
  milwaukee: "https://www.milwaukeetool.com/Register-Product",
  makita: "https://www.makitatools.com/support/product-registration",
  ryobi: "https://www.ryobitools.com/register-product",
  husqvarna: "https://www.husqvarna.com/us/register/",
  stihl: "https://www.stihlusa.com/product-registration/",
  "john deere": "https://www.deere.com/en/parts-services/warranty/",
  honda: "https://powerequipment.honda.com/support/warranty-registration",
  toro: "https://www.toro.com/en/product-registration",
  ego: "https://egopowerplus.com/product-registration/",

  // Plumbing fixtures
  kohler: "https://www.kohler.com/en/register-product",
  moen: "https://www.moen.com/warranty-registration",
  delta: "https://www.deltafaucet.com/service-parts/register-your-product",

  // Smart home / safety
  ring: "https://ring.com/account/devices",
  nest: "https://store.google.com/category/nest",
  ecobee: "https://www.ecobee.com/en-us/warranty-registration/",
  honeywell: "https://www.honeywell.com/us/en/product-registration",

  // Garage / doors
  liftmaster: "https://www.liftmaster.com/product-registration",
  chamberlain: "https://www.chamberlain.com/product-registration",
  "genie garage": "https://www.geniecompany.com/warranty-registration",
};

/**
 * Normalize a brand string for lookup: lowercase, trim, strip "inc" / "corp"
 * suffixes, and collapse whitespace.
 */
function normalizeBrand(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/\b(inc\.?|corp\.?|co\.?|llc|ltd)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Look up the product registration URL for a given manufacturer.
 * Returns `undefined` if not found in the registry.
 */
export function getRegistrationUrl(make: string | undefined): string | undefined {
  if (!make) return undefined;
  const key = normalizeBrand(make);
  // Direct match
  if (REGISTRY[key]) return REGISTRY[key];
  // Partial match: try to find a registry key that starts with or is contained in the brand
  for (const [regKey, url] of Object.entries(REGISTRY)) {
    if (key.includes(regKey) || regKey.includes(key)) return url;
  }
  return undefined;
}

/**
 * Build a text block with the item's details the user can paste into
 * a manufacturer registration form.
 */
function buildClipboardText(item: HomeItem): string {
  const lines: string[] = [];
  if (item.make) lines.push(`Brand: ${item.make}`);
  if (item.model) lines.push(`Model: ${item.model}`);
  if (item.serialNumber) lines.push(`Serial Number: ${item.serialNumber}`);
  if (item.yearInstalled) lines.push(`Year: ${item.yearInstalled}`);
  if (item.purchaseDate) {
    lines.push(`Purchase Date: ${new Date(item.purchaseDate).toLocaleDateString()}`);
  }
  return lines.join("\n");
}

/**
 * Opens the manufacturer's registration page in the system browser and
 * copies the item's details to the clipboard for easy pasting.
 *
 * If no URL is found in the registry, falls back to a Google search for
 * "<brand> product warranty registration".
 */
export async function openRegistrationPage(item: HomeItem): Promise<void> {
  const clipText = buildClipboardText(item);
  if (clipText) {
    await Clipboard.setStringAsync(clipText);
  }

  const knownUrl = getRegistrationUrl(item.make);
  const url =
    knownUrl ??
    `https://www.google.com/search?q=${encodeURIComponent(
      `${item.make ?? item.name} product warranty registration`
    )}`;

  const supported = await Linking.canOpenURL(url);
  if (supported) {
    await Linking.openURL(url);
  }

  // Show a toast-style alert so the user knows data was copied
  if (clipText) {
    Alert.alert(
      "Details copied",
      "Your product details have been copied to the clipboard. Paste them into the registration form.",
      [{ text: "OK" }]
    );
  }
}
