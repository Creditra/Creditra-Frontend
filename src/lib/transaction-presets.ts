import { TRANSACTION_PRESETS_STORAGE_KEY } from "../constants/storageKeys";
import { readJson, writeJson } from "../utils/storage";
import {
  DEFAULT_FILTERS,
  parseTransactionFilters,
  serializeTransactionFilters,
  type TransactionFilters,
} from "./transaction-filters";

export interface TransactionPreset {
  id: string;
  name: string;
  query: string;
}

/** Maximum number of user-created presets; built-ins are always available. */
export const MAX_TRANSACTION_PRESETS = 10;

const OVERDUE_FEES_ID = "builtin-my-overdue-fees";

const OVERDUE_FEES_FILTERS: TransactionFilters = {
  ...DEFAULT_FILTERS,
  type: "Fee",
  status: "Pending",
};

export const BUILTIN_TRANSACTION_PRESETS: readonly TransactionPreset[] = [
  {
    id: OVERDUE_FEES_ID,
    name: "My overdue fees",
    query: serializeTransactionFilters(OVERDUE_FEES_FILTERS),
  },
];

const BUILTIN_IDS = new Set(BUILTIN_TRANSACTION_PRESETS.map((preset) => preset.id));
const BUILTIN_NAMES = new Set(
  BUILTIN_TRANSACTION_PRESETS.map((preset) => preset.name.toLowerCase()),
);

export function isBuiltinPreset(id: string): boolean {
  return BUILTIN_IDS.has(id);
}

function normalizeName(name: string): string {
  return name.trim().replace(/\s+/g, " ");
}

/**
 * A stored query is canonical when it round-trips through the filter parser
 * without errors and serialises back to the same string. This rejects
 * tampered values such as `page=2`, unknown types, or invalid dates.
 */
function isCanonicalQuery(query: string): boolean {
  const { filters, errors } = parseTransactionFilters(query);
  if (Object.keys(errors).length > 0) return false;
  return serializeTransactionFilters({ ...filters, page: 1 }) === query;
}

function toPreset(value: unknown): TransactionPreset | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;

  const { id, name, query } = value as Record<string, unknown>;
  if (typeof id !== "string" || !id.trim() || BUILTIN_IDS.has(id)) return null;
  if (typeof name !== "string") return null;
  if (typeof query !== "string" || !isCanonicalQuery(query)) return null;

  const normalizedName = normalizeName(name);
  if (!normalizedName || BUILTIN_NAMES.has(normalizedName.toLowerCase())) {
    return null;
  }

  return { id, name: normalizedName, query };
}

function readUserPresets(): TransactionPreset[] {
  const raw = readJson<unknown>(TRANSACTION_PRESETS_STORAGE_KEY, []);
  if (!Array.isArray(raw)) return [];

  const seenIds = new Set<string>();
  const seenNames = new Set<string>();
  const presets: TransactionPreset[] = [];

  for (const entry of raw) {
    const preset = toPreset(entry);
    if (!preset) continue;

    const nameKey = preset.name.toLowerCase();
    if (seenIds.has(preset.id) || seenNames.has(nameKey)) continue;

    seenIds.add(preset.id);
    seenNames.add(nameKey);
    presets.push(preset);

    if (presets.length >= MAX_TRANSACTION_PRESETS) break;
  }

  return presets;
}

function withBuiltins(userPresets: TransactionPreset[]): TransactionPreset[] {
  return [...BUILTIN_TRANSACTION_PRESETS, ...userPresets];
}

function generateId(): string {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  return `preset-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Built-in presets followed by the persisted user presets. */
export function loadPresets(): TransactionPreset[] {
  return withBuiltins(readUserPresets());
}

/**
 * Create or replace a user preset. Names are compared case-insensitively, so
 * saving an existing name updates that preset instead of adding a duplicate.
 * Returns the resulting preset list.
 */
export function savePreset(
  nameOrPreset: string | Pick<TransactionPreset, "name" | "query">,
  query?: string,
): TransactionPreset[] {
  const name =
    typeof nameOrPreset === "string" ? nameOrPreset : nameOrPreset.name;
  const presetQuery =
    typeof nameOrPreset === "string" ? (query ?? "") : nameOrPreset.query;

  const normalizedName = normalizeName(name);
  if (!normalizedName || BUILTIN_NAMES.has(normalizedName.toLowerCase())) {
    return loadPresets();
  }
  if (!isCanonicalQuery(presetQuery)) return loadPresets();

  const userPresets = readUserPresets();
  const existingIndex = userPresets.findIndex(
    (preset) => preset.name.toLowerCase() === normalizedName.toLowerCase(),
  );

  if (existingIndex >= 0) {
    userPresets[existingIndex] = {
      ...userPresets[existingIndex],
      name: normalizedName,
      query: presetQuery,
    };
  } else {
    if (userPresets.length >= MAX_TRANSACTION_PRESETS) return loadPresets();
    userPresets.push({
      id: generateId(),
      name: normalizedName,
      query: presetQuery,
    });
  }

  if (!writeJson(TRANSACTION_PRESETS_STORAGE_KEY, userPresets)) {
    return loadPresets();
  }
  return withBuiltins(userPresets);
}

/** Delete a user preset. Built-in presets cannot be deleted. */
export function deletePreset(id: string): TransactionPreset[] {
  if (BUILTIN_IDS.has(id)) return loadPresets();

  const userPresets = readUserPresets().filter((preset) => preset.id !== id);
  if (!writeJson(TRANSACTION_PRESETS_STORAGE_KEY, userPresets)) {
    return loadPresets();
  }
  return withBuiltins(userPresets);
}
