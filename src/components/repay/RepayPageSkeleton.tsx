import { useSearchParams } from 'react-router-dom';
import { Skeleton } from '@/components/Skeleton';

export function RepayPageSkeleton() {
  const [searchParams] = useSearchParams();
  const hasLine = !!searchParams.get('line');

  if (!hasLine) {
    return (
      <div
        className="repay-page mx-auto max-w-2xl space-y-6 px-4 py-8"
        aria-busy="true"
        aria-label="Loading repay page"
      >
        <div className="inline-flex items-center gap-1.5 rounded-md text-sm text-muted" aria-hidden="true">
          <Skeleton width="60px" height="20px" />
        </div>

        <header className="space-y-2" aria-hidden="true">
          <Skeleton width="80px" height="16px" />
          <Skeleton width="320px" height="32px" />
        </header>

        <div className="space-y-3" aria-hidden="true">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="w-full rounded-lg border border-border bg-surface p-4"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="space-y-2">
                  <Skeleton width="150px" height="20px" />
                  <Skeleton width="80px" height="14px" />
                </div>
                <div className="text-right space-y-2">
                  <Skeleton width="100px" height="20px" />
                  <Skeleton width="80px" height="14px" />
                </div>
              </div>
              <Skeleton width="100%" height="8px" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div
      className="repay-page mx-auto max-w-4xl px-4 py-6 sm:py-8"
      aria-busy="true"
      aria-label="Loading repay page"
    >
      <div className="mb-4 inline-flex items-center gap-1.5 rounded-md text-sm text-muted" aria-hidden="true">
        <Skeleton width="160px" height="20px" />
      </div>

      <div className="space-y-6" aria-hidden="true">
        <header className="space-y-2">
          <Skeleton width="80px" height="16px" />
          <Skeleton width="240px" height="32px" />
          <Skeleton width="180px" height="16px" />
        </header>

        <div className="rounded-lg border border-border bg-surface p-4">
          <Skeleton width="100px" height="16px" />
          <Skeleton width="200px" height="40px" className="mt-1" />
          <Skeleton width="100%" height="8px" className="mt-3" />
          <Skeleton width="180px" height="14px" className="mt-2" />
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_360px] lg:items-start">
          <div className="space-y-4">
            <div className="rounded-lg border border-border bg-surface p-4">
              <div className="flex items-center justify-between">
                <Skeleton width="120px" height="20px" />
                <Skeleton width="100px" height="14px" />
              </div>

              <div className="mt-3 flex gap-2">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} className="flex-1" height="32px" />
                ))}
              </div>

              <Skeleton height="56px" className="mt-3" />
              <Skeleton height="52px" className="mt-3" />
            </div>

            <div className="rounded-lg border border-border bg-surface p-4">
              <Skeleton width="80px" height="16px" />
              <div className="mt-3 space-y-3">
                <div className="flex items-center justify-between">
                  <Skeleton width="120px" height="20px" />
                  <Skeleton width="80px" height="20px" />
                </div>
                <div className="flex items-center justify-between">
                  <Skeleton width="120px" height="20px" />
                  <Skeleton width="80px" height="20px" />
                </div>
                <Skeleton width="100%" height="8px" />
                <Skeleton width="100%" height="8px" />
              </div>

              <div className="mt-6 flex items-center justify-between border-t border-border pt-4">
                <div className="space-y-1">
                  <Skeleton width="120px" height="18px" />
                  <Skeleton width="180px" height="14px" />
                </div>
                <Skeleton width="44px" height="24px" />
              </div>

              <Skeleton width="100%" height="44px" className="mt-4" />
            </div>
          </div>

          <aside className="space-y-4 rounded-lg border border-border bg-surface p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <Skeleton width="120px" height="20px" />
            </div>
            <Skeleton width="100%" height="40px" />
            <div className="rounded-lg border border-border bg-background/40 p-3">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Skeleton width="100px" height="14px" />
                  <Skeleton width="80px" height="18px" />
                </div>
                <Skeleton width="32px" height="32px" />
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
