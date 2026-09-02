import math
from typing import Dict


class XPSystem:
    def __init__(self):
        self.xp_rewards: Dict[str, int] = {
            'complete_lesson': 10,
            'perfect_lesson': 15,
            'daily_streak_bonus': 5,
            'complete_day': 50,
            'complete_week': 200,
            'complete_chapter': 500,
            'share_achievement': 5,
            'help_other': 20,
            'get_star': 25,
            'quiz_perfect': 20,
            'first_lesson': 50,
            'comeback': 15,
        }

        self.level_titles: Dict[int, str] = {
            1: 'Apprenti',
            5: 'Développeur Junior',
            10: 'Développeur',
            20: 'Développeur Senior',
            30: 'Expert',
            50: 'Maître du Code',
            75: 'Architecte',
            100: 'Légende',
        }

    # ─────────────────────────────────────────────────────────────────────────

    def calculate_xp(self, action: str, multiplier: int = 1) -> int:
        """Calcule l'XP gagné pour une action donnée."""
        base_xp = self.xp_rewards.get(action, 0)
        return base_xp * multiplier

    def calculate_level(self, total_xp: int) -> Dict:
        """Calcule le niveau, la progression et le titre basés sur l'XP total.

        Formule : level = 1 + floor(XP / 100)
        XP nécessaire pour passer au niveau suivant : (level * 100) - total_xp
        """
        level = 1 + math.floor(total_xp / 100)
        xp_start_of_level = (level - 1) * 100
        xp_end_of_level = level * 100
        xp_in_level = total_xp - xp_start_of_level
        xp_for_next = xp_end_of_level - total_xp
        progress_pct = round((xp_in_level / 100) * 100, 1)

        title = self._get_level_title(level)

        return {
            'level': level,
            'title': title,
            'current_xp': total_xp,
            'xp_in_level': xp_in_level,
            'xp_for_next_level': xp_for_next,
            'xp_start_of_level': xp_start_of_level,
            'xp_end_of_level': xp_end_of_level,
            'progress_percentage': progress_pct,
        }

    def calculate_streak_bonus(self, streak_days: int) -> int:
        """Calcule le bonus XP basé sur la streak quotidienne."""
        if streak_days >= 30:
            return 50
        elif streak_days >= 14:
            return 25
        elif streak_days >= 7:
            return 15
        elif streak_days >= 3:
            return 10
        else:
            return 0

    def get_streak_badge(self, streak_days: int) -> Dict:
        """Retourne le badge associé à la streak."""
        if streak_days >= 100:
            return {'icon': '💎', 'name': 'Légendaire', 'color': '#00d4ff'}
        elif streak_days >= 30:
            return {'icon': '🔥', 'name': 'En Feu', 'color': '#ff4500'}
        elif streak_days >= 14:
            return {'icon': '⚡', 'name': 'Électrique', 'color': '#ffa500'}
        elif streak_days >= 7:
            return {'icon': '🌟', 'name': 'Brillant', 'color': '#ffd700'}
        elif streak_days >= 3:
            return {'icon': '✨', 'name': 'Actif', 'color': '#98fb98'}
        else:
            return {'icon': '🎯', 'name': 'Débutant', 'color': '#87ceeb'}

    def get_all_actions(self) -> Dict[str, int]:
        """Retourne toutes les actions et leurs récompenses XP."""
        return dict(self.xp_rewards)

    def _get_level_title(self, level: int) -> str:
        """Retourne le titre correspondant au niveau."""
        title = 'Apprenti'
        for threshold, t in sorted(self.level_titles.items()):
            if level >= threshold:
                title = t
        return title

    def get_level_milestones(self) -> list:
        """Retourne les jalons importants de progression."""
        return [
            {'level': 1,   'xp': 0,    'reward': 'Accès aux leçons débutant',     'icon': '🌱'},
            {'level': 5,   'xp': 400,  'reward': 'Badge Développeur Junior',       'icon': '🥉'},
            {'level': 10,  'xp': 900,  'reward': 'Accès aux leçons intermédiaires','icon': '🥈'},
            {'level': 20,  'xp': 1900, 'reward': 'Badge Développeur Senior',       'icon': '🥇'},
            {'level': 30,  'xp': 2900, 'reward': 'Accès aux leçons avancées',      'icon': '💡'},
            {'level': 50,  'xp': 4900, 'reward': 'Badge Maître du Code',           'icon': '🏆'},
            {'level': 75,  'xp': 7400, 'reward': 'Accès aux leçons Expert',        'icon': '⭐'},
            {'level': 100, 'xp': 9900, 'reward': 'Badge Légendaire',               'icon': '💎'},
        ]
