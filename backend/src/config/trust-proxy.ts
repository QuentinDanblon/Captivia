/**
 * Valeur de l'option Express 'trust proxy' d'après TRUST_PROXY :
 *  - 'true'        -> 1 saut (un reverse proxy de confiance devant l'app) ;
 *  - entier N > 0  -> N sauts (ex. CDN + load balancer) ;
 *  - absent / 'false' / '0' / invalide -> false (désactivé).
 * On n'accepte jamais `true` brut pour Express : il ferait confiance à tout X-Forwarded-For.
 */
export function resolveTrustProxy(raw: string | undefined): number | false {
  const value = (raw ?? '').trim().toLowerCase();
  if (value === 'true') return 1;
  if (/^\d+$/.test(value)) {
    const hops = parseInt(value, 10);
    return hops > 0 ? hops : false;
  }
  return false;
}
