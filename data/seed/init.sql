-- Enable PostGIS
CREATE EXTENSION IF NOT EXISTS postgis;

-- 1. Main Reports Table
CREATE TABLE reports (
    id SERIAL PRIMARY KEY,
    target_name TEXT NOT NULL,          -- Company or person name
    target_rut  TEXT,                   -- Sanitized RUT (Numbers + K)
    category    TEXT NOT NULL,          -- e.g., 'Contaminación de Aguas'
    description TEXT,
    -- Points for the map pins
    location    GEOGRAPHY(POINT, 4326),
    -- Polygon for the affected area (optional for MVP)
    affected_area GEOGRAPHY(POLYGON, 4326),
    created_at  TIMESTAMP DEFAULT NOW()
);

-- 2. Anti-Spam Voting Table
CREATE TABLE votes (
    id SERIAL PRIMARY KEY,
    report_id INT REFERENCES reports(id) ON DELETE CASCADE,
    voter_hash TEXT NOT NULL,           -- SHA256(IP + UA + Salt)
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(report_id, voter_hash)       -- This prevents double-voting
);

-- 3. Evidence Table (Future-proofing)
CREATE TABLE evidence (
    id SERIAL PRIMARY KEY,
    report_id INT REFERENCES reports(id) ON DELETE CASCADE,
    file_path TEXT NOT NULL,
    is_verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Index for fast map searches
CREATE INDEX idx_reports_location ON reports USING GIST (location);
