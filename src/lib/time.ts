export const OPDESK_TIMEZONE = process.env.OPDESK_TIMEZONE || "Asia/Kolkata";

export function localDateString(date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: OPDESK_TIMEZONE }).format(date);
}

export function localHour(date = new Date()): number {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: OPDESK_TIMEZONE, hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(date);
  const h = Number(parts.find(p => p.type === "hour")?.value ?? 0);
  const m = Number(parts.find(p => p.type === "minute")?.value ?? 0);
  return h + m / 60;
}
