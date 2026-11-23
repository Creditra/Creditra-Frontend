import { useState, useId, useCallback, useMemo, useEffect, useRef } from 'react';
import { FormField } from '../components/FormField';
import './AutopayPage.css';
import { PendingButton } from '../components/PendingButton';
import { useConfirm } from '../components/ConfirmDialog';
import type { AutopayFrequency } from '../components/AutopaySchedule';
import { AutoPayCard } from './AutoPayCard';
import { fmt } from '../utils/tokens';
import { useCreditLines } from '../hooks/useCreditLines';
import { useWallet } from '../context/WalletContext';
import { useWalletIdentityKey } from '../hooks/useWalletIdentityKey';
import {
  hasOverlappingActiveSchedule,
  useAutopaySchedules,
  type AutopayScheduleRecord,
} from '../state/autopay';
import { getRepayableLines } from '../lib/repay-eligibility';
import { getAccruedInterest } from '../lib/interest';
import { roundToCents } from '../utils/currency';
import {
  getRepayableBalance,
  moneyToNumber,
  SETTLEMENT_ASSET,
} from '../lib/repayable-balance';

// ─── Types ────────────────────────────────────────────────────────────────────

interface AutopayFormState {
  creditLineId: string;
  amount: string;
  frequency: AutopayFrequency;
  startDate: string;
  endDate: string;
}

interface FormErrors {
  creditLineId?: string;
  amount?: string;
  startDate?: string;
  endDate?: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const FREQUENCY_OPTIONS: { value: AutopayFrequency; label: string }[] = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'biweekly', label: 'Every 2 weeks' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
];

const EMPTY_FORM: AutopayFormState = {
  creditLineId: '',
  amount: '',
  frequency: 'monthly',
  startDate: '',
  endDate: '',
};

const CREDIT_LINE_ERROR_ID = 'autopay-credit-line-error';
const AMOUNT_LINE_WARNING_ID = 'autopay-amount-line-warning';
const AMOUNT_WALLET_WARNING_ID = 'autopay-amount-wallet-warning';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Returns today in YYYY-MM-DD (local time) for the `min` attribute on date inputs. */
function todayISO(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function validate(
  form: AutopayFormState,
  repayableLineIds: ReadonlySet<string>,
  activeSchedules: readonly AutopayScheduleRecord[],
  editingId: string | null,
): FormErrors {
  const errors: FormErrors = {};

  if (!form.creditLineId) {
    errors.creditLineId = 'Select a credit line to pay.';
  } else if (!repayableLineIds.has(form.creditLineId)) {
    errors.creditLineId = 'Select an available credit line.';
  }

  const amt = parseFloat(form.amount);
  if (!form.amount || isNaN(amt) || amt <= 0) {
    errors.amount = 'Enter a payment amount greater than $0.';
  } else if (amt > 1_000_000) {
    errors.amount = 'Amount cannot exceed $1,000,000 per payment.';
  }

  if (!form.startDate) {
    errors.startDate = 'Select a start date for the autopay schedule.';
  } else if (form.startDate < todayISO()) {
    errors.startDate = 'Start date cannot be in the past.';
  }

  if (form.endDate) {
    if (form.startDate && form.endDate <= form.startDate) {
      errors.endDate = 'End date must be after the start date.';
    }
  }

  if (
    !errors.creditLineId &&
    !errors.startDate &&
    !errors.endDate &&
    hasOverlappingActiveSchedule(
      activeSchedules,
      {
        creditLineId: form.creditLineId,
        startDate: form.startDate,
        endDate: form.endDate || undefined,
      },
      editingId ?? undefined,
    )
  ) {
    errors.creditLineId =
      'An active autopay schedule already overlaps this date range for the selected credit line.';
  }

  return errors;
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * AutopayPage — form for scheduling recurring credit repayments.
 *
 * Accessibility compliance (WCAG 2.1 AA):
 * - All inputs are associated with visible `<label>` elements via `htmlFor` / `id`.
 * - Required fields carry `aria-required` and a visible `*` indicator with
 *   accompanying screen-reader text.
 * - Errors are wired via `aria-describedby` and use `role="alert"` for live
 *   announcement (handled inside `<FormField>`).
 * - The frequency `<select>` and date inputs use `FormField as="custom"` to
 *   maintain the same describedby wiring.
 * - Focus rings use `focus-visible:ring-2` (Tailwind) / the global
 *   `:focus-visible` rule in `index.css` which provides a 2px accent-color ring.
 * - The cancel confirmation uses `aria-live` so screen readers announce the
 *   cleared state.
 * - Color is never the sole distinguishing factor — error states also add a
 *   border-color change and icon (per WCAG 1.4.1).
 * - All interactive targets are ≥ 44 × 44 CSS px (WCAG 2.5.5).
 * - Dark-mode is handled by CSS custom properties from `index.css`; no
 *   hard-coded colours are used in this component.
 */
export default function AutopayPage() {
  const statusRegionId = useId();
  const freqId = useId();
  const freqHelpId = `${freqId}-help`;

  const { lines } = useCreditLines();
  const { balances } = useWallet();
  const walletKey = useWalletIdentityKey();
  const { activeSchedules, create, update, cancel } = useAutopaySchedules();
  const { confirm, dialog: confirmDialog } = useConfirm();

  const [form, setForm] = useState<AutopayFormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<FormErrors>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [savedBanner, setSavedBanner] = useState<{
    action: 'created' | 'updated';
    amount: number;
    startDate: string;
  } | null>(null);
  const [liveAnnouncement, setLiveAnnouncement] = useState('');

  const isMountedRef = useRef(true);
  const cancelTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const submitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (cancelTimerRef.current !== null) {
        clearTimeout(cancelTimerRef.current);
        cancelTimerRef.current = null;
      }
      if (submitTimerRef.current !== null) {
        clearTimeout(submitTimerRef.current);
        submitTimerRef.current = null;
      }
    };
  }, []);

  // ─── Derived ──────────────────────────────────────────────────────────────

  const repayableLines = useMemo(() => getRepayableLines(lines), [lines]);
  const repayableLineIds = useMemo(
    () => new Set(repayableLines.map((line) => line.id)),
    [repayableLines],
  );
  const selectedLine = useMemo(
    () => repayableLines.find((line) => line.id === form.creditLineId) ?? null,
    [repayableLines, form.creditLineId],
  );
  const selectedLineRepayable = useMemo(() => {
    if (!selectedLine) return null;
    return roundToCents(
      selectedLine.utilized + getAccruedInterest(selectedLine, new Date()),
    );
  }, [selectedLine]);

  const walletBalanceResult = useMemo(
    () => getRepayableBalance(balances ?? null, SETTLEMENT_ASSET),
    [balances],
  );
  const walletUsdcBalance =
    walletBalanceResult.status === 'ok'
      ? moneyToNumber(walletBalanceResult.amount)
      : null;

  const parsedAmount = parseFloat(form.amount) || 0;
  const amountExceedsLine =
    selectedLineRepayable !== null && parsedAmount > selectedLineRepayable;
  const amountExceedsWallet =
    walletUsdcBalance !== null && parsedAmount > walletUsdcBalance;

  const amountDescribedBy = [
    amountExceedsLine ? AMOUNT_LINE_WARNING_ID : '',
    amountExceedsWallet ? AMOUNT_WALLET_WARNING_ID : '',
  ]
    .filter(Boolean)
    .join(' ');

  const hasValidPreview =
    parsedAmount > 0 && !!form.startDate && form.startDate >= todayISO();

  // ─── Handlers ─────────────────────────────────────────────────────────────

  const announce = useCallback((message: string) => {
    setLiveAnnouncement(message);
  }, []);

  const handleChange = useCallback(
    <K extends keyof AutopayFormState>(field: K, value: AutopayFormState[K]) => {
      setForm(prev => ({ ...prev, [field]: value }));
      // Clear the field's error on change so the user gets real-time relief.
      setErrors(prev => {
        if (!prev[field as keyof FormErrors]) return prev;
        const next = { ...prev };
        delete next[field as keyof FormErrors];
        return next;
      });
      setSavedBanner(null);
    },
    [],
  );

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!walletKey) {
        setErrors({
          creditLineId: 'Connect your wallet to save an autopay schedule.',
        });
        document.getElementById('autopay-credit-line')?.focus();
        return;
      }

      const errs = validate(form, repayableLineIds, activeSchedules, editingId);
      if (Object.keys(errs).length > 0) {
        setErrors(errs);
        // Move focus to the first errored field
        const firstErrorId = errs.creditLineId
          ? 'autopay-credit-line'
          : errs.amount
            ? 'autopay-amount'
            : errs.startDate
              ? 'autopay-start'
              : 'autopay-end';
        document.getElementById(firstErrorId)?.focus();
        return;
      }

      const amount = parseFloat(form.amount);
      try {
        if (editingId) {
          update(editingId, {
            creditLineId: form.creditLineId,
            amount,
            frequency: form.frequency,
            startDate: form.startDate,
            endDate: form.endDate || undefined,
          });
          setSavedBanner({
            action: 'updated',
            amount,
            startDate: form.startDate,
          });
          announce('Autopay schedule updated successfully.');
          setEditingId(null);
        } else {
          create({
            creditLineId: form.creditLineId,
            amount,
            frequency: form.frequency,
            startDate: form.startDate,
            endDate: form.endDate || undefined,
          });
          setSavedBanner({
            action: 'created',
            amount,
            startDate: form.startDate,
          });
          announce('Autopay schedule saved successfully.');
        }
        setForm(EMPTY_FORM);
        setErrors({});
      } catch (err) {
        setErrors({
          creditLineId:
            err instanceof Error ? err.message : 'Unable to save autopay schedule.',
        });
        document.getElementById('autopay-credit-line')?.focus();
      }
      await new Promise<void>(resolve => {
        if (submitTimerRef.current !== null) {
          clearTimeout(submitTimerRef.current);
        }
        submitTimerRef.current = setTimeout(() => {
          submitTimerRef.current = null;
          resolve();
        }, 1200);
      });
      if (!isMountedRef.current) return;
    },
    [walletKey, form, repayableLineIds, activeSchedules, editingId, create, update, announce],
  );

  const handleCancel = useCallback(() => {
    setForm(EMPTY_FORM);
    setErrors({});
    setSavedBanner(null);
    const wasEditing = editingId !== null;
    setEditingId(null);
    announce(wasEditing ? 'Schedule edit cancelled.' : 'Autopay schedule cleared.');
  }, [editingId, announce]);

  const handleEditSchedule = useCallback(
    (record: AutopayScheduleRecord) => {
      setEditingId(record.id);
      setForm({
        creditLineId: record.creditLineId,
        amount: String(record.amount),
        frequency: record.frequency,
        startDate: record.startDate,
        endDate: record.endDate ?? '',
      });
      setErrors({});
      setSavedBanner(null);
      announce('Editing autopay schedule.');
      document.getElementById('autopay-amount')?.focus();
    },
    [announce],
  );

  const handleCancelSchedule = useCallback(
    async (record: AutopayScheduleRecord) => {
      const lineName =
        lines.find((line) => line.id === record.creditLineId)?.name ?? record.creditLineId;
      const confirmed = await confirm({
        title: 'Cancel autopay schedule?',
        body: `This will stop automatic ${fmt(record.amount)} payments for ${lineName}. You can create a new schedule anytime.`,
        confirmLabel: 'Cancel Schedule',
        cancelLabel: 'Keep Schedule',
        variant: 'danger',
      });
      if (!confirmed) return;

      cancel(record.id);
      if (editingId === record.id) {
        setEditingId(null);
        setForm(EMPTY_FORM);
        setErrors({});
      }
      setSavedBanner(null);
      announce(`Autopay schedule for ${lineName} cancelled.`);
    },
    [lines, confirm, cancel, editingId, announce],
  );
    if (cancelTimerRef.current !== null) {
      clearTimeout(cancelTimerRef.current);
    }
    cancelTimerRef.current = setTimeout(() => {
      cancelTimerRef.current = null;
      setCancelAnnouncement('');
    }, 4000);

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="autopay-page">
      {/* ── Page header ───────────────────────────────────────────────────── */}
      <header className="autopay-page__header">
        <h1 className="autopay-page__title">Autopay Schedule</h1>
        <p className="autopay-page__subtitle">
          Set up recurring repayments and preview your upcoming payment dates
          before activating.
        </p>
      </header>

      {/* ── Live region for save / edit / cancel announcements ────────────── */}
      <div
        id={statusRegionId}
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {liveAnnouncement}
      </div>

      {/* ── Success banner ────────────────────────────────────────────────── */}
      {savedBanner && (
        <div
          className="autopay-page__success-banner"
          role="alert"
          aria-live="assertive"
        >
          <span className="autopay-page__success-icon" aria-hidden="true">
            ✅
          </span>
          <span>
            <strong>
              {savedBanner.action === 'updated'
                ? 'Autopay updated.'
                : 'Autopay activated.'}
            </strong>{' '}
            Your payment of {fmt(savedBanner.amount)} is scheduled for{' '}
            {savedBanner.startDate
              ? new Date(savedBanner.startDate + 'T00:00:00').toLocaleDateString(
                  'en-US',
                  { month: 'long', day: 'numeric', year: 'numeric' },
                )
              : '—'}
            .
          </span>
        </div>
      )}

      <div className="autopay-page__layout">
        {/* ── Form column ─────────────────────────────────────────────────── */}
        <div className="autopay-page__form-col">
          <div className="card">
            <h2 className="autopay-page__section-title">
              <span className="icon" aria-hidden="true">
                🔁
              </span>{' '}
              Configure Schedule
            </h2>

            <form
              onSubmit={handleSubmit}
              noValidate
              aria-label="Autopay schedule configuration"
            >
              {/* Credit line */}
              <div className="form-field">
                <label htmlFor="autopay-credit-line" className="form-field__label">
                  Credit Line
                  <span className="form-field__required" aria-label="required">
                    *
                  </span>
                </label>
                <p id="autopay-credit-line-help" className="form-field__help">
                  The credit line this autopay schedule repays.
                </p>
                <select
                  id="autopay-credit-line"
                  value={form.creditLineId}
                  onChange={e => handleChange('creditLineId', e.target.value)}
                  required
                  aria-required="true"
                  aria-describedby={`autopay-credit-line-help${
                    errors.creditLineId ? ` ${CREDIT_LINE_ERROR_ID}` : ''
                  }`}
                  aria-invalid={!!errors.creditLineId}
                  className={`form-field__input autopay-page__select${
                    errors.creditLineId ? ' form-field__input--error' : ''
                  }`}
                >
                  <option value="">Select a credit line</option>
                  {repayableLines.map(line => (
                    <option key={line.id} value={line.id}>
                      {line.name} — {fmt(line.utilized)} outstanding
                    </option>
                  ))}
                </select>
                {repayableLines.length === 0 && (
                  <p className="form-field__help">
                    No repayable credit lines are available.
                  </p>
                )}
                {errors.creditLineId && (
                  <div
                    id={CREDIT_LINE_ERROR_ID}
                    className="form-field__error"
                    role="alert"
                  >
                    {errors.creditLineId}
                  </div>
                )}
              </div>

              {/* Amount */}
              <FormField
                id="autopay-amount"
                name="amount"
                label="Payment Amount"
                type="number"
                required
                helpText="Amount to deduct on each scheduled date."
                describedBy={amountDescribedBy}
                value={form.amount}
                onChange={value => handleChange('amount', value)}
                placeholder="0.00"
                error={errors.amount}
              />

              {amountExceedsLine && selectedLineRepayable !== null && (
                <p
                  id={AMOUNT_LINE_WARNING_ID}
                  className="autopay-page__warning"
                  role="status"
                >
                  <span aria-hidden="true">⚠️ </span>
                  This amount exceeds the line&apos;s repayable balance of{' '}
                  {fmt(selectedLineRepayable)}. The schedule may fail when it runs.
                </p>
              )}

              {amountExceedsWallet && walletUsdcBalance !== null && (
                <p
                  id={AMOUNT_WALLET_WARNING_ID}
                  className="autopay-page__warning"
                  role="status"
                >
                  <span aria-hidden="true">⚠️ </span>
                  This amount exceeds your {SETTLEMENT_ASSET.code} wallet balance
                  of {fmt(walletUsdcBalance)}. Add funds before the next payment.
                </p>
              )}

              {/* Frequency — custom render so the <select> gets the same
                  describedby wiring as other FormField controls. */}
              <div className="form-field">
                <label
                  htmlFor={freqId}
                  className="form-field__label"
                >
                  Frequency
                  <span className="form-field__required" aria-label="required">
                    *
                  </span>
                </label>
                <p id={freqHelpId} className="form-field__help">
                  How often the payment will be automatically deducted.
                </p>
                <select
                  id={freqId}
                  value={form.frequency}
                  onChange={e =>
                    handleChange('frequency', e.target.value as AutopayFrequency)
                  }
                  required
                  aria-required="true"
                  aria-describedby={freqHelpId}
                  aria-invalid={false}
                  className="form-field__input autopay-page__select"
                >
                  {FREQUENCY_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Start date */}
              <div className="form-field">
                <label htmlFor="autopay-start" className="form-field__label">
                  Start Date
                  <span className="form-field__required" aria-label="required">
                    *
                  </span>
                </label>
                <p id="autopay-start-help" className="form-field__help">
                  The date of your first automatic payment.
                </p>
                <input
                  id="autopay-start"
                  type="date"
                  value={form.startDate}
                  min={todayISO()}
                  onChange={e => handleChange('startDate', e.target.value)}
                  required
                  aria-required="true"
                  aria-describedby={`autopay-start-help${
                    errors.startDate ? ' autopay-start-error' : ''
                  }`}
                  aria-invalid={!!errors.startDate}
                  className={`form-field__input${
                    errors.startDate ? ' form-field__input--error' : ''
                  }`}
                />
                {errors.startDate && (
                  <div
                    id="autopay-start-error"
                    className="form-field__error"
                    role="alert"
                  >
                    {errors.startDate}
                  </div>
                )}
              </div>

              {/* End date (optional) */}
              <div className="form-field">
                <label htmlFor="autopay-end" className="form-field__label">
                  End Date
                </label>
                <p id="autopay-end-help" className="form-field__help">
                  Leave blank for an open-ended schedule.
                </p>
                <input
                  id="autopay-end"
                  type="date"
                  value={form.endDate}
                  min={form.startDate || todayISO()}
                  onChange={e => handleChange('endDate', e.target.value)}
                  aria-describedby={`autopay-end-help${
                    errors.endDate ? ' autopay-end-error' : ''
                  }`}
                  aria-invalid={!!errors.endDate}
                  className={`form-field__input${
                    errors.endDate ? ' form-field__input--error' : ''
                  }`}
                />
                {errors.endDate && (
                  <div
                    id="autopay-end-error"
                    className="form-field__error"
                    role="alert"
                  >
                    {errors.endDate}
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="autopay-page__actions">
                <PendingButton
                  type="submit"
                  pending={false}
                  pendingLabel="Saving…"
                  className="autopay-page__btn autopay-page__btn--primary"
                >
                  {editingId ? 'Save Changes' : 'Activate Autopay'}
                </PendingButton>

                <button
                  type="button"
                  onClick={handleCancel}
                  className="autopay-page__btn autopay-page__btn--cancel"
                  aria-label={
                    editingId
                      ? 'Cancel editing autopay schedule'
                      : 'Cancel autopay — clears the current schedule'
                  }
                >
                  {editingId ? 'Cancel Edit' : 'Cancel Autopay'}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* ── Preview column ──────────────────────────────────────────────── */}
        <div className="autopay-page__preview-col">
          <AutoPayCard
            hasValidPreview={hasValidPreview}
            parsedAmount={parsedAmount}
            frequency={form.frequency}
            startDate={form.startDate}
            endDate={form.endDate || undefined}
            creditLineName={selectedLine?.name}
            creditLineBalance={selectedLineRepayable ?? undefined}
            walletKey={walletKey}
            creditLineId={form.creditLineId || undefined}
          />
        </div>
      </div>

      {/* ── Active Schedules List ─────────────────────────────────────────── */}
      <section
        className="card autopay-page__schedules"
        aria-labelledby="autopay-schedules-heading"
        style={{ marginTop: 'var(--space-6)' }}
      >
        <h2 id="autopay-schedules-heading" className="autopay-page__section-title">
          Active Autopay Schedules
        </h2>

        {activeSchedules.length === 0 ? (
          <p className="form-field__help">
            No active autopay schedules saved for this wallet yet.
          </p>
        ) : (
          <ul
            className="autopay-page__schedule-list"
            style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 'var(--space-3)' }}
          >
            {activeSchedules.map((record) => {
              const lineName =
                lines.find((line) => line.id === record.creditLineId)?.name ??
                record.creditLineId;
              const freqLabel =
                FREQUENCY_OPTIONS.find((opt) => opt.value === record.frequency)?.label ??
                record.frequency;

              return (
                <li
                  key={record.id}
                  className="autopay-page__schedule-item"
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: 'var(--space-3)',
                    padding: 'var(--space-4)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-md)',
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600 }}>{lineName}</div>
                    <div className="form-field__help" style={{ margin: 0 }}>
                      {fmt(record.amount)} · {freqLabel} · Starts {record.startDate}
                      {record.endDate ? ` · Ends ${record.endDate}` : ''}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                    <button
                      type="button"
                      className="autopay-page__btn autopay-page__btn--cancel"
                      onClick={() => handleEditSchedule(record)}
                      aria-label={`Edit autopay schedule for ${lineName}`}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="autopay-page__btn autopay-page__btn--cancel"
                      onClick={() => {
                        void handleCancelSchedule(record);
                      }}
                      aria-label={`Cancel autopay schedule for ${lineName}`}
                    >
                      Cancel
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {confirmDialog}
    </div>
  );
}
