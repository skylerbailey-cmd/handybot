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
  // --- Interior -----------------------------------------------------------
  {
    id: "shower_caulk",
    title: "Inspect tub & shower caulk",
    description:
      "Check the caulk around bathtubs, showers, and backsplashes for cracks, gaps, or mildew. Re-caulk failing joints to prevent water damage behind walls.",
    category: "interior",
    icon: "🛁",
    frequencyDays: 180,
  },
  {
    id: "garbage_disposal",
    title: "Clean garbage disposal",
    description:
      "Run ice cubes and a cut-up lemon through the disposal to clear buildup and deodorize. Follow with cold water for 30 seconds.",
    category: "interior",
    icon: "🍋",
    frequencyDays: 30,
  },
  {
    id: "garage_door_safety",
    title: "Test garage door auto-reverse",
    description:
      "Place a 2x4 flat on the ground under the door and close it. The door should reverse when it hits the board. Also test the photo-eye sensors by waving an object through the beam.",
    category: "interior",
    icon: "🚗",
    frequencyDays: 90,
  },
  {
    id: "weather_stripping",
    title: "Check door weather stripping",
    description:
      "Inspect weather stripping on all exterior doors for gaps, tears, or compression. Replace worn strips to keep drafts and moisture out.",
    category: "interior",
    icon: "🚪",
    frequencyDays: 365,
  },
  {
    id: "deep_clean_carpet",
    title: "Deep-clean carpets & rugs",
    description:
      "Rent or run a carpet cleaner on high-traffic areas. Regular deep cleaning extends carpet life and removes allergens that vacuuming misses.",
    category: "interior",
    icon: "🧹",
    frequencyDays: 365,
  },
  // --- Plumbing (additional) ----------------------------------------------
  {
    id: "washer_hoses",
    title: "Inspect washing machine hoses",
    description:
      "Check the hot and cold supply hoses behind the washing machine for bulges, cracks, or dampness. Rubber hoses should be replaced every 3-5 years; braided stainless lasts longer.",
    category: "plumbing",
    icon: "🔧",
    frequencyDays: 180,
  },
  {
    id: "faucet_aerators",
    title: "Clean faucet aerators",
    description:
      "Unscrew the aerator on each faucet and soak it in vinegar to dissolve mineral deposits. This restores water pressure and flow consistency.",
    category: "plumbing",
    icon: "🚰",
    frequencyDays: 365,
  },
  // --- HVAC (additional) --------------------------------------------------
  {
    id: "condensate_drain",
    title: "Clear AC condensate drain line",
    description:
      "Pour a cup of distilled vinegar or bleach through the condensate drain line to prevent algae clogs. A clogged line can cause water damage or trigger a system shutoff.",
    category: "hvac",
    icon: "💧",
    frequencyDays: 180,
  },
  // --- Exterior (additional) ----------------------------------------------
  {
    id: "power_wash",
    title: "Power wash siding & walkways",
    description:
      "Pressure-wash vinyl/fiber cement siding, the driveway, patio, and walkways to remove mold, mildew, and dirt buildup. Spring is ideal before outdoor season.",
    category: "exterior",
    icon: "💦",
    frequencyDays: 365,
  },
  {
    id: "foundation_inspect",
    title: "Inspect foundation for cracks",
    description:
      "Walk the perimeter and check the visible foundation for new cracks, efflorescence (white powder), or signs of water intrusion. Mark new cracks with tape to monitor growth.",
    category: "exterior",
    icon: "🧱",
    frequencyDays: 365,
  },
  // --- Yard ---------------------------------------------------------------
  {
    id: "mower_maintenance",
    title: "Service lawn mower",
    description:
      "Change the oil, replace or clean the air filter, sharpen the blade, and replace the spark plug. A well-maintained mower cuts cleaner and lasts longer.",
    category: "yard",
    icon: "🌿",
    frequencyDays: 365,
  },
  {
    id: "tree_trim",
    title: "Trim trees away from house",
    description:
      "Cut back any branches within 10 feet of the roof, siding, or power lines. Overhanging limbs drop debris on the roof, hold moisture, and risk storm damage.",
    category: "yard",
    icon: "🌳",
    frequencyDays: 365,
  },
  {
    id: "deck_inspect",
    title: "Inspect deck or patio",
    description:
      "Check for loose boards, popped nails, soft or rotting wood, and wobbly railings. Probe suspect areas with a screwdriver — it shouldn't sink in easily.",
    category: "yard",
    icon: "🪵",
    frequencyDays: 365,
  },
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
