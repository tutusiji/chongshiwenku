import { GroupDetailPanel } from "@/components/groups/group-detail-panel";

export const dynamic = "force-dynamic";

type GroupDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function GroupDetailPage({ params }: GroupDetailPageProps) {
  const { id } = await params;
  return <GroupDetailPanel groupId={id} />;
}
