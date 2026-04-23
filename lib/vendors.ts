import AsyncStorage from "@react-native-async-storage/async-storage";
import { getActiveHomeId, storagePrefix } from "./homes";
import { generateId } from "./storage";
import type { Vendor, VendorSpecialty } from "./types";

function vendorsKey(homeId?: string): string {
  if (homeId) return `handybot:${homeId}:vendors`;
  return storagePrefix() + "vendors";
}

export async function loadVendors(homeId?: string): Promise<Vendor[]> {
  try {
    const raw = await AsyncStorage.getItem(vendorsKey(homeId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Vendor[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function saveVendors(
  vendors: Vendor[],
  homeId?: string
): Promise<void> {
  await AsyncStorage.setItem(vendorsKey(homeId), JSON.stringify(vendors));
}

export async function saveVendor(vendor: Vendor): Promise<void> {
  const all = await loadVendors(vendor.homeId);
  const idx = all.findIndex((v) => v.id === vendor.id);
  if (idx >= 0) {
    all[idx] = vendor;
  } else {
    all.unshift(vendor);
  }
  await saveVendors(all, vendor.homeId);
}

export async function deleteVendor(id: string, homeId?: string): Promise<void> {
  const hid = homeId ?? getActiveHomeId();
  const all = await loadVendors(hid);
  await saveVendors(
    all.filter((v) => v.id !== id),
    hid
  );
}

export async function getVendorsBySpecialty(
  homeId: string,
  specialty: VendorSpecialty
): Promise<Vendor[]> {
  const all = await loadVendors(homeId);
  return all.filter((v) => v.specialty === specialty);
}

export function createBlankVendor(
  homeId: string,
  specialty?: VendorSpecialty
): Vendor {
  return {
    id: generateId(),
    homeId,
    name: "",
    specialty: specialty ?? "handyman",
    createdAt: Date.now(),
  };
}
