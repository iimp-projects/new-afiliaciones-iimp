-- Añade el flag de cambio obligatorio de contraseña en el primer ingreso.
ALTER TABLE "auth_users" ADD COLUMN "must_change_password" BOOLEAN NOT NULL DEFAULT false;
