import { useId } from 'react';
import { createPortal } from 'react-dom';
import type { CSSProperties, ReactNode, RefObject } from 'react';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';
import { useInertBackdrop } from '../hooks/useInertBackdrop';
import './Sheet.css';

interface SheetProps {
  isOpen: boolean;
  side: 'bottom' | 'right';
  ariaLabelledBy: string;
  onClose: () => void;
  children: ReactNode;
  portalId?: string;
  dialogId?: string;
  ariaDescribedBy?: string;
  triggerRef?: RefObject<HTMLElement | null>;
  initialFocusRef?: RefObject<HTMLElement | null>;
  portalClassName?: string;
  backdropClassName?: string;
  panelClassName?: string;
  panelStyle?: CSSProperties;
}

export function Sheet({
  isOpen,
  side,
  ariaLabelledBy,
  onClose,
  children,
  portalId,
  dialogId,
  ariaDescribedBy,
  triggerRef,
  initialFocusRef,
  portalClassName = '',
  backdropClassName = '',
  panelClassName = '',
  panelStyle,
}: SheetProps) {
  const generatedId = useId();
  const resolvedPortalId = portalId ?? `sheet-${generatedId}`;
  const panelRef = useFocusTrap({ isActive: isOpen, triggerRef, initialFocusRef });

  useBodyScrollLock({ isLocked: isOpen });
  useInertBackdrop({ isInert: isOpen, modalId: resolvedPortalId });

  if (!isOpen) return null;

  return createPortal(
    <div
      id={resolvedPortalId}
      className={`sheet-portal sheet-portal--${side} ${portalClassName}`.trim()}
      data-sheet-side={side}
    >
      <div
        className={`sheet-backdrop ${backdropClassName}`.trim()}
        aria-hidden="true"
        onClick={(event) => {
          event.stopPropagation();
          onClose();
        }}
      />
      <div
        id={dialogId}
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={ariaLabelledBy}
        aria-describedby={ariaDescribedBy}
        className={`sheet-panel ${panelClassName}`.trim()}
        style={panelStyle}
        tabIndex={-1}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.preventDefault();
            event.stopPropagation();
            onClose();
          }
        }}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}
