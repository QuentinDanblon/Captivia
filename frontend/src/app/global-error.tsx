'use client';

import { useEffect } from 'react';

/**
 * Dernier filet de sécurité : erreur dans le layout racine lui-même. Remplace tout le document,
 * donc <html>/<body> sont fournis ici, sans dépendre de next-intl ni de Tailwind (styles en ligne),
 * et le texte est bilingue FR/EN puisque la locale n'est pas disponible.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    import('@sentry/nextjs')
      .then((Sentry) => Sentry.captureException(error))
      .catch(() => {});
  }, [error]);

  return (
    <html lang="fr">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Captivia</title>
        <style>{`
          :root { color-scheme: light dark; --bg:#f4f7f2; --ink:#14252b; --muted:#53636a; --accent:#067256; --accent-hover:#055a44; --border:#bfd2c6; }
          @media (prefers-color-scheme: dark) { :root { --bg:#0d1a20; --ink:#edf6f1; --muted:#a7b8ba; --border:#3c5963; } }
          body { margin:0; min-height:100vh; display:flex; align-items:center; justify-content:center; padding:24px; box-sizing:border-box; background:var(--bg); color:var(--ink); font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif; }
          main { max-width:520px; text-align:center; }
          h1 { margin:0 0 8px; font-size:1.6rem; }
          p { margin:0 0 8px; color:var(--muted); line-height:1.5; }
          .ref { font-family:ui-monospace,monospace; font-size:.75rem; }
          .actions { margin-top:24px; display:flex; gap:12px; justify-content:center; flex-wrap:wrap; }
          button, a.btn { font:inherit; font-weight:600; font-size:.9rem; padding:12px 24px; border-radius:12px; cursor:pointer; text-decoration:none; }
          button { border:0; background:var(--accent); color:#fff; }
          button:hover { background:var(--accent-hover); }
          a.btn { border:1px solid var(--border); color:var(--ink); }
          button:focus-visible, a.btn:focus-visible { outline:2px solid var(--accent); outline-offset:2px; }
        `}</style>
      </head>
      <body>
        <main role="alert">
          <h1>
            Une erreur est survenue <span lang="en">/ Something went wrong</span>
          </h1>
          <p>
            Un problème inattendu s&apos;est produit. Veuillez réessayer.
          </p>
          <p lang="en">An unexpected problem occurred. Please try again.</p>
          {error.digest ? <p className="ref">Ref: {error.digest}</p> : null}
          <div className="actions">
            <button type="button" onClick={() => reset()}>
              Réessayer / Try again
            </button>
            {/* Lien natif : le routeur Next peut lui-même être la cause de l'erreur. */}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a className="btn" href="/">
              Accueil / Home
            </a>
          </div>
        </main>
      </body>
    </html>
  );
}
