import { cx } from '@/components/ui';

export interface WeightCurveProps {
  /** Pesées (date ISO, poids en kg), dans n'importe quel ordre. */
  points: { date: string; kg: number }[];
  locale: string;
  /** Description de la courbe (« de 4,1 kg à 4,5 kg en un an »). */
  label: string;
  className?: string;
}

const W = 320;
const H = 120;
const PAD = { top: 12, right: 12, bottom: 22, left: 34 };

/**
 * Courbe de poids au trait (aperçus de la landing) : filets `--line`, tracé à l'encre mousse,
 * valeurs en mono. Même lecture que la courbe du carnet, aux jetons du système.
 */
export function WeightCurve({ points, locale, label, className }: WeightCurveProps) {
  const sorted = [...points].sort((a, b) => a.date.localeCompare(b.date));
  const values = sorted.map((p) => p.kg);
  const min = Math.min(...values) - 0.2;
  const max = Math.max(...values) + 0.2;
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const x = (i: number) => PAD.left + (i / Math.max(1, sorted.length - 1)) * innerW;
  const y = (kg: number) => PAD.top + innerH - ((kg - min) / (max - min)) * innerH;
  const kgFormat = new Intl.NumberFormat(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const monthFormat = new Intl.DateTimeFormat(locale, { month: 'short', timeZone: 'UTC' });
  const ticks = [min + 0.2, (min + max) / 2, max - 0.2];
  const path = sorted.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)} ${y(p.kg).toFixed(1)}`).join(' ');

  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label} className={cx('h-auto w-full', className)}>
      {ticks.map((tick) => (
        <g key={tick}>
          <line x1={PAD.left} x2={W - PAD.right} y1={y(tick)} y2={y(tick)} stroke="var(--line)" strokeWidth="1" />
          <text x={PAD.left - 6} y={y(tick) + 3.5} textAnchor="end" fontSize="10" fill="var(--ink-2)" className="font-mono">
            {kgFormat.format(tick)}
          </text>
        </g>
      ))}
      <path d={path} fill="none" stroke="var(--accent)" strokeWidth="1.75" strokeLinejoin="round" strokeLinecap="round" />
      {sorted.map((p, i) => (
        <g key={p.date}>
          <circle cx={x(i)} cy={y(p.kg)} r="3" fill="var(--surface)" stroke="var(--accent)" strokeWidth="1.5" />
          <text x={x(i)} y={H - 6} textAnchor="middle" fontSize="10" fill="var(--ink-2)" className="font-mono">
            {monthFormat.format(new Date(`${p.date}T12:00:00Z`))}
          </text>
        </g>
      ))}
    </svg>
  );
}
