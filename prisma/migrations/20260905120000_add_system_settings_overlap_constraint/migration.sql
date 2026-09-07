CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE "sys_system_setting_values"
ADD CONSTRAINT "sys_system_setting_values_no_active_overlap"
EXCLUDE USING gist (
  "setting_id" WITH =,
  tsrange(
    "starts_at",
    COALESCE("ends_at", 'infinity'::timestamp),
    '[)'
  ) WITH &&
)
WHERE ("is_active");
