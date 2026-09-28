import Skeleton from '@/components/ui/Skeleton';
import Card from '@/components/ui/Card';

export default function ClientsLoading() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-7 w-36" />
      <Skeleton className="h-[52px] w-full rounded-xl" />
      <Skeleton className="h-12 w-full rounded-xl" />
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Card key={i} className="flex items-center gap-3 p-4">
            <Skeleton className="h-11 w-11 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-28" />
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
