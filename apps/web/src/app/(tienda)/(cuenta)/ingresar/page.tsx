import type { Metadata } from 'next';
import { AccountPanel } from '@/components/account-panel';
import { SectionTitle } from '@/components/ui';

export const metadata: Metadata = { title: 'Ingresar', robots: { index: false } };

export default function SignInPage() {
  return (
    <section className="wrap flex flex-col gap-6 pt-10 md:pt-12">
      <div className="flex max-w-[460px] flex-col gap-6">
        <SectionTitle eyebrow="Tu cuenta" title="Ingresar" as="h1" size="lg" />
        <AccountPanel />
      </div>
    </section>
  );
}
