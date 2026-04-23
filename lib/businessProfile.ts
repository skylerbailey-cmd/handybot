import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "handybot:businessProfile";

export interface BusinessProfile {
  businessName: string;
  ownerName: string;
  address: string;
  phone: string;
  email: string;
  hourlyRateUsd: number;
  taxRatePercent: number;
}

const EMPTY: BusinessProfile = {
  businessName: "",
  ownerName: "",
  address: "",
  phone: "",
  email: "",
  hourlyRateUsd: 0,
  taxRatePercent: 0,
};

export async function loadBusinessProfile(): Promise<BusinessProfile> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return { ...EMPTY };
    return { ...EMPTY, ...JSON.parse(raw) };
  } catch {
    return { ...EMPTY };
  }
}

export async function saveBusinessProfile(
  profile: BusinessProfile
): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(profile));
}

export function isProfileComplete(profile: BusinessProfile): boolean {
  return profile.businessName.trim().length > 0;
}
