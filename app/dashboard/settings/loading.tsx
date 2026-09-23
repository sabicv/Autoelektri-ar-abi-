import Skeleton from '@/components/ui/Skeleton';
import Card from '@/components/ui/Card';

export default function SettingsLoading() {
  return (
    <div className="max-w-xl space-y-6">
      <Skeleton className="h-7 w-48" />
      <Card className="space-y-4 p-4">
        <Skeleton className="h-16 w-16 rounded-full" />
        <Skeleton className="h-11 w-full" />
        <Skeleton className="h-11 w-full" />
        <Skeleton className="h-11 w-full" />
      </Card>
      <Card className="space-y-4 p-4">
        <Skeleton className="h-11 w-full" />
        <Skeleton className="h-11 w-full" />
      </Card>
    </div>
  );
}
