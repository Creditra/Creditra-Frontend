import React, { useEffect, useId } from 'react';
import { createPortal } from 'react-dom';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';
import { useInertBackdrop } from '../hooks/useInertBackdrop';

export type ModalRole = 'dialog' | 'alertdialog';

export interface ModalProps {
  isOpen: boolean;
  children: React.ReactNode;
  role?: ModalRole;
  id?: string;
  ariaLabelledBy?: string;
  ariaDescribedBy?: string;
  triggerRef?: React.RefObject<HTMLElement | null>;
  initialFocusRef?: React.RefObject<HTMLElement | null>;
  dialogRef?: React.RefObject<HTMLDivElement | null>;
  onEscape?: () => void;
  onClose?: () => void;
  onBackdropClick?: () => void;
  closeOnEscape?: boolean;
  closeOnBackdropClick?: boolean;
  backdropDismissible?: boolean;
  overlayClassName?: string;
  dialogClassName?: string;
  overlayStyle?: React.CSSProperties;
  dialogStyle?: React.CSSProperties;
  backdropClassName?: string;
  backdropStyle?: React.CSSProperties;
  backdropTestId?: string;
  dataTestId?: string;
  portalContainer?: HTMLElement | null;
  focusTrapActive?: boolean;
  siblings?: React.ReactNode;
}

export function Modal({
  isOpen,
  children,
  role = 'dialog',
  id,
  ariaLabelledBy,
  ariaDescribedBy,
  triggerRef,
  initialFocusRef,
  dialogRef,
  onEscape,
  onClose,
  onBackdropClick,
  closeOnEscape = true,
  closeOnBackdropClick = true,
  backdropDismissible,
  overlayClassName,
  dialogClassName,
  overlayStyle,
  dialogStyle,
  backdropClassName,
  backdropStyle,
  backdropTestId,
  dataTestId,
  portalContainer,
  focusTrapActive = true,
  siblings,
}: ModalProps) {
  const reactId = useId();
  const modalId = id ?? `modal-portal-${reactId}`;
  const escapeHandler = onEscape ?? onClose;
  const containerRef = useFocusTrap({
    isActive: isOpen && (focusTrapActive ?? true),
    triggerRef,
    onEscape: closeOnEscape ? escapeHandler : undefined,
  });

  useBodyScrollLock({ isLocked: isOpen });
  useInertBackdrop({ isInert: isOpen, modalId });

  useEffect(() => {
    if (isOpen) initialFocusRef?.current?.focus();
  }, [isOpen, initialFocusRef]);

  useEffect(() => {
    if (!dialogRef) return;
    const dialog = containerRef.current;
    if ('current' in dialogRef) {
      (dialogRef as React.MutableRefObject<HTMLDivElement | null>).current = dialog;
    }
  }, [isOpen, dialogRef, containerRef]);

  if (!isOpen || typeof document === 'undefined') return null;

  const backdropHandler = onBackdropClick ?? onClose;
  const backdropEnabled = backdropDismissible ?? closeOnBackdropClick;

  const backdrop = backdropHandler && backdropEnabled ? (
    <div
      id={`${modalId}-backdrop`}
      className={backdropClassName}
      style={backdropStyle}
      data-testid={backdropTestId}
      aria-hidden="true"
      onClick={backdropHandler}
    />
  ) : null;

  const content = (
    <div
      id={modalId}
      className={overlayClassName}
      style={overlayStyle}
      role="presentation"
      data-testid={dataTestId}
      onClick={(event) => {
        event.stopPropagation();
        if (event.target === event.currentTarget && backdropEnabled) backdropHandler?.();
      }}
    >
      {backdrop}
      <div
        ref={containerRef}
        role={role}
        aria-modal="true"
        aria-labelledby={ariaLabelledBy}
        aria-describedby={ariaDescribedBy}
        className={dialogClassName}
        style={dialogStyle}
        tabIndex={-1}
      >
        {children}
      </div>
      {siblings}
    </div>
  );

  return createPortal(content, portalContainer ?? document.body);
}
