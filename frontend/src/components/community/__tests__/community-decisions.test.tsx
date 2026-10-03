import type { AnchorHTMLAttributes, ReactNode } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { DecisionDetail } from '../Decisions';
import { CommunityContext, type CommunitySession } from '../CommunityGate';
import type { ModerationDecision } from '@/lib/community';

jest.mock('@/i18n/navigation', () => ({
  Link: ({ href, children, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; children: ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
}));
const myDecision = jest.fn();
jest.mock('@/lib/community', () => {
  const actual = jest.requireActual('@/lib/community');
  return { ...actual, communityApi: { ...actual.communityApi, myDecision: (...args: unknown[]) => myDecision(...args) } };
});

const session: CommunitySession = {
  token: 't',
  isGuest: false,
  reloadMe: async () => undefined,
  me: { profile: null, currentRulesVersion: '2026-10', canPublish: true, reasons: [], ageConfirmationRequired: false },
};

function decision(overrides: Partial<ModerationDecision> = {}): ModerationDecision {
  return {
    id: 'dec-1',
    action: 'DELETE',
    targetType: 'POST',
    targetId: null,
    target: { type: 'POST', exists: false },
    reason: 'SPAM',
    statement: 'Publicité répétée après avertissement.',
    automated: false,
    suspendedUntil: null,
    createdAt: '2026-10-03T10:00:00.000Z',
    appealStatus: 'NONE',
    appealDeadline: null,
    canAppeal: false,
    appealStatement: null,
    appealResolvedAt: null,
    contactEmail: null,
    ...overrides,
  };
}

function renderDetail() {
  return render(
    <CommunityContext.Provider value={session}>
      <DecisionDetail id="dec-1" />
    </CommunityContext.Provider>,
  );
}

describe('décision : nature du contenu visé', () => {
  beforeEach(() => myDecision.mockReset());

  it('contenu supprimé : la nature reste affichée, avec la mention « supprimé » et sans lien', async () => {
    myDecision.mockResolvedValue(decision());
    renderDetail();
    await waitFor(() => expect(screen.getByText('decisions.facts.target')).toBeInTheDocument());
    expect(screen.getByText('decisions.target.POST')).toBeInTheDocument();
    expect(screen.getByText('decisions.target.gone')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'decisions.seeContent' })).not.toBeInTheDocument();
  });

  it('publication encore en ligne : nature, lien vers le contenu, pas de mention « supprimé »', async () => {
    myDecision.mockResolvedValue(decision({ action: 'HIDE', targetId: 'post-1', target: { type: 'POST', exists: true } }));
    renderDetail();
    await waitFor(() => expect(screen.getByText('decisions.target.POST')).toBeInTheDocument());
    expect(screen.queryByText('decisions.target.gone')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'decisions.seeContent' })).toHaveAttribute('href', '/communaute/publication/post-1');
  });

  it('commentaire supprimé et profil : natures propres', async () => {
    myDecision.mockResolvedValue(decision({ targetType: 'COMMENT', target: { type: 'COMMENT', exists: false } }));
    const { unmount } = renderDetail();
    await waitFor(() => expect(screen.getByText('decisions.target.COMMENT')).toBeInTheDocument());
    expect(screen.getByText('decisions.target.gone')).toBeInTheDocument();
    unmount();
    myDecision.mockResolvedValue(decision({ action: 'SUSPEND', targetType: 'USER', target: { type: 'USER', exists: true } }));
    renderDetail();
    await waitFor(() => expect(screen.getByText('decisions.target.USER')).toBeInTheDocument());
    expect(screen.queryByText('decisions.target.gone')).not.toBeInTheDocument();
  });

  it('API antérieure sans `target` : nature déduite de targetType', async () => {
    myDecision.mockResolvedValue(decision({ target: undefined, action: 'HIDE', targetId: 'post-2' }));
    renderDetail();
    await waitFor(() => expect(screen.getByText('decisions.target.POST')).toBeInTheDocument());
    expect(screen.queryByText('decisions.target.gone')).not.toBeInTheDocument();
  });
});
