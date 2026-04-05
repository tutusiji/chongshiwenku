import { FormPageShell } from "@/components/forms/form-page-shell";
import { RegisterForm } from "@/components/forms/register-form";

export const dynamic = "force-dynamic";

export default function RegisterPage() {
  return (
    <FormPageShell
      title="注册后自动创建积分账户"
      description="首版规则中，用户注册成功后会自动获得 100 币。这个页面既是注册入口，也是后续表单规范的示例基线。"
      asideTitle="创建账号"
      asideDescription="当前注册页采用 Ant Design Form 与 Ant Design Icons，后续将接入真实注册接口与注册奖励逻辑。"
    >
      <RegisterForm />
    </FormPageShell>
  );
}
