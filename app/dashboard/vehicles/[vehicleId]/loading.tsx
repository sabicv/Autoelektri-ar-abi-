import Skeleton from '@/components/ui/Skeleton';
import Card from '@/components/ui/Card';

export default function VehicleLoading() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-6 w-36" />
      <Card className="flex items-start gap-3 p-5">
        <Skeleton className="h-14 w-14 rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-40" />
        </div>
      </Card>
      <Skeleton className="h-5 w-32" />
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="space-y-2 pl-6">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-16 w-full" />
        </div>
      ))}
    </div>
  );
}
