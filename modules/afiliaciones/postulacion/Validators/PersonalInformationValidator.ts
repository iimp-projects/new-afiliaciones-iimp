import { PersonalInformation } from "../Models/PersonalInformation";
import { BaseValidator } from "./BaseValidator";
import { ValidationResult } from "./ValidationResult";
import { ValidationRules } from "./ValidationRules";

export class PersonalInformationValidator extends BaseValidator {
  public validate(data: PersonalInformation): ValidationResult {
    this.reset();

    this.validateIdentity(data);
    this.validateDocument(data);
    this.validateNames(data);
    this.validateBirthInformation(data);
    this.validateContact(data);
    this.validateLocation(data);
    this.validateDocuments(data);

    return this.getResult();
  }

  /**
   * Verifica que la identidad haya sido validada.
   */
  private validateIdentity(data: PersonalInformation): void {
    if (!data.identityVerified) {
      this.addError(
        "documentNumber",
        "IDENTITY_NOT_VERIFIED",
        "Debe verificar primero la identidad del postulante.",
      );
    }
  }

  /**
   * Documento
   */
  private validateDocument(data: PersonalInformation): void {
    if (
      !ValidationRules.required(
        data.documentType,
        "documentType",
        this,
        "DOCUMENT_TYPE_REQUIRED",
        "El tipo de documento es obligatorio.",
      )
    ) {
      return;
    }

    ValidationRules.required(
      data.documentNumber,
      "documentNumber",
      this,
      "DOCUMENT_NUMBER_REQUIRED",
      "El número de documento es obligatorio.",
    );
  }

  /**
   * Nombres
   */
  private validateNames(data: PersonalInformation): void {
    if (
      ValidationRules.required(
        data.names,
        "names",
        this,
        "NAMES_REQUIRED",
        "Los nombres son obligatorios.",
      )
    ) {
      ValidationRules.onlyLetters(
        data.names,
        "names",
        this,
        "NAMES_INVALID",
        "Los nombres solo pueden contener letras.",
      );
    }

    if (
      ValidationRules.required(
        data.fatherLastName,
        "fatherLastName",
        this,
        "FATHER_LASTNAME_REQUIRED",
        "El apellido paterno es obligatorio.",
      )
    ) {
      ValidationRules.onlyLetters(
        data.fatherLastName,
        "fatherLastName",
        this,
        "FATHER_LASTNAME_INVALID",
        "El apellido paterno solo puede contener letras.",
      );
    }

    if (
      ValidationRules.required(
        data.motherLastName,
        "motherLastName",
        this,
        "MOTHER_LASTNAME_REQUIRED",
        "El apellido materno es obligatorio.",
      )
    ) {
      ValidationRules.onlyLetters(
        data.motherLastName,
        "motherLastName",
        this,
        "MOTHER_LASTNAME_INVALID",
        "El apellido materno solo puede contener letras.",
      );
    }
  }

  /**
   * Fecha de nacimiento y género
   */
  private validateBirthInformation(data: PersonalInformation): void {
    ValidationRules.required(
      data.birthDate,
      "birthDate",
      this,
      "BIRTHDATE_REQUIRED",
      "La fecha de nacimiento es obligatoria.",
    );

    ValidationRules.required(
      data.gender,
      "gender",
      this,
      "GENDER_REQUIRED",
      "El género es obligatorio.",
    );
  }

  /**
   * Contacto
   */
  private validateContact(data: PersonalInformation): void {
    if (
      ValidationRules.required(
        data.phone,
        "phone",
        this,
        "PHONE_REQUIRED",
        "El teléfono es obligatorio.",
      )
    ) {
      ValidationRules.phone(
        data.phone,
        "phone",
        this,
        "PHONE_INVALID",
        "El teléfono no es válido.",
      );
    }

    if (
      ValidationRules.required(
        data.primaryEmail,
        "primaryEmail",
        this,
        "PRIMARY_EMAIL_REQUIRED",
        "El correo electrónico es obligatorio.",
      )
    ) {
      ValidationRules.email(
        data.primaryEmail,
        "primaryEmail",
        this,
        "PRIMARY_EMAIL_INVALID",
        "El correo electrónico no es válido.",
      );
    }

    if (data.secondaryEmail) {
      ValidationRules.email(
        data.secondaryEmail,
        "secondaryEmail",
        this,
        "SECONDARY_EMAIL_INVALID",
        "El correo electrónico secundario no es válido.",
      );
    }
  }

  /**
   * Ubicación
   */
  private validateLocation(data: PersonalInformation): void {
    ValidationRules.required(
      data.countryId,
      "countryId",
      this,
      "COUNTRY_REQUIRED",
      "El país es obligatorio.",
    );

    ValidationRules.requiredIf(
      data.countryId === 1,
      data.departmentId,
      "departmentId",
      this,
      "DEPARTMENT_REQUIRED",
      "El departamento es obligatorio.",
    );

    ValidationRules.requiredIf(
      data.countryId === 1,
      data.provinceId,
      "provinceId",
      this,
      "PROVINCE_REQUIRED",
      "La provincia es obligatoria.",
    );

    ValidationRules.requiredIf(
      data.countryId === 1,
      data.districtId,
      "districtId",
      this,
      "DISTRICT_REQUIRED",
      "El distrito es obligatorio.",
    );

    ValidationRules.required(
      data.address,
      "address",
      this,
      "ADDRESS_REQUIRED",
      "La dirección es obligatoria.",
    );
  }

  /**
   * Documentos
   */
  private validateDocuments(data: PersonalInformation): void {
    ValidationRules.allowedExtensions(
      data.photo,
      ["jpg", "jpeg", "png"],
      "photo",
      this,
      "PHOTO_EXTENSION_INVALID",
      "La fotografía debe estar en formato JPG o PNG.",
    );

    ValidationRules.maxFileSize(
      data.photo,
      5 * 1024 * 1024,
      "photo",
      this,
      "PHOTO_MAX_SIZE",
      "La fotografía no debe superar los 5 MB.",
    );

    ValidationRules.allowedExtensions(
      data.identityDocument,
      ["pdf", "jpg", "jpeg", "png"],
      "identityDocument",
      this,
      "IDENTITY_DOCUMENT_EXTENSION_INVALID",
      "El documento debe ser PDF, JPG o PNG.",
    );

    ValidationRules.maxFileSize(
      data.identityDocument,
      10 * 1024 * 1024,
      "identityDocument",
      this,
      "IDENTITY_DOCUMENT_MAX_SIZE",
      "El documento no debe superar los 10 MB.",
    );
  }
}
