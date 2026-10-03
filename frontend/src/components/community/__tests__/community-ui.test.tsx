import type { AnchorHTMLAttributes, ReactNode } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { PlainText } from '../primitives';
import PostCard from '../PostCard';
import { CommunityContext, CommunityNotice, type CommunitySession } from '../CommunityGate';
import type { CommunityErrorKey, CommunityMe, CommunityPost } from '@/lib/community';

jest.mock('@/i18n/navigation', () => ({
  Link: ({ href, children, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; children: ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
}));
jest.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: null, token: null, isLoading: false }) }));
const resendVerification = jest.fn();
jest.mock('@/lib/api', () => {
  const actual = jest.requireActual('@/lib/api');
  return { ...actual, api: { ...actual.api, resendVerification: (...args: unknown[]) => resendVerification(...args) } };
});

const HOSTILE = 'Regardez <script>alert(1)</script> <img src=x onerror=alert(2)> et https://promo.example/gecko — ou www.arnaque.shop';

function post(overrides: Partial<CommunityPost> = {}): CommunityPost {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    type: 'PHOTO',
    body: HOSTILE,
    speciesCategory: 'REPTILE',
    status: 'VISIBLE',
    createdAt: new Date().toISOString(),
    author: { handle: 'kaa_fan', avatarUrl: 'https://evil.example/avatar.png' },
    animal: { name: 'Kaa', species: 'Boa constricteur', scientificName: 'Boa constrictor' },
    media: [],
    likeCount: 3,
    commentCount: 2,
    likedByMe: false,
    isMine: false,
    helpfulCommentId: null,
    ...overrides,
  };
}

describe('texte des membres : texte brut, jamais de HTML ni de lien', () => {
  it('PlainText échappe le balisage et ne crée aucun lien', () => {
    const { container } = render(<PlainText text={HOSTILE} />);
    expect(container.querySelector('script')).toBeNull();
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('a')).toBeNull();
    expect(container.textContent).toBe(HOSTILE);
  });

  it('conserve les sauts de ligne par CSS (pas de <br> injecté)', () => {
    const { container } = render(<PlainText text={'ligne 1\nligne 2'} />);
    const p = container.querySelector('[data-plain-text]')!;
    expect(p.className).toContain('whitespace-pre-line');
    expect(p.innerHTML).toBe('ligne 1\nligne 2');
  });

  it('PostCard : le corps est du texte ; seuls les liens de l’app existent (profil, détail, réponses)', () => {
    const { container } = render(<PostCard post={post()} token="t" onReport={jest.fn()} />);
    expect(container.querySelector('script')).toBeNull();
    expect(screen.getByText(HOSTILE)).toBeInTheDocument();
    const hrefs = Array.from(container.querySelectorAll('a')).map((a) => a.getAttribute('href'));
    expect(hrefs.every((href) => href?.startsWith('/communaute/'))).toBe(true);
    expect(hrefs.some((href) => href?.includes('promo.example') || href?.includes('arnaque'))).toBe(false);
  });

  it('photo : le texte alternatif de l’auteur est utilisé, sinon le repli', () => {
    const media = [
      { id: 'm1', url: 'https://evil.example/1.webp', width: 10, height: 10, alt: 'Un boa enroulé sur sa branche' },
      { id: 'm2', url: 'https://evil.example/2.webp', width: 10, height: 10, alt: null },
    ];
    render(<PostCard post={post({ body: 'Kaa au soleil', animal: null, media })} token="t" />);
    expect(screen.getByTitle('Un boa enroulé sur sa branche')).toBeInTheDocument();
    // Pas de description : repli composé (position · légende), clés de traduction rendues telles quelles.
    expect(screen.getByTitle('photo.position · Kaa au soleil')).toBeInTheDocument();
  });

  it("n'affiche que le nom et l'espèce de l'animal ; avatar hors origine des médias → patte au trait", () => {
    const { container } = render(<PostCard post={post()} token="t" />);
    expect(screen.getByText('Kaa')).toBeInTheDocument();
    expect(container.querySelector('img[src*="evil.example"]')).toBeNull();
  });

  it('question : badge, réponse utile annoncée ; carte masquée signalée à son auteur', () => {
    render(<PostCard post={post({ type: 'QUESTION', helpfulCommentId: 'c1', status: 'HIDDEN_AUTO', isMine: true })} token="t" onReport={jest.fn()} />);
    expect(screen.getAllByText('type.QUESTION').length).toBeGreaterThan(0);
    expect(screen.getByText('card.answered')).toBeInTheDocument();
    expect(screen.getByText('card.hidden')).toBeInTheDocument();
    // On ne signale pas sa propre publication.
    expect(screen.queryByRole('button', { name: 'card.report' })).not.toBeInTheDocument();
  });

  it('signalement : le bouton transmet la publication', () => {
    const onReport = jest.fn();
    render(<PostCard post={post()} token="t" onReport={onReport} />);
    fireEvent.click(screen.getByRole('button', { name: 'card.report' }));
    expect(onReport).toHaveBeenCalledWith(expect.objectContaining({ id: post().id }));
  });

  it('lecture seule (invité) : « j’aime » affiché mais non cliquable', () => {
    render(<PostCard post={post()} token="t" readOnly />);
    expect(screen.queryByRole('button', { name: /card\.likeLabel/ })).not.toBeInTheDocument();
  });
});

describe('états et refus : un texte propre par code', () => {
  const keys: CommunityErrorKey[] = [
    'guest',
    'emailNotVerified',
    'ageRequired',
    'profileRequired',
    'rulesNotAccepted',
    'suspended',
    'rateLimited',
    'linksNotAllowed',
    'mediaDimensions',
    'mediaBusy',
    'handleReserved',
    'network',
    'session',
    'generic',
  ];

  it.each(keys)('%s : titre et texte traduits, jamais le message brut de l’API', (key) => {
    render(<CommunityNotice errorKey={key} />);
    expect(screen.getByText(`errors.${key}.title`)).toBeInTheDocument();
    expect(screen.getByText(`errors.${key}.body`)).toBeInTheDocument();
  });

  it('invité → créer un compte sans perte (conversion)', () => {
    render(<CommunityNotice errorKey="guest" />);
    expect(screen.getByRole('link', { name: 'actions.createAccount' })).toHaveAttribute('href', '/sauvegarder');
  });

  it('profil requis / règles → page du profil communauté', () => {
    render(<CommunityNotice errorKey="profileRequired" />);
    expect(screen.getByRole('link', { name: 'actions.createProfile' })).toHaveAttribute('href', '/communaute/profil');
  });

  it('suspendu → date de fin et lien vers la décision', () => {
    render(<CommunityNotice errorKey="suspended" suspendedUntil="12 oct. 2026" decisionId="abc" />);
    expect(screen.getByText('errors.suspended.bodyUntil')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'actions.seeDecision' })).toHaveAttribute('href', '/communaute/decisions/abc');
  });

  it('suspension portée par le compte (sans profil) : texte dédié, puis date lue dans le profil (suspendedUntil)', () => {
    const session = (me: Partial<CommunityMe>): CommunitySession => ({
      token: 't',
      isGuest: false,
      reloadMe: async () => undefined,
      me: { profile: null, currentRulesVersion: '2026-10', canPublish: false, reasons: ['COMMUNITY_SUSPENDED'], ageConfirmationRequired: false, ...me },
    });
    const { unmount } = render(
      <CommunityContext.Provider value={session({ suspendedUntil: null })}>
        <CommunityNotice errorKey="suspended" accountWide />
      </CommunityContext.Provider>,
    );
    expect(screen.getByText('errors.suspended.bodyNoDate')).toBeInTheDocument();
    unmount();
    render(
      <CommunityContext.Provider value={session({ suspendedUntil: '2026-11-02T10:00:00.000Z' })}>
        <CommunityNotice errorKey="suspended" accountWide />
      </CommunityContext.Provider>,
    );
    expect(screen.getByText('errors.suspended.bodyUntil')).toBeInTheDocument();
  });

  it('suspension : le message d’erreur de l’API n’est plus analysé', () => {
    render(<CommunityNotice errorKey="suspended" accountWide />);
    expect(screen.getByText('errors.suspended.bodyNoDate')).toBeInTheDocument();
  });

  it('e-mail non vérifié → renvoi du lien depuis le message', async () => {
    resendVerification.mockResolvedValue({ message: 'ok', alreadyVerified: false });
    render(<CommunityNotice errorKey="emailNotVerified" token="tok" />);
    fireEvent.click(screen.getByRole('button', { name: 'actions.resendVerification' }));
    await waitFor(() => expect(screen.getByText('actions.verificationSent')).toBeInTheDocument());
    expect(resendVerification).toHaveBeenCalledWith('tok');
  });

  it('erreur réseau → réessayer', () => {
    const onRetry = jest.fn();
    render(<CommunityNotice errorKey="network" onRetry={onRetry} />);
    fireEvent.click(screen.getByRole('button', { name: 'actions.retry' }));
    expect(onRetry).toHaveBeenCalled();
  });
});
