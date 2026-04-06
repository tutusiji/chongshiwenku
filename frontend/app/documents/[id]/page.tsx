import { DocumentDetailPanel } from "@/components/documents/document-detail-panel";

export const dynamic = "force-dynamic";

type DocumentDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function DocumentDetailPage({ params }: DocumentDetailPageProps) {
  const { id } = await params;
  return <DocumentDetailPanel documentId={id} />;
}
