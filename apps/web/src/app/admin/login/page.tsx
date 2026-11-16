import { LoginPanel } from '@/components/login-panel';

export default function AdminLoginPage() {
  return (
    <div className="flex max-w-[440px] flex-col gap-5 pt-4">
      <h1 className="text-[34px] md:text-[40px]">Ingresar al panel</h1>
      <p className="text-muted">Entrá con la cuenta del negocio para cargar muebles y moderar la galería.</p>
      <LoginPanel ownerHint />
    </div>
  );
}
