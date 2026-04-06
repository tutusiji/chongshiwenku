import { FormPageShell } from "@/components/forms/form-page-shell";
import { GroupCreateForm } from "@/components/forms/group-create-form";

export const dynamic = "force-dynamic";

export default function NewGroupPage() {
  return (
    <FormPageShell
      title="资料组表单统一走 Ant Design Form"
      description="课件组、文档组、考研组都属于同一类资料组对象。当前页面已经接上真实创建接口，提交成功后会跳转到资料组详情页继续做权限和成员管理。"
      asideTitle="创建资料组"
      asideDescription="可见性可设置为公开、密码访问、仅自己可见、组内可见或指定用户可见。"
    >
      <GroupCreateForm />
    </FormPageShell>
  );
}
