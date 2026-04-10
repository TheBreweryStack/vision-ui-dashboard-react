import { Skeleton } from "@/components/ui/skeleton";

export function DashboardSkeleton() {
  return (
    <div className="space-y-4 md:space-y-6 animate-pulse">
      {/* Header */}
      <div className="flex flex-row items-center justify-between gap-4">
        <div className="space-y-1">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-8 w-48" />
        </div>
      </div>

      {/* Main Stats Grid - 4 columns on desktop */}
      <div className="grid grid-cols-2 gap-3 md:gap-4 md:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="stat-card p-4">
            <div className="flex items-center justify-between mb-2">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-7 w-7 rounded-lg" />
            </div>
            <Skeleton className="h-7 w-24" />
          </div>
        ))}
      </div>

      {/* Secondary Stats - 3 columns */}
      <div className="grid grid-cols-3 gap-2 md:gap-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="stat-card py-3 px-3">
            <div className="flex flex-col items-center gap-1">
              <Skeleton className="h-7 w-7 rounded-lg" />
              <Skeleton className="h-3 w-12" />
              <Skeleton className="h-5 w-16" />
            </div>
          </div>
        ))}
      </div>

      {/* Trade Limit Progress (free tier placeholder) */}
      <div className="stat-card p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Skeleton className="h-4 w-4 rounded" />
            <Skeleton className="h-4 w-20" />
          </div>
          <Skeleton className="h-4 w-12" />
        </div>
        <Skeleton className="h-2 w-full rounded-full" />
      </div>

      {/* Three Column Layout - Recent Trades, Open Positions, Tasks */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="content-card p-4">
            <div className="flex items-center justify-between mb-4">
              <Skeleton className="h-5 w-28" />
              <Skeleton className="h-4 w-16" />
            </div>
            <div className="space-y-2">
              {[...Array(4)].map((_, j) => (
                <div key={j} className="flex items-center gap-3 p-2">
                  <Skeleton className="h-10 w-10 rounded-lg" />
                  <div className="flex-1">
                    <Skeleton className="h-4 w-20 mb-1" />
                    <Skeleton className="h-3 w-32" />
                  </div>
                  <Skeleton className="h-5 w-12 rounded" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default DashboardSkeleton;
