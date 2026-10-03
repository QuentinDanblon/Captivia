import { render, screen } from '@testing-library/react';

// next-intl : les valeurs sont interpolées comme dans le message français, la date est formatée
// par Intl (même options que useFormatter().dateTime), pour vérifier le rendu réel.
jest.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: Record<string, string>) =>
    key === 'species.reviewedOn' ? `Fiche vérifiée le ${values?.date}` : key,
  useLocale: () => 'fr',
  useFormatter: () => ({
    dateTime: (date: Date, options?: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('fr', { ...options, timeZone: 'UTC' }).format(date),
  }),
}));

import { ReviewedNote } from '../[locale]/(app)/species/[id]/_components/ReviewedNote';

describe('fiche espèce : date de vérification (lastReviewedAt)', () => {
  it('affiche « Fiche vérifiée le … » avec la date localisée quand la valeur est présente', () => {
    render(<ReviewedNote value="2026-10-02T09:30:00.000Z" />);

    expect(screen.getByText('Fiche vérifiée le 2 oct. 2026')).toBeInTheDocument();
    expect(screen.getByText('Fiche vérifiée le 2 oct. 2026').closest('time')).toHaveAttribute('datetime', '2026-10-02T09:30:00.000Z');
  });

  it("n'affiche rien quand la fiche n'a pas été vérifiée (null) ou que la date est absente", () => {
    const { container, rerender } = render(<ReviewedNote value={null} />);
    expect(container).toBeEmptyDOMElement();

    rerender(<ReviewedNote value={undefined} />);
    expect(container).toBeEmptyDOMElement();

    rerender(<ReviewedNote value="pas une date" />);
    expect(container).toBeEmptyDOMElement();
  });
});
