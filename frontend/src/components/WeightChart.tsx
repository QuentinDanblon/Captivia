'use client';

import { useEffect, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { formatWeight } from '@/lib/today';

interface WeightChartProps {
  measurements: Array<{
    measuredAt: string;
    weightKg?: number | null;
  }>;
}

/**
 * Courbe de poids (SVG maison) : une seule série, trait de 2 px à l'encre mousse, grille
 * horizontale en filet, graduations et dates en mono, dernière valeur étiquetée en bout de
 * courbe. Chaque point porte sa valeur (survol / lecteur d'écran) ; la liste des pesées sous la
 * courbe tient lieu de tableau. Couleurs par jetons : clair et sombre sans variante Tailwind.
 */
export default function WeightChart({ measurements }: WeightChartProps) {
  const t = useTranslations();
  const locale = useLocale();
  // Le repère SVG suit la largeur réelle : textes à leur vraie taille, du mobile au bureau.
  const frameRef = useRef<HTMLElement>(null);
  const [width, setWidth] = useState(600);
  const points = measurements
    .filter((m) => typeof m.weightKg === 'number' && !!m.measuredAt)
    .sort((a, b) => new Date(a.measuredAt).getTime() - new Date(b.measuredAt).getTime())
    .map((m) => ({ ...m, weightKg: m.weightKg as number }));
  const drawable = points.length >= 2;
  useEffect(() => {
    const el = frameRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.max(280, Math.round(entry.contentRect.width))));
    observer.observe(el);
    return () => observer.disconnect();
  }, [drawable]);

  if (!drawable) return null;

  const W = width;
  const H = 180;
  const PAD = { top: 16, right: 72, bottom: 28, left: 64 };
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;

  const weights = points.map((p) => p.weightKg);
  let min = Math.min(...weights);
  let max = Math.max(...weights);
  if (min === max) {
    min -= Math.max(0.05, min * 0.05);
    max += Math.max(0.05, max * 0.05);
  }
  const pad = (max - min) * 0.15;
  min -= pad;
  max += pad;

  const x = (i: number) => PAD.left + (i / (points.length - 1)) * innerW;
  const y = (w: number) => PAD.top + innerH - ((w - min) / (max - min)) * innerH;
  const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p.weightKg).toFixed(1)}`).join(' ');

  const ticks = Array.from({ length: 4 }, (_, i) => min + ((max - min) / 3) * i);
  const maxLabels = Math.max(2, Math.floor(innerW / 70));
  const labelEvery = points.length <= maxLabels ? 1 : Math.ceil(points.length / maxLabels);
  const dayFormat = new Intl.DateTimeFormat(locale, { day: '2-digit', month: 'short' });
  const last = points[points.length - 1];

  return (
    <figure ref={frameRef} className="m-0">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full font-mono" role="img" aria-label={t('animals.weightChartLabel')}>
        {ticks.map((tick) => (
          <g key={tick.toFixed(4)}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(tick)} y2={y(tick)} stroke="var(--line)" strokeWidth={1} />
            <text x={PAD.left - 8} y={y(tick) + 4} textAnchor="end" fontSize={11} fill="var(--ink-2)">
              {formatWeight(tick, locale)}
            </text>
          </g>
        ))}
        <path d={line} fill="none" stroke="var(--accent)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        {points.map((p, i) => (
          <g key={p.measuredAt + i}>
            <circle cx={x(i)} cy={y(p.weightKg)} r={4} fill="var(--accent)" stroke="var(--surface)" strokeWidth={2}>
              <title>{`${dayFormat.format(new Date(p.measuredAt))} · ${formatWeight(p.weightKg, locale)}`}</title>
            </circle>
            {i % labelEvery === 0 || i === points.length - 1 ? (
              <text x={x(i)} y={H - 6} textAnchor="middle" fontSize={11} fill="var(--ink-2)">
                {dayFormat.format(new Date(p.measuredAt))}
              </text>
            ) : null}
          </g>
        ))}
        <text x={x(points.length - 1) + 10} y={y(last.weightKg) + 4} fontSize={12} fontWeight={500} fill="var(--ink)">
          {formatWeight(last.weightKg, locale)}
        </text>
      </svg>
    </figure>
  );
}
