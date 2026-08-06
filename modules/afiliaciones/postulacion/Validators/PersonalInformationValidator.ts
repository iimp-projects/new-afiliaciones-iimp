import { PersonalInformation } from "../Models/PersonalInformation";
import { BaseValidator } from "./BaseValidator";
import { ValidationResult } from "./ValidationResult";
import { ValidationRules } from "./ValidationRules";

export class PersonalInformationValidator extends BaseValidator {
  public validate(data: PersonalInformation): ValidationResult {
    this.reset();
    this.validateDocument(data);
    this.validateNames(data);
    this.validateBirthInformation(data);
    this.validateContact(data);
    this.validateLocation(data);
    this.validateDocuments(data);
    return this.getResult();
  }

  private validateDocument(data: PersonalInformation): void {
    if (!ValidationRules.required(data.documentType, "documentType", this, "REQ", "Seleccione un tipo de documento.")) return;
    if (!ValidationRules.required(data.documentNumber, "documentNumber", this, "REQ", "Ingrese su número de documento.")) return;

    if (data.documentType === "DNI") {
      ValidationRules.exactLength(data.documentNumber, 8, "documentNumber", this, "LEN", "El DNI debe tener exactamente 8 caracteres.");
      ValidationRules.numeric(data.documentNumber, "documentNumber", this, "NUM", "El DNI solo debe contener números.");
    } else if (data.documentType === "CE") {
      ValidationRules.lengthBetween(data.documentNumber, 9, 12, "documentNumber", this, "LEN", "El CE debe tener entre 9 y 12 caracteres.");
      ValidationRules.alphaNumeric(data.documentNumber, "documentNumber", this, "ALPHANUM", "El CE solo permite letras y números.");
    } else if (data.documentType === "PASSPORT") {
      ValidationRules.lengthBetween(data.documentNumber, 6, 12, "documentNumber", this, "LEN", "El pasaporte debe tener entre 6 y 12 caracteres.");
      ValidationRules.alphaNumeric(data.documentNumber, "documentNumber", this, "ALPHANUM", "El pasaporte solo permite letras y números.");
    }
  }

  private validateNames(data: PersonalInformation): void {
    const nameFields = [
      { key: "names" as const, label: "nombres" },
      { key: "fatherLastName" as const, label: "apellido paterno" },
      { key: "motherLastName" as const, label: "apellido materno" },
    ];

    nameFields.forEach(({ key, label }) => {
      if (ValidationRules.required(data[key], key, this, "REQ", `El ${label} es obligatorio.`)) {
        ValidationRules.minLength(data[key], 2, key, this, "MIN", `Debe tener al menos 2 caracteres.`);
        ValidationRules.maxLength(data[key], 100, key, this, "MAX", `Máximo 100 caracteres permitidos.`);
        ValidationRules.onlyLetters(data[key], key, this, "LETTERS", `Solo se permiten letras, tildes y espacios.`);
      }
    });
  }

  private validateBirthInformation(data: PersonalInformation): void {
    if (ValidationRules.required(data.birthDate, "birthDate", this, "REQ", "La fecha de nacimiento es obligatoria.")) {
      ValidationRules.notFutureDate(data.birthDate, "birthDate", this, "FUTURE", "La fecha no puede ser futura.");
      ValidationRules.validateAgeRange(data.birthDate, 18, 100, "birthDate", this, "AGE", "Debe tener entre 18 y 100 años.");
    }
    
    if (ValidationRules.required(data.gender, "gender", this, "REQ", "Seleccione su género.")) {
      if (!["MALE", "FEMALE"].includes(data.gender)) {
        this.addError("gender", "INVALID", "Género seleccionado inválido.");
      }
    }
  }

  private validateContact(data: PersonalInformation): void {
    if (ValidationRules.required(data.phone, "phone", this, "REQ", "El celular es obligatorio.")) {
      ValidationRules.exactLength(data.phone, 9, "phone", this, "LEN", "El celular debe tener exactamente 9 dígitos.");
      ValidationRules.numeric(data.phone, "phone", this, "NUM", "El celular solo permite números.");
    }

    if (ValidationRules.required(data.primaryEmail, "primaryEmail", this, "REQ", "El correo principal es obligatorio.")) {
      ValidationRules.email(data.primaryEmail, "primaryEmail", this, "EMAIL", "Ingrese un correo electrónico válido.");
      ValidationRules.maxLength(data.primaryEmail, 254, "primaryEmail", this, "MAX", "El correo es demasiado largo.");
    }

    if (data.secondaryEmail && data.secondaryEmail.trim() !== "") {
      ValidationRules.email(data.secondaryEmail, "secondaryEmail", this, "EMAIL", "Ingrese un correo secundario válido.");
      ValidationRules.maxLength(data.secondaryEmail, 254, "secondaryEmail", this, "MAX", "El correo secundario es demasiado largo.");
    }
  }

  private validateLocation(data: PersonalInformation): void {
    const countryId = Number(data.countryId);

    if (!countryId) {
      this.addError("countryId", "REQ", "Seleccione un país.");
      return;
    }

    // Validación para Perú
    if (countryId === 1) {
      if (!data.departmentId) this.addError("departmentId", "REQ", "Seleccione un departamento.");
      if (!data.provinceId) this.addError("provinceId", "REQ", "Seleccione una provincia.");
      
      // Solo exigir distrito si districtId es undefined o <= 0.
      // Si viene explícitamente como null, el validador LO APRUEBA.
      if (data.districtId === undefined) {
        this.addError("districtId", "REQ", "Seleccione un distrito.");
      }
    }
  }

  private validateDocuments(data: PersonalInformation): void {
    if (ValidationRules.requiredFile(data.photo, "photo", this, "REQ", "La fotografía es obligatoria.")) {
      ValidationRules.allowedExtensions(data.photo, ["jpg", "jpeg", "png"], "photo", this, "EXT", "Solo JPG, JPEG o PNG.");
      ValidationRules.maxFileSize(data.photo, 5 * 1024 * 1024, "photo", this, "SIZE", "Máximo 5 MB.");
    }

    if (ValidationRules.requiredFile(data.identityDocument, "identityDocument", this, "REQ", "El documento es obligatorio.")) {
      ValidationRules.allowedExtensions(data.identityDocument, ["pdf", "jpg", "jpeg", "png"], "identityDocument", this, "EXT", "Solo PDF, JPG o PNG.");
      ValidationRules.maxFileSize(data.identityDocument, 10 * 1024 * 1024, "identityDocument", this, "SIZE", "Máximo 10 MB.");
    }
  }
}