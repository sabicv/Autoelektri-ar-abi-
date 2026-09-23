import Skeleton from '@/components/ui/Skeleton';
import Card from '@/components/ui/Card';

export default function AnalyticsLoading() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-7 w-48" />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="space-y-2 p-4">
            <Skeleton className="h-5 w-5" />
            <Skeleton className="h-7 w-16" />
            <Skeleton className="h-3 w-24" />
          </Card>
        ))}
      </div>

      <Card className="space-y-3 p-4">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-2 w-full" />
        <Skeleton className="h-2 w-full" />
        <Skeleton className="h-2 w-full" />
      </Card>

      <Card className="space-y-3 p-4">
        <Skeleton className="h-5 w-56" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </Card>
    </div>
  );
}
