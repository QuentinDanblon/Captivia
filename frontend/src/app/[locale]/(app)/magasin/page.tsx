'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { api } from '@/lib/api';
import { errorKey } from '@/lib/api-errors';
import { Link } from '@/i18n/navigation';
import {
  Alert,
  AnimalSilhouette,
  Badge,
  Card,
  EmptyState,
  ExternalLink,
  Field,
  SectionHeader,
  Skeleton,
  SkeletonGroup,
  buttonClasses,
} from '@/components/ui';

interface AffiliateStore {
  id: string;
  name: string;
  url: string;
  description?: string | null;
  categories: string[];
  types: string[];
}

// Les valeurs correspondent aux catégories stockées côté API (en français).
const CATEGORY_OPTIONS = [
  { value: '', labelKey: 'store.allCategories' },
  { value: 'mammifère', labelKey: 'store.categoryMammal' },
  { value: 'reptile', labelKey: 'store.categoryReptile' },
  { value: 'oiseau', labelKey: 'store.categoryBird' },
  { value: 'poisson', labelKey: 'store.categoryFish' },
  { value: 'amphibien', labelKey: 'store.categoryAmphibian' },
  { value: 'insecte', labelKey: 'store.categoryInsect' },
  { value: 'arachnide', labelKey: 'store.categoryArachnid' },
] as const;

function safeHref(url: string): string {
  if (!url || typeof url !== 'string') return '#';
  const trimmed = url.trim();
  try {
    new URL(trimmed);
    return trimmed;
  } catch {
    return trimmed.startsWith('http') ? trimmed : '#';
  }
}

/**
 * Boutiques partenaires (liens d'affiliation, API /affiliate-stores). Tant qu'aucune boutique
 * n'est référencée, la page le dit et renvoie vers les fiches espèces : aucun produit factice,
 * aucune mention d'affiliation sans lien d'affiliation.
 */
export default function MagasinPage() {
  const t = useTranslations();
  const [stores, setStores] = useState<AffiliateStore[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState('');

  useEffect(() => {
    let cancelled = false;
    api
      .getAffiliateStores(selectedCategory || undefined, undefined)
      .then((data) => {
        if (!cancelled) setStores(Array.isArray(data) ? data : []);
      })
      .catch((err) => {
        if (!cancelled) {
          // Détail traduit selon l'erreur, jamais le message brut de l'API.
          setError(t(errorKey(err)));
          setStores([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedCategory, t]);

  // Aucune boutique du tout (pas seulement pour le filtre choisi) : pas de filtre à proposer.
  const catalogEmpty = !loading && !error && stores.length === 0 && selectedCategory === '';

  return (
    <div className="cv-container grid gap-6 py-6 sm:py-8">
      <SectionHeader title={t('store.pageTitle')} description={t('store.lead')} />

      {!catalogEmpty ? (
        <Field label={t('store.filterByCategory')} id="store-category-filter" className="max-w-xs">
          <select
            value={selectedCategory}
            onChange={(e) => {
              setLoading(true);
              setError(null);
              setSelectedCategory(e.target.value);
            }}
          >
            {CATEGORY_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {t(opt.labelKey)}
              </option>
            ))}
          </select>
        </Field>
      ) : null}

      {loading ? (
        <SkeletonGroup label={t('common.loading')} className="grid gap-6 md:grid-cols-2">
          <Skeleton shape="block" height={200} />
          <Skeleton shape="block" height={200} />
        </SkeletonGroup>
      ) : error ? (
        <Alert severity="urgent" title={t('store.loadError')}>
          {error}
        </Alert>
      ) : catalogEmpty ? (
        <EmptyState
          size="page"
          headingLevel={2}
          illustration={<AnimalSilhouette kind="other" size={72} />}
          title={t('store.emptyTitle')}
          benefit={t('store.emptyBenefit')}
          action={
            <Link href="/" className={buttonClasses({ variant: 'secondary' })}>
              {t('store.emptyAction')}
            </Link>
          }
        />
      ) : stores.length === 0 ? (
        <EmptyState headingLevel={2} title={t('store.noMatchTitle')} benefit={t('store.noMatchBenefit')} />
      ) : (
        <>
          <ul className="m-0 grid list-none gap-6 p-0 md:grid-cols-2">
            {stores.map((store) => {
              const href = safeHref(store.url);
              return (
                <Card as="li" key={store.id} className="flex flex-col gap-4">
                  <h2 className="m-0 font-display text-h4 font-semibold text-ink">{store.name}</h2>
                  {store.description ? <p className="m-0 flex-1 text-ui text-ink-2">{store.description}</p> : null}
                  {store.types?.length ? (
                    <div className="flex flex-wrap gap-2">
                      {store.types.map((type) => (
                        <Badge key={type}>{type}</Badge>
                      ))}
                    </div>
                  ) : null}
                  {href !== '#' ? (
                    <ExternalLink
                      href={href}
                      rel="sponsored"
                      className={buttonClasses({ variant: 'secondary', className: 'self-start' })}
                    >
                      {t('store.visitStore')}
                      <svg viewBox="0 0 16 16" className="size-4" fill="none" aria-hidden="true">
                        <path d="M6.5 3.5h-3v9h9v-3M9.5 3.5h3v3M12.5 3.5 7.5 8.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      <span className="sr-only">{t('plans.newTab')}</span>
                    </ExternalLink>
                  ) : null}
                </Card>
              );
            })}
          </ul>

          {/* Mention d'affiliation : seulement quand des liens d'affiliation sont affichés. */}
          <aside className="grid gap-1 border-t border-line pt-4 text-meta text-ink-2">
            <p className="m-0">{t('store.disclaimer')}</p>
            <Link href="/transparency" className="justify-self-start text-accent-text underline underline-offset-2">
              {t('footer.transparency')}
            </Link>
          </aside>
        </>
      )}
    </div>
  );
}
