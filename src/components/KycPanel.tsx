import type React from "react";
import { KycBottomSheet } from "./KycBottomSheet";
import { KycDrawer } from "./KycDrawer";
import { BELOW_MD_MEDIA, useMediaQuery } from "../hooks/useMediaQuery";

export interface KycPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onResume: (stepId: string) => void;
  triggerRef?: React.RefObject<HTMLElement | null>;
}

/**
 * Renders the KYC progress panel as a bottom sheet on narrow viewports
 * (`max-width: 767px`) and a right-side drawer on wider viewports.
 * Only one variant is mounted at a time so modal IDs and focus traps never clash.
 */
export function KycPanel(props: KycPanelProps) {
  const isNarrow = useMediaQuery(BELOW_MD_MEDIA);

  if (isNarrow) {
    return <KycBottomSheet {...props} />;
  }

  return <KycDrawer {...props} />;
}
