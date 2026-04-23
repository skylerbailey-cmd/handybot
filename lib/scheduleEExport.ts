import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import type { ExpenseCategory, Issue } from "./types";

const CATEGORY_LABEL: Record<ExpenseCategory, string> = {
  repairs: "Repairs",
  maintenance: "Maintenance",
  supplies: "Supplies",
  improvements: "Improvements",
  auto_travel: "Auto & Travel",
  other: "Other",
};

const CATEGORY_ORDER: ExpenseCategory[] = [
  "repairs",
  "maintenance",
  "supplies",
  "improvements",
  "auto_travel",
  "other",
];

function escCsv(val: string): string {
  if (val.includes(",") || val.includes('"') || val.includes("\n")) {
    return `"${val.replace(/"/g, '""')}"`;
  }
  return val;
}

function fmtDate(ms?: number): string {
  if (!ms) return "";
  return new Date(ms).toLocaleDateString("en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

function fmtMoney(usd?: number): string {
  if (!usd) return "0.00";
  return usd.toFixed(2);
}

/**
 * Generate a Schedule E CSV file and return the file URI.
 */
export async function exportScheduleECsv(args: {
  issues: Issue[];
  homeName: string;
  year: number;
}): Promise<string> {
  const { issues, homeName, year } = args;

  // Filter to issues with expenses in the target year
  const withExpense = issues.filter((i) => {
    if (!i.expenseAmountUsd || i.expenseAmountUsd <= 0) return false;
    const d = i.expenseDate ?? i.updatedAt;
    const y = new Date(d).getFullYear();
    return y === year;
  });

  // Sort by date
  withExpense.sort(
    (a, b) => (a.expenseDate ?? a.updatedAt) - (b.expenseDate ?? b.updatedAt)
  );

  // Build CSV
  const lines: string[] = [];
  lines.push("Date,Property,Category,Vendor,Description,Amount,Receipt");

  // Group by category
  for (const cat of CATEGORY_ORDER) {
    const inCat = withExpense.filter(
      (i) => (i.expenseCategory ?? "other") === cat
    );
    if (inCat.length === 0) continue;

    for (const issue of inCat) {
      lines.push(
        [
          escCsv(fmtDate(issue.expenseDate ?? issue.updatedAt)),
          escCsv(homeName),
          escCsv(CATEGORY_LABEL[issue.expenseCategory ?? "other"]),
          escCsv(issue.receiptVendor ?? ""),
          escCsv(issue.title),
          fmtMoney(issue.expenseAmountUsd),
          escCsv(issue.receiptPhotoUri ?? ""),
        ].join(",")
      );
    }

    // Subtotal row
    const subtotal = inCat.reduce(
      (s, i) => s + (i.expenseAmountUsd ?? 0),
      0
    );
    lines.push(`,,${escCsv(CATEGORY_LABEL[cat])} Subtotal,,,$${fmtMoney(subtotal)},`);
    lines.push(""); // blank separator
  }

  // Grand total
  const total = withExpense.reduce(
    (s, i) => s + (i.expenseAmountUsd ?? 0),
    0
  );
  lines.push(`,,TOTAL,,,$${fmtMoney(total)},`);

  const csv = lines.join("\n");
  const filename = `ScheduleE_${homeName.replace(/\s+/g, "_")}_${year}.csv`;
  const fileUri = `${FileSystem.cacheDirectory}${filename}`;

  await FileSystem.writeAsStringAsync(fileUri, csv, {
    encoding: FileSystem.EncodingType.UTF8,
  });

  return fileUri;
}

/**
 * Export and share the Schedule E CSV via the system share sheet.
 */
export async function shareScheduleECsv(args: {
  issues: Issue[];
  homeName: string;
  year: number;
}): Promise<void> {
  const fileUri = await exportScheduleECsv(args);
  await Sharing.shareAsync(fileUri, {
    mimeType: "text/csv",
    dialogTitle: `Schedule E — ${args.homeName} ${args.year}`,
  });
}
