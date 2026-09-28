import Skeleton from '@/components/ui/Skeleton';
import Card from '@/components/ui/Card';

export default function ClientLoading() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-6 w-28" />
      <Card className="space-y-4 p-5">
        <div className="flex items-center gap-3">
          <Skeleton className="h-14 w-14 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-5 w-44" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Skeleton className="h-[52px] rounded-xl" />
          <Skeleton className="h-[52px] rounded-xl" />
        </div>
      </Card>
      <Skeleton className="h-5 w-24" />
      <Card className="h-32 p-4">
        <Skeleton className="h-full w-full" />
      </Card>
    </div>
  );
}
