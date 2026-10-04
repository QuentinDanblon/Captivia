import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { curatedSpeciesPhoto } from '../species-photos';

describe('correspondance des photos d’espèces validées', () => {
  it.each([
    ['Canis familiaris', 'Chien', '/images/animals/dog-river'],
    ['Canis lupus familiaris', 'Golden Retriever', '/images/animals/dog-golden-retriever'],
    ['Felis catus', 'Chat domestique', '/images/animals/cat-straw'],
    ['Oryctolagus cuniculus', 'Lapin de garenne', '/images/animals/rabbit-straw'],
    ['Nymphicus hollandicus', 'Perruche Calopsite', '/images/animals/cockatiels'],
    ['Melopsittacus undulatus', 'Perruche ondulée', '/images/animals/budgerigars'],
    ['Eublepharis macularius', 'Gecko Léopard', '/images/animals/leopard-gecko'],
    ['Pogona vitticeps', 'Agame barbu', '/images/animals/bearded-dragon'],
    ['Paracheirodon innesi', 'Néon Bleu (Tétra Néon)', '/images/animals/neon-tetra'],
    ['Equus caballus', 'Cheval domestique', '/images/animals/horse'],
    ['Gallus gallus domesticus', 'Poule domestique', '/images/animals/hen'],
    ['Cavia porcellus', 'Cochon d\'Inde', '/images/animals/guinea-pig'],
    ['Mesocricetus auratus', 'Hamster doré', '/images/animals/syrian-hamster'],
    ['Mustela putorius furo', 'Furet', '/images/animals/ferret'],
    ['Chinchilla lanigera', 'Chinchilla', '/images/animals/chinchilla'],
    ['Mus musculus domesticus', 'Souris blanche domestique', '/images/animals/domestic-mouse'],
    ['Rattus norvegicus domesticus', 'Rat domestique', '/images/animals/domestic-rat'],
    ['Serinus canaria domesticus', 'Canari', '/images/animals/canary'],
    ['Psittacus erithacus', 'Perroquet Gris d\'Afrique', '/images/animals/african-grey'],
    ['Boa constrictor', 'Boa Constricteur', '/images/animals/boa-constrictor'],
    ['Python regius', 'Python Royal', '/images/animals/ball-python'],
    ['Iguana iguana', 'Iguane Vert', '/images/animals/green-iguana'],
    ['Trachemys scripta elegans', 'Tortue à Oreilles Rouges', '/images/animals/red-eared-slider'],
    ['Chamaeleo calyptratus', 'Caméléon Casqué', '/images/animals/veiled-chameleon'],
    ['Ambystoma mexicanum', 'Axolotl', '/images/animals/axolotl'],
    ['Carassius auratus', 'Poisson Rouge', '/images/animals/goldfish'],
    ['Betta splendens', 'Combattant (Betta)', '/images/animals/betta'],
    ['Poecilia reticulata', 'Guppy', '/images/animals/guppy'],
    ['Carausius morosus', 'Phasme Bâton', '/images/animals/stick-insect'],
    ['Gromphadorhina portentosa', 'Blatte de Madagascar', '/images/animals/hissing-cockroach'],
    ['Pandinus imperator', 'Scorpion Empereur', '/images/animals/emperor-scorpion'],
    ['Lithobates catesbeianus', 'Grenouille Taureau', '/images/animals/bullfrog'],
    ['Phodopus sungorus', 'Hamster russe', '/images/animals/russian-hamster'],
    ['Phodopus campbelli', 'Hamster de Campbell', '/images/animals/campbell-hamster'],
    ['Phodopus roborovskii', 'Hamster Roborovski', '/images/animals/roborovski-hamster'],
    ['Correlophus ciliatus', 'Gecko à crête', '/images/animals/crested-gecko'],
    ['Furcifer pardalis', 'Caméléon panthère', '/images/animals/panther-chameleon'],
    ['Testudo hermanni', 'Tortue Hermann', '/images/animals/hermann-tortoise'],
    ['Psittacula krameri', 'Perruche à collier', '/images/animals/ring-necked-parakeet'],
    ['Agapornis fischeri', 'Inséparable Fischer', '/images/animals/fischer-lovebird'],
    ['Ara ararauna', 'Ara ararauna', '/images/animals/blue-yellow-macaw'],
    ['Pterophyllum scalare', 'Scalaire', '/images/animals/angelfish'],
    ['Danio rerio', 'Danio zébré', '/images/animals/zebrafish'],
    ['Mikrogeophagus ramirezi', 'Cichlidé de Ramirezi', '/images/animals/ramirezi'],
    ['Agalychnis callidryas', 'Rainette aux yeux rouges', '/images/animals/red-eyed-tree-frog'],
    ['Dendrobates tinctorius', 'Dendrobate', '/images/animals/dyeing-poison-frog'],
    ['Neocaridina davidi', 'Crevette Red Cherry', '/images/animals/cherry-shrimp'],
    ['Caridina multidentata', 'Crevette Amano', '/images/animals/amano-shrimp'],
    ['Ovis aries', 'Mouton', '/images/animals/sheep'],
    ['Equus asinus', 'Âne', '/images/animals/donkey'],
    ['Atelerix albiventris', 'Hérisson africain', '/images/animals/african-hedgehog'],
    ['Brachypelma smithi', 'Tarentule mexicaine à genoux rouges', '/images/animals/tarantula-mexican-red-knee'],
    ['Testudo graeca', 'Tortue grecque', '/images/animals/greek-tortoise'],
    ['Testudo marginata', 'Tortue bordée', '/images/animals/marginated-tortoise'],
    ['Pantherophis guttatus', 'Serpent des blés', '/images/animals/corn-snake'],
    ['Lampropeltis getula', 'Couleuvre royale', '/images/animals/king-snake'],
    ['Varanus exanthematicus', 'Varan des steppes', '/images/animals/savannah-monitor'],
    ['Corydoras panda', 'Corydoras panda', '/images/animals/panda-corydoras'],
    ['Corydoras aeneus', 'Corydoras bronze', '/images/animals/bronze-corydoras'],
    ['Xiphophorus maculatus', 'Platy', '/images/animals/platy'],
    ['Bombina orientalis', 'Crapaud à ventre de feu', '/images/animals/oriental-fire-bellied-toad'],
    ['Hymenopus coronatus', 'Mante orchidée', '/images/animals/orchid-mantis'],
    ['Pandinus imperator', 'Scorpion empereur', '/images/animals/emperor-scorpion'],
    ['Brachypelma albopilosum', 'Tarentule du Curacao', '/images/animals/curly-hair-tarantula'],
    ['Agapornis roseicollis', 'Inséparable Rosâtre', '/images/animals/rosy-faced-lovebird'],
    ['Taeniopygia guttata', 'Diamant Mandarin', '/images/animals/zebra-finch'],
    ['Poecilia sphenops', 'Molly noire', '/images/animals/black-molly'],
    ['Hyla cinerea', 'Rainette Arboricole Verte', '/images/animals/green-treefrog'],
    ['Meriones unguiculatus', 'Gerbille', '/images/animals/mongolian-gerbil'],
    ['Octodon degus', 'Dègue du Chili', '/images/animals/chilean-degu'],
    ['Amazona aestiva', 'Amazone à front bleu', '/images/animals/blue-fronted-amazon'],
    ['Amazona albifrons', 'Amazone à front blanc', '/images/animals/white-fronted-amazon'],
    ['Cacatua alba', 'Cacatoès blanc', '/images/animals/white-cockatoo'],
    ['Phelsuma grandis', 'Gecko géant de Madagascar', '/images/animals/madagascar-giant-day-gecko'],
    ['Litoria caerulea', 'Rainette de White', '/images/animals/whites-tree-frog'],
    ['Hydrochoerus hydrochaeris', 'Capybara', '/images/animals/capybara'],
    ['Gekko gecko', 'Gecko tokay', '/images/animals/tokay-gecko'],
    ['Suricata suricatta', 'Suricate', '/images/animals/meerkat'],
    ['Eclectus roratus', 'Éclectus', '/images/animals/eclectus'],
    ['Dromaius novaehollandiae', 'Émeu', '/images/animals/emu'],
    ['Pavo cristatus', 'Paon bleu', '/images/animals/blue-peafowl'],
    ['Chrysolophus pictus', 'Faisan doré', '/images/animals/golden-pheasant'],
    ['Chloebia gouldiae', 'Gouldien', '/images/animals/gouldian-finch'],
    ['Ceratophrys ornata', 'Grenouille cornue', '/images/animals/ornate-horned-frog'],
    ['Andrias japonicus', 'Salamandre géante du Japon', '/images/animals/japanese-giant-salamander'],
    ['Phyllium philippinicum', 'Phasme feuille', '/images/animals/leaf-insect'],
    ['Achatina fulica', 'Escargot géant africain', '/images/animals/giant-african-snail'],
    ['Archispirostreptus gigas', 'Mille-pattes géant', '/images/animals/giant-millipede'],
    ['Salamandra salamandra', 'Salamandre tachetée', '/images/animals/fire-salamander'],
    ['Dyscophus antongilii', 'Grenouille tomate', '/images/animals/tomato-frog'],
    ['Dendrobates leucomelas', 'Dendrobate lépreux', '/images/animals/bumblebee-poison-frog'],
    ['Ceratophrys cranwelli', 'Grenouille cornue de Cranwell', '/images/animals/cranwells-horned-frog'],
    ['Phelsuma madagascariensis', 'Gecko diurne de Madagascar', '/images/animals/phelsuma-madagascar'],
    ['Uroplatus phantasticus', 'Gecko satanique', '/images/animals/satanic-leaf-tailed-gecko'],
    ['Iguana delicatissima', 'Iguane des Petites Antilles', '/images/animals/antilles-iguana'],
    ['Anolis carolinensis', 'Anole vert', '/images/animals/green-anole'],
    ['Anolis equestris', 'Anole de Cuba', '/images/animals/knight-anole'],
    ['Basiliscus plumifrons', 'Basilic vert', '/images/animals/green-basilisk'],
    ['Trioceros jacksonii', 'Caméléon de Jackson', '/images/animals/jacksons-chameleon'],
    ['Calumma parsonii', 'Caméléon de Parson', '/images/animals/parsons-chameleon'],
    ['Varanus komodoensis', 'Varan de Komodo', '/images/animals/komodo-dragon'],
    ['Salvator merianae', 'Téju noir et blanc', '/images/animals/argentine-tegu'],
    ['Chlamydosaurus kingii', 'Lézard à collerette', '/images/animals/frill-necked-lizard'],
    ['Timon lepidus', 'Lézard ocellé', '/images/animals/ocellated-lizard'],
    ['Corallus caninus', 'Boa émeraude', '/images/animals/emerald-tree-boa'],
    ['Lampropeltis triangulum', 'Couleuvre faux-corail', '/images/animals/milk-snake'],
    ['Heterodon nasicus', 'Couleuvre à nez plat', '/images/animals/hognose-snake'],
    ['Hyphessobrycon herbertaxelrodi', 'Néon noir', '/images/animals/black-neon-tetra'],
    ['Hyphessobrycon pulchripinnis', 'Tétra citron', '/images/animals/lemon-tetra'],
    ['Nematobrycon palmeri', 'Tétra empereur', '/images/animals/emperor-tetra'],
    ['Phenacogrammus interruptus', 'Tétra du Congo', '/images/animals/congo-tetra'],
    ['Hyphessobrycon megalopterus', 'Tétra fantôme noir', '/images/animals/black-phantom-tetra'],
    ['Astronotus ocellatus', 'Oscar', '/images/animals/oscar-cichlid'],
    ['Rocio octofasciata', 'Cichlidé de Jack Dempsey', '/images/animals/jack-dempsey-cichlid'],
    ['Amphilophus citrinellus', 'Cichlidé perroquet', '/images/animals/parrot-cichlid'],
    ['Cyphotilapia frontosa', 'Cichlidé frontosa', '/images/animals/frontosa-cichlid'],
    ['Metriaclima zebra', 'Cichlidé zèbre', '/images/animals/zebra-cichlid'],
    ['Labidochromis caeruleus', 'Cichlidé jaune', '/images/animals/yellow-lab-cichlid'],
    ['Puntius titteya', 'Barbu cerise', '/images/animals/cherry-barb'],
    ['Puntigrus tetrazona', 'Barbu de Sumatra', '/images/animals/tiger-barb'],
    ['Sciurus vulgaris', 'Écureuil Roux Européen', '/images/animals/red-squirrel'],
    ['Procyon lotor', 'Raton Laveur', '/images/animals/raccoon'],
    ['Nasua nasua', 'Coati', '/images/animals/coati'],
    ['Leptailurus serval', 'Serval', '/images/animals/serval'],
    ['Genetta genetta', 'Genette', '/images/animals/genet'],
    ['Lutra lutra', 'Loutre', '/images/animals/european-otter'],
    ['Petaurus breviceps', 'Phalanger volant', '/images/animals/sugar-glider'],
    ['Pteromys volans', 'Écureuil volant', '/images/animals/flying-squirrel'],
    ['Manis pentadactyla', 'Pangolin Asiatique', '/images/animals/chinese-pangolin'],
    ['Vicugna pacos', 'Alpaga', '/images/animals/alpaca'],
    ['Ara macao', 'Ara macao', '/images/animals/scarlet-macaw'],
    ['Ara militaris', 'Ara militaire', '/images/animals/military-macaw'],
    ['Cacatua galerita', 'Cacatoès à huppe jaune', '/images/animals/sulphur-crested-cockatoo'],
    ['Poicephalus senegalus', 'Perroquet youyou', '/images/animals/senegal-parrot'],
    ['Bubo bubo', "Grand-duc d'Europe", '/images/animals/european-eagle-owl'],
    ['Paracheirodon axelrodi', 'Néon cardinalis', '/images/animals/cardinal-tetra'],
    ['Symphysodon discus', 'Discus', '/images/animals/discus'],
    ['Amatitlania nigrofasciata', 'Cichlidé convict', '/images/animals/convict-cichlid'],
    ['Pethia conchonius', 'Barbu rosé', '/images/animals/rosy-barb'],
    ['Devario aequipinnatus', 'Danio géant', '/images/animals/giant-danio'],
    ['Xiphophorus hellerii', 'Xipho', '/images/animals/swordtail'],
    ['Corydoras sterbai', 'Corydoras sterbai', '/images/animals/sterbai-corydoras'],
    ['Otocinclus affinis', 'Otocinclus', '/images/animals/otocinclus'],
    ['Ancistrus cirrhosus', 'Ancistrus', '/images/animals/ancistrus'],
    ['Pantodon buchholzi', 'Poisson-papillon', '/images/animals/butterflyfish'],
    ['Toxotes jaculatrix', 'Poisson-archer', '/images/animals/archerfish'],
    ['Gnathonemus petersii', 'Poisson éléphant', '/images/animals/elephantnose-fish'],
    ['Orycteropus afer', 'Oryctérope du Cap', '/images/animals/aardvark'],
    ['Potos flavus', 'Kinkajou', '/images/animals/kinkajou'],
    ['Sciurus carolinensis', 'Écureuil gris', '/images/animals/grey-squirrel'],
    ['Saguinus oedipus', 'Tamarin', '/images/animals/cottontop-tamarin'],
    ['Caracal caracal', 'Caracal', '/images/animals/caracal'],
    ['Leopardus pardalis', 'Ocelot', '/images/animals/ocelot'],
    ['Arctictis binturong', 'Binturong', '/images/animals/binturong'],
    ['Herpestes ichneumon', 'Mangouste', '/images/animals/egyptian-mongoose'],
    ['Hystrix cristata', 'Porc-épic', '/images/animals/crested-porcupine'],
    ['Cuniculus paca', 'Paca', '/images/animals/paca'],
    ['Neophema pulchella', 'Perruche turquoisine', '/images/animals/turquoise-parrot'],
    ['Agapornis personatus', 'Inséparable masqué', '/images/animals/masked-lovebird'],
    ['Trichoglossus moluccanus', 'Lori de Swainson', '/images/animals/rainbow-lorikeet'],
  ])('%s / %s reçoit sa photo locale créditée', (latin, name, path) => {
    const photo = curatedSpeciesPhoto(latin, name);
    expect(photo?.src).toContain(path);
    expect(existsSync(resolve(process.cwd(), 'public', photo?.src.replace(/^\//, '') ?? ''))).toBe(true);
    expect(photo?.srcSet).toContain(path);
    expect(photo?.author).toBeTruthy();
    expect(photo?.sourceUrl).toMatch(/^https:\/\/commons\.wikimedia\.org\/wiki\/File:/);
    expect(photo?.license.label).toMatch(/CC BY|CC0|Domaine public/);
    expect(photo?.license.url).toMatch(/^https:\/\//);
  });

  it('ne donne pas la photo d’un golden retriever à une autre race de chien', () => {
    expect(curatedSpeciesPhoto('Canis lupus familiaris', 'Berger allemand')).toBeNull();
    expect(curatedSpeciesPhoto('Canis lupus familiaris', 'Golden Retriever')?.author).toBe('Dietmar Rabich');
  });

  it('reconnaît l’ara quand son nom vernaculaire est le binôme latin retiré par la normalisation', () => {
    expect(curatedSpeciesPhoto('Ara ararauna')?.src).toContain('/images/animals/blue-yellow-macaw-');
  });

  it('exige le nom du profil lorsque plusieurs races partagent le même taxon', () => {
    expect(curatedSpeciesPhoto('Cavia porcellus')).toBeNull();
    expect(curatedSpeciesPhoto('Carassius auratus')).toBeNull();
    expect(curatedSpeciesPhoto('Ovis aries')).toBeNull();
  });

  it.each([
    ['Cavia porcellus', 'Cochon D’Inde Péruvien'],
    ['Carassius auratus', 'Poisson Rouge Oranda'],
    ['Ovis aries', 'Mérinos'],
  ])('ne donne pas la photo générique de %s à la race %s', (latin, name) => {
    expect(curatedSpeciesPhoto(latin, name)).toBeNull();
  });

  it('ne donne pas une photo de chat ou de chien à un taxon sans correspondance exacte', () => {
    expect(curatedSpeciesPhoto('Felis catus', 'Bengal')).toBeNull();
    expect(curatedSpeciesPhoto('Canis lupus familiaris', 'Carlin')).toBeNull();
  });
});
