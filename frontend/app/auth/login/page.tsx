import { FormPageShell } from "@/components/forms/form-page-shell";
import { LoginForm } from "@/components/forms/login-form";

export const dynamic = "force-dynamic";

export default function LoginPage() {
  return (
    <FormPageShell
      title="使用 Ant Design Form 构建登录页"
      description="登录、注册以及后续所有业务表单都会统一走 Ant Design Form 体系，保证字段校验、布局和交互反馈一致。"
      asideTitle="登录崇实文库"
      asideDescription="支持用户名、邮箱或手机号登录。后续会接入真实认证接口、登录态管理与风控。"
    >
      <LoginForm />
    </FormPageShell>
  );
}
