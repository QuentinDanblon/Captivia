import type { GuideCategory } from '@/lib/guides';

/** Primary source pages consulted for the habitat guidance by category. */
export const GUIDE_SOURCES: Record<GuideCategory, { title: string; url: string }[]> = {
  dogs: [
    { title: 'CDC — Cleaning and disinfecting pet supplies', url: 'https://www.cdc.gov/healthy-pets/about/cleaning-and-disinfecting-pet-supplies.html' },
    { title: 'DEFRA — Code of practice for the welfare of dogs', url: 'https://assets.publishing.service.gov.uk/media/5ac78152ed915d76a04b2da6/pb13333-cop-dogs-091204.pdf' },
  ],
  cats: [
    { title: 'CDC — Cleaning and disinfecting pet supplies', url: 'https://www.cdc.gov/healthy-pets/about/cleaning-and-disinfecting-pet-supplies.html' },
    { title: 'DEFRA — Code of practice for the welfare of cats', url: 'https://assets.publishing.service.gov.uk/media/5ac77fa4ed915d76a313cd4e/pb13332-cop-cats-091204.pdf' },
  ],
  rodents: [
    { title: 'RSPCA — Guinea pigs: environment', url: 'https://www.rspca.org.uk/adviceandwelfare/pets/rodents/guineapigs/environment' },
    { title: 'RSPCA — Hamsters: environment', url: 'https://www.rspca.org.uk/adviceandwelfare/pets/rodents/hamsters/environment' },
  ],
  rabbits: [
    { title: 'RSPCA — Rabbits: environment', url: 'https://www.rspca.org.uk/adviceandwelfare/pets/rabbits/environment' },
  ],
  mammals: [
    { title: 'RSPCA — Horses: environment (horse-specific evidence)', url: 'https://www.rspca.org.uk/adviceandwelfare/pets/horses/environment' },
    { title: 'RSPCA — Other pets (exotic-pet overview)', url: 'https://www.rspca.org.uk/adviceandwelfare/pets/other' },
  ],
  birds: [
    { title: 'RSPCA — Other pets: pet birds', url: 'https://www.rspca.org.uk/adviceandwelfare/pets/other' },
  ],
  reptiles: [
    { title: 'MSD Veterinary Manual — Management of reptiles', url: 'https://www.msdvetmanual.com/exotic-and-laboratory-animals/reptiles/management-of-reptiles' },
  ],
  amphibians: [
    { title: 'MSD Veterinary Manual — Environment and husbandry for amphibians', url: 'https://www.msdvetmanual.com/exotic-and-laboratory-animals/amphibians/environment-and-husbandry-for-amphibians' },
  ],
  freshwater: [
    { title: 'RSPCA — Fish: environment', url: 'https://www.rspca.org.uk/adviceandwelfare/pets/fish/environment' },
  ],
  marine: [
    { title: 'OATA — How to set up and look after a marine tank aquarium', url: 'https://ornamentalfish.org/what-we-do/advice-information/care-sheets/caresheets-marine-fish/how-to-set-up-and-look-after-a-marine-tank-aquarium/' },
  ],
  insects: [
    { title: 'Amateur Entomologists’ Society — Stick insects', url: 'https://www.amentsoc.org/insects/caresheets/stick-insects.html' },
  ],
  arachnids: [
    { title: 'Amateur Entomologists’ Society — Tarantulas', url: 'https://www.amentsoc.org/insects/caresheets/tarantula.html' },
    { title: 'Amateur Entomologists’ Society — Scorpions', url: 'https://www.amentsoc.org/insects/caresheets/scorpions.html' },
  ],
};
