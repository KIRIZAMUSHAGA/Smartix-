import json
from datetime import datetime, date
from typing import Dict, List, Optional


class ProgressTracker:
    def __init__(self, db_connection):
        self.db = db_connection

    async def get_user_progress(self, user_id: str) -> Dict:
        """Récupère la progression d'un utilisateur."""
        try:
            result = await self.db.fetch_one(
                "SELECT * FROM user_progress WHERE user_id = $1",
                user_id
            )
        except Exception:
            result = None

        if not result:
            return {
                'user_id': user_id,
                'completed_lessons': [],
                'current_lesson': 'js_1_1',
                'current_day': 1,
                'total_xp': 0,
                'level': 1,
                'streak_days': 0,
                'last_active': None,
            }

        row = dict(result)
        completed = row.get('completed_lessons', '[]')
        if isinstance(completed, str):
            completed = json.loads(completed)
        row['completed_lessons'] = completed
        return row

    async def complete_lesson(self, user_id: str, lesson_id: str, xp_earned: int) -> Dict:
        """Marque une leçon comme complétée et met à jour la progression."""
        progress = await self.get_user_progress(user_id)

        if lesson_id in progress['completed_lessons']:
            return {'error': 'Lesson already completed'}

        new_completed = progress['completed_lessons'] + [lesson_id]
        new_total_xp = progress['total_xp'] + xp_earned
        new_level = self._calculate_level(new_total_xp)

        streak = await self._update_streak(
            user_id,
            progress.get('streak_days', 0),
            progress.get('last_active')
        )

        now = datetime.utcnow()

        try:
            existing = await self.db.fetch_one(
                "SELECT user_id FROM user_progress WHERE user_id = $1",
                user_id
            )
            if existing:
                await self.db.execute(
                    """UPDATE user_progress
                       SET completed_lessons = $1,
                           total_xp = $2,
                           level = $3,
                           streak_days = $4,
                           last_active = $5,
                           updated_at = $6
                       WHERE user_id = $7""",
                    json.dumps(new_completed),
                    new_total_xp,
                    new_level,
                    streak,
                    now,
                    now,
                    user_id
                )
            else:
                await self.db.execute(
                    """INSERT INTO user_progress
                       (user_id, completed_lessons, current_lesson, current_day,
                        total_xp, level, streak_days, last_active, created_at, updated_at)
                       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)""",
                    user_id,
                    json.dumps(new_completed),
                    lesson_id,
                    1,
                    new_total_xp,
                    new_level,
                    streak,
                    now,
                    now,
                    now
                )
        except Exception as e:
            return {'error': f'Database error: {str(e)}'}

        return {
            'completed': True,
            'lesson_id': lesson_id,
            'xp_gained': xp_earned,
            'total_xp': new_total_xp,
            'new_level': new_level,
            'streak': streak,
            'completed_count': len(new_completed),
        }

    def _calculate_level(self, xp: int) -> int:
        """Calcule le niveau basé sur l'XP total.
        Niveau 1 : 0 XP, Niveau 2 : 100 XP, etc.
        """
        return 1 + (xp // 100)

    async def _update_streak(
        self,
        user_id: str,
        current_streak: int,
        last_active: Optional[datetime]
    ) -> int:
        """Met à jour la streak quotidienne."""
        today = date.today()

        if not last_active:
            return 1

        if isinstance(last_active, str):
            try:
                last_active = datetime.fromisoformat(last_active)
            except ValueError:
                return 1

        last_date = last_active.date() if hasattr(last_active, 'date') else last_active
        days_diff = (today - last_date).days

        if days_diff == 0:
            return current_streak
        elif days_diff == 1:
            return current_streak + 1
        else:
            return 1

    async def get_leaderboard(self, limit: int = 10) -> List[Dict]:
        """Retourne le classement des meilleurs utilisateurs."""
        try:
            rows = await self.db.fetch_all(
                """SELECT user_id, total_xp, level, streak_days,
                          json_array_length(completed_lessons::json) AS completed_count
                   FROM user_progress
                   ORDER BY total_xp DESC
                   LIMIT $1""",
                limit
            )
            return [dict(r) for r in rows]
        except Exception:
            return []

    async def get_stats(self, user_id: str) -> Dict:
        """Retourne des statistiques détaillées pour un utilisateur."""
        progress = await self.get_user_progress(user_id)
        completed_count = len(progress['completed_lessons'])

        return {
            'total_lessons_completed': completed_count,
            'total_xp': progress['total_xp'],
            'current_level': progress['level'],
            'streak_days': progress['streak_days'],
            'completion_percentage': round((completed_count / 200) * 100, 1),
        }
