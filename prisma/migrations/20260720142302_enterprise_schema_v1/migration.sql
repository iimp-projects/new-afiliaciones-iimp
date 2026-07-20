/*
  Warnings:

  - You are about to drop the `University` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `aff_application_documents` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `aff_application_history` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `aff_applications` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `aff_approvals` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `aff_observations` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `cat_companies` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `cat_countries` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `cat_departments` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `cat_districts` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `cat_provinces` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `cat_specialties` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `pay_billings` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `pay_invoices` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `pay_payments` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `per_addresses` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `per_contacts` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `per_persons` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `prof_academic_info` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `prof_employment_info` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `prof_experiences` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "University" DROP CONSTRAINT "University_country_id_fkey";

-- DropForeignKey
ALTER TABLE "aff_application_documents" DROP CONSTRAINT "aff_application_documents_application_id_fkey";

-- DropForeignKey
ALTER TABLE "aff_application_documents" DROP CONSTRAINT "aff_application_documents_approved_by_id_fkey";

-- DropForeignKey
ALTER TABLE "aff_application_history" DROP CONSTRAINT "aff_application_history_application_id_fkey";

-- DropForeignKey
ALTER TABLE "aff_applications" DROP CONSTRAINT "aff_applications_person_id_fkey";

-- DropForeignKey
ALTER TABLE "aff_approvals" DROP CONSTRAINT "aff_approvals_application_id_fkey";

-- DropForeignKey
ALTER TABLE "aff_approvals" DROP CONSTRAINT "aff_approvals_sponsor_person_id_fkey";

-- DropForeignKey
ALTER TABLE "aff_observations" DROP CONSTRAINT "aff_observations_application_id_fkey";

-- DropForeignKey
ALTER TABLE "auth_users" DROP CONSTRAINT "auth_users_person_id_fkey";

-- DropForeignKey
ALTER TABLE "auth_users" DROP CONSTRAINT "auth_users_role_id_fkey";

-- DropForeignKey
ALTER TABLE "cat_departments" DROP CONSTRAINT "cat_departments_country_id_fkey";

-- DropForeignKey
ALTER TABLE "cat_districts" DROP CONSTRAINT "cat_districts_province_id_fkey";

-- DropForeignKey
ALTER TABLE "cat_provinces" DROP CONSTRAINT "cat_provinces_department_id_fkey";

-- DropForeignKey
ALTER TABLE "pay_billings" DROP CONSTRAINT "pay_billings_country_id_fkey";

-- DropForeignKey
ALTER TABLE "pay_billings" DROP CONSTRAINT "pay_billings_payment_id_fkey";

-- DropForeignKey
ALTER TABLE "pay_invoices" DROP CONSTRAINT "pay_invoices_billing_id_fkey";

-- DropForeignKey
ALTER TABLE "pay_payments" DROP CONSTRAINT "pay_payments_application_id_fkey";

-- DropForeignKey
ALTER TABLE "per_addresses" DROP CONSTRAINT "per_addresses_district_id_fkey";

-- DropForeignKey
ALTER TABLE "per_addresses" DROP CONSTRAINT "per_addresses_person_id_fkey";

-- DropForeignKey
ALTER TABLE "per_contacts" DROP CONSTRAINT "per_contacts_person_id_fkey";

-- DropForeignKey
ALTER TABLE "prof_academic_info" DROP CONSTRAINT "prof_academic_info_person_id_fkey";

-- DropForeignKey
ALTER TABLE "prof_academic_info" DROP CONSTRAINT "prof_academic_info_specialty_id_fkey";

-- DropForeignKey
ALTER TABLE "prof_academic_info" DROP CONSTRAINT "prof_academic_info_university_id_fkey";

-- DropForeignKey
ALTER TABLE "prof_employment_info" DROP CONSTRAINT "prof_employment_info_company_id_fkey";

-- DropForeignKey
ALTER TABLE "prof_employment_info" DROP CONSTRAINT "prof_employment_info_person_id_fkey";

-- DropForeignKey
ALTER TABLE "prof_experiences" DROP CONSTRAINT "prof_experiences_company_id_fkey";

-- DropForeignKey
ALTER TABLE "prof_experiences" DROP CONSTRAINT "prof_experiences_person_id_fkey";

-- DropTable
DROP TABLE "University";

-- DropTable
DROP TABLE "aff_application_documents";

-- DropTable
DROP TABLE "aff_application_history";

-- DropTable
DROP TABLE "aff_applications";

-- DropTable
DROP TABLE "aff_approvals";

-- DropTable
DROP TABLE "aff_observations";

-- DropTable
DROP TABLE "cat_companies";

-- DropTable
DROP TABLE "cat_countries";

-- DropTable
DROP TABLE "cat_departments";

-- DropTable
DROP TABLE "cat_districts";

-- DropTable
DROP TABLE "cat_provinces";

-- DropTable
DROP TABLE "cat_specialties";

-- DropTable
DROP TABLE "pay_billings";

-- DropTable
DROP TABLE "pay_invoices";

-- DropTable
DROP TABLE "pay_payments";

-- DropTable
DROP TABLE "per_addresses";

-- DropTable
DROP TABLE "per_contacts";

-- DropTable
DROP TABLE "per_persons";

-- DropTable
DROP TABLE "prof_academic_info";

-- DropTable
DROP TABLE "prof_employment_info";

-- DropTable
DROP TABLE "prof_experiences";

-- CreateTable
CREATE TABLE "persons" (
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
    "nationality_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "persons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "person_contacts" (
    "id" SERIAL NOT NULL,
    "person_id" INTEGER NOT NULL,
    "phone_type" "PhoneType" NOT NULL DEFAULT 'MOBILE',
    "phone_number" VARCHAR(50) NOT NULL,
    "email" VARCHAR(150),
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "person_contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "person_addresses" (
    "id" SERIAL NOT NULL,
    "person_id" INTEGER NOT NULL,
    "district_id" INTEGER NOT NULL,
    "address_type_id" INTEGER NOT NULL,
    "street" VARCHAR(255) NOT NULL,
    "reference" VARCHAR(255),
    "zip_code" VARCHAR(20),
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "person_addresses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "membership_applications" (
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

    CONSTRAINT "membership_applications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "membership_documents" (
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

    CONSTRAINT "membership_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "membership_history" (
    "id" SERIAL NOT NULL,
    "application_id" INTEGER NOT NULL,
    "previous_status" "ApplicationStatus" NOT NULL,
    "new_status" "ApplicationStatus" NOT NULL,
    "changed_by_id" INTEGER,
    "change_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "membership_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "membership_approvals" (
    "id" SERIAL NOT NULL,
    "application_id" INTEGER NOT NULL,
    "sponsor_person_id" INTEGER NOT NULL,
    "sponsor_code" VARCHAR(50),
    "status" "EndorsementStatus" NOT NULL DEFAULT 'PENDING',
    "transaction_date" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "membership_approvals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "membership_observations" (
    "id" SERIAL NOT NULL,
    "application_id" INTEGER NOT NULL,
    "review_department" VARCHAR(100) NOT NULL,
    "error_description" TEXT NOT NULL,
    "status" "ObservationStatus" NOT NULL DEFAULT 'PENDING',
    "resolved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "membership_observations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "professional_academics" (
    "id" SERIAL NOT NULL,
    "person_id" INTEGER NOT NULL,
    "study_level" "StudyLevel" NOT NULL,
    "degree_id" INTEGER,
    "university_id" INTEGER,
    "specialty_id" INTEGER,
    "degree_title" VARCHAR(200),
    "professional_association" VARCHAR(200),
    "license_number" VARCHAR(50),
    "graduation_year" INTEGER,
    "term_or_semester" VARCHAR(50),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "professional_academics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "professional_employment" (
    "id" SERIAL NOT NULL,
    "person_id" INTEGER NOT NULL,
    "company_id" INTEGER,
    "position_id" INTEGER,
    "area" VARCHAR(150),
    "working_address" VARCHAR(250),
    "work_phone" VARCHAR(50),
    "work_extension" VARCHAR(20),
    "work_email" VARCHAR(150),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "professional_employment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "professional_experiences" (
    "id" SERIAL NOT NULL,
    "person_id" INTEGER NOT NULL,
    "company_id" INTEGER,
    "position_id" INTEGER NOT NULL,
    "description" TEXT,
    "start_date" DATE NOT NULL,
    "end_date" DATE,
    "is_current" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "professional_experiences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
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

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "billings" (
    "id" SERIAL NOT NULL,
    "payment_id" INTEGER NOT NULL,
    "tax_id" VARCHAR(20) NOT NULL,
    "business_name" VARCHAR(250) NOT NULL,
    "billing_address" VARCHAR(250),
    "country_id" INTEGER,
    "billing_email" VARCHAR(150),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "billings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoices" (
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

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "catalog_countries" (
    "id" SERIAL NOT NULL,
    "code" VARCHAR(50),
    "iso_code" VARCHAR(3) NOT NULL,
    "phone_code" VARCHAR(10) NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "catalog_countries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "catalog_departments" (
    "id" SERIAL NOT NULL,
    "code" VARCHAR(50),
    "country_id" INTEGER NOT NULL,
    "ubigeo_code" VARCHAR(10) NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "catalog_departments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "catalog_provinces" (
    "id" SERIAL NOT NULL,
    "code" VARCHAR(50),
    "department_id" INTEGER NOT NULL,
    "ubigeo_code" VARCHAR(10) NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "catalog_provinces_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "catalog_districts" (
    "id" SERIAL NOT NULL,
    "code" VARCHAR(50),
    "province_id" INTEGER NOT NULL,
    "ubigeo_code" VARCHAR(10) NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "catalog_districts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "catalog_universities" (
    "id" SERIAL NOT NULL,
    "code" VARCHAR(50),
    "name" VARCHAR(250) NOT NULL,
    "country_id" INTEGER NOT NULL,
    "acronym" VARCHAR(20),
    "website" VARCHAR(255),
    "is_licensed" BOOLEAN NOT NULL DEFAULT true,
    "is_public" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "catalog_universities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "catalog_companies" (
    "id" SERIAL NOT NULL,
    "code" VARCHAR(50),
    "tax_id" VARCHAR(20),
    "name" VARCHAR(250) NOT NULL,
    "industry" VARCHAR(150),
    "country_id" INTEGER,
    "sector_id" INTEGER,
    "website" VARCHAR(255),
    "email" VARCHAR(150),
    "phone" VARCHAR(50),
    "address" VARCHAR(255),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "catalog_companies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "catalog_specialties" (
    "id" SERIAL NOT NULL,
    "code" VARCHAR(50),
    "name" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "specialty_category_id" INTEGER,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "catalog_specialties_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "catalog_academic_degrees" (
    "id" SERIAL NOT NULL,
    "code" VARCHAR(50),
    "name" VARCHAR(150) NOT NULL,
    "abbreviation" VARCHAR(50),
    "study_level" "StudyLevel" NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "catalog_academic_degrees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "catalog_specialty_categories" (
    "id" SERIAL NOT NULL,
    "code" VARCHAR(50),
    "name" VARCHAR(150) NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "catalog_specialty_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "catalog_company_sectors" (
    "id" SERIAL NOT NULL,
    "code" VARCHAR(50),
    "name" VARCHAR(150) NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "catalog_company_sectors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "catalog_job_positions" (
    "id" SERIAL NOT NULL,
    "code" VARCHAR(50),
    "name" VARCHAR(150) NOT NULL,
    "description" TEXT,
    "hierarchy_level" INTEGER,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "catalog_job_positions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "catalog_address_types" (
    "id" SERIAL NOT NULL,
    "code" VARCHAR(50),
    "name" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "catalog_address_types_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "persons_document_number_idx" ON "persons"("document_number");

-- CreateIndex
CREATE INDEX "persons_nationality_id_idx" ON "persons"("nationality_id");

-- CreateIndex
CREATE INDEX "persons_paternal_last_name_maternal_last_name_first_name_idx" ON "persons"("paternal_last_name", "maternal_last_name", "first_name");

-- CreateIndex
CREATE UNIQUE INDEX "persons_document_type_document_number_key" ON "persons"("document_type", "document_number");

-- CreateIndex
CREATE INDEX "person_contacts_person_id_idx" ON "person_contacts"("person_id");

-- CreateIndex
CREATE INDEX "person_contacts_email_idx" ON "person_contacts"("email");

-- CreateIndex
CREATE INDEX "person_addresses_person_id_idx" ON "person_addresses"("person_id");

-- CreateIndex
CREATE INDEX "person_addresses_district_id_idx" ON "person_addresses"("district_id");

-- CreateIndex
CREATE INDEX "person_addresses_address_type_id_idx" ON "person_addresses"("address_type_id");

-- CreateIndex
CREATE UNIQUE INDEX "membership_applications_application_code_key" ON "membership_applications"("application_code");

-- CreateIndex
CREATE UNIQUE INDEX "membership_applications_tracking_code_key" ON "membership_applications"("tracking_code");

-- CreateIndex
CREATE INDEX "membership_applications_person_id_idx" ON "membership_applications"("person_id");

-- CreateIndex
CREATE INDEX "membership_applications_status_idx" ON "membership_applications"("status");

-- CreateIndex
CREATE INDEX "membership_applications_application_code_idx" ON "membership_applications"("application_code");

-- CreateIndex
CREATE INDEX "membership_applications_tracking_code_idx" ON "membership_applications"("tracking_code");

-- CreateIndex
CREATE INDEX "membership_applications_person_id_status_idx" ON "membership_applications"("person_id", "status");

-- CreateIndex
CREATE INDEX "membership_documents_application_id_idx" ON "membership_documents"("application_id");

-- CreateIndex
CREATE INDEX "membership_documents_approved_by_id_idx" ON "membership_documents"("approved_by_id");

-- CreateIndex
CREATE INDEX "membership_documents_ai_validation_status_idx" ON "membership_documents"("ai_validation_status");

-- CreateIndex
CREATE INDEX "membership_history_application_id_idx" ON "membership_history"("application_id");

-- CreateIndex
CREATE INDEX "membership_approvals_application_id_idx" ON "membership_approvals"("application_id");

-- CreateIndex
CREATE INDEX "membership_approvals_sponsor_person_id_idx" ON "membership_approvals"("sponsor_person_id");

-- CreateIndex
CREATE INDEX "membership_observations_application_id_idx" ON "membership_observations"("application_id");

-- CreateIndex
CREATE INDEX "membership_observations_status_idx" ON "membership_observations"("status");

-- CreateIndex
CREATE INDEX "professional_academics_person_id_idx" ON "professional_academics"("person_id");

-- CreateIndex
CREATE INDEX "professional_academics_degree_id_idx" ON "professional_academics"("degree_id");

-- CreateIndex
CREATE INDEX "professional_academics_university_id_idx" ON "professional_academics"("university_id");

-- CreateIndex
CREATE INDEX "professional_academics_specialty_id_idx" ON "professional_academics"("specialty_id");

-- CreateIndex
CREATE INDEX "professional_employment_person_id_idx" ON "professional_employment"("person_id");

-- CreateIndex
CREATE INDEX "professional_employment_company_id_idx" ON "professional_employment"("company_id");

-- CreateIndex
CREATE INDEX "professional_employment_position_id_idx" ON "professional_employment"("position_id");

-- CreateIndex
CREATE INDEX "professional_experiences_person_id_idx" ON "professional_experiences"("person_id");

-- CreateIndex
CREATE INDEX "professional_experiences_company_id_idx" ON "professional_experiences"("company_id");

-- CreateIndex
CREATE INDEX "professional_experiences_position_id_idx" ON "professional_experiences"("position_id");

-- CreateIndex
CREATE INDEX "payments_application_id_idx" ON "payments"("application_id");

-- CreateIndex
CREATE INDEX "payments_status_idx" ON "payments"("status");

-- CreateIndex
CREATE INDEX "payments_transaction_id_idx" ON "payments"("transaction_id");

-- CreateIndex
CREATE UNIQUE INDEX "billings_payment_id_key" ON "billings"("payment_id");

-- CreateIndex
CREATE INDEX "billings_payment_id_idx" ON "billings"("payment_id");

-- CreateIndex
CREATE INDEX "billings_tax_id_idx" ON "billings"("tax_id");

-- CreateIndex
CREATE INDEX "billings_country_id_idx" ON "billings"("country_id");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_billing_id_key" ON "invoices"("billing_id");

-- CreateIndex
CREATE INDEX "invoices_billing_id_idx" ON "invoices"("billing_id");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_serie_number_key" ON "invoices"("serie", "number");

-- CreateIndex
CREATE UNIQUE INDEX "catalog_countries_code_key" ON "catalog_countries"("code");

-- CreateIndex
CREATE UNIQUE INDEX "catalog_countries_iso_code_key" ON "catalog_countries"("iso_code");

-- CreateIndex
CREATE UNIQUE INDEX "catalog_departments_code_key" ON "catalog_departments"("code");

-- CreateIndex
CREATE UNIQUE INDEX "catalog_departments_ubigeo_code_key" ON "catalog_departments"("ubigeo_code");

-- CreateIndex
CREATE INDEX "catalog_departments_country_id_idx" ON "catalog_departments"("country_id");

-- CreateIndex
CREATE UNIQUE INDEX "catalog_provinces_code_key" ON "catalog_provinces"("code");

-- CreateIndex
CREATE UNIQUE INDEX "catalog_provinces_ubigeo_code_key" ON "catalog_provinces"("ubigeo_code");

-- CreateIndex
CREATE INDEX "catalog_provinces_department_id_idx" ON "catalog_provinces"("department_id");

-- CreateIndex
CREATE UNIQUE INDEX "catalog_districts_code_key" ON "catalog_districts"("code");

-- CreateIndex
CREATE UNIQUE INDEX "catalog_districts_ubigeo_code_key" ON "catalog_districts"("ubigeo_code");

-- CreateIndex
CREATE INDEX "catalog_districts_province_id_idx" ON "catalog_districts"("province_id");

-- CreateIndex
CREATE UNIQUE INDEX "catalog_universities_code_key" ON "catalog_universities"("code");

-- CreateIndex
CREATE UNIQUE INDEX "catalog_universities_acronym_key" ON "catalog_universities"("acronym");

-- CreateIndex
CREATE INDEX "catalog_universities_country_id_idx" ON "catalog_universities"("country_id");

-- CreateIndex
CREATE UNIQUE INDEX "catalog_universities_country_id_name_key" ON "catalog_universities"("country_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "catalog_companies_code_key" ON "catalog_companies"("code");

-- CreateIndex
CREATE UNIQUE INDEX "catalog_companies_tax_id_key" ON "catalog_companies"("tax_id");

-- CreateIndex
CREATE INDEX "catalog_companies_tax_id_idx" ON "catalog_companies"("tax_id");

-- CreateIndex
CREATE INDEX "catalog_companies_name_idx" ON "catalog_companies"("name");

-- CreateIndex
CREATE INDEX "catalog_companies_country_id_idx" ON "catalog_companies"("country_id");

-- CreateIndex
CREATE INDEX "catalog_companies_sector_id_idx" ON "catalog_companies"("sector_id");

-- CreateIndex
CREATE UNIQUE INDEX "catalog_specialties_code_key" ON "catalog_specialties"("code");

-- CreateIndex
CREATE INDEX "catalog_specialties_specialty_category_id_idx" ON "catalog_specialties"("specialty_category_id");

-- CreateIndex
CREATE UNIQUE INDEX "catalog_academic_degrees_code_key" ON "catalog_academic_degrees"("code");

-- CreateIndex
CREATE UNIQUE INDEX "catalog_specialty_categories_code_key" ON "catalog_specialty_categories"("code");

-- CreateIndex
CREATE UNIQUE INDEX "catalog_company_sectors_code_key" ON "catalog_company_sectors"("code");

-- CreateIndex
CREATE UNIQUE INDEX "catalog_job_positions_code_key" ON "catalog_job_positions"("code");

-- CreateIndex
CREATE UNIQUE INDEX "catalog_address_types_code_key" ON "catalog_address_types"("code");

-- CreateIndex
CREATE INDEX "auth_role_permissions_role_id_idx" ON "auth_role_permissions"("role_id");

-- CreateIndex
CREATE INDEX "auth_role_permissions_permission_id_idx" ON "auth_role_permissions"("permission_id");

-- CreateIndex
CREATE INDEX "auth_users_role_id_idx" ON "auth_users"("role_id");

-- AddForeignKey
ALTER TABLE "auth_users" ADD CONSTRAINT "auth_users_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "auth_roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auth_users" ADD CONSTRAINT "auth_users_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "persons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "persons" ADD CONSTRAINT "persons_nationality_id_fkey" FOREIGN KEY ("nationality_id") REFERENCES "catalog_countries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "person_contacts" ADD CONSTRAINT "person_contacts_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "persons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "person_addresses" ADD CONSTRAINT "person_addresses_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "persons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "person_addresses" ADD CONSTRAINT "person_addresses_district_id_fkey" FOREIGN KEY ("district_id") REFERENCES "catalog_districts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "person_addresses" ADD CONSTRAINT "person_addresses_address_type_id_fkey" FOREIGN KEY ("address_type_id") REFERENCES "catalog_address_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "membership_applications" ADD CONSTRAINT "membership_applications_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "persons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "membership_documents" ADD CONSTRAINT "membership_documents_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "membership_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "membership_documents" ADD CONSTRAINT "membership_documents_approved_by_id_fkey" FOREIGN KEY ("approved_by_id") REFERENCES "auth_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "membership_history" ADD CONSTRAINT "membership_history_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "membership_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "membership_approvals" ADD CONSTRAINT "membership_approvals_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "membership_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "membership_approvals" ADD CONSTRAINT "membership_approvals_sponsor_person_id_fkey" FOREIGN KEY ("sponsor_person_id") REFERENCES "persons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "membership_observations" ADD CONSTRAINT "membership_observations_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "membership_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "professional_academics" ADD CONSTRAINT "professional_academics_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "persons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "professional_academics" ADD CONSTRAINT "professional_academics_degree_id_fkey" FOREIGN KEY ("degree_id") REFERENCES "catalog_academic_degrees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "professional_academics" ADD CONSTRAINT "professional_academics_university_id_fkey" FOREIGN KEY ("university_id") REFERENCES "catalog_universities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "professional_academics" ADD CONSTRAINT "professional_academics_specialty_id_fkey" FOREIGN KEY ("specialty_id") REFERENCES "catalog_specialties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "professional_employment" ADD CONSTRAINT "professional_employment_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "persons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "professional_employment" ADD CONSTRAINT "professional_employment_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "catalog_companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "professional_employment" ADD CONSTRAINT "professional_employment_position_id_fkey" FOREIGN KEY ("position_id") REFERENCES "catalog_job_positions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "professional_experiences" ADD CONSTRAINT "professional_experiences_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "persons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "professional_experiences" ADD CONSTRAINT "professional_experiences_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "catalog_companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "professional_experiences" ADD CONSTRAINT "professional_experiences_position_id_fkey" FOREIGN KEY ("position_id") REFERENCES "catalog_job_positions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "membership_applications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billings" ADD CONSTRAINT "billings_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billings" ADD CONSTRAINT "billings_country_id_fkey" FOREIGN KEY ("country_id") REFERENCES "catalog_countries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_billing_id_fkey" FOREIGN KEY ("billing_id") REFERENCES "billings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalog_departments" ADD CONSTRAINT "catalog_departments_country_id_fkey" FOREIGN KEY ("country_id") REFERENCES "catalog_countries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalog_provinces" ADD CONSTRAINT "catalog_provinces_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "catalog_departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalog_districts" ADD CONSTRAINT "catalog_districts_province_id_fkey" FOREIGN KEY ("province_id") REFERENCES "catalog_provinces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalog_universities" ADD CONSTRAINT "catalog_universities_country_id_fkey" FOREIGN KEY ("country_id") REFERENCES "catalog_countries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalog_companies" ADD CONSTRAINT "catalog_companies_country_id_fkey" FOREIGN KEY ("country_id") REFERENCES "catalog_countries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalog_companies" ADD CONSTRAINT "catalog_companies_sector_id_fkey" FOREIGN KEY ("sector_id") REFERENCES "catalog_company_sectors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalog_specialties" ADD CONSTRAINT "catalog_specialties_specialty_category_id_fkey" FOREIGN KEY ("specialty_category_id") REFERENCES "catalog_specialty_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
