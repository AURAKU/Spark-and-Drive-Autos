import { notFound } from "next/navigation";

import { getDutyAdminAssessmentDetailData } from "@/actions/duty-admin-os";
import { DutyAssessmentDetailClient } from "@/components/admin/duty-os/duty-assessment-detail-client";

export const dynamic = "force-dynamic";

type Params = Promise<{ id: string }>;

export default async function DutyAssessmentDetailPage({ params }: { params: Params }) {
  const { id } = await params;
  const data = await getDutyAdminAssessmentDetailData(id);
  if (!data) notFound();
  return <DutyAssessmentDetailClient data={data} />;
}
