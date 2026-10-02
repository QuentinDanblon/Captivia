import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Captivia – Le guide de la faune',
    short_name: 'Captivia',
    description:
      "Le guide pédagogique et bienveillant pour les propriétaires d'animaux domestiques et NAC.",
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#f4f7f2',
    theme_color: '#0aa678',
    lang: 'fr',
    categories: ['lifestyle', 'education', 'utilities'],
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
