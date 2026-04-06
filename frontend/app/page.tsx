import { SiteHomePage } from "@/components/site-home-page";
import type { DocumentSummary } from "@/lib/documents";

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000/api/v1";

async function getInitialDocuments(): Promise<{
  items: DocumentSummary[];
  error: string | null;
}> {
  try {
    const response = await fetch(`${apiBaseUrl}/documents/discover?limit=24`, {
      cache: "no-store",
    });

    if (!response.ok) {
      return { items: [], error: "首页文档加载失败" };
    }

    const payload = (await response.json()) as { items: DocumentSummary[] };
    return { items: payload.items, error: null };
  } catch {
    return { items: [], error: "首页文档加载失败" };
  }
}

export default async function Page() {
  const { items, error } = await getInitialDocuments();
  return <SiteHomePage initialDocuments={items} initialError={error} />;
}
