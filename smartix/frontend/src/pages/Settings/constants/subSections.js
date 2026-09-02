// constants/subSections.js
import { Layout, TrendingUp, Star, Filter, Eye, Heart } from 'lucide-react';

export const SUB_SECTIONS = [
  {
    id: 'feed',
    icon: Layout,
    labelKey: 'settings.content.feed',
    descriptionKey: 'settings.content.feedDesc'
  },
  {
    id: 'interests',
    icon: TrendingUp,
    labelKey: 'settings.content.interests',
    descriptionKey: 'settings.content.interestsDesc'
  },
  {
    id: 'favorites',
    icon: Star,
    labelKey: 'settings.content.favorites',
    descriptionKey: 'settings.content.favoritesDesc'
  },
  {
    id: 'filtering',
    icon: Filter,
    labelKey: 'settings.content.filtering',
    descriptionKey: 'settings.content.filteringDesc'
  },
  {
    id: 'hidden',
    icon: Eye,
    labelKey: 'settings.content.hidden',
    descriptionKey: 'settings.content.hiddenDesc'
  }
];
