/**
 * Stage 5 chip model. Inventory is the source of truth:
 * docs/evidence/stage-5-chips/CHIP_INVENTORY.md
 *
 * Only safe-MED-FLAG chips may render. Nothing is preselected.
 */

export type ChipClass = "safe-MED-FLAG" | "escalate-Serious" | "out-of-stage-5";
export type ChipSource = "recent-user" | "Custom" | "static list" | "other";

export const CHIP_FIELD_PEPTIDE_NAME = "peptide-name";
export const CUSTOM_CHIP_COPY = "Custom";
export const UNKNOWN_CHIP_COPY = "Unknown";
export const CHIP_DEFAULT_SELECTION = "none" as const;

export interface ChipSpec {
  id: string;
  field: string;
  source: ChipSource;
  defaultSelection: typeof CHIP_DEFAULT_SELECTION;
  copy: string;
  class: ChipClass;
  selected: false;
}

function nameChip(
  id: string,
  source: ChipSource,
  copy: string,
  chipClass: ChipClass = "safe-MED-FLAG"
): ChipSpec {
  return {
    id,
    field: CHIP_FIELD_PEPTIDE_NAME,
    source,
    defaultSelection: CHIP_DEFAULT_SELECTION,
    copy,
    class: chipClass,
    selected: false,
  };
}

export function stage5NameChips(recentNames: string[]): ChipSpec[] {
  const chips: ChipSpec[] = [
    nameChip("name-custom", "Custom", CUSTOM_CHIP_COPY),
    nameChip("name-unknown", "other", UNKNOWN_CHIP_COPY),
  ];
  recentNames.forEach((name, index) => {
    if (!name || name === UNKNOWN_CHIP_COPY) {
      return;
    }
    chips.push(nameChip(`name-recent-${index}`, "recent-user", name));
  });
  return chips;
}

export function assertNoPreselect(chips: ChipSpec[]): boolean {
  return chips.every((chip) => chip.selected === false && chip.defaultSelection === "none");
}

export function isShippableChip(chip: ChipSpec): boolean {
  return chip.class === "safe-MED-FLAG";
}

export function forbiddenChipFraming(copy: string): boolean {
  return /\b(recommend(?:ed|ation)?|best|therapeutic)\b/i.test(copy);
}
