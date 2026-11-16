CREATE SCHEMA IF NOT EXISTS tibia_dungeons;

CREATE TABLE IF NOT EXISTS tibia_dungeons.game_saves (
  save_id UUID PRIMARY KEY,
  state JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
