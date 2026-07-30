const arabicLocale = "ar-u-nu-arab";
const arabicNumber = new Intl.NumberFormat(arabicLocale, { maximumFractionDigits: 1 });
const arabicInteger = new Intl.NumberFormat(arabicLocale, { maximumFractionDigits: 0 });
const arabicDateTime = new Intl.DateTimeFormat(arabicLocale, {
  dateStyle: "medium",
  timeStyle: "short",
});

export function formatNumber(value: number): string {
  return arabicNumber.format(value);
}

export function formatInteger(value: number): string {
  return arabicInteger.format(value);
}

export function formatPercent(value: number): string {
  return `${arabicNumber.format(value * 100)}٪`;
}

export function formatDateTime(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "غير معروف" : arabicDateTime.format(date);
}

export function humanizeReason(reason: string): string {
  const reasons: Record<string, string> = {
    contribution_commit: "اعتماد مساهمة",
    deterministic_seed: "بداية المحاكاة",
    scheduled_tick: "نبضة مجدولة",
  };
  return reasons[reason] ?? reason.replaceAll("_", " ");
}
