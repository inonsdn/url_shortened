CREATE TABLE links (
    id          BIGSERIAL PRIMARY KEY,
    code        VARCHAR(10) UNIQUE NOT NULL,
    url         TEXT NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX links_url_idx ON links (url);