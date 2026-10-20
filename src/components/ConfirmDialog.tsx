/**
 * ConfirmDialog — Reusable accessible confirmation dialog and `useConfirm` hook.
 *
 * Accessibility features:
 * - `role="alertdialog"`, `aria-modal="true"`, `aria-labelledby`, and `aria-describedby`
 * - Focus moves to the least destructive action (Cancel) on open via `useFocusTrap`
 *   (Cancel is rendered first in the DOM per `docs/BUTTON_ORDER.md`)
 * - Focus is trapped inside and returns to the trigger element on close
 * - Escape key and backdrop click cancel the dialog
 * - Background scroll locked via `useBodyScrollLock`
 * - Background content marked inert via `useInertBackdrop`
 * - Button order follows `docs/BUTTON_ORDER.md`: Cancel (leftmost) -> Confirm (rightmost)
 * - 44x44px minimum touch targets, works at 320px viewport width
 */

import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';
import { useInertBackdrop } from '../hooks/useInertBackdrop';
import './ConfirmDialog.css';

export interface ConfirmOptions {
  /** Dialog heading / title */
  title: string;
  /** Explanatory consequence message */
  body: string;
  /** Label for the confirm action button (e.g. "Disconnect Google") */
  confirmLabel?: string;
  /** Label for the cancel action button (defaults to "Cancel") */
  cancelLabel?: string;
  /** Visual style for the confirm button (defaults to 'danger') */
  variant?: 'danger' | 'primary';
}

export interface ConfirmDialogProps extends ConfirmOptions {
  /** Whether the dialog is open */
  isOpen: boolean;
  /** Called when the user confirms the action */
  onConfirm: () => void;
  /** Called when the user cancels (Cancel button, Escape, or backdrop click) */
  onCancel: () => void;
  /** Optional ref to the element that triggered the dialog (for return focus) */
  triggerRef?: React.RefObject<HTMLElement | null>;
}

/**
 * Accessible confirmation modal dialog (`role="alertdialog"`).
 *
 * Reuses `useFocusTrap`, `useBodyScrollLock`, and `useInertBackdrop`.
 * Because Cancel is the first focusable element in the dialog (matching
 * `docs/BUTTON_ORDER.md`: Cancel -> Primary), `useFocusTrap` automatically
 * moves initial focus to Cancel on open, and focuses Cancel immediately
 * on mount so keyboard users start on the least destructive action.
 */
export function ConfirmDialog({
  isOpen,
  title,
  body,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'danger',
  onConfirm,
  onCancel,
  triggerRef,
}: ConfirmDialogProps) {
  const reactId = useId();
  const modalId = `confirm-dialog-portal-${reactId}`;
  const titleId = `confirm-dialog-title-${reactId}`;
  const bodyId = `confirm-dialog-body-${reactId}`;
  const cancelBtnRef = useRef<HTMLButtonElement>(null);

  const containerRef = useFocusTrap({
    isActive: isOpen,
    triggerRef,
    onEscape: onCancel,
  });

  useBodyScrollLock({ isLocked: isOpen });
  useInertBackdrop({ isInert: isOpen, modalId });

  // Focus the least destructive action (Cancel) immediately on open, in addition
  // to useFocusTrap's 50ms deferred focus, so synchronous assertions and
  // immediate keyboard interactions land on Cancel right away.
  useEffect(() => {
    if (isOpen) {
      cancelBtnRef.current?.focus();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div id={modalId} className="confirm-dialog-portal" data-testid="confirm-dialog-portal">
      {/* Backdrop: click cancels */}
      <div
        className="confirm-dialog-backdrop"
        data-testid="confirm-dialog-backdrop"
        aria-hidden="true"
        onClick={onCancel}
      />

      {/* Alert dialog container */}
      <div
        ref={containerRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={bodyId}
        className="confirm-dialog"
      >
        <h2 id={titleId} className="confirm-dialog__title">
          {title}
        </h2>

        <p id={bodyId} className="confirm-dialog__body">
          {body}
        </p>

        {/* Button order: Cancel (exit) -> Primary/Destructive (confirm)
            See docs/BUTTON_ORDER.md */}
        <div className="confirm-dialog__footer">
          <button
            ref={cancelBtnRef}
            type="button"
            className="confirm-dialog__btn confirm-dialog__btn--cancel btn-secondary btn-sm"
            onClick={onCancel}
          >
            {cancelLabel}
          </button>

          <button
            type="button"
            className={`confirm-dialog__btn ${
              variant === 'danger'
                ? 'confirm-dialog__btn--danger btn-danger btn-sm'
                : 'confirm-dialog__btn--primary btn-sm'
            }`}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

interface PendingConfirmation {
  options: ConfirmOptions;
  resolve: (confirmed: boolean) => void;
}

/**
 * Promise-friendly hook for controlling a single `ConfirmDialog` instance.
 *
 * - Call `await confirm({ title, body, confirmLabel })` to open the dialog and
 *   await the user's choice (`true` when confirmed, `false` when cancelled).
 * - Only one dialog can be open at a time; calling `confirm()` while a dialog
 *   is already open immediately resolves the previous promise with `false`
 *   (cancelled) and replaces the dialog with the new request.
 */
export function useConfirm() {
  const [pending, setPending] = useState<PendingConfirmation | null>(null);
  const pendingRef = useRef<PendingConfirmation | null>(null);
  const triggerRef = useRef<HTMLElement | null>(null);

  const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    // If a dialog is already open, resolve the first as false (cancelled)
    if (pendingRef.current) {
      pendingRef.current.resolve(false);
      pendingRef.current = null;
    }

    // Capture the element that triggered the confirmation for focus return
    if (typeof document !== 'undefined' && document.activeElement instanceof HTMLElement) {
      triggerRef.current = document.activeElement;
    }

    return new Promise<boolean>((resolve) => {
      const next: PendingConfirmation = { options, resolve };
      pendingRef.current = next;
      setPending(next);
    });
  }, []);

  const handleConfirm = useCallback(() => {
    const current = pendingRef.current;
    pendingRef.current = null;
    setPending(null);
    current?.resolve(true);
  }, []);

  const handleCancel = useCallback(() => {
    const current = pendingRef.current;
    pendingRef.current = null;
    setPending(null);
    current?.resolve(false);
  }, []);

  // Clean up any unresolved confirmation on unmount
  useEffect(() => {
    return () => {
      if (pendingRef.current) {
        pendingRef.current.resolve(false);
        pendingRef.current = null;
      }
    };
  }, []);

  const confirmDialogProps: ConfirmDialogProps = {
    isOpen: pending !== null,
    title: pending?.options.title ?? '',
    body: pending?.options.body ?? '',
    confirmLabel: pending?.options.confirmLabel ?? 'Confirm',
    cancelLabel: pending?.options.cancelLabel ?? 'Cancel',
    variant: pending?.options.variant ?? 'danger',
    onConfirm: handleConfirm,
    onCancel: handleCancel,
    triggerRef,
  };

  const dialog = <ConfirmDialog {...confirmDialogProps} />;

  return {
    confirm,
    dialog,
    confirmDialogProps,
    isOpen: pending !== null,
  };
}
