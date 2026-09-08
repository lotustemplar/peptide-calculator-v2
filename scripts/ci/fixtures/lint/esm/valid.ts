import type { Dose } from "./dose-types";

const dose: Dose = 1;

export function formatDose(value: Dose): string {
  return String(value);
}

export { dose };
