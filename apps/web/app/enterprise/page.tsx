import type { Metadata } from 'next';
import EnterprisePageClient from './EnterprisePageClient';

export const metadata: Metadata = {
  title: 'حملات الشركات | إعلاني',
  description: 'حملات مرئية للشركات والبراندات عبر إعلاني في مدن السعودية.',
  alternates: { canonical: '/enterprise' },
};

export default function EnterprisePage() {
  return <EnterprisePageClient />;
}
