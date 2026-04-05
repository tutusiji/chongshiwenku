import { FormPageShell } from "@/components/forms/form-page-shell";
import { GroupCreateForm } from "@/components/forms/group-create-form";

export const dynamic = "force-dynamic";

export default function NewGroupPage() {
  return (
    <FormPageShell
      title="资料组表单也统一走 Ant Design Form"
      description="课件组、文档组、考研组都属于同一类资料组对象。这里先把创建组表单和可见性规则做成统一前端模式。"
      asideTitle="创建资料组"
      asideDescription="可见性可设置为公开、密码访问、仅自己可见、组内可见或指定用户可见。"
    >
      <GroupCreateForm />
    </FormPageShell>
  );
}
