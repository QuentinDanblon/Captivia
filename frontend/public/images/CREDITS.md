# Crédits des images

Toute image servie depuis `public/images/` figure ici **avant** d'être utilisée dans une page.
Règles complètes : `frontend/docs/DESIGN.md`, section « Imagerie ».

- Licences acceptées : **CC0**, **domaine public**, **CC BY** et **CC BY-SA** (attribution obligatoire,
  y compris dans la légende `Figure` : auteur + licence liés à la source).
- Sources : Wikimedia Commons en priorité (licence lue sur la page du fichier, pas sur un site miroir).
- Interdit : images générées par IA, banques d'images sans licence libre, captures d'autres sites,
  licences NC/ND (incompatibles avec la redistribution et le recadrage).
- Fichiers : `public/images/<animals|nature|guides>/<slug>-<largeur>.<avif|webp>`, plusieurs largeurs, plus
  grande variante ≤ 150 Ko, métadonnées (EXIF, XMP, ICC, localisation) retirées.

Le registre utilisé par le code est `src/content/photos.ts` (même liste) : `Figure` affiche le
crédit sous chaque photo (ou en cartouche sur la photo du haut de la landing) et la page
« Sources et licences » reprend ce tableau.

## Vérification

Licence, auteur et attribution relus le 2026-10-02 via l'API de Wikimedia Commons
(`action=query&prop=imageinfo&iiprop=url|extmetadata`, champs `LicenseShortName`, `LicenseUrl`,
`Artist`, `Attribution`, `AttributionRequired`). Téléchargement de la vignette 1920 px fournie par
Commons (ou du fichier original s'il est plus petit), puis traitement avec `sharp`.

**Modifications** (toutes les photos) : recadrage au ratio d'affichage, redimensionnement,
conversion AVIF + WebP, retrait des métadonnées. *Textures de fond* (`moss-forest`, `lemon-balm`) :
léger flou en plus, pour alléger les fichiers. Les adaptations des photos CC BY-SA sont diffusées
sous la même licence.

Les 40 photographies supplémentaires du catalogue ont été vérifiées le **2026-10-03** avec
la même API : licence libre, auteur/attribution et identification taxonomique dans la description
et les catégories de Commons, puis contrôle visuel. Les images sans attribution exploitable,
sous licence non admise ou montrant un autre taxon ont été remplacées. Les variantes ne sont
pas agrandies au-delà de la largeur originale.

Les deux schémas des guides ont été vérifiés le **2026-10-03** dans les métadonnées de la même API.
Ils sont conservés en entier sur fond blanc, redimensionnés et convertis en AVIF + WebP ; la
source vectorielle permet de produire chaque largeur sans recadrage.

## Photographies

| Fichier(s) | Sujet | Titre Commons | Auteur | Licence | Source |
| --- | --- | --- | --- | --- | --- |
| `animals/dog-golden-retriever-{480,800,1200}` | Golden retriever, en forêt (Dülmen, Allemagne) | Dülmen, Hausdülmen, Golden Retriever -- 2022 -- 5945.jpg | Dietmar Rabich | CC BY-SA 4.0 | https://commons.wikimedia.org/wiki/File:D%C3%BClmen,_Hausd%C3%BClmen,_Golden_Retriever_--_2022_--_5945.jpg |
| `animals/dog-river-{640,960,1280,1600}` | Chien dans l'eau, lumière du soir (Laos) | Liver yellow dog in the water looking at viewer at golden hour in Don Det Laos.jpg | Basile Morin | CC BY-SA 4.0 | https://commons.wikimedia.org/wiki/File:Liver_yellow_dog_in_the_water_looking_at_viewer_at_golden_hour_in_Don_Det_Laos.jpg |
| `animals/cat-straw-{480,800,1200}` | Chat roux et blanc couché sur la paille | Felis silvestris catus lying on rice straw.jpg | Basile Morin | CC BY-SA 4.0 | https://commons.wikimedia.org/wiki/File:Felis_silvestris_catus_lying_on_rice_straw.jpg |
| `animals/cat-tabby-{480,800}` | Jeune chat tigré assis (Portugal) | Cat November 2010-1a.jpg | Alvesgaspar | CC BY-SA 3.0 | https://commons.wikimedia.org/wiki/File:Cat_November_2010-1a.jpg |
| `animals/rabbit-straw-{480,800,1200}` | Lapin noir et blanc buvant dans une gamelle | Conejo común (Oryctolagus cuniculus), Tierpark Hellabrunn, Múnich, Alemania, 2012-06-17, DD 02.JPG | Diego Delso | CC BY-SA 3.0 | https://commons.wikimedia.org/wiki/File:Conejo_com%C3%BAn_(Oryctolagus_cuniculus),_Tierpark_Hellabrunn,_M%C3%BAnich,_Alemania,_2012-06-17,_DD_02.JPG |
| `animals/cockatiels-{480,800,1200}` | Trois calopsittes sur une branche | Nymphicus hollandicus - Forst 01.jpg | H. Zell | CC BY-SA 3.0 | https://commons.wikimedia.org/wiki/File:Nymphicus_hollandicus_-_Forst_01.jpg |
| `animals/budgerigars-{480,800,1200}` | Deux perruches ondulées | Melopsittacus undulatus - Vogelpark Steinen 02.jpg | H. Zell | CC BY-SA 3.0 | https://commons.wikimedia.org/wiki/File:Melopsittacus_undulatus_-_Vogelpark_Steinen_02.jpg |
| `animals/leopard-gecko-{480,800}` | Gecko léopard sur le sable | Eublepharis macularius 2009 G6.jpg | George Chernilevsky | Domaine public | https://commons.wikimedia.org/wiki/File:Eublepharis_macularius_2009_G6.jpg |
| `animals/bearded-dragon-{480,800}` | Tête de pogona (agame barbu) | 383 - Head of central bearded dragon (Pogona vitticeps).jpg | Virtual-Pano | CC BY 4.0 | https://commons.wikimedia.org/wiki/File:383_-_Head_of_central_bearded_dragon_(Pogona_vitticeps).jpg |
| `animals/neon-tetra-{480,800,1200}` | Néon (tétra) en aquarium | Neonsalmler Paracheirodon innesi.jpg | Holger Krisp | CC BY 3.0 | https://commons.wikimedia.org/wiki/File:Neonsalmler_Paracheirodon_innesi.jpg |
| `animals/horse-{480,800}` | Portrait d'un cheval lusitanien | Horse December 2014-1.jpg | Alvesgaspar | CC BY-SA 4.0 | https://commons.wikimedia.org/wiki/File:Horse_December_2014-1.jpg |
| `animals/hen-{480,800,1200}` | Poule rousse | Hen chicken.jpg | Thegreenj | CC BY-SA 3.0 | https://commons.wikimedia.org/wiki/File:Hen_chicken.jpg |
| `nature/moss-forest-{640,960,1280}` | Sous-bois moussu (Lierneux, Belgique) | Mossy forest in Lierneux (DSC01260).jpg | Trougnouf (Benoit Brummer) | CC BY 4.0 | https://commons.wikimedia.org/wiki/File:Mossy_forest_in_Lierneux_(DSC01260).jpg |
| `nature/grass-droplets-{800,1200,1600}` | Brins d'herbe et gouttes de rosée (Lisbonne) | Grass blades with water droplets, Parque Florestal de Monsanto, Lisbon, Portugal (approx. GPS location) julesvernex2.jpg | Jules Verne Times Two | CC BY-SA 4.0 | https://commons.wikimedia.org/wiki/File:Grass_blades_with_water_droplets,_Parque_Florestal_de_Monsanto,_Lisbon,_Portugal_(approx._GPS_location)_julesvernex2.jpg |
| `nature/lemon-balm-{640,960,1280}` | Feuilles de mélisse | Mélisse Feuilles FR 2013b.jpg | JLPC / Wikimedia Commons | CC BY-SA 3.0 | https://commons.wikimedia.org/wiki/File:M%C3%A9lisse_Feuilles_FR_2013b.jpg |
| `animals/guinea-pig-{480,800}` | Cochon d'Inde (Cavia porcellus) | Yoyocochondinde.JPG | Variraptor | CC BY-SA 3.0 | https://commons.wikimedia.org/wiki/File:Yoyocochondinde.JPG |
| `animals/syrian-hamster-{480,800}` | Hamster doré (Mesocricetus auratus) | Golden hamster front 1.jpg | Adamjennison111 at English Wikipedia | CC BY 2.5 | https://commons.wikimedia.org/wiki/File:Golden_hamster_front_1.jpg |
| `animals/ferret-{480,800}` | Furet (Mustela putorius furo) | Ferret 2008.png | Alfredo Gutiérrez | CC BY-SA 4.0 | https://commons.wikimedia.org/wiki/File:Ferret_2008.png |
| `animals/chinchilla-{480,800}` | Chinchilla (Chinchilla lanigera) | Chinchilla lanigera1.jpg | Trurl66 | Domaine public | https://commons.wikimedia.org/wiki/File:Chinchilla_lanigera1.jpg |
| `animals/domestic-mouse-{480,800}` | Souris blanche domestique (Mus musculus domesticus) | Farbmaeuse.jpg | Whitesky | CC BY-SA 3.0 | https://commons.wikimedia.org/wiki/File:Farbmaeuse.jpg |
| `animals/domestic-rat-{480,800}` | Rat domestique (Rattus norvegicus domesticus) | Rats-domestique.jpg | Alexalouest | CC0 | https://commons.wikimedia.org/wiki/File:Rats-domestique.jpg |
| `animals/canary-{480,800}` | Canari (Serinus canaria domesticus) | GelbA.JPG | NEWSchr | CC BY-SA 4.0 | https://commons.wikimedia.org/wiki/File:GelbA.JPG |
| `animals/african-grey-{480,800}` | Perroquet Gris d'Afrique (Psittacus erithacus) | Psittacus_erithacus_qtl1.jpg | Quartl | CC BY-SA 3.0 | https://commons.wikimedia.org/wiki/File:Psittacus_erithacus_qtl1.jpg |
| `animals/boa-constrictor-{480,800}` | Boa Constricteur (Boa constrictor) | Boa_constrictor_Gallion_Guyane.jpg | Arnaud Aury | CC BY 4.0 | https://commons.wikimedia.org/wiki/File:Boa_constrictor_Gallion_Guyane.jpg |
| `animals/ball-python-{480,800}` | Python Royal (Python regius) | Ball_python_lucy.JPG | Mokele at English Wikipedia | CC BY-SA 3.0 | https://commons.wikimedia.org/wiki/File:Ball_python_lucy.JPG |
| `animals/green-iguana-{480,800}` | Iguane Vert (Iguana iguana) | Iguanidae_head_from_Venezuela.jpg | Wilfredor | CC0 | https://commons.wikimedia.org/wiki/File:Iguanidae_head_from_Venezuela.jpg |
| `animals/red-eared-slider-{480,800}` | Tortue à Oreilles Rouges (Trachemys scripta elegans) | Roodwangsierschildpad.jpg | Fruggo | CC BY-SA 3.0 | https://commons.wikimedia.org/wiki/File:Roodwangsierschildpad.jpg |
| `animals/veiled-chameleon-{480,800}` | Caméléon Casqué (Chamaeleo calyptratus) | 2017-05-13_AT_Wien_22_Donaustadt,_Palmenhaus_Hirschstetten,_Chamaeleo_calyptratus_(51099601593).jpg | Paul Korecky | CC BY-SA 2.0 | https://commons.wikimedia.org/wiki/File:2017-05-13_AT_Wien_22_Donaustadt,_Palmenhaus_Hirschstetten,_Chamaeleo_calyptratus_(51099601593).jpg |
| `animals/axolotl-{480,800}` | Axolotl (Ambystoma mexicanum) | Ambystoma_mexicanum_-_Aksolotli,_Mexican_axolotl_C_IMG_3700.JPG | Anneli Salo | CC BY-SA 3.0 | https://commons.wikimedia.org/wiki/File:Ambystoma_mexicanum_-_Aksolotli,_Mexican_axolotl_C_IMG_3700.JPG |
| `animals/goldfish-{480,800}` | Poisson Rouge (Carassius auratus) | Gold fish1.jpg | לינה אבוגוש | CC BY-SA 3.0 | https://commons.wikimedia.org/wiki/File:Gold_fish1.jpg |
| `animals/betta-{320,425}` | Combattant (Betta) (Betta splendens) | Betta splendens - Flickr - Nippyfish.jpg | Nippyfish | CC BY 2.0 | https://commons.wikimedia.org/wiki/File:Betta_splendens_-_Flickr_-_Nippyfish.jpg |
| `animals/guppy-{320,378}` | Guppy (Poecilia reticulata) | Guppy_coppia_gialla.jpg | Marrabbio2 | CC BY-SA 3.0 | https://commons.wikimedia.org/wiki/File:Guppy_coppia_gialla.jpg |
| `animals/stick-insect-{320,734}` | Phasme Bâton (Carausius morosus) | Carausius morosus-adult1.JPG | Dinosaur918 | CC BY-SA 3.0 | https://commons.wikimedia.org/wiki/File:Carausius_morosus-adult1.JPG |
| `animals/hissing-cockroach-{480,800}` | Blatte de Madagascar (Gromphadorhina portentosa) | Female_Madagascar_hissing_cockroach.JPG | Almabes at English Wikipedia | Domaine public | https://commons.wikimedia.org/wiki/File:Female_Madagascar_hissing_cockroach.JPG |
| `animals/emperor-scorpion-{480,800}` | Scorpion Empereur (Pandinus imperator) | Pandinus-imperator-6609.jpg | Danny Steaven | CC BY-SA 3.0 | https://commons.wikimedia.org/wiki/File:Pandinus-imperator-6609.jpg |
| `animals/bullfrog-{480,800}` | Grenouille Taureau (Lithobates catesbeianus) | North-American-bullfrog1.jpg | Carl D. Howe | CC BY-SA 2.5 | https://commons.wikimedia.org/wiki/File:North-American-bullfrog1.jpg |
| `animals/russian-hamster-{480,800}` | Hamster russe (Phodopus sungorus) | Phodopus_sungorus2.jpg | Dirk Goldhahn | CC BY-SA 2.5 | https://commons.wikimedia.org/wiki/File:Phodopus_sungorus2.jpg |
| `animals/campbell-hamster-{320,360}` | Hamster de Campbell (Phodopus campbelli) | Campbell_hamster_blue_fawn.jpg | Allen Huang | Domaine public | https://commons.wikimedia.org/wiki/File:Campbell_hamster_blue_fawn.jpg |
| `animals/roborovski-hamster-{320,559}` | Hamster Roborovski (Phodopus roborovskii) | Photo_of_Roborovski_Hamster.jpg | Roborovskihamsters at en.wikipedia | Domaine public | https://commons.wikimedia.org/wiki/File:Photo_of_Roborovski_Hamster.jpg |
| `animals/crested-gecko-{480,800}` | Gecko à crête (Correlophus ciliatus) | Eveha's_crested_gecko.jpg | Eveha | CC BY-SA 3.0 | https://commons.wikimedia.org/wiki/File:Eveha%27s_crested_gecko.jpg |
| `animals/panther-chameleon-{480,800}` | Caméléon panthère (Furcifer pardalis) | Panther chameleon (Furcifer pardalis) male Montagne d’Ambre 2.jpg | Charles J. Sharp | CC BY-SA 4.0 | https://commons.wikimedia.org/wiki/File:Panther_chameleon_(Furcifer_pardalis)_male_Montagne_d%E2%80%99Ambre_2.jpg |
| `animals/hermann-tortoise-{480,800}` | Tortue Hermann (Testudo hermanni) | Testudo_hermanni_hermanni_Mallorca_02.jpg | Orchi | CC BY-SA 3.0 | https://commons.wikimedia.org/wiki/File:Testudo_hermanni_hermanni_Mallorca_02.jpg |
| `animals/ring-necked-parakeet-{320,645}` | Perruche à collier (Psittacula krameri) | Rose-ringed_Parakeets_(Male_&_Female)-_During_Foreplay_at_Hodal_I_Picture_0034.jpg | J.M.Garg | CC BY-SA 3.0 | https://commons.wikimedia.org/wiki/File:Rose-ringed_Parakeets_(Male_%26_Female)-_During_Foreplay_at_Hodal_I_Picture_0034.jpg |
| `animals/fischer-lovebird-{480,800}` | Inséparable Fischer (Agapornis fischeri) | Inséparables.JPG | Ghislain38 | CC BY-SA 3.0 | https://commons.wikimedia.org/wiki/File:Ins%C3%A9parables.JPG |
| `animals/blue-yellow-macaw-{480,800}` | Ara ararauna (Ara ararauna) | Ara ararauna qtl3.jpg | Quartl | CC BY-SA 3.0 | https://commons.wikimedia.org/wiki/File:Ara_ararauna_qtl3.jpg |
| `animals/angelfish-{480,800}` | Scalaire (Pterophyllum scalare) | Angelfish 2.jpg | Gannu03 | CC BY-SA 4.0 | https://commons.wikimedia.org/wiki/File:Angelfish_2.jpg |
| `animals/zebrafish-{480,800}` | Danio zébré (Danio rerio) | Zebradanio-P1219668.jpg | Ffish.asia | CC BY 4.0 | https://commons.wikimedia.org/wiki/File:Zebradanio-P1219668.jpg |
| `animals/ramirezi-{320,444}` | Cichlidé de Ramirezi (Mikrogeophagus ramirezi) | Mikrogeophagus_ramirezi_2.jpg | Grommash | CC BY-SA 3.0 | https://commons.wikimedia.org/wiki/File:Mikrogeophagus_ramirezi_2.jpg |
| `animals/red-eyed-tree-frog-{480,800}` | Rainette aux yeux rouges (Agalychnis callidryas) | Agalychnis_callidryas.jpg | Christian R. Linder | CC BY-SA 3.0 | https://commons.wikimedia.org/wiki/File:Agalychnis_callidryas.jpg |
| `animals/dyeing-poison-frog-{480,800}` | Dendrobate (Dendrobates tinctorius) | Dendrobates tinctorius - Wilhelma.jpg | H. Zell | CC BY-SA 3.0 | https://commons.wikimedia.org/wiki/File:Dendrobates_tinctorius_-_Wilhelma.jpg |
| `animals/cherry-shrimp-{480,800}` | Crevette Red Cherry (Neocaridina davidi) | RedCherryShrimp.jpg | Atulbhats | CC BY-SA 4.0 | https://commons.wikimedia.org/wiki/File:RedCherryShrimp.jpg |
| `animals/amano-shrimp-{480,800}` | Crevette Amano (Caridina multidentata) | Caridina_multidentata(Hamamatsu,Shizuoka,Japan,2007).jpg | Seotaro | CC BY-SA 3.0 | https://commons.wikimedia.org/wiki/File:Caridina_multidentata(Hamamatsu,Shizuoka,Japan,2007).jpg |
| `animals/sheep-{480,800}` | Mouton (Ovis aries) | Flock_of_sheep.jpg | Keith Weller | Domaine public | https://commons.wikimedia.org/wiki/File:Flock_of_sheep.jpg |
| `animals/donkey-{320,714}` | Âne (Equus asinus) | Donkey_in_Clovelly,_North_Devon,_England.jpg | Adrian Pingstone | Domaine public | https://commons.wikimedia.org/wiki/File:Donkey_in_Clovelly,_North_Devon,_England.jpg |
| `animals/african-hedgehog-{480,800}` | Hérisson africain (Atelerix albiventris) | Atelerix albiventris in Spain.jpg | Nacaru | CC BY-SA 4.0 | https://commons.wikimedia.org/wiki/File:Atelerix_albiventris_in_Spain.jpg |
| `guides/aquarium-filter-{480,800,1200}` | Schéma de filtre extérieur d'aquarium | Aquarium-Au enfilter.svg | Fred the Oyster | CC BY-SA 4.0 | https://commons.wikimedia.org/wiki/File:Aquarium-Au_enfilter.svg |
| `guides/nitrogen-cycle-{480,800,1200}` | Cycle de l'azote dans un aquarium | Aquarium Nitrogen Cycle.svg | Ilmari Karonen | Domaine public | https://commons.wikimedia.org/wiki/File:Aquarium_Nitrogen_Cycle.svg |

Chaque fichier existe en `.avif` et en `.webp`. Licences : CC BY-SA 4.0
(https://creativecommons.org/licenses/by-sa/4.0/), CC BY-SA 3.0
(https://creativecommons.org/licenses/by-sa/3.0/), CC BY 4.0
(https://creativecommons.org/licenses/by/4.0/), CC BY 3.0 (https://creativecommons.org/licenses/by/3.0/), CC BY 2.0
(https://creativecommons.org/licenses/by/2.0/), CC BY 2.5
(https://creativecommons.org/licenses/by/2.5/), CC BY-SA 2.0
(https://creativecommons.org/licenses/by-sa/2.0/), CC BY-SA 2.5
(https://creativecommons.org/licenses/by-sa/2.5/) et CC0
(https://creativecommons.org/publicdomain/zero/1.0/).

## Hors de `public/images/`

| Fichier | Usage | Origine |
| --- | --- | --- |
| `src/assets/og-golden-retriever.jpg` | Fond de l'image Open Graph (1200×630) générée par `opengraph-image.tsx` | `dog-golden-retriever` ci-dessus (Dietmar Rabich, CC BY-SA 4.0), recadrée ; le crédit est écrit sur l'image |
