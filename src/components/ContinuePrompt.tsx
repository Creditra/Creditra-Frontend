/**
 * ContinuePrompt
 *
 * Small region surfaced on the Dashboard (and any other entry point that
 * wants to invite the user back into a recent flow) that points at the
 * most-recently-updated credit line.
 *
 * Renders nothing when the caller passes an empty list so the parent
 * can drop the component in unconditionally without an extra guard.
 */

import { Link } from "react-router-dom";
import type { CreditLine } from "../types/creditLine";

interface ContinuePromptProps {
  creditLines: CreditLine[];
}

export function ContinuePrompt({ creditLines }: ContinuePromptProps) {
  if (creditLines.length === 0) return null;

  const recent = [...creditLines].sort(
    (a, b) =>
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  )[0];

  return (
    <section
      className="continue-prompt"
      role="region"
      aria-label="Continue where you left off"
    >
      <h3 className="continue-prompt__title">Continue with {recent.name}</h3>
      <p className="continue-prompt__body">
        Pick up your most-recent credit line activity.
      </p>
      <Link
        to={`/credit-lines`}
        className="continue-prompt__action"
        aria-label={`Open ${recent.name}`}
      >
        Open {recent.name} →
      </Link>
    </section>
  );
}