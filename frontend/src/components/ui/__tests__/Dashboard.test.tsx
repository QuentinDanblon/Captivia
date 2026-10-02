import { fireEvent, render, screen, within } from '@testing-library/react';
import Alert from '../Alert';
import Tip from '../Tip';
import MediaCard from '../MediaCard';
import AnimalCard from '../AnimalCard';
import { PremiumBadge, TaskPill } from '../Pills';
import { GuestBanner, LockedSlot, Steps } from '../Offer';

describe('ui/Alert (alertes graduées)', () => {
  it('urgent : role="alert", mot de gravité, action', () => {
    render(
      <Alert severity="urgent" severityLabel="Urgent" title="Traitement en retard de 2 jours" action={<button type="button">Marquer comme fait</button>}>
        Nala — Baytril 0,2 ml
      </Alert>,
    );
    const alert = screen.getByRole('alert');
    expect(alert).toHaveAttribute('data-severity', 'urgent');
    expect(alert).toHaveTextContent('Urgent · Traitement en retard de 2 jours');
    expect(within(alert).getByRole('button', { name: 'Marquer comme fait' })).toBeInTheDocument();
  });

  it('info / attention : annonce polie (role="status"), pictogramme de forme distincte', () => {
    const { container, rerender } = render(<Alert title="Rendez-vous à prendre" severity="warning" />);
    expect(screen.getByRole('status')).toHaveAttribute('data-severity', 'warning');
    expect(container.querySelector('svg[data-severity="warning"]')).toHaveAttribute('aria-hidden', 'true');
    rerender(<Alert title="Nouvelle fiche disponible" />);
    expect(screen.getByRole('status')).toHaveAttribute('data-severity', 'info');
  });
});

describe('ui/Tip (« Bon à savoir »)', () => {
  it('note complémentaire (aside) avec intitulé et source', () => {
    render(
      <Tip label="Bon à savoir" source="Fiche Boa constrictor">
        La mue dure 7 à 10 jours.
      </Tip>,
    );
    const tip = screen.getByRole('complementary');
    expect(tip).toHaveTextContent('Bon à savoir');
    expect(tip).toHaveTextContent('La mue dure 7 à 10 jours.');
    expect(screen.getByText('Fiche Boa constrictor')).toHaveClass('font-mono');
  });
});

describe('ui/MediaCard', () => {
  it('carte entière cliquable via le titre, actions du pied au-dessus', () => {
    render(
      <MediaCard title="Kaa" href="/mes-animaux/kaa" header="Publié par Léa" footer={<button type="button">J’aime</button>}>
        Corps
      </MediaCard>,
    );
    const article = screen.getByRole('article');
    expect(within(article).getByRole('heading', { level: 3, name: 'Kaa' })).toBeInTheDocument();
    expect(within(article).getByRole('link', { name: 'Kaa' })).toHaveAttribute('href', '/mes-animaux/kaa');
    expect(within(article).getByRole('button', { name: 'J’aime' })).toBeInTheDocument();
    expect(article).toHaveTextContent('Publié par Léa');
  });
});

describe('ui/AnimalCard', () => {
  it('sans photo : silhouette ; nom, binôme latin, pastilles et faits chiffrés', () => {
    const { container } = render(
      <AnimalCard
        name="Kaa"
        latin="Boa constrictor"
        kind="reptile"
        href="/mes-animaux/kaa"
        status={<TaskPill count={2} label="soins aujourd'hui" />}
        facts={[
          { label: 'Dernière pesée', value: '2 340 g · il y a 12 j' },
          { label: 'Prochain RDV', value: '07 oct. · 14:00' },
        ]}
      />,
    );
    expect(screen.getByRole('link', { name: 'Kaa' })).toHaveAttribute('href', '/mes-animaux/kaa');
    expect(screen.getByText('Boa constrictor')).toHaveAttribute('lang', 'la');
    expect(container.querySelector('svg[data-kind="reptile"]')).toBeInTheDocument();
    const terms = screen.getAllByRole('term').map((dt) => dt.textContent);
    expect(terms).toEqual(['Dernière pesée', 'Prochain RDV']);
    expect(screen.getByText('2 340 g · il y a 12 j')).toHaveClass('font-mono');
  });

  it('avec photo : image décrite et crédit', () => {
    render(
      <AnimalCard
        name="Nala"
        photo={{ src: '/images/nala.jpg', alt: 'Nala, python royal', credit: { author: 'Léa', license: 'CC BY 4.0', sourceUrl: 'https://example.org' } }}
      />,
    );
    expect(screen.getByRole('img', { name: 'Nala, python royal' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Léa' })).toBeInTheDocument();
  });
});

describe('ui/TaskPill et PremiumBadge', () => {
  it('le nombre porte le message ; ton selon le reste à faire', () => {
    const { rerender } = render(<TaskPill count={3} label="soins aujourd'hui" />);
    let pill = screen.getByText('3').parentElement!;
    expect(pill).toHaveTextContent("3soins aujourd'hui");
    expect(pill).toHaveAttribute('data-tone', 'warn');
    rerender(<TaskPill count={0} label="soin en attente" />);
    pill = screen.getByText('0').parentElement!;
    expect(pill).toHaveAttribute('data-tone', 'ok');
  });

  it('badge Premium sobre', () => {
    render(<PremiumBadge label="Premium" />);
    expect(screen.getByText('Premium')).toHaveClass('font-mono');
  });
});

describe('Offre : LockedSlot, GuestBanner, Steps', () => {
  it('emplacement verrouillé : titre, valeur, une action', () => {
    render(
      <LockedSlot
        title="Ajouter un deuxième animal"
        value="Chaque animal a son carnet, ses rappels et son agenda."
        badge={<PremiumBadge label="Premium" />}
        action={<button type="button">Découvrir Premium</button>}
      />,
    );
    expect(screen.getByText('Ajouter un deuxième animal')).toBeInTheDocument();
    expect(screen.getByText(/Chaque animal a son carnet/)).toBeInTheDocument();
    expect(screen.getAllByRole('button')).toHaveLength(1);
  });

  it('bandeau invité masquable, région nommée', () => {
    const onDismiss = jest.fn();
    render(
      <GuestBanner
        title="Sauvegardez vos données"
        description="Kaa et son carnet sont enregistrés sur cet appareil seulement."
        action={<button type="button">Créer un compte</button>}
        dismissLabel="Masquer"
        onDismiss={onDismiss}
      />,
    );
    expect(screen.getByRole('region', { name: 'Sauvegardez vos données' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Masquer' }));
    expect(onDismiss).toHaveBeenCalled();
    expect(screen.queryByRole('region')).not.toBeInTheDocument();
  });

  it('étapes d’onboarding : liste ordonnée, étape courante aria-current="step"', () => {
    render(<Steps steps={['Espèce', 'Nom et naissance', 'Premier soin']} current={1} aria-label="Premier animal" progressLabel="Étape 2 sur 3" />);
    const items = within(screen.getByRole('list', { name: 'Premier animal' })).getAllByRole('listitem');
    expect(items.map((li) => li.getAttribute('data-state'))).toEqual(['done', 'current', 'todo']);
    expect(items[1]).toHaveAttribute('aria-current', 'step');
    expect(screen.getByText('Étape 2 sur 3')).toBeInTheDocument();
  });
});
