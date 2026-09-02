// constants/sections.js
import { 
  Palette, Languages, Bell, Layout, Gauge, 
  Accessibility, Star, Shield, Database, Cloud,
  Zap, Lock, Eye, User, Settings
} from 'lucide-react';

export const SECTIONS = [
  {
    id: 'appearance',
    icon: Palette,
    labelKey: 'settings.sections.appearance',
    descriptionKey: 'settings.sections.appearanceDesc',
    order: 10,
    group: 'general',
    badge: null
  },
  {
    id: 'language',
    icon: Languages,
    labelKey: 'settings.sections.language',
    descriptionKey: 'settings.sections.languageDesc',
    order: 20,
    group: 'general',
    badge: 'language',
    badgeType: 'neutral'
  },
  {
    id: 'notifications',
    icon: Bell,
    labelKey: 'settings.sections.notifications',
    descriptionKey: 'settings.sections.notificationsDesc',
    order: 30,
    group: 'general',
    badge: 'notifications',
    badgeType: 'danger'
  },
  {
    id: 'content',
    icon: Layout,
    labelKey: 'settings.sections.content',
    descriptionKey: 'settings.sections.contentDesc',
    order: 40,
    group: 'general'
  },
  {
    id: 'performance',
    icon: Gauge,
    labelKey: 'settings.sections.performance',
    descriptionKey: 'settings.sections.performanceDesc',
    order: 50,
    group: 'advanced'
  },
  {
    id: 'accessibility',
    icon: Accessibility,
    labelKey: 'settings.sections.accessibility',
    descriptionKey: 'settings.sections.accessibilityDesc',
    order: 60,
    group: 'advanced'
  },
  // Sections premium (exemples)
  {
    id: 'premium',
    icon: Star,
    labelKey: 'settings.sections.premium',
    descriptionKey: 'settings.sections.premiumDesc',
    order: 5,
    group: 'general',
    premium: true,
    badge: 'premium',
    badgeType: 'premium'
  },
  // Sections avec contrôle d'accès
  {
    id: 'admin',
    icon: Shield,
    labelKey: 'settings.sections.admin',
    descriptionKey: 'settings.sections.adminDesc',
    order: 100,
    group: 'advanced',
    roles: ['admin', 'superadmin'],
    badge: null
  },
  // Sections avec feature flag
  {
    id: 'beta',
    icon: Zap,
    labelKey: 'settings.sections.beta',
    descriptionKey: 'settings.sections.betaDesc',
    order: 110,
    group: 'advanced',
    featureFlag: 'betaFeatures',
    badge: 'beta',
    badgeType: 'warning'
  }
];
