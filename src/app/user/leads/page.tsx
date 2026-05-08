import { Suspense } from "react";
import { LeadsCrm } from "@/components/leads/LeadsCrm";
import { Skeleton } from "@/components/ui/Skeleton";

export default function LeadsPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-4">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-64 w-full" />
        </div>
      }
    >
      <LeadsCrm />
    </Suspense>
  );
}
