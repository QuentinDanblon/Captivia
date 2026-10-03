import { render, screen } from '@testing-library/react';

jest.mock('next-intl', () => ({
  useLocale: () => 'en',
  useTranslations: () => {
    const messages = jest.requireActual('../../../messages/en.json');
    const lookup = (key: string) => key.split('.').reduce<unknown>((value, part) =>
      value && typeof value === 'object' ? (value as Record<string, unknown>)[part] : undefined, messages);
    return Object.assign((key: string) => String(lookup(key) ?? key), { has: (key: string) => typeof lookup(key) === 'string' });
  },
}));

import { EquipmentSection } from '../[locale]/(app)/species/[id]/_components/sections';

it('traduit le matériel de base et affiche sa source consultable', () => {
  const source = 'https://www.gov.uk/government/publications/code-of-practice-for-the-welfare-of-dogs';
  render(<EquipmentSection equipment={{
    recommendations: [{ id: 'dog-bed', category: 'couchage', label: 'Panier ou coussin adapté à la taille', labelKey: 'bed' }],
    sources: [source],
  }} />);
  expect(screen.getByText('Bed or cushion suited to the animal’s size')).toBeInTheDocument();
  expect(screen.queryByText('Panier ou coussin adapté à la taille')).not.toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'gov.uk' })).toHaveAttribute('href', source);
});
