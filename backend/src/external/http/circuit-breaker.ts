/**
 * Disjoncteur minimal (un par fournisseur externe).
 *
 * - fermé : les appels passent ; N échecs transitoires consécutifs ouvrent le circuit ;
 * - ouvert : les appels sont refusés immédiatement (repli sur les données locales /
 *   le cache périmé) jusqu'à l'expiration du délai de refroidissement ;
 * - semi-ouvert : une seule requête « sonde » est autorisée ; son succès referme le
 *   circuit, son échec le rouvre pour un nouveau délai.
 *
 * L'horloge est injectable pour des tests déterministes (aucun timer réel).
 */
export type CircuitState = 'closed' | 'open' | 'half-open';

export interface CircuitBreakerOptions {
  /** Nombre d'échecs transitoires consécutifs qui ouvrent le circuit. */
  failureThreshold: number;
  /** Durée pendant laquelle le circuit reste ouvert avant la sonde (ms). */
  resetTimeoutMs: number;
  /** Horloge (ms) — par défaut Date.now. */
  now?: () => number;
  /** Notifié à chaque changement d'état (journalisation). */
  onStateChange?: (state: CircuitState) => void;
}

export class CircuitBreaker {
  private state: CircuitState = 'closed';
  private consecutiveFailures = 0;
  private openedAt = 0;
  private probeInFlight = false;
  private readonly now: () => number;

  constructor(private readonly options: CircuitBreakerOptions) {
    this.now = options.now ?? Date.now;
  }

  /** État courant (sans consommer la sonde du mode semi-ouvert). */
  get currentState(): CircuitState {
    if (
      this.state === 'open' &&
      this.now() - this.openedAt >= this.options.resetTimeoutMs
    ) {
      return 'half-open';
    }
    return this.state;
  }

  get failures(): number {
    return this.consecutiveFailures;
  }

  /**
   * Autorise-t-on un appel maintenant ? En semi-ouvert, un seul appel (la sonde)
   * est autorisé tant que son résultat n'est pas connu.
   */
  canRequest(): boolean {
    if (this.state === 'closed') return true;

    if (this.state === 'open') {
      if (this.now() - this.openedAt < this.options.resetTimeoutMs)
        return false;
      this.transition('half-open');
    }

    // half-open
    if (this.probeInFlight) return false;
    this.probeInFlight = true;
    return true;
  }

  /** Appel réussi (ou erreur non transitoire : le fournisseur répond). */
  onSuccess(): void {
    this.consecutiveFailures = 0;
    this.probeInFlight = false;
    if (this.state !== 'closed') this.transition('closed');
  }

  /** Échec transitoire (réseau, timeout, 5xx, 429). */
  onFailure(): void {
    this.probeInFlight = false;
    if (this.state === 'half-open') {
      this.open();
      return;
    }
    this.consecutiveFailures += 1;
    if (this.consecutiveFailures >= this.options.failureThreshold) {
      this.open();
    }
  }

  private open(): void {
    this.openedAt = this.now();
    this.transition('open');
  }

  private transition(next: CircuitState): void {
    if (this.state === next) return;
    this.state = next;
    this.options.onStateChange?.(next);
  }
}
