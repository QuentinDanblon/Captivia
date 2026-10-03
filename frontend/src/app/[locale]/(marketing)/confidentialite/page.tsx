import type { Metadata } from 'next';
import { LegalDocument, legalMetadata } from '@/content/legal';

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  return legalMetadata(locale, 'privacy');
}

export default async function PrivacyPage({ params }: Props) {
  const { locale } = await params;
  return <LegalDocument locale={locale} docKey="privacy" />;
}
