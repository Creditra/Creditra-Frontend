/**
 * AmountInput Page Wrapper
 *
 * Re-exports AmountInput and AmountInputSkeleton from components, providing a responsive
 * container page layout for narrow (mobile <=375px) viewports through desktop breakpoints.
 */

import { AmountInput as AmountInputComponent, AmountInputProps } from "@/components/AmountInput";

export { AmountInput, AmountInputSkeleton } from "@/components/AmountInput";
export type { AmountInputProps } from "@/components/AmountInput";

/**
 * AmountInputPage — Responsive page wrapper for AmountInput.
 */
export function AmountInputPage(props: AmountInputProps) {
  return (
    <div className="w-full max-w-xl mx-auto px-3 sm:px-6 py-4 sm:py-8 overflow-x-hidden">
      <AmountInputComponent {...props} />
    </div>
  );
}

export default AmountInputComponent;
