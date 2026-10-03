'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { useTranslations } from 'next-intl';
import SectionSkeleton from './SectionSkeleton';
import type { SpeciesHealthData, SpeciesLegislationData, SpeciesEquipmentData, SpeciesFoodProduct } from './types';

// Un seul onglet est monté à la fois : son code n'est chargé qu'à la première activation.
const SpeciesHealthTab = dynamic(() => import('./SpeciesHealthTab'), { loading: () => <SectionSkeleton className="h-20" /> });
const SpeciesLegislationTab = dynamic(() => import('./SpeciesLegislationTab'), { loading: () => <SectionSkeleton className="h-20" /> });
const SpeciesEquipmentTab = dynamic(() => import('./SpeciesEquipmentTab'), { loading: () => <SectionSkeleton className="h-20" /> });
const SpeciesFoodTab = dynamic(() => import('./SpeciesFoodTab'), { loading: () => <SectionSkeleton className="h-20" /> });

interface Props {
  speciesHealth: SpeciesHealthData | null;
  speciesLegislation: SpeciesLegislationData | null;
  speciesEquipment: SpeciesEquipmentData | null;
  speciesFood: SpeciesFoodProduct[];
}

export default function SpeciesInfoTabs({ speciesHealth, speciesLegislation, speciesEquipment, speciesFood }: Props) {
  const t = useTranslations();
  const [activeTab, setActiveTab] = useState('health');

  return (
  <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden">
    <div className="border-b border-gray-200 dark:border-gray-700">
      <div className="flex gap-0 px-6">
        <button
          onClick={() => setActiveTab('health')}
          className={`px-4 py-3 font-medium transition-colors ${
            activeTab === 'health'
              ? 'text-emerald-600 border-b-2 border-emerald-600'
              : 'text-gray-600 dark:text-gray-400 hover:text-emerald-600'
          }`}
        >
          {t('species.health')}
        </button>
        <button
          onClick={() => setActiveTab('legislation')}
          className={`px-4 py-3 font-medium transition-colors ${
            activeTab === 'legislation'
              ? 'text-emerald-600 border-b-2 border-emerald-600'
              : 'text-gray-600 dark:text-gray-400 hover:text-emerald-600'
          }`}
        >
          {t('species.legal')}
        </button>
        <button
          onClick={() => setActiveTab('equipment')}
          className={`px-4 py-3 font-medium transition-colors ${
            activeTab === 'equipment'
              ? 'text-emerald-600 border-b-2 border-emerald-600'
              : 'text-gray-600 dark:text-gray-400 hover:text-emerald-600'
          }`}
        >
          {t('species.equipment')}
        </button>
        <button
          onClick={() => setActiveTab('food')}
          className={`px-4 py-3 font-medium transition-colors ${
            activeTab === 'food'
              ? 'text-emerald-600 border-b-2 border-emerald-600'
              : 'text-gray-600 dark:text-gray-400 hover:text-emerald-600'
          }`}
        >
          {t('species.food')}
        </button>
      </div>
    </div>

    <div className="p-6">
          {activeTab === 'health' && <SpeciesHealthTab speciesHealth={speciesHealth} />}
          {activeTab === 'legislation' && <SpeciesLegislationTab speciesLegislation={speciesLegislation} />}
          {activeTab === 'equipment' && <SpeciesEquipmentTab speciesEquipment={speciesEquipment} />}
          {activeTab === 'food' && <SpeciesFoodTab speciesFood={speciesFood} />}
        </div>
      </div>
  );
}
