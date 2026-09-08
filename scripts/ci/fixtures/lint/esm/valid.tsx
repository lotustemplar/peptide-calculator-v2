import type { Dose } from "./dose-types";

export function DoseLabel({ value }: { value: Dose }) {
  return <span data-dose={String(value)}>{String(value)}</span>;
}
