// utils/validators.js
import { DEFAULT_SETTINGS } from '../constants/defaultSettings';

const ALLOWED_FONT_SIZES = ['petit', 'normal', 'grand'];
const ALLOWED_LANGUAGES = ['fr', 'en', 'ln', 'sw', 'pt'];
const ALLOWED_REGIONS = ['fr', 'en', 'ln', 'sw', 'pt'];

export const validateSettings = (settings) => {
  const validated = { ...DEFAULT_SETTINGS };
  
  // Validation des valeurs scalaires
  if (ALLOWED_FONT_SIZES.includes(settings.fontSize)) validated.fontSize = settings.fontSize;
  if (typeof settings.animationsEnabled === 'boolean') validated.animationsEnabled = settings.animationsEnabled;
  if (ALLOWED_LANGUAGES.includes(settings.language)) validated.language = settings.language;
  if (ALLOWED_REGIONS.includes(settings.region)) validated.region = settings.region;
  
  // Validation des objets
  if (settings.notifications && typeof settings.notifications === 'object') validated.notifications = settings.notifications;
  if (settings.content && typeof settings.content === 'object') validated.content = settings.content;
  if (settings.performance && typeof settings.performance === 'object') validated.performance = settings.performance;
  if (settings.accessibility && typeof settings.accessibility === 'object') validated.accessibility = settings.accessibility;
  if (settings.feed && typeof settings.feed === 'object') validated.feed = settings.feed;
  if (settings.interests && typeof settings.interests === 'object') validated.interests = settings.interests;
  if (settings.fav && typeof settings.fav === 'object') validated.fav = settings.fav;
  if (settings.filter && typeof settings.filter === 'object') validated.filter = settings.filter;
  if (settings.ai && typeof settings.ai === 'object') validated.ai = settings.ai;
  if (settings.study && typeof settings.study === 'object') validated.study = settings.study;
  if (settings.hidden && typeof settings.hidden === 'object') validated.hidden = settings.hidden;
  
  return validated;
};
