import { relativeTime as formatCalendarRelative } from "../../utils/dates";
import { now as clockNow } from "../../lib/clock";

export const relativeTime = (iso: string): string =>
  formatCalendarRelative(iso, clockNow());
