ALTER TABLE "person_addresses"
  ALTER COLUMN "district_id" DROP NOT NULL,
  ADD COLUMN "country_id" INTEGER,
  ADD COLUMN "foreign_region" VARCHAR(150),
  ADD COLUMN "foreign_city" VARCHAR(150);

ALTER TABLE "person_addresses"
  ADD CONSTRAINT "person_addresses_country_id_fkey"
  FOREIGN KEY ("country_id") REFERENCES "catalog_countries"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "person_addresses_country_id_idx" ON "person_addresses"("country_id");
