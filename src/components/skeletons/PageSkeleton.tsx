import { Skeleton } from "@/components/ui/skeleton";

export function PageSkeleton() {
  return (
    <div className="min-h-screen bg-background pb-24 md:pb-6 animate-pulse">
      <div className="p-4 md:p-6 max-w-7xl mx-auto">
        {/* Header skeleton */}
        <div className="flex items-center justify-between mb-6">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-10 w-10 rounded-xl" />
        </div>

        {/* Content skeleton */}
        <div className="space-y-4">
          <div className="stat-card p-4">
            <Skeleton className="h-5 w-32 mb-4" />
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full rounded-lg" />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default PageSkeleton;
