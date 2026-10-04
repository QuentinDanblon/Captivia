import { render, screen } from '@testing-library/react';
import { LegislationSection } from '../[locale]/(app)/species/[id]/_components/sections';
import SpeciesLegislationTab from '../[locale]/(app)/mes-animaux/[id]/_components/SpeciesLegislationTab';

const unreviewedBelgianStatus = {
  editorial: [{
    country: 'BE',
    status: 'allowed',
    details: { permits: ['Unverified permit claim'], restrictions: ['Unverified restriction'], needsReview: true },
    sources: [],
  }],
};

it('ne présente pas le statut national belge historique comme une autorisation sur la fiche espèce', () => {
  render(<LegislationSection legislation={unreviewedBelgianStatus} />);

  expect(screen.getByText('title')).toBeInTheDocument();
  expect(screen.getByText('species.review.legislation')).toBeInTheDocument();
  expect(screen.getByText('sources.wallonia')).toHaveAttribute('href', 'https://bienetreanimal.wallonie.be/liste-positive');
  expect(screen.queryByText('species.allowed')).not.toBeInTheDocument();
  expect(screen.queryByText('Unverified permit claim')).not.toBeInTheDocument();
  expect(screen.queryByText('Unverified restriction')).not.toBeInTheDocument();
});

it('applique le même avertissement dans la fiche de mon animal', () => {
  render(<SpeciesLegislationTab speciesLegislation={unreviewedBelgianStatus} />);

  expect(screen.getByText('title')).toBeInTheDocument();
  expect(screen.getByText('species.review.legislation')).toBeInTheDocument();
  expect(screen.queryByText('species.allowed')).not.toBeInTheDocument();
});

it('garde les liens vers les autorités belges visibles même sans statut enregistré', () => {
  const emptyLegislation = { editorial: [] };
  const { unmount } = render(<LegislationSection legislation={emptyLegislation} />);
  expect(screen.getByText('sources.wallonia')).toHaveAttribute('href', 'https://bienetreanimal.wallonie.be/liste-positive');
  unmount();

  render(<SpeciesLegislationTab speciesLegislation={emptyLegislation} />);
  expect(screen.getByText('sources.wallonia')).toHaveAttribute('href', 'https://bienetreanimal.wallonie.be/liste-positive');
  expect(screen.getByText('species.noLegalData')).toBeInTheDocument();
});
