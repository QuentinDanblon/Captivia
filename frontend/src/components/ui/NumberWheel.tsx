'use client';

import { useEffect, useRef, type KeyboardEvent } from 'react';
import { cx } from './cx';

interface NumberWheelProps {
  id: string;
  label: string;
  hint: string;
  max: number;
  value: number;
  valueText: (value: number) => string;
  onChange: (value: number) => void;
}

/** Roulette tactile : trois lignes de 44 px, cran central, clavier et lecteur d'écran. */
export default function NumberWheel({ id, label, hint, max, value, valueText, onChange }: NumberWheelProps) {
  const wheel = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    wheel.current?.scrollTo({ top: (value - 1) * 44, behavior: 'instant' });
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [value, max]);

  function select(next: number) {
    const clamped = Math.max(1, Math.min(max, next));
    wheel.current?.scrollTo({ top: (clamped - 1) * 44, behavior: 'instant' });
    if (clamped !== value) onChange(clamped);
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const next = {
      ArrowUp: value + 1, ArrowDown: value - 1,
      ArrowRight: value + 1, ArrowLeft: value - 1,
      PageUp: value + 5, PageDown: value - 5, Home: 1, End: max,
    }[event.key];
    if (next === undefined) return;
    event.preventDefault();
    select(next);
  }

  return (
    <div className="grid min-w-0 gap-1.5">
      <span id={`${id}-label`} className="text-ui font-medium text-ink">{label}</span>
      <div className="relative rounded-control border border-line-field bg-surface">
        <div
          ref={wheel}
          id={id}
          role="spinbutton"
          tabIndex={0}
          aria-labelledby={`${id}-label`}
          aria-describedby={`${id}-hint`}
          aria-valuemin={1}
          aria-valuemax={max}
          aria-valuenow={value}
          aria-valuetext={valueText(value)}
          onKeyDown={onKeyDown}
          onScroll={() => {
            if (timer.current) clearTimeout(timer.current);
            timer.current = setTimeout(() => {
              const next = Math.max(1, Math.min(max, Math.round((wheel.current?.scrollTop ?? 0) / 44) + 1));
              if (next !== value) onChange(next);
            }, 150);
          }}
          className="h-[132px] snap-y snap-mandatory overflow-y-auto overscroll-contain rounded-control py-[44px]"
        >
          {Array.from({ length: max }, (_, i) => i + 1).map((number) => (
            <button
              key={number}
              type="button"
              tabIndex={-1}
              aria-hidden="true"
              onClick={() => { wheel.current?.focus({ preventScroll: true }); select(number); }}
              className={cx('flex h-[44px] w-full shrink-0 snap-center items-center justify-center px-3 text-ui',
                number === value ? 'bg-accent font-medium text-on-accent' : 'text-ink-2 hover:bg-sunken')}
            >
              {valueText(number)}
            </button>
          ))}
        </div>
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-[44px] h-[44px] border-y border-line-field" />
      </div>
      <p id={`${id}-hint`} className="m-0 text-meta text-ink-2">{hint}</p>
    </div>
  );
}
