import { DocumentUploadForm } from "@/components/forms/document-upload-form";
import { FormPageShell } from "@/components/forms/form-page-shell";

export const dynamic = "force-dynamic";

export default function NewDocumentPage() {
  return (
    <FormPageShell
      title="文档上传统一走 Ant Design Form"
      description="这里已经接上真实文档上传接口。上传文件后会落到本地开发存储，创建文档记录，并触发 10 币上传奖励。"
      asideTitle="上传文档"
      asideDescription="首版支持 PDF、Word、Excel、PPT、TXT、CSV 等常见学习资料格式。"
    >
      <DocumentUploadForm />
    </FormPageShell>
  );
}
