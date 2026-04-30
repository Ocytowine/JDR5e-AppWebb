import type { TickScale } from "../../world-simulation";

export function formatDurationHours(hours: number | undefined | null): string {
  if (typeof hours !== "number" || !Number.isFinite(hours)) return "n/a";
  if (hours < 24) return `${hours.toFixed(hours >= 10 ? 0 : 1)} h`;
  const days = hours / 24;
  return `${days.toFixed(days >= 10 ? 0 : 1)} j`;
}

export function formatTicksAsDuration(ticks: number | undefined | null, hoursPerTick: number): string {
  if (typeof ticks !== "number" || !Number.isFinite(ticks)) return "n/a";
  return formatDurationHours(ticks * hoursPerTick);
}

export function formatScaleStep(scale: TickScale | undefined): string {
  if (scale === "macro") return "+6 h";
  if (scale === "micro") return "+1 h";
  return "n/a";
}

export function formatCooldownValue(hours: number | undefined | null): string {
  if (typeof hours !== "number" || !Number.isFinite(hours)) return "n/a";
  return `${hours} h`;
}

export function formatRejectionReason(reason: string): string {
  if (!reason.startsWith("cooldown:")) return reason;
  const raw = Number(reason.slice("cooldown:".length));
  return Number.isFinite(raw) ? `cooldown ${formatCooldownValue(raw)}` : reason;
}
