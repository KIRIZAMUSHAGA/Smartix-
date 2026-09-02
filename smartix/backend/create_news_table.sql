-- Sources
CREATE TABLE IF NOT EXISTS news_source (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  base_url TEXT,
  rss_url TEXT,
  country TEXT,
  language TEXT,
  priority INT DEFAULT 0,
  last_checked TIMESTAMP
);

-- News
CREATE TABLE IF NOT EXISTS news (
  id SERIAL PRIMARY KEY,
  source_id INT REFERENCES news_source(id),
  title TEXT NOT NULL,
  summary TEXT,
  content TEXT,
  url TEXT NOT NULL UNIQUE,
  canonical_url TEXT,
  image_url TEXT,
  local_image_path TEXT,
  country TEXT,
  language TEXT,
  category TEXT,
  published_at TIMESTAMP,
  fetched_at TIMESTAMP DEFAULT NOW(),
  dedup_hash TEXT,
  is_duplicate BOOLEAN DEFAULT FALSE,
  processed BOOLEAN DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_news_published ON news(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_news_dedup ON news(dedup_hash);

-- Interactions
CREATE TABLE IF NOT EXISTS news_like (
  id SERIAL PRIMARY KEY,
  news_id INT REFERENCES news(id),
  user_id TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS news_comment (
  id SERIAL PRIMARY KEY,
  news_id INT REFERENCES news(id),
  user_id TEXT,
  message TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
