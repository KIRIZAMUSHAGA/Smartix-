import { useState, useEffect } from 'react';

const STREAK_BADGES = [
  { min: 100, icon: '💎', name: 'Légendaire', color: '#00d4ff' },
  { min: 30,  icon: '🔥', name: 'En Feu',     color: '#ff4500' },
  { min: 14,  icon: '⚡', name: 'Électrique', color: '#ffa500' },
  { min: 7,   icon: '🌟', name: 'Brillant',   color: '#ffd700' },
  { min: 3,   icon: '✨', name: 'Actif',      color: '#98fb98' },
  { min: 0,   icon: '🎯', name: 'Débutant',   color: '#87ceeb' },
];

const LEVEL_MILESTONES = [
  { level: 1,   xp: 0,    reward: 'Accès aux leçons débutant',       icon: '🌱' },
  { level: 5,   xp: 400,  reward: 'Badge Développeur Junior',         icon: '🥉' },
  { level: 10,  xp: 900,  reward: 'Accès aux leçons intermédiaires',  icon: '🥈' },
  { level: 20,  xp: 1900, reward: 'Badge Développeur Senior',         icon: '🥇' },
  { level: 30,  xp: 2900, reward: 'Accès aux leçons avancées',        icon: '💡' },
  { level: 50,  xp: 4900, reward: 'Badge Maître du Code',             icon: '🏆' },
  { level: 75,  xp: 7400, reward: 'Accès aux leçons Expert',          icon: '⭐' },
  { level: 100, xp: 9900, reward: 'Badge Légendaire',                 icon: '💎' },
];

function getStreakBadge(streak) {
  return STREAK_BADGES.find(b => streak >= b.min) || STREAK_BADGES[STREAK_BADGES.length - 1];
}

function getLevelTitle(level) {
  if (level >= 100) return 'Légende';
  if (level >= 75)  return 'Architecte';
  if (level >= 50)  return 'Maître du Code';
  if (level >= 30)  return 'Expert';
  if (level >= 20)  return 'Développeur Senior';
  if (level >= 10)  return 'Développeur';
  if (level >= 5)   return 'Développeur Junior';
  return 'Apprenti';
}

// ─────────────────────────────────────────────────────────────────────────────
// Mini-composant : badge d'achievement
// ─────────────────────────────────────────────────────────────────────────────

const AchievementBadge = ({ achievement }) => (
  <div style={{
    display: 'flex', alignItems: 'center', gap: 10,
    background: '#161b22',
    border: '1px solid #30363d',
    borderRadius: 10, padding: '10px 14px',
  }}>
    <span style={{ fontSize: 24 }}>{achievement.icon}</span>
    <div>
      <div style={{ color: '#e6edf3', fontWeight: 700, fontSize: 13 }}>
        {achievement.name}
      </div>
      <div style={{ color: '#8b949e', fontSize: 12 }}>
        {achievement.description}
      </div>
    </div>
    {achievement.earned_at && (
      <div style={{ marginLeft: 'auto', color: '#58a6ff', fontSize: 11 }}>
        {new Date(achievement.earned_at).toLocaleDateString('fr-FR')}
      </div>
    )}
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// Composant principal
// ─────────────────────────────────────────────────────────────────────────────

const LevelProgress = ({ totalXp = 0, streakDays = 0, userId }) => {
  const [levelData, setLevelData] = useState(null);
  const [recentAchievements, setRecentAchievements] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);
  const [activeTab, setActiveTab] = useState('progress');
  const [animating, setAnimating] = useState(false);

  useEffect(() => {
    computeLevelData();
    loadAchievements();
    loadLeaderboard();
  }, [totalXp]);

  const computeLevelData = async () => {
    try {
      const res = await fetch(`/api/user/level?xp=${totalXp}`);
      if (res.ok) {
        setLevelData(await res.json());
      } else {
        setLevelData(computeLocally(totalXp));
      }
    } catch {
      setLevelData(computeLocally(totalXp));
    }
  };

  const computeLocally = (xp) => {
    const level = 1 + Math.floor(xp / 100);
    const xpInLevel = xp - (level - 1) * 100;
    const xpForNext = level * 100 - xp;
    return {
      level,
      title: getLevelTitle(level),
      current_xp: xp,
      xp_in_level: xpInLevel,
      xp_for_next_level: xpForNext,
      xp_start_of_level: (level - 1) * 100,
      xp_end_of_level: level * 100,
      progress_percentage: Math.min(100, (xpInLevel / 100) * 100),
    };
  };

  const loadAchievements = async () => {
    try {
      const res = await fetch('/api/user/achievements/recent');
      if (res.ok) setRecentAchievements(await res.json());
    } catch {
      setRecentAchievements([]);
    }
  };

  const loadLeaderboard = async () => {
    try {
      const res = await fetch('/api/leaderboard?limit=10');
      if (res.ok) setLeaderboard(await res.json());
    } catch {
      setLeaderboard([]);
    }
  };

  if (!levelData) {
    return (
      <div style={{
        background: '#0d1117', borderRadius: 16, padding: 32,
        color: '#8b949e', textAlign: 'center',
      }}>
        Chargement...
      </div>
    );
  }

  const streakBadge = getStreakBadge(streakDays);
  const streakBonus = streakDays >= 30 ? 50 : streakDays >= 14 ? 25
    : streakDays >= 7 ? 15 : streakDays >= 3 ? 10 : 0;

  const nextMilestone = LEVEL_MILESTONES
    .filter(m => m.level > levelData.level)
    .sort((a, b) => a.level - b.level)[0];

  const tabs = [
    { id: 'progress', label: '📈 Progression' },
    { id: 'achievements', label: '🏆 Succès' },
    { id: 'leaderboard', label: '👑 Classement' },
    { id: 'milestones', label: '🎯 Jalons' },
  ];

  return (
    <div style={{
      background: '#0d1117',
      border: '1px solid #30363d',
      borderRadius: 16,
      overflow: 'hidden',
      fontFamily: 'Inter, -apple-system, sans-serif',
      color: '#e6edf3',
    }}>
      {/* ── Carte niveau principal ── */}
      <div style={{
        background: 'linear-gradient(135deg, #1f2937 0%, #1a1a2e 100%)',
        padding: '28px 28px 20px',
        borderBottom: '1px solid #30363d',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 20 }}>
          {/* Badge niveau */}
          <div style={{
            width: 72, height: 72,
            background: 'linear-gradient(135deg, #1f6feb, #58a6ff)',
            borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 28, fontWeight: 900,
            boxShadow: '0 0 20px #1f6feb60',
            flexShrink: 0,
          }}>
            {levelData.level}
          </div>

          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, color: '#8b949e', fontWeight: 600, marginBottom: 4 }}>
              NIVEAU {levelData.level}
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 4 }}>
              {levelData.title}
            </div>
            <div style={{ fontSize: 13, color: '#8b949e' }}>
              {levelData.current_xp} XP au total
            </div>
          </div>

          {/* Streak badge */}
          <div style={{
            textAlign: 'center',
            background: `${streakBadge.color}15`,
            border: `2px solid ${streakBadge.color}50`,
            borderRadius: 12, padding: '10px 16px',
          }}>
            <div style={{ fontSize: 24 }}>{streakBadge.icon}</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: streakBadge.color }}>
              {streakDays}
            </div>
            <div style={{ fontSize: 10, color: '#8b949e', fontWeight: 600 }}>
              JOURS
            </div>
            {streakBonus > 0 && (
              <div style={{
                marginTop: 4, fontSize: 11,
                color: '#f0883e', fontWeight: 700,
              }}>
                +{streakBonus} XP/jour
              </div>
            )}
          </div>
        </div>

        {/* Barre de progression vers le niveau suivant */}
        <div>
          <div style={{
            display: 'flex', justifyContent: 'space-between',
            marginBottom: 6, fontSize: 12, color: '#8b949e',
          }}>
            <span>Niv. {levelData.level}</span>
            <span style={{ color: '#58a6ff', fontWeight: 700 }}>
              {levelData.xp_in_level} / 100 XP
            </span>
            <span>Niv. {levelData.level + 1}</span>
          </div>
          <div style={{
            background: '#30363d', borderRadius: 999,
            height: 12, overflow: 'hidden',
            position: 'relative',
          }}>
            <div style={{
              width: `${levelData.progress_percentage}%`,
              height: '100%',
              background: 'linear-gradient(90deg, #1f6feb, #58a6ff)',
              borderRadius: 999,
              transition: 'width 0.8s ease',
              boxShadow: '0 0 8px #1f6feb80',
            }} />
          </div>
          <div style={{
            textAlign: 'center', marginTop: 6,
            fontSize: 12, color: '#8b949e',
          }}>
            Encore <strong style={{ color: '#58a6ff' }}>{levelData.xp_for_next_level} XP</strong>{' '}
            pour le niveau suivant
          </div>
        </div>
      </div>

      {/* ── Onglets ── */}
      <div style={{
        display: 'flex', borderBottom: '1px solid #30363d',
        background: '#161b22',
      }}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              flex: 1, padding: '12px 8px',
              background: 'none',
              border: 'none',
              borderBottom: `2px solid ${activeTab === tab.id ? '#1f6feb' : 'transparent'}`,
              color: activeTab === tab.id ? '#58a6ff' : '#8b949e',
              cursor: 'pointer', fontSize: 12,
              fontWeight: activeTab === tab.id ? 700 : 400,
              transition: 'color 0.2s',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Contenu des onglets ── */}
      <div style={{ padding: 20 }}>

        {/* Progression */}
        {activeTab === 'progress' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Stats rapides */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {[
                { label: 'XP ce niveau', value: `${levelData.xp_in_level}/100`, icon: '⭐' },
                { label: 'Progression', value: `${Math.round(levelData.progress_percentage)}%`, icon: '📈' },
                { label: 'Streak badge', value: streakBadge.name, icon: streakBadge.icon },
                { label: 'Bonus streak', value: streakBonus > 0 ? `+${streakBonus} XP/j` : '—', icon: '🎁' },
              ].map((s, i) => (
                <div key={i} style={{
                  background: '#161b22',
                  border: '1px solid #30363d',
                  borderRadius: 10, padding: '12px 16px',
                }}>
                  <div style={{ fontSize: 20, marginBottom: 4 }}>{s.icon}</div>
                  <div style={{ color: '#58a6ff', fontWeight: 700, fontSize: 16 }}>{s.value}</div>
                  <div style={{ color: '#8b949e', fontSize: 12, marginTop: 2 }}>{s.label}</div>
                </div>
              ))}
            </div>

            {/* Prochain jalon */}
            {nextMilestone && (
              <div style={{
                background: '#1c2128',
                border: '1px solid #30363d',
                borderRadius: 10, padding: 16,
              }}>
                <div style={{ color: '#8b949e', fontSize: 12, marginBottom: 8 }}>
                  PROCHAIN JALON
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontSize: 28 }}>{nextMilestone.icon}</span>
                  <div>
                    <div style={{ fontWeight: 700 }}>Niveau {nextMilestone.level}</div>
                    <div style={{ color: '#8b949e', fontSize: 13 }}>{nextMilestone.reward}</div>
                  </div>
                  <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
                    <div style={{ color: '#58a6ff', fontWeight: 700 }}>
                      {nextMilestone.xp - totalXp > 0 ? `${nextMilestone.xp - totalXp} XP` : '✅'}
                    </div>
                    <div style={{ color: '#8b949e', fontSize: 12 }}>restants</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Achievements */}
        {activeTab === 'achievements' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {recentAchievements.length > 0 ? (
              recentAchievements.map((a, i) => (
                <AchievementBadge key={i} achievement={a} />
              ))
            ) : (
              <div style={{
                textAlign: 'center', padding: 40,
                color: '#8b949e', fontSize: 14,
              }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>🏆</div>
                Complète des leçons pour débloquer des succès !
              </div>
            )}
          </div>
        )}

        {/* Leaderboard */}
        {activeTab === 'leaderboard' && (
          <div>
            {leaderboard.length > 0 ? (
              leaderboard.map((entry, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '10px 0',
                  borderBottom: i < leaderboard.length - 1 ? '1px solid #21262d' : 'none',
                }}>
                  <span style={{
                    width: 28, textAlign: 'center',
                    fontWeight: 800,
                    color: i === 0 ? '#ffd700' : i === 1 ? '#c0c0c0' : i === 2 ? '#cd7f32' : '#8b949e',
                    fontSize: i < 3 ? 18 : 14,
                  }}>
                    {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`}
                  </span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>
                      {entry.user_id === userId ? '(Toi) ' : ''}{entry.user_id}
                    </div>
                    <div style={{ color: '#8b949e', fontSize: 12 }}>
                      Niv. {entry.level} · {entry.streak_days}🔥
                    </div>
                  </div>
                  <div style={{
                    color: '#f0883e', fontWeight: 800, fontSize: 15,
                  }}>
                    {entry.total_xp} XP
                  </div>
                </div>
              ))
            ) : (
              <div style={{
                textAlign: 'center', padding: 40,
                color: '#8b949e', fontSize: 14,
              }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>👑</div>
                Sois le premier à apparaître dans le classement !
              </div>
            )}
          </div>
        )}

        {/* Jalons */}
        {activeTab === 'milestones' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {LEVEL_MILESTONES.map((m, i) => {
              const reached = levelData.level >= m.level;
              return (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  background: reached ? '#1a472a20' : '#161b22',
                  border: `1px solid ${reached ? '#27ae6040' : '#30363d'}`,
                  borderRadius: 10, padding: '12px 16px',
                  opacity: reached ? 1 : 0.7,
                }}>
                  <span style={{ fontSize: 24 }}>{m.icon}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{
                      fontWeight: 700, fontSize: 14,
                      color: reached ? '#27ae60' : '#e6edf3',
                    }}>
                      Niveau {m.level}
                    </div>
                    <div style={{ color: '#8b949e', fontSize: 12 }}>{m.reward}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    {reached ? (
                      <span style={{ color: '#27ae60', fontSize: 18 }}>✅</span>
                    ) : (
                      <span style={{ color: '#8b949e', fontSize: 12 }}>
                        {m.xp} XP
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default LevelProgress;
