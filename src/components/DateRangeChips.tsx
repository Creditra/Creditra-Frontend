import { useEffect, useId, useRef } from 'react';
import { DatePicker } from './DatePicker';
import './DateRangeChips.css';

export const DATE_PRESET_OPTIONS = [
  { value: 'today', label: 'Today' },
  { value: '7d', label: '7d' },
  { value: '30d', label: '30d' },
  { value: '90d', label: '90d' },
  { value: 'custom', label: 'Custom' },
] as const;

export type DatePreset = (typeof DATE_PRESET_OPTIONS)[number]['value'];

interface DateRangeChipsProps {
  selectedPreset: DatePreset;
  customStartDate: string;
  customEndDate: string;
  onPresetChange: (preset: DatePreset) => void;
  onCustomStartDateChange: (value: string) => void;
  onCustomEndDateChange: (value: string) => void;
  onFilterChange?: () => void;
}

export function DateRangeChips({
  selectedPreset,
  customStartDate,
  customEndDate,
  onPresetChange,
  onCustomStartDateChange,
  onCustomEndDateChange,
  onFilterChange,
}: DateRangeChipsProps) {
  const labelId = useId();
  const isFirstRender = useRef(true);
  const onFilterChangeRef = useRef(onFilterChange);

  useEffect(() => {
    onFilterChangeRef.current = onFilterChange;
  }, [onFilterChange]);

  useEffect(() => {
    if (selectedPreset === 'custom') {
      document.getElementById('custom-start-date')?.focus();
    }
  }, [selectedPreset]);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    // Filters have changed; reset any external history cursors to avoid stale data.
    onFilterChangeRef.current?.();
  }, [selectedPreset, customStartDate, customEndDate]);

  return (
    <div className="date-range-chips">
      <span className="th-filter-label" id={labelId}>
        Date Range
      </span>
      <div className="th-chip-group" role="group" aria-labelledby={labelId}>
        {DATE_PRESET_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            className="th-filter-chip"
            aria-pressed={selectedPreset === option.value}
            onClick={() => onPresetChange(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>

      {selectedPreset === 'custom' && (
        <div className="date-range-custom-fields">
          <DatePicker
            id="custom-start-date"
            label="Start date"
            value={customStartDate}
            onChange={onCustomStartDateChange}
            max={customEndDate || undefined}
          />
          <DatePicker
            id="custom-end-date"
            label="End date"
            value={customEndDate}
            onChange={onCustomEndDateChange}
            min={customStartDate || undefined}
          />
        </div>
      )}
    </div>
  );
}
