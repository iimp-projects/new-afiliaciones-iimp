-- CreateEnum
CREATE TYPE "CredentialType" AS ENUM ('PASSWORD', 'PASSKEY');

-- CreateEnum
CREATE TYPE "SecurityEventType" AS ENUM ('LOGIN_SUCCESS', 'LOGIN_FAILED', 'ACCOUNT_LOCKED', 'ACCOUNT_UNLOCKED', 'SESSION_REVOKED', 'SESSION_EXPIRED', 'CREDENTIAL_ADDED', 'CREDENTIAL_REVOKED');

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('DNI', 'CE', 'PASSPORT', 'OTHER');

-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE', 'OTHER', 'PREFER_NOT_TO_SAY');

-- CreateEnum
CREATE TYPE "CivilStatus" AS ENUM ('SINGLE', 'MARRIED', 'DIVORCED', 'WIDOWED', 'OTHER');

-- CreateEnum
CREATE TYPE "ApplicationStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'AWAITING_ENDORSEMENTS', 'UNDER_EVALUATION', 'OBSERVED', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AiValidationStatus" AS ENUM ('PENDING', 'VALIDATED', 'REJECTED', 'MANUAL_REVIEW_REQUIRED');

-- CreateEnum
CREATE TYPE "DocumentCategory" AS ENUM ('CV', 'RECOMMENDATION_LETTER', 'SWORN_DECLARATION', 'ID_DOCUMENT', 'DEGREE_CERTIFICATE', 'PAYMENT_VOUCHER', 'OTHER');

-- CreateEnum
CREATE TYPE "ObservationStatus" AS ENUM ('PENDING', 'RESOLVED', 'DISMISSED');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'PROCESSING', 'PAID', 'FAILED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "PaymentGateway" AS ENUM ('NIUBIZ', 'IZIPAY', 'STRIPE', 'PAYPAL', 'BANK_TRANSFER');

-- CreateEnum
CREATE TYPE "Currency" AS ENUM ('PEN', 'USD');

-- CreateEnum
CREATE TYPE "InvoiceType" AS ENUM ('BOLETA', 'FACTURA', 'CREDIT_NOTE', 'DEBIT_NOTE');

-- CreateEnum
CREATE TYPE "PhoneType" AS ENUM ('MOBILE', 'LANDLINE', 'WORK', 'OTHER');

-- CreateEnum
CREATE TYPE "UserType" AS ENUM ('SYSTEM_ADMIN', 'VALIDATOR', 'APPLICANT', 'AFFILIATE');

-- CreateEnum
CREATE TYPE "AffiliateType" AS ENUM ('REGULAR', 'STUDENT', 'SENIOR', 'HONORARY');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'BLOCKED', 'PENDING');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('IN_APP', 'EMAIL', 'SMS', 'PUSH');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('UNREAD', 'READ', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "StudyLevel" AS ENUM ('BACHELOR', 'MASTER', 'DOCTORATE', 'TECHNICAL', 'OTHER');

-- CreateEnum
CREATE TYPE "EndorsementStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ConfigDataType" AS ENUM ('STRING', 'INTEGER', 'DECIMAL', 'BOOLEAN', 'JSON');

-- CreateTable
CREATE TABLE "auth_users" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(150),
    "email" VARCHAR(150) NOT NULL,
    "email_verified" TIMESTAMP(3),
    "image" VARCHAR(500),
    "status" "UserStatus" NOT NULL DEFAULT 'PENDING',
    "type" "UserType" NOT NULL DEFAULT 'APPLICANT',
    "last_login_at" TIMESTAMP(3),
    "failed_login_attempts" INTEGER NOT NULL DEFAULT 0,
    "locked_until" TIMESTAMP(3),
    "role_id" INTEGER,
    "person_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "auth_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth_credentials" (
    "id" TEXT NOT NULL,
    "user_id" INTEGER NOT NULL,
    "type" "CredentialType" NOT NULL,
    "secret" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "auth_credentials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth_user_sessions" (
    "id" TEXT NOT NULL,
    "user_id" INTEGER NOT NULL,
    "ip_address" VARCHAR(45),
    "user_agent" TEXT,
    "os" VARCHAR(100),
    "browser" VARCHAR(100),
    "expires_at" TIMESTAMP(3) NOT NULL,
    "last_activity_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "is_revoked" BOOLEAN NOT NULL DEFAULT false,
    "revoked_at" TIMESTAMP(3),
    "revoke_reason" VARCHAR(255),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "auth_user_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth_security_events" (
    "id" TEXT NOT NULL,
    "user_id" INTEGER,
    "type" "SecurityEventType" NOT NULL,
    "ip_address" VARCHAR(45),
    "user_agent" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auth_security_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth_accounts" (
    "id" TEXT NOT NULL,
    "user_id" INTEGER NOT NULL,
    "type" VARCHAR(50) NOT NULL,
    "provider" VARCHAR(50) NOT NULL,
    "provider_account_id" VARCHAR(100) NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" VARCHAR(50),
    "scope" VARCHAR(255),
    "id_token" TEXT,
    "session_state" VARCHAR(255),

    CONSTRAINT "auth_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth_sessions" (
    "id" TEXT NOT NULL,
    "session_token" VARCHAR(255) NOT NULL,
    "user_id" INTEGER NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "auth_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth_verification_tokens" (
    "identifier" VARCHAR(150) NOT NULL,
    "token" VARCHAR(255) NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "auth_roles" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "slug" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "auth_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth_permissions" (
    "id" SERIAL NOT NULL,
    "action" VARCHAR(100) NOT NULL,
    "subject" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "auth_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth_role_permissions" (
    "role_id" INTEGER NOT NULL,
    "permission_id" INTEGER NOT NULL,

    CONSTRAINT "auth_role_permissions_pkey" PRIMARY KEY ("role_id","permission_id")
);

-- CreateTable
CREATE TABLE "per_persons" (
    "id" SERIAL NOT NULL,
    "document_type" "DocumentType" NOT NULL,
    "document_number" VARCHAR(50) NOT NULL,
    "first_name" VARCHAR(150) NOT NULL,
    "paternal_last_name" VARCHAR(150) NOT NULL,
    "maternal_last_name" VARCHAR(150),
    "gender" "Gender",
    "civil_status" "CivilStatus",
    "birth_date" DATE,
    "birth_place" VARCHAR(200),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "per_persons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "per_contacts" (
    "id" SERIAL NOT NULL,
    "person_id" INTEGER NOT NULL,
    "phone_type" "PhoneType" NOT NULL DEFAULT 'MOBILE',
    "phone_number" VARCHAR(50) NOT NULL,
    "email" VARCHAR(150),
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "per_contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "per_addresses" (
    "id" SERIAL NOT NULL,
    "person_id" INTEGER NOT NULL,
    "district_id" INTEGER NOT NULL,
    "street" VARCHAR(255) NOT NULL,
    "reference" VARCHAR(255),
    "zip_code" VARCHAR(20),
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "per_addresses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "aff_applications" (
    "id" SERIAL NOT NULL,
    "application_code" VARCHAR(50) NOT NULL,
    "tracking_code" VARCHAR(50) NOT NULL,
    "person_id" INTEGER NOT NULL,
    "affiliate_type" "AffiliateType" NOT NULL,
    "status" "ApplicationStatus" NOT NULL DEFAULT 'DRAFT',
    "current_step" INTEGER NOT NULL DEFAULT 1,
    "draft_data" JSONB,
    "correspondence_preference" VARCHAR(100),
    "submitted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "aff_applications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "aff_application_documents" (
    "id" TEXT NOT NULL,
    "application_id" INTEGER NOT NULL,
    "category" "DocumentCategory" NOT NULL,
    "file_url" VARCHAR(500) NOT NULL,
    "file_name" VARCHAR(250) NOT NULL,
    "mime_type" VARCHAR(100) NOT NULL,
    "size_bytes" BIGINT NOT NULL,
    "ai_validation_status" "AiValidationStatus" NOT NULL DEFAULT 'PENDING',
    "ai_confidence_score" DECIMAL(5,4),
    "ai_extracted_data" JSONB,
    "ai_model_used" VARCHAR(100),
    "validated_at" TIMESTAMP(3),
    "approved_by_id" INTEGER,
    "rejection_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "aff_application_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "aff_application_history" (
    "id" SERIAL NOT NULL,
    "application_id" INTEGER NOT NULL,
    "previous_status" "ApplicationStatus" NOT NULL,
    "new_status" "ApplicationStatus" NOT NULL,
    "changed_by_id" INTEGER,
    "change_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "aff_application_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "aff_approvals" (
    "id" SERIAL NOT NULL,
    "application_id" INTEGER NOT NULL,
    "sponsor_person_id" INTEGER NOT NULL,
    "sponsor_code" VARCHAR(50),
    "status" "EndorsementStatus" NOT NULL DEFAULT 'PENDING',
    "transaction_date" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "aff_approvals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "aff_observations" (
    "id" SERIAL NOT NULL,
    "application_id" INTEGER NOT NULL,
    "review_department" VARCHAR(100) NOT NULL,
    "error_description" TEXT NOT NULL,
    "status" "ObservationStatus" NOT NULL DEFAULT 'PENDING',
    "resolved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "aff_observations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prof_academic_info" (
    "id" SERIAL NOT NULL,
    "person_id" INTEGER NOT NULL,
    "study_level" "StudyLevel" NOT NULL,
    "university_id" INTEGER,
    "specialty_id" INTEGER,
    "degree_title" VARCHAR(200),
    "professional_association" VARCHAR(200),
    "license_number" VARCHAR(50),
    "graduation_year" INTEGER,
    "term_or_semester" VARCHAR(50),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "prof_academic_info_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prof_employment_info" (
    "id" SERIAL NOT NULL,
    "person_id" INTEGER NOT NULL,
    "company_id" INTEGER,
    "area" VARCHAR(150),
    "position" VARCHAR(150),
    "working_address" VARCHAR(250),
    "work_phone" VARCHAR(50),
    "work_extension" VARCHAR(20),
    "work_email" VARCHAR(150),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "prof_employment_info_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prof_experiences" (
    "id" SERIAL NOT NULL,
    "person_id" INTEGER NOT NULL,
    "company_id" INTEGER,
    "position" VARCHAR(150) NOT NULL,
    "description" TEXT,
    "start_date" DATE NOT NULL,
    "end_date" DATE,
    "is_current" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "prof_experiences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pay_payments" (
    "id" SERIAL NOT NULL,
    "application_id" INTEGER NOT NULL,
    "gateway" "PaymentGateway" NOT NULL DEFAULT 'NIUBIZ',
    "transaction_id" VARCHAR(100),
    "authorization_code" VARCHAR(50),
    "response_code" VARCHAR(50),
    "total_amount" DECIMAL(10,2) NOT NULL,
    "currency" "Currency" NOT NULL DEFAULT 'PEN',
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "payment_date" TIMESTAMP(3),
    "gateway_payload" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pay_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pay_billings" (
    "id" SERIAL NOT NULL,
    "payment_id" INTEGER NOT NULL,
    "tax_id" VARCHAR(20) NOT NULL,
    "business_name" VARCHAR(250) NOT NULL,
    "billing_address" VARCHAR(250),
    "country_id" INTEGER,
    "billing_email" VARCHAR(150),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pay_billings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pay_invoices" (
    "id" SERIAL NOT NULL,
    "billing_id" INTEGER NOT NULL,
    "type" "InvoiceType" NOT NULL,
    "serie" VARCHAR(4) NOT NULL,
    "number" VARCHAR(8) NOT NULL,
    "issue_date" TIMESTAMP(3) NOT NULL,
    "sunat_hash" VARCHAR(255),
    "sunat_cdr_url" VARCHAR(500),
    "xml_url" VARCHAR(500),
    "pdf_url" VARCHAR(500),
    "status" VARCHAR(50) NOT NULL DEFAULT 'EMITTED',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pay_invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cat_countries" (
    "id" SERIAL NOT NULL,
    "iso_code" VARCHAR(3) NOT NULL,
    "phone_code" VARCHAR(10) NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "cat_countries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cat_departments" (
    "id" SERIAL NOT NULL,
    "country_id" INTEGER NOT NULL,
    "ubigeo_code" VARCHAR(10) NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "cat_departments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cat_provinces" (
    "id" SERIAL NOT NULL,
    "department_id" INTEGER NOT NULL,
    "ubigeo_code" VARCHAR(10) NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "cat_provinces_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cat_districts" (
    "id" SERIAL NOT NULL,
    "province_id" INTEGER NOT NULL,
    "ubigeo_code" VARCHAR(10) NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "cat_districts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cat_universities" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(250) NOT NULL,
    "is_licensed" BOOLEAN NOT NULL DEFAULT true,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "cat_universities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cat_companies" (
    "id" SERIAL NOT NULL,
    "tax_id" VARCHAR(20),
    "name" VARCHAR(250) NOT NULL,
    "industry" VARCHAR(150),
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "cat_companies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cat_specialties" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "cat_specialties_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sys_notifications" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "channel" "NotificationChannel" NOT NULL DEFAULT 'IN_APP',
    "title" VARCHAR(200) NOT NULL,
    "message" TEXT NOT NULL,
    "status" "NotificationStatus" NOT NULL DEFAULT 'UNREAD',
    "read_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sys_notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sys_audit_logs" (
    "id" TEXT NOT NULL,
    "trace_id" VARCHAR(100),
    "user_id" INTEGER,
    "action" VARCHAR(100) NOT NULL,
    "entity" VARCHAR(100) NOT NULL,
    "entity_id" VARCHAR(100),
    "old_values" JSONB,
    "new_values" JSONB,
    "endpoint" VARCHAR(255),
    "http_method" VARCHAR(10),
    "execution_time_ms" INTEGER,
    "ip_address" VARCHAR(50),
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sys_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sys_configurations" (
    "id" SERIAL NOT NULL,
    "group" VARCHAR(100) NOT NULL,
    "key" VARCHAR(100) NOT NULL,
    "value" TEXT NOT NULL,
    "data_type" "ConfigDataType" NOT NULL DEFAULT 'STRING',
    "description" TEXT,
    "is_public" BOOLEAN NOT NULL DEFAULT false,
    "updated_by" VARCHAR(100),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sys_configurations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "auth_users_email_key" ON "auth_users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "auth_users_person_id_key" ON "auth_users"("person_id");

-- CreateIndex
CREATE INDEX "auth_users_email_idx" ON "auth_users"("email");

-- CreateIndex
CREATE INDEX "auth_users_status_idx" ON "auth_users"("status");

-- CreateIndex
CREATE INDEX "auth_credentials_user_id_idx" ON "auth_credentials"("user_id");

-- CreateIndex
CREATE INDEX "auth_user_sessions_user_id_idx" ON "auth_user_sessions"("user_id");

-- CreateIndex
CREATE INDEX "auth_user_sessions_is_revoked_idx" ON "auth_user_sessions"("is_revoked");

-- CreateIndex
CREATE INDEX "auth_user_sessions_expires_at_idx" ON "auth_user_sessions"("expires_at");

-- CreateIndex
CREATE INDEX "auth_security_events_user_id_idx" ON "auth_security_events"("user_id");

-- CreateIndex
CREATE INDEX "auth_security_events_type_idx" ON "auth_security_events"("type");

-- CreateIndex
CREATE INDEX "auth_security_events_created_at_idx" ON "auth_security_events"("created_at");

-- CreateIndex
CREATE INDEX "auth_accounts_user_id_idx" ON "auth_accounts"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "auth_accounts_provider_provider_account_id_key" ON "auth_accounts"("provider", "provider_account_id");

-- CreateIndex
CREATE UNIQUE INDEX "auth_sessions_session_token_key" ON "auth_sessions"("session_token");

-- CreateIndex
CREATE INDEX "auth_sessions_user_id_idx" ON "auth_sessions"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "auth_verification_tokens_token_key" ON "auth_verification_tokens"("token");

-- CreateIndex
CREATE UNIQUE INDEX "auth_verification_tokens_identifier_token_key" ON "auth_verification_tokens"("identifier", "token");

-- CreateIndex
CREATE UNIQUE INDEX "auth_roles_slug_key" ON "auth_roles"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "auth_permissions_action_subject_key" ON "auth_permissions"("action", "subject");

-- CreateIndex
CREATE INDEX "per_persons_document_number_idx" ON "per_persons"("document_number");

-- CreateIndex
CREATE INDEX "per_persons_paternal_last_name_maternal_last_name_first_nam_idx" ON "per_persons"("paternal_last_name", "maternal_last_name", "first_name");

-- CreateIndex
CREATE UNIQUE INDEX "per_persons_document_type_document_number_key" ON "per_persons"("document_type", "document_number");

-- CreateIndex
CREATE INDEX "per_contacts_person_id_idx" ON "per_contacts"("person_id");

-- CreateIndex
CREATE INDEX "per_contacts_email_idx" ON "per_contacts"("email");

-- CreateIndex
CREATE INDEX "per_addresses_person_id_idx" ON "per_addresses"("person_id");

-- CreateIndex
CREATE INDEX "per_addresses_district_id_idx" ON "per_addresses"("district_id");

-- CreateIndex
CREATE UNIQUE INDEX "aff_applications_application_code_key" ON "aff_applications"("application_code");

-- CreateIndex
CREATE UNIQUE INDEX "aff_applications_tracking_code_key" ON "aff_applications"("tracking_code");

-- CreateIndex
CREATE INDEX "aff_applications_person_id_idx" ON "aff_applications"("person_id");

-- CreateIndex
CREATE INDEX "aff_applications_status_idx" ON "aff_applications"("status");

-- CreateIndex
CREATE INDEX "aff_applications_application_code_idx" ON "aff_applications"("application_code");

-- CreateIndex
CREATE INDEX "aff_applications_tracking_code_idx" ON "aff_applications"("tracking_code");

-- CreateIndex
CREATE INDEX "aff_application_documents_application_id_idx" ON "aff_application_documents"("application_id");

-- CreateIndex
CREATE INDEX "aff_application_documents_ai_validation_status_idx" ON "aff_application_documents"("ai_validation_status");

-- CreateIndex
CREATE INDEX "aff_application_history_application_id_idx" ON "aff_application_history"("application_id");

-- CreateIndex
CREATE INDEX "aff_approvals_application_id_idx" ON "aff_approvals"("application_id");

-- CreateIndex
CREATE INDEX "aff_approvals_sponsor_person_id_idx" ON "aff_approvals"("sponsor_person_id");

-- CreateIndex
CREATE INDEX "aff_observations_application_id_idx" ON "aff_observations"("application_id");

-- CreateIndex
CREATE INDEX "aff_observations_status_idx" ON "aff_observations"("status");

-- CreateIndex
CREATE INDEX "prof_academic_info_person_id_idx" ON "prof_academic_info"("person_id");

-- CreateIndex
CREATE INDEX "prof_academic_info_university_id_idx" ON "prof_academic_info"("university_id");

-- CreateIndex
CREATE INDEX "prof_employment_info_person_id_idx" ON "prof_employment_info"("person_id");

-- CreateIndex
CREATE INDEX "prof_employment_info_company_id_idx" ON "prof_employment_info"("company_id");

-- CreateIndex
CREATE INDEX "prof_experiences_person_id_idx" ON "prof_experiences"("person_id");

-- CreateIndex
CREATE INDEX "pay_payments_application_id_idx" ON "pay_payments"("application_id");

-- CreateIndex
CREATE INDEX "pay_payments_status_idx" ON "pay_payments"("status");

-- CreateIndex
CREATE INDEX "pay_payments_transaction_id_idx" ON "pay_payments"("transaction_id");

-- CreateIndex
CREATE UNIQUE INDEX "pay_billings_payment_id_key" ON "pay_billings"("payment_id");

-- CreateIndex
CREATE INDEX "pay_billings_payment_id_idx" ON "pay_billings"("payment_id");

-- CreateIndex
CREATE INDEX "pay_billings_tax_id_idx" ON "pay_billings"("tax_id");

-- CreateIndex
CREATE UNIQUE INDEX "pay_invoices_billing_id_key" ON "pay_invoices"("billing_id");

-- CreateIndex
CREATE INDEX "pay_invoices_billing_id_idx" ON "pay_invoices"("billing_id");

-- CreateIndex
CREATE UNIQUE INDEX "pay_invoices_serie_number_key" ON "pay_invoices"("serie", "number");

-- CreateIndex
CREATE UNIQUE INDEX "cat_countries_iso_code_key" ON "cat_countries"("iso_code");

-- CreateIndex
CREATE UNIQUE INDEX "cat_departments_ubigeo_code_key" ON "cat_departments"("ubigeo_code");

-- CreateIndex
CREATE INDEX "cat_departments_country_id_idx" ON "cat_departments"("country_id");

-- CreateIndex
CREATE UNIQUE INDEX "cat_provinces_ubigeo_code_key" ON "cat_provinces"("ubigeo_code");

-- CreateIndex
CREATE INDEX "cat_provinces_department_id_idx" ON "cat_provinces"("department_id");

-- CreateIndex
CREATE UNIQUE INDEX "cat_districts_ubigeo_code_key" ON "cat_districts"("ubigeo_code");

-- CreateIndex
CREATE INDEX "cat_districts_province_id_idx" ON "cat_districts"("province_id");

-- CreateIndex
CREATE UNIQUE INDEX "cat_companies_tax_id_key" ON "cat_companies"("tax_id");

-- CreateIndex
CREATE INDEX "cat_companies_tax_id_idx" ON "cat_companies"("tax_id");

-- CreateIndex
CREATE INDEX "cat_companies_name_idx" ON "cat_companies"("name");

-- CreateIndex
CREATE INDEX "sys_notifications_user_id_idx" ON "sys_notifications"("user_id");

-- CreateIndex
CREATE INDEX "sys_notifications_status_idx" ON "sys_notifications"("status");

-- CreateIndex
CREATE INDEX "sys_audit_logs_entity_entity_id_idx" ON "sys_audit_logs"("entity", "entity_id");

-- CreateIndex
CREATE INDEX "sys_audit_logs_user_id_idx" ON "sys_audit_logs"("user_id");

-- CreateIndex
CREATE INDEX "sys_audit_logs_created_at_idx" ON "sys_audit_logs"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "sys_configurations_key_key" ON "sys_configurations"("key");

-- CreateIndex
CREATE INDEX "sys_configurations_group_idx" ON "sys_configurations"("group");

-- AddForeignKey
ALTER TABLE "auth_users" ADD CONSTRAINT "auth_users_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "auth_roles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auth_users" ADD CONSTRAINT "auth_users_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "per_persons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auth_credentials" ADD CONSTRAINT "auth_credentials_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auth_user_sessions" ADD CONSTRAINT "auth_user_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auth_security_events" ADD CONSTRAINT "auth_security_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auth_accounts" ADD CONSTRAINT "auth_accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auth_sessions" ADD CONSTRAINT "auth_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auth_role_permissions" ADD CONSTRAINT "auth_role_permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "auth_roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auth_role_permissions" ADD CONSTRAINT "auth_role_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "auth_permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "per_contacts" ADD CONSTRAINT "per_contacts_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "per_persons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "per_addresses" ADD CONSTRAINT "per_addresses_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "per_persons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "per_addresses" ADD CONSTRAINT "per_addresses_district_id_fkey" FOREIGN KEY ("district_id") REFERENCES "cat_districts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aff_applications" ADD CONSTRAINT "aff_applications_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "per_persons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aff_application_documents" ADD CONSTRAINT "aff_application_documents_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "aff_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aff_application_documents" ADD CONSTRAINT "aff_application_documents_approved_by_id_fkey" FOREIGN KEY ("approved_by_id") REFERENCES "auth_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aff_application_history" ADD CONSTRAINT "aff_application_history_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "aff_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aff_approvals" ADD CONSTRAINT "aff_approvals_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "aff_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aff_approvals" ADD CONSTRAINT "aff_approvals_sponsor_person_id_fkey" FOREIGN KEY ("sponsor_person_id") REFERENCES "per_persons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aff_observations" ADD CONSTRAINT "aff_observations_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "aff_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prof_academic_info" ADD CONSTRAINT "prof_academic_info_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "per_persons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prof_academic_info" ADD CONSTRAINT "prof_academic_info_university_id_fkey" FOREIGN KEY ("university_id") REFERENCES "cat_universities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prof_academic_info" ADD CONSTRAINT "prof_academic_info_specialty_id_fkey" FOREIGN KEY ("specialty_id") REFERENCES "cat_specialties"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prof_employment_info" ADD CONSTRAINT "prof_employment_info_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "per_persons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prof_employment_info" ADD CONSTRAINT "prof_employment_info_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "cat_companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prof_experiences" ADD CONSTRAINT "prof_experiences_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "per_persons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prof_experiences" ADD CONSTRAINT "prof_experiences_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "cat_companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pay_payments" ADD CONSTRAINT "pay_payments_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "aff_applications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pay_billings" ADD CONSTRAINT "pay_billings_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "pay_payments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pay_billings" ADD CONSTRAINT "pay_billings_country_id_fkey" FOREIGN KEY ("country_id") REFERENCES "cat_countries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pay_invoices" ADD CONSTRAINT "pay_invoices_billing_id_fkey" FOREIGN KEY ("billing_id") REFERENCES "pay_billings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cat_departments" ADD CONSTRAINT "cat_departments_country_id_fkey" FOREIGN KEY ("country_id") REFERENCES "cat_countries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cat_provinces" ADD CONSTRAINT "cat_provinces_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "cat_departments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cat_districts" ADD CONSTRAINT "cat_districts_province_id_fkey" FOREIGN KEY ("province_id") REFERENCES "cat_provinces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sys_notifications" ADD CONSTRAINT "sys_notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sys_audit_logs" ADD CONSTRAINT "sys_audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
