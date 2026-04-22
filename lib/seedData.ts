/**
 * Seeds the app with demo inventory items, reminders, and repairs so
 * every screen has content to display. Call once from Settings or on
 * first launch. Safe to call multiple times — it checks if data already exists.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { addHomeItem, loadInventory, saveInventory } from "./homeData";
import { storagePrefix } from "./homes";
import { createCustomReminder, loadReminders } from "./reminders";
import { generateId, loadIssues, saveIssues } from "./storage";
import type { HomeItem, Issue, PlanStep, Reminder } from "./types";
import type { RecallAlert } from "./recalls";

const now = Date.now();
const DAY = 24 * 60 * 60 * 1000;

// --------------------------------------------------------------------------
// Inventory items
// --------------------------------------------------------------------------

const SEED_ITEMS: Omit<HomeItem, "id" | "createdAt" | "updatedAt">[] = [
  {
    name: "Samsung French Door Refrigerator",
    category: "appliance",
    icon: "🧊",
    room: "Kitchen",
    make: "Samsung",
    model: "RF28R7351SR",
    serialNumber: "0AW84BBJ500123",
    yearInstalled: 2020,
    estimatedAgeYears: 4,
    typicalLifespanYears: 15,
    condition: "good",
    conditionNotes: "Running well, exterior has minor scuffs. Ice maker working properly.",
    maintenanceTips: [
      "Vacuum condenser coils every 6 months",
      "Replace water filter every 6 months",
      "Check door gaskets for tears annually",
    ],
    suggestedReminders: [
      {
        title: "Replace fridge water filter",
        description: "Replace the Samsung DA29-00020B water filter",
        frequencyDays: 180,
        icon: "💧",
      },
      {
        title: "Vacuum condenser coils",
        description: "Pull fridge out and vacuum the coils underneath",
        frequencyDays: 180,
        icon: "🧹",
      },
    ],
    purchaseDate: now - 4 * 365 * DAY,
    warrantyExpiration: now + 30 * DAY, // Expiring soon!
    warrantyProvider: "Samsung",
    warrantyCoverageNotes: "5-year limited warranty covers compressor and sealed refrigeration system",
    replacementCostUsd: 2499,
  },
  {
    name: "Carrier Central AC Unit",
    category: "hvac",
    icon: "❄️",
    room: "Garage",
    make: "Carrier",
    model: "24ACC636A003",
    serialNumber: "2119E04832",
    yearInstalled: 2017,
    estimatedAgeYears: 7,
    typicalLifespanYears: 15,
    condition: "fair",
    conditionNotes: "Running but noisier than last year. Probably needs refrigerant check.",
    maintenanceTips: [
      "Change air filter every 90 days",
      "Schedule annual professional tune-up",
      "Clear debris from outdoor unit monthly",
    ],
    suggestedReminders: [
      {
        title: "Change HVAC air filter",
        description: "Replace the 20x25x1 pleated filter",
        frequencyDays: 90,
        icon: "🌬",
      },
    ],
    purchaseDate: now - 7 * 365 * DAY,
    warrantyExpiration: now - 60 * DAY, // Expired
    warrantyProvider: "Carrier",
    warrantyCoverageNotes: "10-year parts warranty expired",
    replacementCostUsd: 5200,
  },
  {
    name: "Rheem Tankless Water Heater",
    category: "plumbing",
    icon: "🚿",
    room: "Utility Room",
    make: "Rheem",
    model: "RTEX-18",
    serialNumber: "RTX2205871",
    yearInstalled: 2022,
    estimatedAgeYears: 2,
    typicalLifespanYears: 20,
    condition: "good",
    conditionNotes: "Installed 2 years ago, no issues. Consistent water temperature.",
    maintenanceTips: [
      "Flush with vinegar annually to prevent scale buildup",
      "Check inlet water filter screen every 6 months",
    ],
    suggestedReminders: [
      {
        title: "Flush water heater",
        description: "Run vinegar solution through the unit to remove mineral scale",
        frequencyDays: 365,
        icon: "🔥",
      },
    ],
    purchaseDate: now - 2 * 365 * DAY,
    warrantyExpiration: now + 3 * 365 * DAY,
    warrantyProvider: "Rheem",
    warrantyCoverageNotes: "5-year parts and labor, 12-year heat exchanger",
    replacementCostUsd: 1150,
  },
  {
    name: "LG Front-Load Washer",
    category: "appliance",
    icon: "👕",
    room: "Laundry Room",
    make: "LG",
    model: "WM4000HWA",
    yearInstalled: 2021,
    estimatedAgeYears: 3,
    typicalLifespanYears: 12,
    condition: "good",
    conditionNotes: "Works great. Door gasket is clean, no mold.",
    maintenanceTips: [
      "Run a cleaning cycle monthly with washer cleaner",
      "Wipe door gasket after each load to prevent mold",
      "Check and clean drain pump filter every 3 months",
    ],
    purchaseDate: now - 3 * 365 * DAY,
    warrantyExpiration: now + 90 * DAY,
    warrantyProvider: "LG",
    warrantyCoverageNotes: "2-year parts and labor, 10-year motor warranty",
    replacementCostUsd: 1099,
  },
  {
    name: "GE Electric Range",
    category: "appliance",
    icon: "🍳",
    room: "Kitchen",
    make: "GE",
    model: "JB655SKSS",
    yearInstalled: 2016,
    estimatedAgeYears: 8,
    typicalLifespanYears: 15,
    condition: "fair",
    conditionNotes: "One burner runs hotter than the others. Oven temperature accurate.",
    maintenanceTips: [
      "Deep clean oven every 3 months",
      "Replace drip pans when corroded",
    ],
    replacementCostUsd: 799,
  },
  {
    name: "Smoke & CO Detector (Hallway)",
    category: "safety",
    icon: "🔔",
    room: "Hallway",
    make: "Kidde",
    model: "KN-COSM-IBA",
    yearInstalled: 2018,
    estimatedAgeYears: 6,
    typicalLifespanYears: 7,
    condition: "poor",
    conditionNotes: "Approaching end of life. NFPA recommends replacement every 7 years.",
    maintenanceTips: [
      "Test monthly by pressing the test button",
      "Replace batteries annually",
      "Replace entire unit every 7 years",
    ],
    replacementCostUsd: 45,
  },
  {
    name: "Garage Door Opener",
    category: "exterior",
    icon: "🚗",
    room: "Garage",
    make: "LiftMaster",
    model: "8500W",
    yearInstalled: 2019,
    estimatedAgeYears: 5,
    typicalLifespanYears: 15,
    condition: "good",
    conditionNotes: "Wall-mounted, quiet operation. Battery backup working.",
    maintenanceTips: [
      "Lubricate chain/belt and rollers every 6 months",
      "Test auto-reverse safety monthly",
    ],
    purchaseDate: now - 5 * 365 * DAY,
    warrantyExpiration: now + 2 * 365 * DAY,
    warrantyProvider: "LiftMaster",
    warrantyCoverageNotes: "Lifetime motor warranty, 5-year parts",
    replacementCostUsd: 450,
  },
];

// --------------------------------------------------------------------------
// Repairs
// --------------------------------------------------------------------------

function makeSteps(titles: string[]): PlanStep[] {
  return titles.map((title) => ({
    id: generateId(),
    title,
    detail: "",
    completed: true,
  }));
}

const SEED_ISSUES: Omit<Issue, "id">[] = [
  {
    title: "Leaking kitchen faucet",
    summary: "Single-handle Moen faucet dripping from the spout — replaced the cartridge to fix.",
    status: "verified",
    createdAt: now - 45 * DAY,
    updatedAt: now - 44 * DAY,
    plan: {
      difficulty: "Easy",
      estimatedMinutes: 30,
      estimatedSavingsUsd: 175,
      tools: [
        { id: generateId(), name: "Adjustable wrench", required: true, have: true },
        { id: generateId(), name: "Allen key set", required: true, have: true },
      ],
      materials: [
        { id: generateId(), name: "Moen 1225 cartridge", quantity: "1", have: true },
      ],
      steps: makeSteps([
        "Turn off water under the sink",
        "Remove the faucet handle",
        "Pull out the old cartridge",
        "Insert the new cartridge",
        "Reassemble and test",
      ]),
      safetyNotes: ["Turn off water supply before starting"],
    },
    messages: [],
  },
  {
    title: "Running toilet — flapper valve",
    summary: "Toilet running continuously, wasting water. Replaced the flapper and adjusted the fill valve.",
    status: "completed",
    createdAt: now - 20 * DAY,
    updatedAt: now - 19 * DAY,
    plan: {
      difficulty: "Easy",
      estimatedMinutes: 20,
      estimatedSavingsUsd: 150,
      tools: [],
      materials: [
        { id: generateId(), name: "Universal flapper", quantity: "1", have: true },
      ],
      steps: makeSteps([
        "Turn off water at the shut-off valve",
        "Flush to drain the tank",
        "Remove old flapper",
        "Install new flapper",
        "Adjust chain length and test",
      ]),
      safetyNotes: [],
    },
    messages: [],
  },
  {
    title: "Replace GFCI outlet in bathroom",
    summary: "GFCI outlet tripping repeatedly — replaced with a new 20A GFCI outlet.",
    status: "verified",
    createdAt: now - 10 * DAY,
    updatedAt: now - 9 * DAY,
    plan: {
      difficulty: "Medium",
      estimatedMinutes: 45,
      estimatedSavingsUsd: 225,
      tools: [
        { id: generateId(), name: "Voltage tester", required: true, have: true },
        { id: generateId(), name: "Screwdriver set", required: true, have: true },
      ],
      materials: [
        { id: generateId(), name: "20A GFCI outlet", quantity: "1", have: true },
      ],
      steps: makeSteps([
        "Turn off breaker at the panel",
        "Verify power is off with voltage tester",
        "Remove old outlet",
        "Connect wires to new GFCI",
        "Mount and test",
      ]),
      safetyNotes: ["Always verify power is off before touching any wires"],
      risk: {
        severity: "medium",
        category: "electrical",
        headline: "Live 120V wiring",
        rationale: "Working with household electrical. Breaker must be confirmed off before starting.",
        callAProRecommended: false,
      },
    },
    messages: [],
  },
];

// --------------------------------------------------------------------------
// Seed function
// --------------------------------------------------------------------------

export async function seedDemoData(): Promise<{
  itemsAdded: number;
  issuesAdded: number;
  remindersAdded: number;
}> {
  let itemsAdded = 0;
  let issuesAdded = 0;
  let remindersAdded = 0;

  // Seed inventory
  const existingItems = await loadInventory();
  if (existingItems.length === 0) {
    for (const item of SEED_ITEMS) {
      await addHomeItem({
        ...item,
        id: generateId(),
        createdAt: now,
        updatedAt: now,
      });
      itemsAdded++;
    }
  }

  // Seed issues
  const existingIssues = await loadIssues();
  if (existingIssues.length === 0) {
    const newIssues: Issue[] = SEED_ISSUES.map((i) => ({
      ...i,
      id: generateId(),
    }));
    await saveIssues(newIssues);
    issuesAdded = newIssues.length;
  }

  // Seed reminders
  const existingReminders = await loadReminders();
  if (existingReminders.length === 0) {
    const seedReminders = [
      {
        title: "Change HVAC air filter",
        description: "Replace the 20x25x1 pleated filter in the Carrier unit",
        icon: "🌬",
        category: "hvac" as const,
        frequencyDays: 90,
        startDate: new Date(now + 15 * DAY),
      },
      {
        title: "Replace fridge water filter",
        description: "Replace the Samsung DA29-00020B water filter",
        icon: "💧",
        category: "appliance" as const,
        frequencyDays: 180,
        startDate: new Date(now + 45 * DAY),
      },
      {
        title: "Test smoke detectors",
        description: "Press test button on all smoke and CO detectors",
        icon: "🔔",
        category: "safety" as const,
        frequencyDays: 30,
        startDate: new Date(now - 5 * DAY), // Overdue!
      },
      {
        title: "Flush water heater",
        description: "Run vinegar solution through the Rheem tankless unit",
        icon: "🔥",
        category: "plumbing" as const,
        frequencyDays: 365,
        startDate: new Date(now + 120 * DAY),
      },
      {
        title: "Lubricate garage door",
        description: "Apply silicone lubricant to rollers, hinges, and springs",
        icon: "🚗",
        category: "exterior" as const,
        frequencyDays: 180,
        startDate: new Date(now + 60 * DAY),
      },
    ];
    for (const r of seedReminders) {
      await createCustomReminder(r);
      remindersAdded++;
    }
  }

  // Seed recall alerts into the local cache so the Recalls tab has content.
  // We need to read back the seeded inventory to get the generated IDs.
  const recallCacheKey = storagePrefix() + "recall_alerts";
  // Always re-seed recalls if the cache is empty, stale, or has zero alerts.
  let hasRecalls = false;
  try {
    const raw = await AsyncStorage.getItem(recallCacheKey);
    if (raw) {
      const parsed = JSON.parse(raw) as { alerts?: unknown[]; fetchedAt?: number };
      hasRecalls = Array.isArray(parsed.alerts) && parsed.alerts.length > 0;
    }
  } catch { /* ignore */ }
  if (!hasRecalls) {
    const seededItems = await loadInventory();
    const samsung = seededItems.find((i) => i.make === "Samsung");
    const kidde = seededItems.find((i) => i.make === "Kidde");
    const lg = seededItems.find((i) => i.make === "LG");

    const fakeRecalls: RecallAlert[] = [];

    if (samsung) {
      // Confirmed recall — model number RF28R7351SR appears in the description
      fakeRecalls.push({
        recallId: 10201,
        recallNumber: "24-112",
        recallDate: "2024-03-14",
        title: "Samsung Recalls French Door Refrigerators Due to Ice Maker Defect; Risk of Injury",
        description:
          "The ice maker in certain Samsung French Door refrigerators can produce ice shards or oversized ice chunks that can damage the dispenser mechanism. Affected models include RF28R7351SR, RF28R7551SR, RF23M8070SR, and RF28T5001SR.",
        hazard: "Ice maker can produce sharp ice fragments that may cause lacerations when dispensed",
        remedy:
          "Contact Samsung for a free in-home repair. Technicians will replace the ice maker assembly at no charge. Call 1-800-726-7864 or visit samsung.com/us/support.",
        url: "https://www.cpsc.gov/Recalls/2024/Samsung-Recalls-French-Door-Refrigerators",
        itemId: samsung.id,
        matchReason: 'Model "RF28R7351SR" found in recall description',
        isExactMatch: true,
      });

      // Possible recall — same manufacturer, different product
      fakeRecalls.push({
        recallId: 9486,
        recallNumber: "23-080",
        recallDate: "2022-12-22",
        title: "Samsung Recalls Top-Load Washing Machines Due to Fire Hazard; Software Repair Available",
        description:
          "The washing machines can short-circuit and overheat, posing a fire hazard.",
        hazard: "The washing machines can short-circuit and overheat, posing a fire hazard",
        remedy:
          "A free software update resolves the issue. Wi-Fi-equipped units download automatically. Non-Wi-Fi models can contact Samsung for a free dongle to install the update.",
        url: "https://www.cpsc.gov/Recalls/2023/Samsung-Recalls-Top-Load-Washing-Machines-Due-to-Fire-Hazard-Software-Repair-Available",
        itemId: samsung.id,
        matchReason: 'Manufacturer "Samsung" + product type "appliance" match — verify this applies to your specific model',
        isExactMatch: false,
      });
    }

    if (kidde) {
      fakeRecalls.push({
        recallId: 5356,
        recallNumber: "09-266",
        recallDate: "2009-07-09",
        title:
          "Kidde Recalls Dual Sensor Smoke Alarms; Can Fail to Warn of a Fire",
        description:
          "An electrostatic discharge can damage the Kidde Model PI2000 Dual Sensor Smoke Alarm, causing it not to warn consumers of a fire.",
        hazard: "Electrostatic discharge can damage the unit, causing it not to warn consumers of a fire",
        remedy:
          "Contact Kidde at (877) 524-2086 to receive a free replacement smoke alarm.",
        url: "https://www.cpsc.gov/Recalls/2009/Kidde-Recalls-Dual-Sensor-Smoke-Alarms-Can-Fail-to-Warn-of-a-Fire",
        itemId: kidde.id,
        matchReason:
          'Manufacturer "Kidde" + product type "smoke detector" match — verify this applies to your specific model',
        isExactMatch: false,
      });
    }

    if (lg) {
      fakeRecalls.push({
        recallId: 1272,
        recallNumber: "13-073",
        recallDate: "2012-12-18",
        title:
          "LG Recalls Top-Loading Washing Machines Due to Risk of Injury",
        description:
          "An unbalanced load can cause the washing machine to shake excessively and the drum to come loose during use, posing a risk of injury to consumers and property damage.",
        hazard: "Drum can come loose during use, posing a risk of injury and property damage",
        remedy:
          "Contact LG for a free in-home repair of the machine.",
        url: "https://www.cpsc.gov/Recalls/2012/lg-recalls-top-loading-washing-machines-due-to-risk-of-injury",
        itemId: lg.id,
        matchReason: 'Manufacturer "LG" + product type "washer" match — verify this applies to your specific model',
        isExactMatch: false,
      });
    }

    if (fakeRecalls.length > 0) {
      const cache = { alerts: fakeRecalls, fetchedAt: Date.now() };
      await AsyncStorage.setItem(recallCacheKey, JSON.stringify(cache));
    }
  }

  return { itemsAdded, issuesAdded, remindersAdded };
}

/**
 * Force-clears existing data and re-seeds everything from scratch.
 * Intended for the "Load demo data" button in Settings.
 */
export async function forceSeedDemoData(): Promise<{
  itemsAdded: number;
  issuesAdded: number;
  remindersAdded: number;
}> {
  const prefix = storagePrefix();

  // Clear inventory, issues, reminders, and recall cache
  await AsyncStorage.multiRemove([
    prefix + "inventory",
    prefix + "issues",
    prefix + "reminders",
    prefix + "recall_alerts",
    prefix + "recall_notified_ids",
  ]);

  // Clear in-memory inventory so addHomeItem starts fresh
  await saveInventory([]);

  return seedDemoData();
}
