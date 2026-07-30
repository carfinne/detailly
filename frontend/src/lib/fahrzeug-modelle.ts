// ===========================================================================
// Kuratierte Marken-/Modell-Textliste (Eingabehilfe beim Fahrzeug-Anlegen)
// ---------------------------------------------------------------------------
// Reine TEXTLISTE zur Tipphilfe. Enthaelt ausschliesslich Marken- und
// Modellnamen als beschreibende Nennung. KEINE Logos, KEINE Bilder, KEINE
// fremden Datenbank-Exporte/Scrapes — die Liste ist von Hand kuratiert.
// Alle Marken- und Modellbezeichnungen sind Eigentum der jeweiligen Hersteller.
//
// Umfang: die im deutschen Markt gaengigen Volumen- und Premiummarken samt
// ihrer gaengigsten Modellreihen (inkl. gaengiger Transporter). Ziel ist die
// Abdeckung der Alltagsfaelle einer Aufbereitungs-/Folierwerkstatt — NICHT
// Vollstaendigkeit. Freitext bleibt ueberall moeglich (Oldtimer, Import, Umbau).
//
// Bundle-Schonung: Diese Datei wird NICHT statisch importiert, sondern lazy
// (dynamischer Import beim ersten Fokus des Marke-/Modell-Feldes), damit sie
// nicht im Haupt-Bundle landet und den App-Start nicht verlangsamt.
// ===========================================================================

export type MarkenDaten = Record<string, string[]>;

export const FAHRZEUG_MARKEN: MarkenDaten = {
  'VW': [
    'Up', 'Polo', 'Golf', 'Golf Variant', 'Golf Plus', 'Jetta', 'Scirocco', 'Beetle',
    'Passat', 'Passat Variant', 'Arteon', 'Taigo', 'T-Cross', 'T-Roc', 'Tiguan',
    'Tiguan Allspace', 'Touran', 'Touareg', 'Sharan', 'Amarok',
    'ID.3', 'ID.4', 'ID.5', 'ID.7', 'ID. Buzz',
    'Caddy', 'Multivan', 'Transporter', 'Caravelle', 'Crafter',
  ],
  'Mercedes-Benz': [
    'A-Klasse', 'B-Klasse', 'C-Klasse', 'E-Klasse', 'S-Klasse',
    'CLA', 'CLS', 'GLA', 'GLB', 'GLC', 'GLE', 'GLS', 'G-Klasse',
    'SL', 'SLC', 'AMG GT', 'CLK', 'ML',
    'EQA', 'EQB', 'EQC', 'EQE', 'EQS', 'EQV',
    'V-Klasse', 'Vito', 'Citan', 'Sprinter',
  ],
  'BMW': [
    '1er', '2er', '2er Active Tourer', '2er Gran Coupé', '3er', '4er', '5er', '6er', '7er', '8er',
    'X1', 'X2', 'X3', 'X4', 'X5', 'X6', 'X7', 'Z4',
    'i3', 'i4', 'i5', 'i7', 'iX', 'iX1', 'iX2', 'iX3',
    'M2', 'M3', 'M4', 'M5',
  ],
  'Audi': [
    'A1', 'A3', 'A4', 'A4 Avant', 'A5', 'A6', 'A6 Avant', 'A7', 'A8',
    'Q2', 'Q3', 'Q4 e-tron', 'Q5', 'Q7', 'Q8', 'TT', 'R8',
    'e-tron', 'e-tron GT', 'Q8 e-tron',
    'S3', 'S4', 'RS3', 'RS4', 'RS6', 'SQ5',
  ],
  'Opel': [
    'Karl', 'Adam', 'Corsa', 'Corsa-e', 'Astra', 'Insignia', 'Vectra',
    'Mokka', 'Mokka-e', 'Crossland', 'Grandland', 'Meriva', 'Zafira',
    'Combo', 'Vivaro', 'Movano', 'Agila', 'Antara', 'Cascada', 'Ampera',
  ],
  'Ford': [
    'Ka', 'Ka+', 'Fiesta', 'Focus', 'Mondeo', 'Puma', 'EcoSport', 'Kuga',
    'C-Max', 'S-Max', 'Galaxy', 'Edge', 'Explorer',
    'Mustang', 'Mustang Mach-E',
    'Ranger', 'Transit', 'Transit Custom', 'Transit Connect', 'Tourneo',
  ],
  'Škoda': [
    'Citigo', 'Fabia', 'Fabia Combi', 'Scala', 'Rapid', 'Octavia', 'Octavia Combi',
    'Superb', 'Superb Combi', 'Kamiq', 'Karoq', 'Kodiaq', 'Enyaq', 'Yeti', 'Roomster',
  ],
  'Seat': [
    'Mii', 'Ibiza', 'Leon', 'Leon ST', 'Toledo', 'Altea', 'Exeo',
    'Arona', 'Ateca', 'Tarraco', 'Alhambra',
  ],
  'Cupra': ['Leon', 'Formentor', 'Ateca', 'Born', 'Tavascan', 'Terramar'],
  'Toyota': [
    'Aygo', 'Aygo X', 'Yaris', 'Yaris Cross', 'Corolla', 'Auris', 'Avensis', 'Camry',
    'C-HR', 'RAV4', 'Highlander', 'Land Cruiser', 'Hilux', 'Proace',
    'Prius', 'Mirai', 'bZ4X', 'Supra', 'GR86', 'Verso',
  ],
  'Renault': [
    'Twingo', 'Clio', 'Megane', 'Megane E-Tech', 'Talisman', 'Laguna', 'Espace',
    'Captur', 'Arkana', 'Kadjar', 'Austral', 'Koleos', 'Scenic', 'Modus',
    'Zoe', 'Kangoo', 'Trafic', 'Master',
  ],
  'Dacia': [
    'Sandero', 'Sandero Stepway', 'Logan', 'Duster', 'Jogger', 'Spring', 'Dokker', 'Lodgy',
  ],
  'Peugeot': [
    '108', '208', '308', '508', '2008', '3008', '5008',
    '207', '307', '407', 'RCZ',
    'Partner', 'Rifter', 'Expert', 'Boxer', 'Traveller',
  ],
  'Citroën': [
    'C1', 'C3', 'C3 Aircross', 'C4', 'C4 Cactus', 'C5', 'C5 Aircross', 'C5 X',
    'Berlingo', 'SpaceTourer', 'Jumpy', 'Jumper',
    'DS3', 'DS4', 'DS5', 'C4 Picasso', 'C3 Picasso', 'Xsara Picasso',
  ],
  'Fiat': [
    '500', '500e', '500X', '500L', 'Panda', 'Punto', 'Tipo', 'Bravo',
    'Doblo', 'Ducato', 'Fiorino', 'Talento', 'Qubo', '124 Spider', 'Freemont',
  ],
  'Hyundai': [
    'i10', 'i20', 'i30', 'i40', 'ix20', 'ix35', 'Tucson', 'Santa Fe',
    'Kona', 'Bayon', 'Ioniq', 'Ioniq 5', 'Ioniq 6', 'Nexo', 'Staria', 'H-1', 'Getz',
  ],
  'Kia': [
    'Picanto', 'Rio', 'Ceed', 'ProCeed', 'XCeed', 'Stonic', 'Sportage', 'Sorento',
    'Niro', 'Soul', 'Venga', 'Optima', 'Stinger', 'EV6', 'EV9', 'Carens', 'Carnival',
  ],
  'Nissan': [
    'Micra', 'Note', 'Juke', 'Qashqai', 'X-Trail', 'Leaf', 'Ariya', 'Pulsar',
    'Pixo', 'Navara', 'NV200', 'Townstar', '370Z', 'GT-R', 'Murano', 'Pathfinder',
  ],
  'Mazda': [
    'Mazda2', 'Mazda3', 'Mazda5', 'Mazda6', 'CX-3', 'CX-30', 'CX-5', 'CX-60',
    'MX-5', 'MX-30', 'RX-8', 'Premacy',
  ],
  'Honda': [
    'Jazz', 'Civic', 'CR-V', 'HR-V', 'ZR-V', 'Accord', 'Insight', 'e', 'NSX', 'FR-V', 'Stream',
  ],
  'Volvo': [
    'V40', 'V50', 'V60', 'V70', 'V90', 'S40', 'S60', 'S80', 'S90',
    'XC40', 'XC60', 'XC90', 'C30', 'C40', 'C70', 'EX30', 'EX90',
  ],
  'Mini': [
    'Cooper', 'One', 'Cooper S', 'Cooper SE', 'Cabrio', 'Clubman', 'Countryman',
    'Paceman', 'Coupé', 'Roadster',
  ],
  'Porsche': [
    '911', '718 Boxster', '718 Cayman', 'Boxster', 'Cayman',
    'Cayenne', 'Macan', 'Panamera', 'Taycan', '924', '944', '968',
  ],
  'Tesla': ['Model 3', 'Model S', 'Model X', 'Model Y', 'Roadster', 'Cybertruck'],
  'Jeep': [
    'Renegade', 'Avenger', 'Compass', 'Cherokee', 'Grand Cherokee', 'Wrangler',
    'Gladiator', 'Commander', 'Patriot',
  ],
  'Suzuki': [
    'Alto', 'Celerio', 'Swift', 'Ignis', 'Baleno', 'SX4', 'S-Cross', 'Vitara',
    'Grand Vitara', 'Jimny', 'Splash', 'Across', 'Swace',
  ],
  'Mitsubishi': [
    'Space Star', 'Colt', 'Lancer', 'ASX', 'Eclipse Cross', 'Outlander', 'L200',
    'Pajero', 'Shogun', 'i-MiEV', 'Grandis',
  ],
  'Land Rover': [
    'Defender', 'Discovery', 'Discovery Sport', 'Freelander',
    'Range Rover', 'Range Rover Sport', 'Range Rover Evoque', 'Range Rover Velar',
  ],
  'Jaguar': ['XE', 'XF', 'XJ', 'XK', 'F-Type', 'E-Pace', 'F-Pace', 'I-Pace', 'S-Type', 'X-Type'],
  'Alfa Romeo': [
    'Giulietta', 'Giulia', 'MiTo', 'Stelvio', 'Tonale', '4C', '147', '159', 'Brera', 'Spider', 'GT',
  ],
  'Smart': ['Fortwo', 'Forfour', 'Roadster', 'Crossblade', '#1', '#3'],
  'Lexus': ['CT', 'IS', 'ES', 'GS', 'LS', 'UX', 'NX', 'RX', 'RZ', 'RC', 'LC'],
  'Polestar': ['1', '2', '3', '4'],
  'MG': ['MG3', 'MG4', 'MG5', 'ZS', 'HS', 'EHS', 'Marvel R', 'Cyberster'],
  'Iveco': ['Daily'],
  'MAN': ['TGE'],
};
