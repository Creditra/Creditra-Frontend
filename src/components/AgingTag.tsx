import { Clock } from 'lucide-react';
import { STATUS_COLOR } from '../utils/tokens';
import { KbdHint } from './KbdHint';
import './AgingTag.css';

interface AgingTagProps {
  /** The number of days the line is past due. */
  daysPastDue: number;
  /** Optional tooltip text shown on hover. */
  title?: string;
  /** Optional additional class names appended to the tag. */
  className?: string;
  /** Optional keyboard shortcut key(s) to display. Defaults to 'R'. */
  shortcutKey?: string | string[];
}

/**
 * A tag to visually flag delinquent credit lines.
 *
 * Renders in a high-contrast danger (Defaulted) colour scheme
 * when daysPastDue > 0. Uses the Clock icon to provide a visual cue
 * alongside the text.
 *
 * Accessibility: The icon is hidden from screen readers since the text
 * already explicitly states "X days past due", avoiding redundant announcements.
 */
export function AgingTag({
  daysPastDue,
  title = `${daysPastDue} days past due`,
  className = '',
  shortcutKey = 'R',
}: AgingTagProps) {
  if (daysPastDue <= 0) return null;

  // Use the "Defaulted" (danger) color palette for delinquent lines
  const { bg, color, border } = STATUS_COLOR.Defaulted;
  const classes = ['aging-tag', className].filter(Boolean).join(' ');

  return (
    <span
      className={classes}
      style={{ background: bg, color, borderColor: border }}
      title={title}
    >
      <Clock size={12} className="aging-tag__icon" aria-hidden="true" />
      <span>{daysPastDue} days past due</span>
      <KbdHint
        keys={shortcutKey}
        variant="inline"
        className="aging-tag__shortcut"
        description="Repay delinquent line"
      />
    </span>
  );
}
