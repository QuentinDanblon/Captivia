import type { Metadata } from 'next';
import { LegalDocument, legalMetadata } from '@/content/legal';

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  return legalMetadata(locale, 'terms');
}

export default async function TermsPage({ params }: Props) {
  const { locale } = await params;
  return <LegalDocument locale={locale} docKey="terms" />;
}
