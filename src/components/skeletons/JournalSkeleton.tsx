import { Skeleton } from "@/components/ui/skeleton";

export function JournalSkeleton() {
  return (
    <div className="space-y-4 md:space-y-6 animate-in">
      {/* Mobile action row */}
      <div className="flex md:hidden items-center justify-between gap-2 px-1">
        <div className="flex items-center gap-1.5 overflow-x-auto">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-8 w-20 rounded-lg shrink-0" />
          ))}
        </div>
        <Skeleton className="h-8 w-16 rounded-lg shrink-0" />
      </div>

      {/* Desktop header - hidden on mobile */}
      <div className="hidden md:flex items-center justify-between">
        <div>
          <Skeleton className="h-8 w-40 mb-2" />
          <Skeleton className="h-4 w-56" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-10 w-10 rounded-lg" />
          <Skeleton className="h-10 w-10 rounded-lg" />
          <Skeleton className="h-10 w-32 rounded-lg" />
          <Skeleton className="h-10 w-28 rounded-lg" />
          <Skeleton className="h-10 w-28 rounded-lg" />
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4 md:gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="stat-card p-3 md:p-4">
            <Skeleton className="h-3 w-16 mb-1" />
            <Skeleton className="h-6 w-24" />
          </div>
        ))}
      </div>

      {/* Action Buttons Row - Desktop only */}
      <div className="hidden md:flex items-center gap-2">
        <Skeleton className="h-10 w-28 rounded-lg" />
        <Skeleton className="h-10 w-28 rounded-lg" />
        <Skeleton className="h-10 w-36 rounded-lg" />
      </div>

      {/* Tabs + Content */}
      <div className="content-card">
        <div className="flex gap-2 mb-4 p-2">
          <Skeleton className="h-10 w-24 rounded-lg" />
          <Skeleton className="h-10 w-24 rounded-lg" />
        </div>

        {/* Calendar Grid */}
        <div className="p-4">
          <div className="flex items-center justify-between mb-4">
            <Skeleton className="h-6 w-32" />
            <div className="flex gap-2">
              <Skeleton className="h-8 w-8 rounded-lg" />
              <Skeleton className="h-8 w-8 rounded-lg" />
            </div>
          </div>
          
          {/* Day headers */}
          <div className="grid grid-cols-7 gap-2 mb-3">
            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((_, i) => (
              <Skeleton key={i} className="h-4 w-full" />
            ))}
          </div>
          
          {/* Calendar days grid */}
          <div className="grid grid-cols-7 gap-2">
            {[...Array(35)].map((_, i) => (
              <Skeleton key={i} className="h-16 w-full rounded-lg" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default JournalSkeleton;
