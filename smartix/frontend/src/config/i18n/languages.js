// config/i18n/languages.js

export const LANGUAGES = [
  { code: 'fr', name: 'Français', nativeName: 'Français', flag: '🇫🇷', region: 'fr' },
  { code: 'en', name: 'English', nativeName: 'English', flag: '🇬🇧', region: 'us' },
  { code: 'ln', name: 'Lingala', nativeName: 'Lingála', flag: '🇨🇩', region: 'cd' },
  { code: 'sw', name: 'Swahili', nativeName: 'Kiswahili', flag: '🇹🇿', region: 'tz' },
  { code: 'pt', name: 'Portuguese', nativeName: 'Português', flag: '🇵🇹', region: 'pt' }
];

export const REGIONS = [
  { code: 'fr', label: "France", flag: "🇫🇷", group: "Europe" },
  { code: 'ci', label: "Côte d'Ivoire", flag: "🇨🇮", group: "Afrique de l'Ouest" },
  { code: 'sn', label: "Sénégal", flag: "🇸🇳", group: "Afrique de l'Ouest" },
  { code: 'cm', label: "Cameroun", flag: "🇨🇲", group: "Afrique Centrale" },
  { code: 'cd', label: "RDC", flag: "🇨🇩", group: "Afrique Centrale" },
  { code: 'rw', label: "Rwanda", flag: "🇷🇼", group: "Afrique de l'Est" },
  { code: 'ug', label: "Ouganda", flag: "🇺🇬", group: "Afrique de l'Est" },
  { code: 'bj', label: "Bénin", flag: "🇧🇯", group: "Afrique de l'Ouest" },
  { code: 'bf', label: "Burkina Faso", flag: "🇧🇫", group: "Afrique de l'Ouest" },
  { code: 'ga', label: "Gabon", flag: "🇬🇦", group: "Afrique Centrale" },
  { code: 'gn', label: "Guinée", flag: "🇬🇳", group: "Afrique de l'Ouest" },
  { code: 'ml', label: "Mali", flag: "🇲🇱", group: "Afrique de l'Ouest" },
  { code: 'ne', label: "Niger", flag: "🇳🇪", group: "Afrique de l'Ouest" },
  { code: 'tg', label: "Togo", flag: "🇹🇬", group: "Afrique de l'Ouest" },
  { code: 'mg', label: "Madagascar", flag: "🇲🇬", group: "Afrique Australe" },
  { code: 'mu', label: "Maurice", flag: "🇲🇺", group: "Afrique Australe" }
];

export const REGION_GROUPS = [
  { name: 'Afrique de l\'Ouest', countries: ['ci', 'sn', 'bj', 'bf', 'gn', 'ml', 'ne', 'tg'] },
  { name: 'Afrique Centrale', countries: ['cm', 'cd', 'ga'] },
  { name: 'Afrique de l\'Est', countries: ['rw', 'ug'] },
  { name: 'Afrique Australe', countries: ['mg', 'mu'] },
  { name: 'Europe', countries: ['fr'] }
];
