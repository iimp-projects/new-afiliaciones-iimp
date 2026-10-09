-- Migración ADITIVA: contador diario de envíos por cuenta SMTP.
-- No modifica tablas existentes ni elimina registros. Se usa para aplicar
-- cuotas diarias conservadoras a las campañas de la cuenta DEFAULT, protegiendo
-- la capacidad de las notificaciones transaccionales.

CREATE TABLE "smtp_daily_quotas" (
    "id" SERIAL NOT NULL,
    "account" VARCHAR(20) NOT NULL,
    "day" VARCHAR(10) NOT NULL,
    "sent_count" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "smtp_daily_quotas_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "smtp_daily_quotas_account_day_key" ON "smtp_daily_quotas"("account", "day");
