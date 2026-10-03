'use client';

import { useId, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Card, Field } from '@/components/ui';

/** Geometry only; no stocking density or husbandry minimum is inferred. */
export function habitatVolume(length: number, width: number, height: number): number | null {
  if (![length, width, height].every((value) => Number.isFinite(value) && value > 0 && value <= 50_000)) return null;
  return length * width * height / 1_000;
}

export function HabitatPlan({ equipment = [] }: { equipment?: string[] }) {
  const t = useTranslations('guides');
  const locale = useLocale();
  const figureId = useId();
  const [length, setLength] = useState('');
  const [width, setWidth] = useState('');
  const [height, setHeight] = useState('');
  const [positions, setPositions] = useState<string[]>([]);
  const dimensions = [Number(length), Number(width), Number(height)];
  const volume = habitatVolume(dimensions[0], dimensions[1], dimensions[2]);
  const nf = new Intl.NumberFormat(locale, { maximumFractionDigits: 2 });

  function view(vertical: number, label: string, dimension: number, topView = false) {
    const scale = Math.min(280 / dimensions[0], 140 / vertical);
    const w = dimensions[0] * scale;
    const h = vertical * scale;
    const x = (400 - w) / 2;
    const y = (210 - h) / 2;
    return <svg viewBox="0 0 400 260" role="img" aria-label={label} className="w-full text-ink">
      <title>{label}</title>
      <rect x={x} y={y} width={w} height={h} fill="none" stroke="currentColor" strokeWidth="2" />
      {topView ? equipment.slice(0, 5).map((material, index) => {
        const position = positions[index] ?? 'none';
        if (position === 'none') return null;
        const markerX = position === 'left' ? 0.2 : position === 'right' ? 0.8 : 0.5;
        const markerY = 0.15 + index * 0.15;
        return <g key={`${index}-${material}`} aria-hidden="true">
          <circle cx={x + w * markerX} cy={y + h * markerY} r="12" fill="var(--paper)" stroke="currentColor" strokeWidth="1.5" />
          <text x={x + w * markerX} y={y + h * markerY + 5} textAnchor="middle" fill="currentColor" className="font-mono" fontSize="18">{index + 1}</text>
        </g>;
      }) : null}
      <path d={`M${x},${y + h + 14} h${w} M${x},${y + h + 8} v12 M${x + w},${y + h + 8} v12`} fill="none" stroke="currentColor" />
      <text x="200" y={y + h + 38} textAnchor="middle" fill="currentColor" className="font-mono text-ui">{nf.format(dimensions[0])} cm</text>
      <path d={`M${x + w + 14},${y} v${h} M${x + w + 8},${y} h12 M${x + w + 8},${y + h} h12`} fill="none" stroke="currentColor" />
      <text x={x + w + 24} y={y + h / 2} fill="currentColor" className="font-mono text-ui" transform={`rotate(90,${x + w + 24},${y + h / 2})`} textAnchor="middle">{nf.format(dimension)} cm</text>
    </svg>;
  }

  return <Card as="section" title={t('planTitle')} titleId={figureId}>
    <p className="mt-0 text-ink-2">{t('planIntro')}</p>
    <details className="mb-4">
      <summary className="min-h-11 cursor-pointer py-2 text-ui font-medium">{t('planEquipment')}</summary>
      <div className="grid gap-3 pt-3 sm:grid-cols-2">
        {equipment.slice(0, 5).map((material, index) => <Field key={`${index}-${material}`} label={material}>
          <select
            value={positions[index] ?? 'none'}
            onChange={(event) => setPositions((current) => {
              const next = [...current];
              next[index] = event.target.value;
              return next;
            })}
          >
            {(['none', 'left', 'centre', 'right'] as const).map((position) => <option key={position} value={position}>{t(`planPositions.${position}`)}</option>)}
          </select>
        </Field>)}
      </div>
    </details>
    <div className="grid gap-3 sm:grid-cols-3">
      {[
        { key: 'length', value: length, set: setLength },
        { key: 'width', value: width, set: setWidth },
        { key: 'height', value: height, set: setHeight },
      ].map((field) => <Field key={field.key} label={t(field.key)}>
        <input type="number" min="0.1" max="50000" step="any" inputMode="decimal" value={field.value} onChange={(event) => field.set(event.target.value)} />
      </Field>)}
    </div>
    {volume === null ? <p className="text-meta text-ink-2">{t('planHint')}</p> : <div className="mt-5 grid gap-4">
      <div className="grid gap-4 sm:grid-cols-2" aria-label={t('planAlt', { length: nf.format(dimensions[0]), width: nf.format(dimensions[1]), height: nf.format(dimensions[2]) })}>
        <figure className="m-0 rounded-control border border-line bg-paper p-3">
          <figcaption className="text-ui font-medium">{t('planTop')}</figcaption>
          {view(dimensions[1], t('planTop'), dimensions[1], true)}
        </figure>
        <figure className="m-0 rounded-control border border-line bg-paper p-3">
          <figcaption className="text-ui font-medium">{t('planFront')}</figcaption>
          {view(dimensions[2], t('planFront'), dimensions[2])}
        </figure>
      </div>
      {equipment.slice(0, 5).some((_, index) => (positions[index] ?? 'none') !== 'none') ? <ol className="m-0 grid list-none gap-1 p-0 text-meta text-ink-2">
        {equipment.slice(0, 5).map((material, index) => {
          const position = positions[index] ?? 'none';
          return position === 'none' ? null : <li key={`${index}-${material}`}>{index + 1}. {material} — {t(`planPositions.${position}`)}</li>;
        })}
      </ol> : null}
      <output aria-live="polite" className="font-mono text-body">{t('planVolume', { litres: nf.format(volume) })}</output>
      <p className="m-0 text-meta text-ink-2">{t('planVolumeHint')}</p>
    </div>}
  </Card>;
}
