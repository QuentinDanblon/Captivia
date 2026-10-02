import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

/**
 * Mode invité (« Essayer sans compte ») : un vrai `User` avec `isGuest = true`, sans e-mail ni
 * mot de passe. Il utilise le carnet complet de son animal unique, mais certaines actions exigent
 * un compte (adresse e-mail joignable, identité stable) : elles renvoient toutes un 403 portant
 * le code `GUEST_ACCOUNT`, que les clients traduisent en invitation à créer un compte.
 */
export const GUEST_ACCOUNT_CODE = 'GUEST_ACCOUNT';

/** Actions refusées à un invité (champ `action` du corps de la 403, pour le client). */
export type GuestRestrictedAction =
  | 'public_link'
  | 'calendar_feed'
  | 'publish'
  | 'subscription'
  | 'password'
  | 'email_verification';

const GUEST_MESSAGES: Record<GuestRestrictedAction, string> = {
  public_link: 'Create an account to share a public page for your animal.',
  calendar_feed: 'Create an account to subscribe to your care calendar.',
  publish: 'Create an account to publish in the community.',
  subscription: 'Create an account before subscribing to Premium.',
  password: 'Guest accounts have no password: create an account first.',
  email_verification:
    'Guest accounts have no e-mail address: create an account first.',
};

export class GuestAccountException extends ForbiddenException {
  constructor(action: GuestRestrictedAction) {
    super({
      statusCode: 403,
      code: GUEST_ACCOUNT_CODE,
      action,
      message: GUEST_MESSAGES[action],
    });
  }
}

/** Lève `GuestAccountException` si `user` est un invité. */
export function ensureNotGuest(
  user: { isGuest?: boolean | null } | null | undefined,
  action: GuestRestrictedAction,
): void {
  if (user?.isGuest === true) throw new GuestAccountException(action);
}

export const GUEST_ACTION_METADATA = 'captivia:guest-action';

/**
 * Route interdite aux invités : `@GuestForbidden('calendar_feed')` + `@UseGuards(JwtAuthGuard,
 * NoGuestGuard)`. Prévu aussi pour les futures routes de publication (réseau social) :
 * `@GuestForbidden('publish')`.
 */
export const GuestForbidden = (action: GuestRestrictedAction) =>
  SetMetadata(GUEST_ACTION_METADATA, action);

/**
 * Garde à placer APRÈS `JwtAuthGuard` (qui pose `req.user`, relu en base à chaque requête) :
 * refuse la route aux invités avec un 403 `GUEST_ACCOUNT`.
 */
@Injectable()
export class NoGuestGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context
      .switchToHttp()
      .getRequest<{ user?: { isGuest?: boolean } }>();
    const action =
      this.reflector.getAllAndOverride<GuestRestrictedAction | undefined>(
        GUEST_ACTION_METADATA,
        [context.getHandler(), context.getClass()],
      ) ?? 'publish';
    ensureNotGuest(req.user, action);
    return true;
  }
}
