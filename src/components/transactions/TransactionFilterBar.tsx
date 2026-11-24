import React, { useCallback, useRef, useState } from "react";
import { AmountRangeChips } from "../AmountRangeChips";
import { KbdHint } from "../KbdHint";
import type { CreditLine } from "../../types/creditLine";
import type { TransactionFilters } from "../../hooks/useTransactionFilters";

const TYPE_FILTER_OPTIONS = [
  { value: "all", label: "All" },
  { value: "Draw", label: "Draw" },
  { value: "Repay", label: "Repay" },
  { value: "Fee", label: "Fee" },
  { value: "Interest", label: "Interest" },
] as const;

const RANGE_PRESET_OPTIONS = [
  { value: "this-week", label: "This Week" },
  { value: "this-month", label: "This Month" },
  { value: "all-time", label: "All Time" },
] as const;

interface TransactionFilterBarProps {
  filters: TransactionFilters;
  creditLines: CreditLine[];
  onFilterChange: () => void;
}

export function TransactionFilterBar({
  filters,
  creditLines,
  onFilterChange,
}: TransactionFilterBarProps) {
  const {
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
    commitSearch,
    updateAmountUrl,
    syncUrl,
    suggestions,
    resultCountText,
  } = filters;
  const [isSuggestionsOpen, setIsSuggestionsOpen] = useState(false);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const listboxRef = useRef<HTMLUListElement>(null);
  const SEARCH_LISTBOX_ID = "tx-search-listbox";
  const SEARCH_INPUT_ID = "tx-search-input";

  const commitSuggestion = useCallback(
    (value: string) => {
      setSearchInputValue(value);
      commitSearch(value);
      setIsSuggestionsOpen(false);
      setActiveSuggestionIndex(-1);
    },
    [commitSearch, setSearchInputValue],
  );
  const dismissSuggestions = useCallback(() => {
    setIsSuggestionsOpen(false);
    setActiveSuggestionIndex(-1);
  }, []);
  const handleSearchKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      const listOpen = isSuggestionsOpen && suggestions.length > 0;
      switch (event.key) {
        case "ArrowDown":
          event.preventDefault();
          if (!listOpen) {
            if (suggestions.length > 0) setIsSuggestionsOpen(true);
            return;
          }
          setActiveSuggestionIndex((previous) =>
            previous < suggestions.length - 1 ? previous + 1 : 0,
          );
          break;
        case "ArrowUp":
          event.preventDefault();
          if (!listOpen) return;
          setActiveSuggestionIndex((previous) =>
            previous <= 0 ? suggestions.length - 1 : previous - 1,
          );
          break;
        case "Enter":
          if (listOpen && activeSuggestionIndex >= 0) {
            event.preventDefault();
            commitSuggestion(suggestions[activeSuggestionIndex]);
          }
          break;
        case "Escape":
          if (listOpen) {
            event.preventDefault();
            dismissSuggestions();
          }
          break;
        case "Tab":
          dismissSuggestions();
          break;
        default:
          break;
      }
    },
    [
      isSuggestionsOpen,
      suggestions,
      activeSuggestionIndex,
      commitSuggestion,
      dismissSuggestions,
    ],
  );

  return (
    <div className="th-filters">
      <div className="th-filter-group">
        <label>Credit Line</label>
        <select
          value={selectedLine}
          onChange={(event) => {
            setSelectedLine(event.target.value);
            onFilterChange();
          }}
        >
          <option value="all">All Credit Lines</option>
          {creditLines.map((cl) => (
            <option key={cl.id} value={cl.id}>
              {cl.name}
            </option>
          ))}
        </select>
      </div>

      <div className="th-filter-group th-filter-group-wide">
        <span className="th-filter-label" id="transaction-type-filter-label">
          Type
        </span>
        <div
          className="th-chip-group"
          role="group"
          aria-labelledby="transaction-type-filter-label"
        >
          {TYPE_FILTER_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              className="th-filter-chip"
              aria-pressed={selectedType === option.value}
              onClick={() => {
                setSelectedType(option.value);
                onFilterChange();
              }}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
      <div className="th-filter-group">
        <label>Status</label>
        <select
          value={selectedStatus}
          onChange={(event) => {
            setSelectedStatus(event.target.value);
            onFilterChange();
          }}
        >
          <option value="all">All Statuses</option>
          <option value="Completed">Completed</option>
          <option value="Pending">Pending</option>
          <option value="Failed">Failed</option>
        </select>
      </div>

      <div className="th-filter-group th-filter-group-wide">
        <div className="th-subgroup">
          <span className="th-filter-label" id="transaction-range-filter-label">
            Presets
          </span>
          <div
            className="th-chip-group"
            role="group"
            aria-labelledby="transaction-range-filter-label"
          >
            {RANGE_PRESET_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                className="th-filter-chip"
                aria-pressed={presetRange === option.value}
                onClick={() => {
                  setPresetRange(option.value);
                  setDateRange("custom");
                  setCustomStartDate("");
                  setCustomEndDate("");
                  onFilterChange();
                  syncUrl(option.value);
                }}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
        <div className="th-subgroup">
          <span className="th-filter-label" id="transaction-date-filter-label">
            Date Range
          </span>
          <div
            className="th-chip-group"
            role="group"
            aria-labelledby="transaction-date-filter-label"
          >
            {[
              { value: "today" as const, label: "Today" },
              { value: "7d" as const, label: "7d" },
              { value: "30d" as const, label: "30d" },
              { value: "90d" as const, label: "90d" },
              { value: "custom" as const, label: "Custom" },
            ].map((option) => (
              <button
                key={option.value}
                type="button"
                className="th-filter-chip"
                aria-pressed={
                  presetRange === "custom" && dateRange === option.value
                }
                onClick={() => {
                  setPresetRange("custom");
                  setDateRange(option.value);
                  onFilterChange();
                  if (option.value === "custom") {
                    syncUrl("custom", customStartDate, customEndDate);
                  } else {
                    setCustomStartDate("");
                    setCustomEndDate("");
                    syncUrl("custom");
                  }
                }}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
        {dateRange === "custom" && (
          <div className="date-range-custom-fields">
            <label className="date-range-custom-field">
              <span>Start date</span>
              <input
                type="date"
                value={customStartDate}
                onChange={(event) => {
                  setDateRange("custom");
                  setPresetRange("custom");
                  setCustomStartDate(event.target.value);
                  onFilterChange();
                  syncUrl("custom", event.target.value, customEndDate);
                }}
                max={customEndDate || undefined}
              />
            </label>
            <label className="date-range-custom-field">
              <span>End date</span>
              <input
                type="date"
                value={customEndDate}
                onChange={(event) => {
                  setDateRange("custom");
                  setPresetRange("custom");
                  setCustomEndDate(event.target.value);
                  onFilterChange();
                  syncUrl("custom", customStartDate, event.target.value);
                }}
                min={customStartDate || undefined}
              />
            </label>
          </div>
        )}
      </div>
      <div className="th-filter-group th-filter-group-wide">
        <AmountRangeChips
          selectedPreset={selectedAmountRange}
          customMin={customAmountMin}
          customMax={customAmountMax}
          isCustomActive={isCustomAmountRangeActive}
          onPresetChange={(preset) => {
            setSelectedAmountRange(preset);
            setCustomAmountMin("");
            setCustomAmountMax("");
            setIsCustomAmountRangeActive(false);
            onFilterChange();
            updateAmountUrl(preset);
          }}
          onCustomRangeApply={({ min, max }) => {
            setSelectedAmountRange("all");
            setCustomAmountMin(min === null ? "" : String(min));
            setCustomAmountMax(max === null ? "" : String(max));
            setIsCustomAmountRangeActive(true);
            onFilterChange();
            updateAmountUrl(null);
          }}
          onCustomRangeClear={() => {
            setSelectedAmountRange("all");
            setCustomAmountMin("");
            setCustomAmountMax("");
            setIsCustomAmountRangeActive(false);
            onFilterChange();
            updateAmountUrl(null);
          }}
        />
      </div>

      <div
        className="th-search-group"
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null))
            dismissSuggestions();
        }}
      >
        <div className="th-search-label-row">
          <label htmlFor={SEARCH_INPUT_ID} className="th-filter-label">
            Search
          </label>
          <div
            className="th-search-shortcuts"
            role="group"
            aria-label="Search keyboard shortcuts"
          >
            <KbdHint
              keys={["↑", "↓"]}
              label="Navigate"
              description="Use Arrow Up and Arrow Down to navigate search suggestions"
            />
            <KbdHint
              keys="Enter"
              label="Select"
              description="Press Enter to select the active search suggestion"
            />
            <KbdHint
              keys="Esc"
              label="Close"
              description="Press Escape to close search suggestions"
            />
          </div>
        </div>
        <div className="th-search-combobox">
          <input
            ref={searchInputRef}
            id={SEARCH_INPUT_ID}
            type="text"
            role="combobox"
            aria-label="Search transactions"
            aria-expanded={isSuggestionsOpen && suggestions.length > 0}
            aria-controls={SEARCH_LISTBOX_ID}
            aria-autocomplete="list"
            aria-activedescendant={
              activeSuggestionIndex >= 0
                ? `tx-suggestion-${activeSuggestionIndex}`
                : undefined
            }
            placeholder="Search by note, line, ID, or hash…"
            value={searchInputValue}
            autoComplete="off"
            spellCheck={false}
            onChange={(event) => {
              const value = event.target.value;
              setSearchInputValue(value);
              setIsSuggestionsOpen(value.trim().length > 0);
              setActiveSuggestionIndex(-1);
            }}
            onKeyDown={handleSearchKeyDown}
            onFocus={() => {
              if (searchInputValue.trim() && suggestions.length > 0)
                setIsSuggestionsOpen(true);
            }}
          />
          {searchInputValue && (
            <button
              type="button"
              className="th-search-clear"
              aria-label="Clear search"
              tabIndex={0}
              onClick={() => {
                setSearchInputValue("");
                commitSearch("");
                setIsSuggestionsOpen(false);
                setActiveSuggestionIndex(-1);
                onFilterChange();
                searchInputRef.current?.focus();
              }}
            >
              ✕
            </button>
          )}
          <ul
            ref={listboxRef}
            id={SEARCH_LISTBOX_ID}
            role="listbox"
            aria-label="Search suggestions"
            className={`th-search-listbox${isSuggestionsOpen && suggestions.length > 0 ? " th-search-listbox--open" : ""}`}
          >
            {suggestions.map((suggestion, index) => (
              <li
                key={suggestion}
                id={`tx-suggestion-${index}`}
                role="option"
                aria-selected={index === activeSuggestionIndex}
                className={`th-search-option${index === activeSuggestionIndex ? " th-search-option--active" : ""}`}
                onMouseDown={(event) => {
                  event.preventDefault();
                  commitSuggestion(suggestion);
                }}
              >
                <span className="th-search-option-icon" aria-hidden="true">
                  🔍
                </span>
                {suggestion}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div
        className="th-filter-results"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {resultCountText}
      </div>
    </div>
  );
}
