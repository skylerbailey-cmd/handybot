import type { MaintenanceTemplate } from "./types";

/**
 * A curated list of common home-maintenance tasks every homeowner should
 * keep up with. Intervals follow widely-cited guidance from HVAC / plumbing
 * / fire-safety organizations (USFA, Consumer Reports, This Old House, the
 * NFPA, and appliance manufacturer manuals). Users can enable any of
 * these and pick a start date.
 */
export const MAINTENANCE_TEMPLATES: readonly MaintenanceTemplate[] = [
  // --- HVAC ---------------------------------------------------------------
  {
    id: "hvac_filter",
    title: "Change HVAC air filter",
    description:
      "Replace the disposable air filter in your furnace / air handler. Most 1-inch pleated filters are rated for 1–3 months; check sooner if you have pets or allergies.",
    category: "hvac",
    icon: "🌬",
    frequencyDays: 90,
  },
  {
    id: "hvac_tuneup",
    title: "Schedule HVAC tune-up",
    description:
      "Have a pro inspect and service your heating and cooling system. Annual service catches small issues before they become expensive failures.",
    category: "hvac",
    icon: "🛠",
    frequencyDays: 365,
  },
  {
    id: "dryer_vent",
    title: "Clean dryer vent duct",
    description:
      "Lint buildup in the dryer exhaust line is a leading cause of house fires. Clean the full duct run at least once a year.",
    category: "safety",
    icon: "🔥",
    frequencyDays: 365,
  },
  // --- Plumbing -----------------------------------------------------------
  {
    id: "water_heater_flush",
    title: "Flush water heater",
    description:
      "Drain a few gallons to clear sediment from the bottom of the tank. Annual flushing extends the life of a gas or electric tank heater.",
    category: "plumbing",
    icon: "🚿",
    frequencyDays: 365,
  },
  {
    id: "sump_pump_test",
    title: "Test sump pump",
    description:
      "Pour a bucket of water into the sump pit and confirm the pump kicks on and clears it. Test every few months, especially before spring rains.",
    category: "plumbing",
    icon: "💧",
    frequencyDays: 90,
  },
  {
    id: "leaks_under_sinks",
    title: "Check under sinks for leaks",
    description:
      "Open the cabinet doors under every sink and look for water stains, drips, or wet supply lines. Catching a slow leak early prevents mold and rot.",
    category: "plumbing",
    icon: "🚰",
    frequencyDays: 90,
  },
  {
    id: "toilet_flapper",
    title: "Inspect toilet flappers",
    description:
      "Listen for a running toilet and check the flapper for mineral buildup or warping. A worn flapper wastes thousands of gallons a year.",
    category: "plumbing",
    icon: "🚽",
    frequencyDays: 365,
  },
  // --- Exterior -----------------------------------------------------------
  {
    id: "gutters_clean",
    title: "Clean gutters",
    description:
      "Clear leaves, sticks, and shingle grit from gutters and downspouts. Do it twice a year — once after spring growth and once after fall leaf drop.",
    category: "exterior",
    icon: "🍂",
    frequencyDays: 180,
  },
  {
    id: "roof_inspect",
    title: "Inspect roof",
    description:
      "Walk the perimeter and look for missing or curling shingles, damaged flashing, and debris around penetrations. Binoculars are safer than a ladder.",
    category: "exterior",
    icon: "🏠",
    frequencyDays: 365,
  },
  {
    id: "caulk_exterior",
    title: "Inspect exterior caulking",
    description:
      "Check caulking around windows, doors, and trim for cracks or gaps. Re-caulk any failing joints to keep water and air out.",
    category: "exterior",
    icon: "🪟",
    frequencyDays: 365,
  },
  // --- Safety -------------------------------------------------------------
  {
    id: "smoke_test",
    title: "Test smoke & CO alarms",
    description:
      "Press the test button on every smoke and carbon-monoxide detector. The NFPA recommends testing monthly and replacing the whole unit every 10 years.",
    category: "safety",
    icon: "🚨",
    frequencyDays: 30,
  },
  {
    id: "smoke_batteries",
    title: "Replace smoke alarm batteries",
    description:
      "Swap in fresh batteries in every smoke and CO alarm (unless yours are 10-year sealed units). A common reminder: do it when the clocks change.",
    category: "safety",
    icon: "🔋",
    frequencyDays: 365,
  },
  {
    id: "fire_extinguisher",
    title: "Check fire extinguisher",
    description:
      "Verify the pressure gauge is in the green and the pin is intact. Replace or service any extinguisher that's older than 10–12 years.",
    category: "safety",
    icon: "🧯",
    frequencyDays: 365,
  },
  {
    id: "gfci_test",
    title: "Test GFCI outlets",
    description:
      "Press the TEST button on each ground-fault outlet in kitchens, bathrooms, garages, and outdoors. Reset and confirm power returns. Do it monthly.",
    category: "safety",
    icon: "⚡",
    frequencyDays: 30,
  },
  // --- Appliances ---------------------------------------------------------
  {
    id: "fridge_coils",
    title: "Vacuum refrigerator coils",
    description:
      "Unplug the fridge, pull it out, and vacuum the condenser coils on the back or underneath. Dusty coils make the compressor work harder and fail sooner.",
    category: "appliance",
    icon: "🧊",
    frequencyDays: 180,
  },
  {
    id: "washer_clean",
    title: "Run washing machine cleaning cycle",
    description:
      "Run an empty hot cycle with a washer-cleaning tablet (or distilled vinegar) to clear detergent buildup, soap scum, and odors.",
    category: "appliance",
    icon: "🧺",
    frequencyDays: 30,
  },
  {
    id: "dishwasher_clean",
    title: "Clean dishwasher filter",
    description:
      "Remove the bottom rack, unscrew the filter assembly, rinse it under hot water, and run an empty hot cycle with a dishwasher cleaner.",
    category: "appliance",
    icon: "🍽",
    frequencyDays: 30,
  },
  {
    id: "range_hood",
    title: "Clean range hood filter",
    description:
      "Pop out the metal mesh filter above your stove and soak it in hot soapy water (or run it through the dishwasher) to clear grease buildup.",
    category: "appliance",
    icon: "🍳",
    frequencyDays: 30,
  },
  // --- Yard ---------------------------------------------------------------
  {
    id: "sprinkler_winterize",
    title: "Winterize sprinkler system",
    description:
      "Shut off the main water supply to the irrigation system and blow out the lines with compressed air before the first hard freeze to prevent burst pipes.",
    category: "yard",
    icon: "❄️",
    frequencyDays: 365,
  },
  {
    id: "sprinkler_startup",
    title: "Spring-start sprinkler system",
    description:
      "Slowly open the main valve, walk every zone, and check for broken heads or leaks before you need the system for summer.",
    category: "yard",
    icon: "🌱",
    frequencyDays: 365,
  },
];
