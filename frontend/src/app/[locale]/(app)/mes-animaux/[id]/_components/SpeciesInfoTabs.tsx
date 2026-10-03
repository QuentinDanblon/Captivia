'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import * as Tabs from '@radix-ui/react-tabs';
import { useTranslations } from 'next-intl';
import { Card } from '@/components/ui';
import { SectionLoading } from './parts';
import type { SpeciesHealthData, SpeciesLegislationData, SpeciesEquipmentData, SpeciesFoodProduct } from './types';

// Un seul onglet est monté à la fois : son code n'est chargé qu'à la première activation.
const SpeciesHealthTab = dynamic(() => import('./SpeciesHealthTab'), { loading: () => <SectionLoading /> });
const SpeciesLegislationTab = dynamic(() => import('./SpeciesLegislationTab'), { loading: () => <SectionLoading /> });
const SpeciesEquipmentTab = dynamic(() => import('./SpeciesEquipmentTab'), { loading: () => <SectionLoading /> });
const SpeciesFoodTab = dynamic(() => import('./SpeciesFoodTab'), { loading: () => <SectionLoading /> });

interface Props {
  speciesHealth: SpeciesHealthData | null;
  speciesLegislation: SpeciesLegislationData | null;
  speciesEquipment: SpeciesEquipmentData | null;
  speciesFood: SpeciesFoodProduct[];
}

const TAB_CLASS =
  'min-h-11 shrink-0 border-b-2 border-transparent px-3 text-ui font-medium text-ink-2 transition-colors ' +
  'hover:text-ink data-[state=active]:border-accent data-[state=active]:text-ink';

/** Repères de l'espèce (santé, réglementation, matériel, alimentation) en onglets accessibles. */
export default function SpeciesInfoTabs({ speciesHealth, speciesLegislation, speciesEquipment, speciesFood }: Props) {
  const t = useTranslations();
  const [activeTab, setActiveTab] = useState('health');

  return (
    <Card as="section" id="espece" padding="none" aria-labelledby="species-tabs-title" className="scroll-mt-20">
      <Tabs.Root value={activeTab} onValueChange={setActiveTab}>
        <div className="flex flex-wrap items-end justify-between gap-x-4 border-b border-line px-4 pt-4 sm:px-6">
          <h2 id="species-tabs-title" className="m-0 pb-3 font-display text-h4 font-semibold text-ink">
            {t('animals.sheet.speciesTitle')}
          </h2>
          <Tabs.List aria-label={t('animals.sheet.speciesTitle')} className="-mb-px flex max-w-full gap-1 overflow-x-auto">
            <Tabs.Trigger value="health" className={TAB_CLASS}>
              {t('species.health')}
            </Tabs.Trigger>
            <Tabs.Trigger value="legislation" className={TAB_CLASS}>
              {t('species.legal')}
            </Tabs.Trigger>
            <Tabs.Trigger value="equipment" className={TAB_CLASS}>
              {t('species.equipment')}
            </Tabs.Trigger>
            <Tabs.Trigger value="food" className={TAB_CLASS}>
              {t('species.food')}
            </Tabs.Trigger>
          </Tabs.List>
        </div>
        <div className="p-4 sm:p-6">
          <Tabs.Content value="health">{activeTab === 'health' && <SpeciesHealthTab speciesHealth={speciesHealth} />}</Tabs.Content>
          <Tabs.Content value="legislation">
            {activeTab === 'legislation' && <SpeciesLegislationTab speciesLegislation={speciesLegislation} />}
          </Tabs.Content>
          <Tabs.Content value="equipment">
            {activeTab === 'equipment' && <SpeciesEquipmentTab speciesEquipment={speciesEquipment} />}
          </Tabs.Content>
          <Tabs.Content value="food">{activeTab === 'food' && <SpeciesFoodTab speciesFood={speciesFood} />}</Tabs.Content>
        </div>
      </Tabs.Root>
    </Card>
  );
}
