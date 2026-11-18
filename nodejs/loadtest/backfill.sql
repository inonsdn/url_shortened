\timing on

DO $$
BEGIN
  FOR batch IN 0..31 LOOP
    INSERT INTO links (code, url, created_at)
    SELECT 'b' || lpad(to_hex(i), 9, '0'),
           'https://example.com/page/' || i,
           now() - random() * interval '365 days'
    FROM generate_series(batch * 1000000 + 1,
                         LEAST((batch + 1) * 1000000, 31536000)) AS i
    ON CONFLICT (code) DO NOTHING;
    COMMIT;
    RAISE NOTICE 'batch % done', batch;
  END LOOP;
END $$;

ANALYZE links;