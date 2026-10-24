export const AMOUNT_PRESETS = [
  { value: "all", label: "All amounts" },
  { value: "under-100", label: "Under $100" },
  { value: "100-1k", label: "$100–$1k" },
  { value: "1k-5k", label: "$1k–$5k" },
  { value: "5k-25k", label: "$5k–$25k" },
  { value: "25k-plus", label: "$25k+" },
] as const;

export type AmountPreset = (typeof AMOUNT_PRESETS)[number]["value"];
export type AmountFilter =
  | { kind: "all" }
  | { kind: "preset"; id: Exclude<AmountPreset, "all"> }
  | { kind: "custom"; min: number | null; max: number | null };

const PRESET_BOUNDS: Record<Exclude<AmountPreset, "all">, { min?: number; max?: number }> = {
  "under-100": { max: 100 },
  "100-1k": { min: 100, max: 1_000 },
  "1k-5k": { min: 1_000, max: 5_000 },
  "5k-25k": { min: 5_000, max: 25_000 },
  "25k-plus": { min: 25_000 },
};

const PRESET_IDS = new Set<string>(AMOUNT_PRESETS.map(({ value }) => value));

export function amountPresetFromUrl(value: string | null): AmountPreset | null {
  if (!value) return null;
  if (value === "lt100") return "under-100";
  if (value === "100-1000") return "100-1k";
  if (value === "gt1000") return null;
  return PRESET_IDS.has(value) ? (value as AmountPreset) : null;
}

export function matchesAmountFilter(filter: AmountFilter, amount: number): boolean {
  const absoluteAmount = Math.abs(amount);
  if (!Number.isFinite(absoluteAmount)) return false;
  if (filter.kind === "all") return true;
  if (filter.kind === "custom") {
    return (
      (filter.min === null || absoluteAmount >= filter.min) &&
      (filter.max === null || absoluteAmount < filter.max)
    );
  }

  const bounds = PRESET_BOUNDS[filter.id];
  return (
    (bounds.min === undefined || absoluteAmount >= bounds.min) &&
    (bounds.max === undefined || absoluteAmount < bounds.max)
  );
}
