import type { AgendaItem } from './agenda.types';
import type { AgendaLabels } from './agenda.labels';

/** Longueur de ligne maximale RFC 5545 §3.1 (octets, hors CRLF). */
const MAX_LINE_OCTETS = 75;
const DEFAULT_DURATION_MS = 30 * 60 * 1000;
const VET_DURATION_MS = 60 * 60 * 1000;

/**
 * Échappe une valeur de type TEXT (RFC 5545 §3.3.11) : `\`, `;`, `,` et fins de ligne.
 * Les caractères de contrôle (hors saut de ligne) sont supprimés : ils casseraient le flux.
 */
export function escapeIcsText(value: string): string {
  return (
    value
      // eslint-disable-next-line no-control-regex -- la plage de caractères de contrôle est précisément l'objet de ce nettoyage
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
      .replace(/\\/g, '\\\\')
      .replace(/;/g, '\\;')
      .replace(/,/g, '\\,')
      .replace(/\r\n|\r|\n/g, '\\n')
  );
}

/**
 * Plie une ligne de contenu à 75 octets (§3.1) : coupe sur une frontière de caractère UTF-8
 * (jamais au milieu d'un caractère multi-octets) ; chaque suite commence par une espace.
 */
export function foldLine(line: string): string {
  const out: string[] = [];
  let current = '';
  let octets = 0;
  for (const ch of line) {
    const size = Buffer.byteLength(ch, 'utf8');
    if (octets + size > MAX_LINE_OCTETS) {
      out.push(current);
      current = ' ';
      octets = 1;
    }
    current += ch;
    octets += size;
  }
  out.push(current);
  return out.join('\r\n');
}

const pad = (n: number, width = 2): string => String(n).padStart(width, '0');

/** `YYYYMMDDTHHMMSSZ` (heure UTC, §3.3.5). */
export function formatUtcDateTime(d: Date): string {
  return (
    `${pad(d.getUTCFullYear(), 4)}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}` +
    `T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
  );
}

/** `YYYYMMDD` à partir d'un `YYYY-MM-DD` (§3.3.4). */
export function formatDateValue(day: string): string {
  return day.replace(/-/g, '');
}

function nextDay(day: string): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

/** UID stable (TEXT) : la même occurrence garde le même UID d'une synchronisation à l'autre. */
function uidFor(item: AgendaItem): string {
  return `${item.id.replace(/[^A-Za-z0-9:._-]/g, '-')}@captivia`;
}

export interface BuildIcsOptions {
  labels: AgendaLabels;
  now: Date;
}

/** Construit un VCALENDAR (RFC 5545) à partir des éléments de l'agenda. Lignes CRLF, pliées à 75 octets. */
export function buildIcs(
  items: AgendaItem[],
  { labels, now }: BuildIcsOptions,
): string {
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Captivia//Care Agenda//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeIcsText(labels.calendarName)}`,
    `X-WR-CALDESC:${escapeIcsText(labels.calendarDescription)}`,
    'REFRESH-INTERVAL;VALUE=DURATION:PT6H',
    'X-PUBLISHED-TTL:PT6H',
  ];
  const stamp = formatUtcDateTime(now);

  for (const item of items) {
    const typeLabel = labels.itemTypes[item.type];
    const summary =
      item.type === 'routine'
        ? `${item.title} - ${item.animalName}`
        : `${typeLabel}: ${item.title} - ${item.animalName}`;
    const description = [item.detail, `${item.animalName} (${typeLabel})`]
      .filter((v): v is string => !!v)
      .join('\n');

    lines.push('BEGIN:VEVENT', `UID:${uidFor(item)}`, `DTSTAMP:${stamp}`);
    if (item.allDay) {
      lines.push(
        `DTSTART;VALUE=DATE:${formatDateValue(item.day)}`,
        `DTEND;VALUE=DATE:${formatDateValue(nextDay(item.day))}`,
      );
    } else {
      const start = new Date(item.date);
      const duration =
        item.type === 'vet_appointment' ? VET_DURATION_MS : DEFAULT_DURATION_MS;
      lines.push(
        `DTSTART:${formatUtcDateTime(start)}`,
        `DTEND:${formatUtcDateTime(new Date(start.getTime() + duration))}`,
      );
    }
    lines.push(
      `SUMMARY:${escapeIcsText(summary)}`,
      `DESCRIPTION:${escapeIcsText(description)}`,
      `CATEGORIES:${escapeIcsText(typeLabel)}`,
      `STATUS:${item.status === 'cancelled' || item.status === 'skipped' ? 'CANCELLED' : 'CONFIRMED'}`,
      `TRANSP:${item.type === 'vet_appointment' ? 'OPAQUE' : 'TRANSPARENT'}`,
      'END:VEVENT',
    );
  }

  lines.push('END:VCALENDAR');
  return lines.map(foldLine).join('\r\n') + '\r\n';
}
