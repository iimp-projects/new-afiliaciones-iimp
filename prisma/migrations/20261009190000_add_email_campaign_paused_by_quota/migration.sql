-- Migración ADITIVA: marca de pausa por cuota diaria en campañas.
-- No modifica tablas existentes ni elimina registros. Permite reanudar de forma
-- idempotente las campañas pausadas por agotamiento de la cuota diaria.

ALTER TABLE "email_campaigns" ADD COLUMN "paused_by_quota" BOOLEAN NOT NULL DEFAULT false;
