ALTER TABLE "persons" ADD COLUMN "associate_code" VARCHAR(20);

CREATE UNIQUE INDEX "persons_associate_code_key" ON "persons"("associate_code");

CREATE TABLE "associate_code_sequence" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "last_value" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "associate_code_sequence_pkey" PRIMARY KEY ("id")
);

INSERT INTO "associate_code_sequence" ("id", "last_value", "updated_at")
VALUES (1, 0, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;
