import createMiddleware from 'next-intl/middleware';
import { NextRequest, NextResponse } from 'next/server';
import { routing } from '../i18n/routing';

const intlMiddleware = createMiddleware(routing);

export default function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip static files (public/, favicon, sw.js, badges/*.svg, ...) so they are
  // served as-is instead of being rewritten to /<locale>/... (404 otherwise).
  // Note: the extension exclusion cannot live in the matcher regex (crashes
  // Next.js build with "The string did not match the expected pattern"), so we
  // do it here with an early return.
  // /.well-known/* (apple-app-site-association, assetlinks.json…) ne doit jamais être localisé.
  // Exception : un pseudo de la communauté peut contenir un point (`/communaute/u/gecko.lea`).
  const isMemberProfile = /^(\/[a-z]{2})?\/communaute\/u\/[^/]+\/?$/.test(pathname);
  if (pathname.startsWith('/.well-known/') || (/\.[a-zA-Z0-9]+$/.test(pathname) && !isMemberProfile)) {
    return NextResponse.next();
  }
  // Images Open Graph (`/<locale>/opengraph-image-…`) : servies telles quelles, y compris pour la
  // locale par défaut — sans quoi `og:image` répondrait par une redirection 307 vers l'URL sans
  // préfixe.
  if (/^\/[a-z]{2}\/opengraph-image/.test(pathname)) {
    return NextResponse.next();
  }

  return intlMiddleware(request);
}

// Match all pathnames except api, _next, _vercel (path-to-regexp compatible for Next.js 16/Turbopack)
export const config = {
  matcher: ['/((?!api|_next|_vercel).*)'],
};
