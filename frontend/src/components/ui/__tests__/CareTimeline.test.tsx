import { render, screen, within } from '@testing-library/react';
import CareTimeline, { type CareStatus, type CareTimelineItem } from '../CareTimeline';

const STATUS: Record<CareStatus, string> = {
  done: 'Fait',
  due: 'À faire',
  overdue: 'En retard',
  planned: 'Prévu',
  skipped: 'Sauté',
};

const items: CareTimelineItem[] = [
  { id: 'a', date: '2026-10-02T08:00:00Z', title: 'Nourrissage', detail: 'Kaa · 1 rat moyen', status: 'due', kind: 'Routine' },
  { id: 'b', date: '2026-10-02T20:00:00Z', title: 'Baytril 2,5 %', detail: 'Nala · 0,2 ml', status: 'done', kind: 'Médicament' },
  { id: 'c', date: '2026-10-04T00:00:00Z', allDay: true, title: 'Vermifuge', status: 'overdue' },
  { id: 'd', date: '2026-10-07T14:00:00Z', title: 'Bilan annuel', status: 'skipped' },
];

function renderTimeline(extra: Partial<Parameters<typeof CareTimeline>[0]> = {}) {
  return render(
    <CareTimeline
      items={items}
      statusLabels={STATUS}
      label="Soins à venir"
      allDayLabel="Journée"
      locale="fr-FR"
      timeZone="UTC"
      {...extra}
    />,
  );
}

describe('ui/CareTimeline', () => {
  it('liste ordonnée nommée, une entrée par soin dans l’ordre', () => {
    renderTimeline();
    const list = screen.getByRole('list', { name: 'Soins à venir' });
    expect(list.tagName).toBe('OL');
    const entries = within(list).getAllByRole('listitem');
    expect(entries).toHaveLength(4);
    expect(entries.map((li) => li.getAttribute('data-status'))).toEqual(['due', 'done', 'overdue', 'skipped']);
  });

  it('statut toujours écrit (pas seulement la couleur) et nature du soin', () => {
    renderTimeline();
    const [first, second] = screen.getAllByRole('listitem');
    expect(within(first).getByText('À faire')).toHaveClass('text-warn');
    expect(within(first).getByText('Routine')).toBeInTheDocument();
    expect(within(second).getByText('Fait')).toHaveClass('text-ok');
    expect(first.querySelector('svg[data-status="due"]')).toHaveAttribute('aria-hidden', 'true');
  });

  it('dates en <time datetime>, jour écrit au changement de jour seulement, heure sinon', () => {
    renderTimeline();
    const [first, second, third] = screen.getAllByRole('listitem');
    expect(first.querySelector('time')).toHaveAttribute('dateTime', '2026-10-02T08:00:00.000Z');
    expect(first.querySelector('time')).toHaveTextContent(/02 oct\./);
    expect(first.querySelector('time')).toHaveTextContent('08:00');
    expect(second.querySelector('time')).not.toHaveTextContent(/oct\./);
    expect(second.querySelector('time')).toHaveTextContent('20:00');
    expect(third.querySelector('time')).toHaveTextContent(/04 oct\./);
    expect(third.querySelector('time')).toHaveTextContent('Journée');
  });

  it('soin sauté : titre barré ; action propre à une entrée', () => {
    renderTimeline({
      items: [
        { ...items[3] },
        { ...items[0], action: <button type="button">Marquer comme fait</button> },
      ],
    });
    expect(screen.getByText('Bilan annuel')).toHaveClass('line-through');
    expect(screen.getByRole('button', { name: 'Marquer comme fait' })).toBeInTheDocument();
  });

  it('liste vide : aucune entrée', () => {
    renderTimeline({ items: [] });
    expect(screen.queryAllByRole('listitem')).toHaveLength(0);
  });
});
