import Skeleton from '@/components/ui/Skeleton';
import Card from '@/components/ui/Card';

export default function JobsLoading() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-7 w-32" />
      <Skeleton className="h-12 w-full rounded-xl" />

      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="space-y-3 p-4">
            <div className="flex gap-2">
              <Skeleton className="h-5 w-24 rounded-full" />
            </div>
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-4 w-32" />
          </Card>
        ))}
      </div>
    </div>
  );
}
