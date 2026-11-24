import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import type { DatePreset } from "../components/DateRangeChips";
import type { AmountRangePreset } from "../components/AmountRangeChips";
import type { CreditTransaction } from "./useCreditLines";
import {
  amountPresetFromUrl,
  matchesAmountFilter,
  type AmountFilter,
} from "../utils/transactionAmountFilter";
import {
  startOfMonth,
  startOfWeek,
} from "../utils/dates";
import { now as clockNow, nowMs as clockNowMs } from "../lib/clock";

export type TypeFilter = "all" | Exclude<CreditTransaction["type"], "StatusChange">;
export type RangePreset = "this-week" | "this-month" | "all-time" | "custom";

export interface TransactionFilters {
  selectedLine: string;
  setSelectedLine: (value: string) => void;
  selectedType: TypeFilter;
  setSelectedType: (value: TypeFilter) => void;
  selectedStatus: string;
  setSelectedStatus: (value: string) => void;
  dateRange: DatePreset;
  setDateRange: (value: DatePreset) => void;
  presetRange: RangePreset;
  setPresetRange: (value: RangePreset) => void;
  customStartDate: string;
  setCustomStartDate: (value: string) => void;
  customEndDate: string;
  setCustomEndDate: (value: string) => void;
  selectedAmountRange: AmountRangePreset;
  setSelectedAmountRange: (value: AmountRangePreset) => void;
  customAmountMin: string;
  setCustomAmountMin: (value: string) => void;
  customAmountMax: string;
  setCustomAmountMax: (value: string) => void;
  isCustomAmountRangeActive: boolean;
  setIsCustomAmountRangeActive: (value: boolean) => void;
  searchInputValue: string;
  setSearchInputValue: (value: string) => void;
  searchQuery: string;
  commitSearch: (value: string) => void;
  updateAmountUrl: (preset: AmountRangePreset | null) => void;
  syncUrl: (preset: RangePreset, start?: string, end?: string) => void;
  clearFilters: () => void;
  allTransactions: CreditTransaction[];
  filteredTransactions: CreditTransaction[];
  suggestions: string[];
  filterKey: string;
  hasActiveFilters: boolean;
  resultCountText: string;
  tableCaption: string;
}

export function useTransactionFilters(
  transactions: CreditTransaction[],
): TransactionFilters {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedLine, setSelectedLine] = useState("all");
  const [selectedType, setSelectedType] = useState<TypeFilter>("all");
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [dateRange, setDateRange] = useState<DatePreset>("custom");
  const [presetRange, setPresetRange] = useState<RangePreset>("custom");
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");
  const [selectedAmountRange, setSelectedAmountRange] =
    useState<AmountRangePreset>(
      () => amountPresetFromUrl(searchParams.get("amount")) ?? "all",
    );
  const [customAmountMin, setCustomAmountMin] = useState(() =>
    searchParams.get("amount") === "gt1000" ? "1000" : "",
  );
  const [customAmountMax, setCustomAmountMax] = useState("");
  const [isCustomAmountRangeActive, setIsCustomAmountRangeActive] =
    useState(() => searchParams.get("amount") === "gt1000");
  const [searchInputValue, setSearchInputValue] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const amountFilter = useMemo<AmountFilter>(
    () =>
      isCustomAmountRangeActive
        ? {
            kind: "custom",
            min: customAmountMin.trim() ? Number(customAmountMin) : null,
            max: customAmountMax.trim() ? Number(customAmountMax) : null,
          }
        : selectedAmountRange === "all"
          ? { kind: "all" }
          : { kind: "preset", id: selectedAmountRange },
    [
      isCustomAmountRangeActive,
      customAmountMin,
      customAmountMax,
      selectedAmountRange,
    ],
  );

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const rangeParam = params.get("range");

    if (
      rangeParam === "this-week" ||
      rangeParam === "this-month" ||
      rangeParam === "all-time"
    ) {
      setPresetRange(rangeParam);
      setDateRange("custom");
      return;
    }

    setPresetRange("custom");
    const customStart = params.get("start");
    const customEnd = params.get("end");
    if (customStart) {
      setCustomStartDate(customStart);
      setDateRange("custom");
    } else {
      setCustomStartDate("");
    }
    if (customEnd) {
      setCustomEndDate(customEnd);
      setDateRange("custom");
    } else {
      setCustomEndDate("");
    }
  }, [location.search]);

  const allTransactions = useMemo(
    () =>
      transactions.map((tx) => ({ ...tx })).sort((a, b) => {
        const aTime = new Date(a.date).getTime();
        const bTime = new Date(b.date).getTime();
        if (bTime !== aTime) return bTime - aTime;
        return a.id < b.id ? 1 : a.id > b.id ? -1 : 0;
      }),
    [transactions],
  );

  const filteredTransactions = useMemo(
    () =>
      allTransactions.filter((tx) => {
        const txTime = new Date(tx.date).getTime();
        if (Number.isNaN(txTime)) return false;
        if (selectedLine !== "all" && tx.lineId !== selectedLine) return false;
        if (selectedType !== "all" && tx.type !== selectedType) return false;
        if (selectedStatus !== "all" && tx.status !== selectedStatus)
          return false;
        if (!matchesAmountFilter(amountFilter, tx.amount)) return false;
        if (searchQuery) {
          const query = searchQuery.toLowerCase();
          const matchesNote = tx.note?.toLowerCase().includes(query);
          const matchesLine = tx.lineName.toLowerCase().includes(query);
          const matchesId = tx.lineId.toLowerCase().includes(query);
          const matchesHash = tx.txHash?.toLowerCase().includes(query);
          if (!matchesNote && !matchesLine && !matchesId && !matchesHash)
            return false;
        }

        const now = clockNow();
        const startOfToday = new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate(),
        ).getTime();
        if (dateRange === "today" && txTime < startOfToday) return false;
        if (
          dateRange === "7d" &&
          txTime < clockNowMs() - 7 * 24 * 60 * 60 * 1000
        ) {
          return false;
        }
        if (
          dateRange === "30d" &&
          txTime < clockNowMs() - 30 * 24 * 60 * 60 * 1000
        ) {
          return false;
        }
        if (
          dateRange === "90d" &&
          txTime < clockNowMs() - 90 * 24 * 60 * 60 * 1000
        ) {
          return false;
        }

        if (presetRange === "this-week") {
          if (txTime < startOfWeek(now).getTime()) return false;
        } else if (presetRange === "this-month") {
          if (txTime < startOfMonth(now).getTime()) return false;
        } else if (presetRange === "custom" && dateRange === "custom") {
          if (customStartDate) {
            const start = new Date(`${customStartDate}T00:00:00`).getTime();
            if (txTime < start) return false;
          }
          if (customEndDate) {
            const end = new Date(`${customEndDate}T23:59:59.999`).getTime();
            if (txTime > end) return false;
          }
        }
        return true;
      }),
    [
      allTransactions,
      selectedLine,
      selectedType,
      selectedStatus,
      amountFilter,
      searchQuery,
      dateRange,
      presetRange,
      customStartDate,
      customEndDate,
    ],
  );

  useEffect(() => {
    const timer = window.setTimeout(() => setSearchQuery(searchInputValue), 250);
    return () => window.clearTimeout(timer);
  }, [searchInputValue]);

  const suggestions = useMemo<string[]>(() => {
    const q = searchInputValue.trim().toLowerCase();
    if (!q) return [];
    const seen = new Set<string>();
    const results: string[] = [];
    for (const tx of allTransactions) {
      if (results.length >= 8) break;
      for (const candidate of [tx.lineName, tx.lineId, tx.note]) {
        if (!candidate) continue;
        if (candidate.toLowerCase().includes(q) && !seen.has(candidate)) {
          seen.add(candidate);
          results.push(candidate);
          if (results.length >= 8) break;
        }
      }
    }
    return results;
  }, [searchInputValue, allTransactions]);

  const syncUrl = useCallback(
    (nextPreset: RangePreset, start = "", end = "") => {
      const params = new URLSearchParams(location.search);
      if (nextPreset === "custom") {
        if (start) params.set("start", start);
        else params.delete("start");
        if (end) params.set("end", end);
        else params.delete("end");
        params.delete("range");
      } else {
        params.set("range", nextPreset);
        params.delete("start");
        params.delete("end");
      }
      const nextSearch = params.toString();
      navigate(
        {
          pathname: location.pathname,
          search: nextSearch ? `?${nextSearch}` : "",
        },
        { replace: true },
      );
    },
    [location.pathname, location.search, navigate],
  );

  const updateAmountUrl = useCallback(
    (preset: AmountRangePreset | null) => {
      setSearchParams((previous) => {
        const next = new URLSearchParams(previous);
        if (preset === null || preset === "all") next.delete("amount");
        else next.set("amount", preset);
        return next;
      });
    },
    [setSearchParams],
  );

  const commitSearch = useCallback((value: string) => {
    setSearchInputValue(value);
    setSearchQuery(value);
  }, []);

  const clearFilters = useCallback(() => {
    setSelectedLine("all");
    setSelectedType("all");
    setSelectedStatus("all");
    setDateRange("custom");
    setPresetRange("custom");
    setCustomStartDate("");
    setCustomEndDate("");
    setSelectedAmountRange("all");
    setCustomAmountMin("");
    setCustomAmountMax("");
    setIsCustomAmountRangeActive(false);
    setSearchQuery("");
    setSearchInputValue("");
    updateAmountUrl(null);
  }, [updateAmountUrl]);

  const hasActiveFilters =
    selectedLine !== "all" ||
    selectedType !== "all" ||
    selectedStatus !== "all" ||
    selectedAmountRange !== "all" ||
    isCustomAmountRangeActive ||
    dateRange !== "custom" ||
    customStartDate.length > 0 ||
    customEndDate.length > 0 ||
    searchInputValue.trim().length > 0;
  const resultCountText = `${filteredTransactions.length} ${filteredTransactions.length === 1 ? "transaction" : "transactions"} shown`;
  const filterKey = JSON.stringify([
    selectedLine,
    selectedType,
    selectedStatus,
    dateRange,
    presetRange,
    customStartDate,
    customEndDate,
    selectedAmountRange,
    isCustomAmountRangeActive,
    customAmountMin,
    customAmountMax,
    searchQuery,
  ]);
  const tableCaption = useMemo(() => {
    const parts: string[] = [];
    const typeLabels: Record<TypeFilter, string> = {
      all: "All",
      Draw: "Draw",
      Repay: "Repayment",
      Fee: "Fee",
      Interest: "Interest",
    };
    if (selectedType !== "all")
      parts.push(`filtered by ${typeLabels[selectedType]}`);
    const dateLabels: Record<string, string> = {
      today: "today",
      "7d": "last 7 days",
      "30d": "last 30 days",
      "90d": "last 90 days",
    };
    if (dateRange !== "custom" && dateLabels[dateRange]) {
      parts.push(dateLabels[dateRange]);
    } else if (dateRange === "custom" && (customStartDate || customEndDate)) {
      parts.push(`from ${customStartDate || "any"} to ${customEndDate || "any"}`);
    }
    if (selectedStatus !== "all") parts.push(`status: ${selectedStatus}`);
    if (searchInputValue.trim())
      parts.push(`matching "${searchInputValue.trim()}"`);
    const count = filteredTransactions.length;
    const scope = parts.length > 0 ? `, ${parts.join(", ")}` : "";
    return `Transaction history${scope} — ${count} ${count === 1 ? "result" : "results"}`;
  }, [
    selectedType,
    dateRange,
    customStartDate,
    customEndDate,
    selectedStatus,
    searchInputValue,
    filteredTransactions.length,
  ]);

  return {
    selectedLine,
    setSelectedLine,
    selectedType,
    setSelectedType,
    selectedStatus,
    setSelectedStatus,
    dateRange,
    setDateRange,
    presetRange,
    setPresetRange,
    customStartDate,
    setCustomStartDate,
    customEndDate,
    setCustomEndDate,
    selectedAmountRange,
    setSelectedAmountRange,
    customAmountMin,
    setCustomAmountMin,
    customAmountMax,
    setCustomAmountMax,
    isCustomAmountRangeActive,
    setIsCustomAmountRangeActive,
    searchInputValue,
    setSearchInputValue,
    searchQuery,
    commitSearch,
    updateAmountUrl,
    syncUrl,
    clearFilters,
    allTransactions,
    filteredTransactions,
    suggestions,
    filterKey,
    hasActiveFilters,
    resultCountText,
    tableCaption,
  };
}
