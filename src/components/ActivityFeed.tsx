import { useEffect, useMemo, useRef } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { NoActivity } from "./illustrations";
import { MOCK_CREDIT_LINES } from "../data/mockData";
import type { Transaction, TransactionType } from "../types/creditLine";
import { COLOR, fmt } from "../utils/tokens";

type FeedEvent = Transaction & {
  lineId: string;
  lineName: string;
};

type ActivityGroup = {
  id: string;
  type: TransactionType;
  count: number;
  totalAmount: number;
  latestDate: string;
  latestNote?: string;
  lineNames: string[];
};

const TX_ICON: Record<TransactionType, string> = {
  Draw: "↗",
  Repay: "↙",
  Fee: "📋",
  Interest: "📈",
  StatusChange: "🔄",
};

const TX_COLOR: Record<TransactionType, string> = {
  Draw: COLOR.danger,
  Repay: COLOR.success,
  Fee: COLOR.muted,
  Interest: COLOR.warning,
  StatusChange: COLOR.muted,
};

const TX_LABEL: Record<TransactionType, { singular: string; plural: string }> = {
  Draw: { singular: "Draw", plural: "Draws" },
  Repay: { singular: "Repayment", plural: "Repayments" },
  Fee: { singular: "Fee", plural: "Fees" },
  Interest: { singular: "Interest charge", plural: "Interest charges" },
  StatusChange: { singular: "Status change", plural: "Status changes" },
};

const relativeTimeFormatter = new Intl.RelativeTimeFormat("en", {
  numeric: "auto",
});

export function formatRelative(iso: string, baseDate = new Date()): string {
  const targetDate = new Date(iso);
  const diffMs = targetDate.getTime() - baseDate.getTime();

  if (Number.isNaN(targetDate.getTime())) {
    return "";
  }

  const minutes = Math.round(diffMs / 60000);
  if (Math.abs(minutes) < 60) {
    return relativeTimeFormatter.format(minutes, "minute");
  }

  const hours = Math.round(diffMs / 3600000);
  if (Math.abs(hours) < 24) {
    return relativeTimeFormatter.format(hours, "hour");
  }

  const days = Math.round(diffMs / 86400000);
  if (Math.abs(days) < 7) {
    return relativeTimeFormatter.format(days, "day");
  }

  return targetDate.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getGroupedActivity(events: FeedEvent[]): ActivityGroup[] {
  return events.reduce<ActivityGroup[]>((groups, event) => {
    const previousGroup = groups[groups.length - 1];

    if (previousGroup?.type === event.type) {
      previousGroup.count += 1;
      previousGroup.totalAmount += Math.abs(event.amount);
      if (!previousGroup.lineNames.includes(event.lineName)) {
        previousGroup.lineNames.push(event.lineName);
      }
      return groups;
    }

    groups.push({
      id: event.id,
      type: event.type,
      count: 1,
      totalAmount: Math.abs(event.amount),
      latestDate: event.date,
      latestNote: event.note,
      lineNames: [event.lineName],
    });

    return groups;
  }, []);
}

function getAmountLabel(group: ActivityGroup): string | null {
  if (group.type === "StatusChange") {
    return null;
  }

  return `${group.type === "Repay" ? "+" : "-"}${fmt(group.totalAmount)}`;
}

function getSubtitle(group: ActivityGroup): string {
  const lineLabel =
    group.lineNames.length === 1
      ? group.lineNames[0]
      : `${group.lineNames.length} credit lines`;

  return `${lineLabel} · ${formatRelative(group.latestDate)}`;
}

function getTitle(group: ActivityGroup): string {
  if (group.count === 1) {
    return group.latestNote || TX_LABEL[group.type].singular;
  }

  return TX_LABEL[group.type].plural;
}

export function ActivityFeed() {
  const [searchParams, setSearchParams] = useSearchParams();
  const filterKeyString = ["range", "start", "end"]
    .map((key) => searchParams.get(key) ?? "")
    .join("|");
  const prevFilterKeyStringRef = useRef(filterKeyString);

  useEffect(() => {
    if (prevFilterKeyStringRef.current !== filterKeyString) {
      prevFilterKeyStringRef.current = filterKeyString;
      if (searchParams.has("cursor")) {
        const nextSearchParams = new URLSearchParams(searchParams);
        nextSearchParams.delete("cursor");
        setSearchParams(nextSearchParams, { replace: true });
      }
    }
  }, [filterKeyString, searchParams, setSearchParams]);

  const events = useMemo<FeedEvent[]>(() => {
    return MOCK_CREDIT_LINES.flatMap((line) =>
      line.transactions.map((transaction) => ({
        ...transaction,
        lineId: line.id,
        lineName: line.name,
      })),
    )
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 10);
  }, []);

  const groupedEvents = useMemo(() => getGroupedActivity(events), [events]);

  const transactionsSearch = useMemo(() => {
    const nextSearchParams = new URLSearchParams();

    ["range", "start", "end"].forEach((key) => {
      const value = searchParams.get(key);
      if (value) {
        nextSearchParams.set(key, value);
      }
    });

    const queryString = nextSearchParams.toString();
    return queryString ? `?${queryString}` : "";
  }, [searchParams]);

  return (
    <section
      className="card"
      style={{ animationDelay: "0.08s", marginTop: "1rem" }}
      aria-label="Activity feed"
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "1rem",
          marginBottom: "0.5rem",
        }}
      >
        <h2 style={{ margin: 0 }}>
          <span className="icon">📝</span> Activity Feed
        </h2>
        <Link to={`/transactions${transactionsSearch}`} className="view-all-link" style={{ marginTop: 0, padding: 0 }}>
          See all
        </Link>
      </div>

      {groupedEvents.length === 0 ? (
        <div className="empty-state">
          <NoActivity className="empty-state-illustration--muted" />
          <h2>No activity yet</h2>
          <p>Your latest transaction events will appear here as activity starts coming in.</p>
        </div>
      ) : (
        groupedEvents.map((group) => {
          const amountLabel = getAmountLabel(group);

          return (
            <div key={group.id} className="activity-item">
              <div
                className="activity-icon"
                style={{
                  background: `${TX_COLOR[group.type]}15`,
                  color: TX_COLOR[group.type],
                }}
                aria-hidden="true"
              >
                {TX_ICON[group.type]}
              </div>

              <div className="activity-content">
                <div
                  className="activity-title"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                    flexWrap: "wrap",
                    marginBottom: "0.25rem",
                  }}
                >
                  <span>{getTitle(group)}</span>
                  {group.count > 1 && (
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        minWidth: "1.5rem",
                        padding: "0.125rem 0.4rem",
                        borderRadius: "999px",
                        background: "rgba(88, 166, 255, 0.12)",
                        color: COLOR.accent,
                        fontSize: "0.7rem",
                        fontWeight: 600,
                        lineHeight: 1,
                      }}
                      aria-label={`${group.count} grouped events`}
                    >
                      {group.count}
                    </span>
                  )}
                </div>
                <div className="activity-sub">{getSubtitle(group)}</div>
              </div>

              {amountLabel && (
                <div
                  className="activity-amount"
                  style={{ color: TX_COLOR[group.type] }}
                >
                  {amountLabel}
                </div>
              )}
            </div>
          );
        })
      )}
    </section>
  );
}

export default ActivityFeed;
