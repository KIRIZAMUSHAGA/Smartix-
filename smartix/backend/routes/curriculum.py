from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional

from curriculum.lesson_data import get_all_days, get_lesson_by_id
from curriculum.code_validator import CodeValidator
from gamification.xp_system import XPSystem

router = APIRouter()
validator = CodeValidator()
xp_system = XPSystem()

# ─────────────────────────────────────────────────────────────────────────────
# Schémas
# ─────────────────────────────────────────────────────────────────────────────

class ValidateCodeRequest(BaseModel):
    code: str
    language: str = 'javascript'
    tests: list[str] = []


class CompleteLessonRequest(BaseModel):
    lesson_id: str
    xp_earned: int = 10


# ─────────────────────────────────────────────────────────────────────────────
# Routes curriculum
# ─────────────────────────────────────────────────────────────────────────────

@router.get('/curriculum')
async def get_curriculum():
    """Retourne la liste complète des 100 jours."""
    days = get_all_days()
    return days


@router.get('/curriculum/day/{day_number}')
async def get_day(day_number: int):
    """Retourne un jour spécifique du curriculum."""
    all_days = get_all_days()
    day = next((d for d in all_days if d['day'] == day_number), None)
    if not day:
        raise HTTPException(status_code=404, detail=f'Jour {day_number} introuvable')
    return day


@router.get('/curriculum/lesson/{lesson_id}')
async def get_lesson(lesson_id: str):
    """Retourne une leçon spécifique."""
    lesson = get_lesson_by_id(lesson_id)
    if not lesson:
        raise HTTPException(status_code=404, detail=f'Leçon {lesson_id} introuvable')
    return lesson


# ─────────────────────────────────────────────────────────────────────────────
# Validation de code
# ─────────────────────────────────────────────────────────────────────────────

@router.post('/validate-code')
async def validate_code(body: ValidateCodeRequest):
    """Valide le code utilisateur contre des tests automatiques."""
    if not body.code.strip():
        return {'success': False, 'error': 'Code vide', 'results': [], 'passed_count': 0, 'total_count': 0}
    if len(body.code) > 50_000:
        raise HTTPException(status_code=400, detail='Code trop long (max 50 000 caractères)')

    result = await validator.validate(body.code, body.language, body.tests)
    return result


# ─────────────────────────────────────────────────────────────────────────────
# Progression utilisateur (stockage local simplifié sans auth obligatoire)
# ─────────────────────────────────────────────────────────────────────────────

_in_memory_progress: dict = {}


@router.get('/user/progress')
async def get_progress():
    """Retourne la progression (stockage en mémoire pour demo)."""
    return _in_memory_progress.get('default', {
        'user_id': 'default',
        'completed_lessons': [],
        'current_lesson': 'js_1_1',
        'current_day': 1,
        'total_xp': 0,
        'level': 1,
        'streak_days': 0,
        'last_active': None,
    })


@router.post('/user/complete-lesson')
async def complete_lesson(body: CompleteLessonRequest):
    """Marque une leçon comme complétée."""
    progress = _in_memory_progress.get('default', {
        'user_id': 'default',
        'completed_lessons': [],
        'current_day': 1,
        'total_xp': 0,
        'level': 1,
        'streak_days': 0,
    })

    if body.lesson_id in progress.get('completed_lessons', []):
        return {'error': 'Leçon déjà complétée'}

    completed = list(progress.get('completed_lessons', [])) + [body.lesson_id]
    new_xp = progress.get('total_xp', 0) + body.xp_earned
    level_info = xp_system.calculate_level(new_xp)

    progress['completed_lessons'] = completed
    progress['total_xp'] = new_xp
    progress['level'] = level_info['level']

    _in_memory_progress['default'] = progress

    return {
        'completed': True,
        'lesson_id': body.lesson_id,
        'xp_gained': body.xp_earned,
        'total_xp': new_xp,
        'new_level': level_info['level'],
        'streak': progress.get('streak_days', 0),
        'completed_count': len(completed),
    }


# ─────────────────────────────────────────────────────────────────────────────
# Niveau et gamification
# ─────────────────────────────────────────────────────────────────────────────

@router.get('/user/level')
async def get_level(xp: int = 0):
    """Calcule et retourne les informations de niveau pour un XP donné."""
    return xp_system.calculate_level(xp)


@router.get('/user/achievements/recent')
async def get_achievements():
    """Retourne les achievements récents (stub)."""
    return []


@router.get('/leaderboard')
async def get_leaderboard(limit: int = 10):
    """Retourne le classement (stub)."""
    return []


@router.get('/gamification/xp-actions')
async def get_xp_actions():
    """Retourne toutes les actions et leurs récompenses XP."""
    return xp_system.get_all_actions()


@router.get('/gamification/milestones')
async def get_milestones():
    """Retourne les jalons de progression."""
    return xp_system.get_level_milestones()
