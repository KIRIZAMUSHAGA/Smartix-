-- ClickHouse init.sql — Initialisation de la base Vibe-Coding
-- Exécuté automatiquement au démarrage du conteneur ClickHouse

-- ─────────────────────────────────────────────────────────────────────────────
-- Base de données
-- ─────────────────────────────────────────────────────────────────────────────

CREATE DATABASE IF NOT EXISTS vibe_coding;

-- ─────────────────────────────────────────────────────────────────────────────
-- Métriques d'usage utilisateur
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS vibe_coding.vibe_metrics
(
    timestamp   DateTime     DEFAULT now(),
    user_id     String,
    project_id  String       DEFAULT '',
    event_type  String,
    duration_ms UInt32       DEFAULT 0,
    metadata    String       DEFAULT '',
    region      String       DEFAULT 'eu-west'
)
ENGINE = MergeTree()
PARTITION BY toYYYYMM(timestamp)
ORDER BY (timestamp, user_id)
TTL timestamp + INTERVAL 1 YEAR
SETTINGS index_granularity = 8192;

-- ─────────────────────────────────────────────────────────────────────────────
-- Métriques de performance des API
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS vibe_coding.performance_metrics
(
    timestamp        DateTime DEFAULT now(),
    endpoint         String,
    method           String   DEFAULT 'GET',
    response_time_ms UInt32,
    status_code      UInt16,
    user_id          String   DEFAULT 'anonymous',
    region           String   DEFAULT 'eu-west',
    bytes_sent       UInt32   DEFAULT 0
)
ENGINE = MergeTree()
PARTITION BY toYYYYMM(timestamp)
ORDER BY (timestamp, endpoint)
TTL timestamp + INTERVAL 90 DAY
SETTINGS index_granularity = 8192;

-- ─────────────────────────────────────────────────────────────────────────────
-- Erreurs applicatives
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS vibe_coding.errors
(
    timestamp     DateTime DEFAULT now(),
    error_type    String,
    error_message String,
    stack_trace   String   DEFAULT '',
    user_id       String   DEFAULT 'anonymous',
    project_id    String   DEFAULT '',
    endpoint      String   DEFAULT '',
    region        String   DEFAULT 'eu-west'
)
ENGINE = MergeTree()
PARTITION BY toYYYYMM(timestamp)
ORDER BY (timestamp, error_type)
TTL timestamp + INTERVAL 6 MONTH
SETTINGS index_granularity = 8192;

-- ─────────────────────────────────────────────────────────────────────────────
-- Événements de scaling
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS vibe_coding.scaling_events
(
    timestamp      DateTime DEFAULT now(),
    event_type     String,
    deployment     String,
    from_replicas  UInt8,
    to_replicas    UInt8,
    trigger_metric String   DEFAULT '',
    trigger_value  Float64  DEFAULT 0,
    region         String   DEFAULT 'eu-west'
)
ENGINE = MergeTree()
ORDER BY (timestamp, deployment)
TTL timestamp + INTERVAL 1 YEAR
SETTINGS index_granularity = 8192;

-- ─────────────────────────────────────────────────────────────────────────────
-- Sessions utilisateur (agrégation quotidienne)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS vibe_coding.user_sessions
(
    date          Date,
    user_id       String,
    session_count UInt32  DEFAULT 0,
    total_time_ms UInt64  DEFAULT 0,
    region        String  DEFAULT 'eu-west'
)
ENGINE = SummingMergeTree((session_count, total_time_ms))
PARTITION BY toYYYYMM(date)
ORDER BY (date, user_id)
TTL date + INTERVAL 2 YEAR;

-- ─────────────────────────────────────────────────────────────────────────────
-- Vue matérialisée : DAU (Daily Active Users)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE MATERIALIZED VIEW IF NOT EXISTS vibe_coding.dau_mv
ENGINE = AggregatingMergeTree()
PARTITION BY toYYYYMM(date)
ORDER BY date
AS
SELECT
    toDate(timestamp)                   AS date,
    uniqState(user_id)                  AS dau_state,
    countState()                        AS events_state
FROM vibe_coding.vibe_metrics
GROUP BY date;

-- Vue de lecture du DAU
CREATE VIEW IF NOT EXISTS vibe_coding.dau AS
SELECT
    date,
    uniqMerge(dau_state)     AS dau,
    countMerge(events_state) AS total_events
FROM vibe_coding.dau_mv
GROUP BY date
ORDER BY date;

-- ─────────────────────────────────────────────────────────────────────────────
-- Vue matérialisée : API Performance agrégée par heure
-- ─────────────────────────────────────────────────────────────────────────────

CREATE MATERIALIZED VIEW IF NOT EXISTS vibe_coding.perf_hourly_mv
ENGINE = AggregatingMergeTree()
PARTITION BY toYYYYMM(hour)
ORDER BY (hour, endpoint)
AS
SELECT
    toStartOfHour(timestamp)                AS hour,
    endpoint,
    method,
    avgState(response_time_ms)              AS avg_time_state,
    quantileState(0.95)(response_time_ms)   AS p95_state,
    countState()                            AS total_state,
    countIfState(status_code >= 400)        AS error_state
FROM vibe_coding.performance_metrics
GROUP BY hour, endpoint, method;

-- Vue de lecture de la performance horaire
CREATE VIEW IF NOT EXISTS vibe_coding.perf_hourly AS
SELECT
    hour,
    endpoint,
    method,
    avgMerge(avg_time_state)             AS avg_response_time,
    quantileMerge(0.95)(p95_state)       AS p95_response_time,
    countMerge(total_state)              AS total_requests,
    countMerge(error_state)              AS error_requests,
    countMerge(error_state) * 100.0 /
        nullIf(countMerge(total_state), 0) AS error_rate_pct
FROM vibe_coding.perf_hourly_mv
GROUP BY hour, endpoint, method
ORDER BY hour DESC;

-- ─────────────────────────────────────────────────────────────────────────────
-- Données de test (supprimées en production)
-- ─────────────────────────────────────────────────────────────────────────────

-- Insertion de données de démonstration
INSERT INTO vibe_coding.vibe_metrics
    (timestamp, user_id, project_id, event_type, duration_ms, region)
VALUES
    (now(), 'user_001', 'proj_001', 'lesson_complete', 5000, 'eu-west'),
    (now(), 'user_002', 'proj_002', 'code_validated', 1200, 'us-east'),
    (now(), 'user_003', 'proj_001', 'lesson_started', 0, 'eu-west'),
    (now(), 'user_001', 'proj_003', 'project_created', 300, 'eu-west');

INSERT INTO vibe_coding.performance_metrics
    (timestamp, endpoint, method, response_time_ms, status_code, region)
VALUES
    (now(), '/api/curriculum', 'GET', 45, 200, 'eu-west'),
    (now(), '/api/validate-code', 'POST', 1250, 200, 'eu-west'),
    (now(), '/api/user/progress', 'GET', 12, 200, 'us-east'),
    (now(), '/api/user/complete-lesson', 'POST', 87, 200, 'eu-west');
