import { useEffect, useId, useRef, useState } from "react";
import { useBodyScrollLock } from "../hooks/useBodyScrollLock";
import { useFocusTrap } from "../hooks/useFocusTrap";
import { useInertBackdrop } from "../hooks/useInertBackdrop";
import "./AmountRangeChips.css";

export const AMOUNT_RANGE_OPTIONS = [
  { value: "all", label: "All amounts" },
  { value: "under-5k", label: "Under $5k" },
  { value: "5k-25k", label: "$5k-$25k" },
  { value: "25k-plus", label: "$25k+" },
] as const;

export type AmountRangePreset = (typeof AMOUNT_RANGE_OPTIONS)[number]["value"];

interface AmountRangeValue {
  min: number | null;
  max: number | null;
}

interface AmountRangeChipsProps {
  selectedPreset: AmountRangePreset;
  customMin: string;
  customMax: string;
  isCustomActive: boolean;
  onPresetChange: (preset: AmountRangePreset) => void;
  onCustomRangeApply: (range: AmountRangeValue) => void;
  onCustomRangeClear: () => void;
  onResetHistoryCursors?: () => void;
}

const formatAmountLabel = (value: string): string => {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return value;

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
  }).format(amount);
};

const parseAmountInput = (value: string): number | null => {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return parsed;
};

export function AmountRangeChips({
  selectedPreset,
  customMin,
  customMax,
  isCustomActive,
  onPresetChange,
  onCustomRangeApply,
  onCustomRangeClear,
  onResetHistoryCursors,
}: AmountRangeChipsProps) {
  const labelId = useId();
  const modalId = `${labelId.replace(/:/g, "")}-amount-range-modal`;
  const minInputRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [draftMin, setDraftMin] = useState(customMin);
  const [draftMax, setDraftMax] = useState(customMax);
  const activeDialogRef = useFocusTrap({
    isActive: isModalOpen,
    triggerRef,
    onEscape: () => setIsModalOpen(false),
  });

  useBodyScrollLock({ isLocked: isModalOpen });
  useInertBackdrop({ isInert: isModalOpen, modalId });

  const activeFilterKey = isCustomActive
    ? `custom:${customMin}:${customMax}`
    : `preset:${selectedPreset}`;
  const previousFilterKeyRef = useRef(activeFilterKey);

  useEffect(() => {
    if (previousFilterKeyRef.current !== activeFilterKey) {
      previousFilterKeyRef.current = activeFilterKey;
      onResetHistoryCursors?.();
    }
  }, [activeFilterKey, onResetHistoryCursors]);

  useEffect(() => {
    if (!isModalOpen) return;

    setDraftMin(customMin);
    setDraftMax(customMax);
  }, [customMin, customMax, isModalOpen]);

  useEffect(() => {
    if (!isModalOpen) return;

    const timer = window.setTimeout(() => {
      minInputRef.current?.focus();
    }, 60);

    return () => window.clearTimeout(timer);
  }, [isModalOpen]);

  const parsedMin = parseAmountInput(draftMin);
  const parsedMax = parseAmountInput(draftMax);
  const hasInvalidDraft = [draftMin, draftMax].some((value) => {
    const trimmed = value.trim();
    return trimmed.length > 0 && parseAmountInput(value) === null;
  });
  const isRangeInverted =
    parsedMin !== null && parsedMax !== null && parsedMin > parsedMax;
  const isApplyDisabled =
    hasInvalidDraft ||
    isRangeInverted ||
    (draftMin.trim() === "" && draftMax.trim() === "");

  const customSummary = [
    customMin ? `Min ${formatAmountLabel(customMin)}` : null,
    customMax ? `Max ${formatAmountLabel(customMax)}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const handleApply = () => {
    if (isApplyDisabled) return;

    onCustomRangeApply({ min: parsedMin, max: parsedMax });
    setIsModalOpen(false);
  };

  const handleOpenModal = () => {
    setIsModalOpen(true);
  };

  return (
    <div className="amount-range-chips">
      <span className="th-filter-label" id={labelId}>
        Amount Range
      </span>

      <div className="th-chip-group" role="group" aria-labelledby={labelId}>
        {AMOUNT_RANGE_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            className="th-filter-chip"
            aria-pressed={!isCustomActive && selectedPreset === option.value}
            onClick={() => onPresetChange(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>

      <div className="amount-range-actions">
        <button
          ref={triggerRef}
          type="button"
          className={`amount-range-custom-trigger ${isCustomActive ? "is-active" : ""}`}
          aria-pressed={isCustomActive}
          aria-haspopup="dialog"
          onClick={handleOpenModal}
        >
          {isCustomActive ? `Custom: ${customSummary}` : "Custom range"}
        </button>
        {isCustomActive && (
          <button
            type="button"
            className="amount-range-clear"
            onClick={onCustomRangeClear}
          >
            Clear custom
          </button>
        )}
      </div>

      {isModalOpen && (
        <div id={modalId} className="amount-range-modal-root">
          <div
            className="amount-range-modal-backdrop"
            aria-hidden="true"
            onClick={() => setIsModalOpen(false)}
          />
          <div
            ref={activeDialogRef}
            className="amount-range-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="amount-range-modal-title"
            aria-describedby="amount-range-modal-description"
          >
            <div className="amount-range-modal-header">
              <div>
                <p className="amount-range-modal-kicker">Fine-grained filter</p>
                <h3 id="amount-range-modal-title">
                  Choose a custom amount range
                </h3>
                <p id="amount-range-modal-description">
                  Filter transaction amounts by a minimum, maximum, or both.
                </p>
              </div>
              <button
                type="button"
                className="amount-range-modal-close"
                aria-label="Close custom amount range dialog"
                onClick={() => setIsModalOpen(false)}
              >
                ×
              </button>
            </div>

            <div className="amount-range-modal-body">
              <label className="amount-range-field">
                <span>Minimum amount</span>
                <input
                  ref={minInputRef}
                  type="number"
                  min="0"
                  step="0.01"
                  inputMode="decimal"
                  value={draftMin}
                  onChange={(event) => setDraftMin(event.target.value)}
                  placeholder="0.00"
                />
              </label>
              <label className="amount-range-field">
                <span>Maximum amount</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  inputMode="decimal"
                  value={draftMax}
                  onChange={(event) => setDraftMax(event.target.value)}
                  placeholder="50000.00"
                />
              </label>
              <p className="amount-range-modal-hint">
                Leave either field blank to filter with only a minimum or
                maximum value.
              </p>
              {hasInvalidDraft && (
                <p className="amount-range-modal-error" role="alert">
                  Enter a valid non-negative amount.
                </p>
              )}
              {!hasInvalidDraft && isRangeInverted && (
                <p className="amount-range-modal-error" role="alert">
                  Minimum amount must be less than or equal to the maximum
                  amount.
                </p>
              )}
            </div>

            <div className="amount-range-modal-footer">
              {isCustomActive && (
                <button
                  type="button"
                  className="amount-range-secondary"
                  onClick={() => {
                    onCustomRangeClear();
                    setIsModalOpen(false);
                  }}
                >
                  Clear custom range
                </button>
              )}
              <button
                type="button"
                className="amount-range-secondary"
                onClick={() => setIsModalOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="amount-range-primary"
                onClick={handleApply}
                disabled={isApplyDisabled}
              >
                Apply range
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
