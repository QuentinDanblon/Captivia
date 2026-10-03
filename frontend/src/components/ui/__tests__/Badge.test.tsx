import { render, screen } from '@testing-library/react';
import Badge, { IUCN_CATEGORIES, IucnBadge, IucnScale, toIucnCategory, type IucnCategory } from '../Badge';

const LABELS: Record<IucnCategory, string> = {
  EX: 'Éteinte',
  EW: 'Éteinte à l’état sauvage',
  CR: 'En danger critique',
  EN: 'En danger',
  VU: 'Vulnérable',
  NT: 'Quasi menacée',
  LC: 'Préoccupation mineure',
  DD: 'Données insuffisantes',
  NE: 'Non évaluée',
};

describe('ui/Badge', () => {
  it('affiche le libellé avec le ton demandé', () => {
    render(<Badge tone="warn">À faire</Badge>);
    const badge = screen.getByText('À faire').parentElement!;
    expect(badge.className).toContain('bg-warn-soft');
    expect(badge.className).toContain('text-warn');
  });

  it('pastille décorative optionnelle (le texte porte le sens)', () => {
    const { container } = render(
      <Badge tone="ok" dot>
        Fait
      </Badge>,
    );
    const dot = container.querySelector('[aria-hidden="true"]');
    expect(dot).toBeInTheDocument();
    expect(screen.getByText('Fait')).toBeInTheDocument();
  });
});

describe('ui/IucnBadge', () => {
  it('code officiel décoratif + libellé lisible', () => {
    render(<IucnBadge category="VU" label={LABELS.VU} />);
    const code = screen.getByText('VU');
    expect(code).toHaveAttribute('aria-hidden', 'true');
    expect(code.className).toContain('bg-[var(--iucn-vu)]');
    expect(screen.getByText('Vulnérable')).toBeVisible();
  });

  it('libellé masqué visuellement mais toujours présent', () => {
    render(<IucnBadge category="CR" label={LABELS.CR} showLabel={false} />);
    expect(screen.getByText('En danger critique')).toHaveClass('sr-only');
    expect(screen.getByText('CR').className).toContain('text-[#fff]');
  });

  it('chaque catégorie a ses couleurs officielles', () => {
    for (const category of IUCN_CATEGORIES) {
      const { unmount } = render(<IucnBadge category={category} label={LABELS[category]} />);
      expect(screen.getByText(category).className).toContain(`--iucn-${category.toLowerCase()}`);
      unmount();
    }
  });
});

describe('ui/IucnScale', () => {
  it('liste ordonnée EX → LC, catégorie courante marquée aria-current', () => {
    render(<IucnScale category="EN" labels={LABELS} aria-label="Statut UICN" />);
    const list = screen.getByRole('list', { name: 'Statut UICN' });
    const items = Array.from(list.querySelectorAll('li'));
    expect(items.map((li) => li.textContent)).toEqual([
      `EX${LABELS.EX}`,
      `EW${LABELS.EW}`,
      `CR${LABELS.CR}`,
      `EN${LABELS.EN}`,
      `VU${LABELS.VU}`,
      `NT${LABELS.NT}`,
      `LC${LABELS.LC}`,
    ]);
    expect(items.filter((li) => li.getAttribute('aria-current') === 'true')).toHaveLength(1);
    expect(items[3]).toHaveAttribute('aria-current', 'true');
  });

  it('hors échelle (DD) : aucune catégorie courante, libellé écrit dessous', () => {
    render(<IucnScale category="DD" labels={LABELS} aria-label="Statut UICN" />);
    expect(screen.getByRole('list').querySelector('[aria-current]')).toBeNull();
    expect(screen.getByText('Données insuffisantes', { selector: 'p' })).toBeInTheDocument();
  });
});

describe('toIucnCategory', () => {
  it.each([
    ['lc', 'LC'],
    [' VU ', 'VU'],
    ['Critically Endangered', 'CR'],
    ['Data deficient', 'DD'],
    ['inconnu', null],
    [null, null],
  ])('%p → %p', (input, expected) => {
    expect(toIucnCategory(input)).toBe(expected);
  });
});
