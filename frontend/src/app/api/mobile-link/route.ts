import { NextRequest, NextResponse } from 'next/server';
import os from 'os';

/**
 * Retourne l’IP locale du serveur et le lien pour ouvrir le site sur le téléphone (même Wi‑Fi).
 * Usage strictement local (dev) : hors `NODE_ENV=development`, la route répond 404
 * (ne jamais exposer l’IP LAN du serveur en production) ; en dev, toute requête dont
 * l’hôte n’est pas localhost/127.0.0.1 reçoit aussi un 404.
 */
export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV !== 'development') {
    return new NextResponse(null, { status: 404 });
  }

  const host = request.headers.get('host') || '';
  const hostname = host.split(':')[0].toLowerCase();
  const isLocal =
    hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1' || hostname === '[::1]';

  if (!isLocal) {
    return NextResponse.json({ enabled: false }, { status: 404 });
  }

  const port = process.env.PORT || '3000';
  let ip = 'localhost';

  try {
    const nets = os.networkInterfaces();
    for (const name of Object.keys(nets)) {
      const interfaces = nets[name];
      if (!interfaces) continue;
      for (const net of interfaces) {
        if (net.family === 'IPv4' && !net.internal) {
          ip = net.address;
          break;
        }
      }
      if (ip !== 'localhost') break;
    }
  } catch {
    // keep localhost
  }

  const base = `http://${ip}:${port}`;
  return NextResponse.json({
    ip,
    port,
    url: base,
    urlFr: `${base}/fr`,
  });
}
