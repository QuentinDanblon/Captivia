'use client';

interface WeightChartProps {
  measurements: Array<{
    measuredAt: string;
    weightKg?: number | null;
  }>;
}

/**
 * Courbe de poids minimaliste (SVG maison, sans dépendance externe).
 * Affiche le poids (kg) en ordonnée et la date en abscisse, avec
 * échelle automatique min/max des poids.
 */
export default function WeightChart({ measurements }: WeightChartProps) {
  const points = measurements
    .filter((m) => typeof m.weightKg === 'number' && !!m.measuredAt)
    .sort(
      (a, b) => new Date(a.measuredAt).getTime() - new Date(b.measuredAt).getTime()
    )
    .map((m) => ({ ...m, weightKg: m.weightKg as number }));

  if (points.length < 2) return null;

  const W = 600;
  const H = 190;
  const PAD = { top: 18, right: 18, bottom: 30, left: 48 };
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;

  const weights = points.map((p) => p.weightKg);
  let min = Math.min(...weights);
  let max = Math.max(...weights);
  if (min === max) {
    min -= 1;
    max += 1;
  }
  const pad = (max - min) * 0.15 || 1;
  min -= pad;
  max += pad;

  const x = (i: number) =>
    PAD.left + (points.length === 1 ? innerW / 2 : (i / (points.length - 1)) * innerW);
  const y = (w: number) => PAD.top + innerH - ((w - min) / (max - min)) * innerH;

  const line = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p.weightKg).toFixed(1)}`)
    .join(' ');

  const tickCount = 4;
  const ticks = Array.from({ length: tickCount + 1 }, (_, i) => min + ((max - min) / tickCount) * i);
  const labelEvery = points.length <= 8 ? 1 : Math.ceil(points.length / 4);

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full h-auto"
      role="img"
      aria-label="Courbe de poids"
    >
      {/* Grille horizontale + labels (kg) */}
      {ticks.map((t) => (
        <g key={t.toFixed(2)}>
          <line
            x1={PAD.left}
            x2={W - PAD.right}
            y1={y(t)}
            y2={y(t)}
            stroke="currentColor"
            className="text-gray-200 dark:text-gray-700"
            strokeWidth={1}
          />
          <text
            x={PAD.left - 8}
            y={y(t) + 4}
            textAnchor="end"
            fontSize={11}
            className="fill-gray-400 dark:fill-gray-500"
          >
            {t.toFixed(1)}
          </text>
        </g>
      ))}

      {/* Ligne de la courbe */}
      <polyline
        points={line}
        fill="none"
        stroke="#10b981"
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Points + dates */}
      {points.map((p, i) => (
        <g key={p.measuredAt + i}>
          <circle cx={x(i)} cy={y(p.weightKg)} r={4} fill="#10b981" stroke="#fff" strokeWidth={1.5} />
          {i % labelEvery === 0 && (
            <text
              x={x(i)}
              y={H - 8}
              textAnchor="middle"
              fontSize={10}
              className="fill-gray-400 dark:fill-gray-500"
            >
              {new Date(p.measuredAt).toLocaleDateString(undefined, { day: '2-digit', month: '2-digit' })}
            </text>
          )}
        </g>
      ))}
    </svg>
  );
}
