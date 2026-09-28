import Skeleton from '@/components/ui/Skeleton';
import Card from '@/components/ui/Card';

// The job page's own shape, so opening a job doesn't flash the job list.
export default function JobLoading() {
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Skeleton className="h-6 w-36" />
      <Card className="space-y-3 p-4">
        <Skeleton className="h-5 w-28 rounded-full" />
        <Skeleton className="h-6 w-52" />
        <Skeleton className="h-4 w-36" />
        <div className="flex gap-2">
          <Skeleton className="h-12 flex-1 rounded-xl" />
          <Skeleton className="h-12 flex-1 rounded-xl" />
          <Skeleton className="h-12 w-12 rounded-xl" />
        </div>
      </Card>
      {Array.from({ length: 3 }).map((_, i) => (
        <Card key={i} className="space-y-3 p-4">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-20 w-full rounded-xl" />
        </Card>
      ))}
    </div>
  );
}
