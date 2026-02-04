CREATE TABLE IF NOT EXISTS didqube.ops_config (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS didqube.anon_usage (
  alias_commitment TEXT NOT NULL REFERENCES didqube.anon_aliases(alias_commitment) ON DELETE CASCADE,
  day DATE NOT NULL,
  spent_qcents BIGINT NOT NULL DEFAULT 0,
  PRIMARY KEY (alias_commitment, day)
);
CREATE INDEX IF NOT EXISTS idx_anon_usage_alias_day ON didqube.anon_usage(alias_commitment, day);
