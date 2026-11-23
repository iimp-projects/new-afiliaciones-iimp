import { z } from "zod";
import { PERU_COUNTRY_ID } from "../Rules/ProfileCompletenessRules";

export const profileAddressSchema = z
  .object({
    street: z.string().trim().min(3).max(255),
    reference: z.string().trim().max(255).nullable(),
    countryId: z.number().int().positive(),
    districtId: z.number().int().positive().nullable(),
    postalCode: z.string().trim().max(20).nullable(),
    foreignRegion: z.string().trim().max(120).nullable(),
    foreignCity: z.string().trim().max(120).nullable(),
  })
  .superRefine((value, ctx) => {
    if (value.countryId === PERU_COUNTRY_ID) {
      if (!value.districtId) {
        ctx.addIssue({ code: "custom", path: ["districtId"], message: "Seleccione un distrito." });
      }
      return;
    }
    if (!value.foreignRegion) {
      ctx.addIssue({ code: "custom", path: ["foreignRegion"], message: "Ingrese la región o estado." });
    }
    if (!value.foreignCity) {
      ctx.addIssue({ code: "custom", path: ["foreignCity"], message: "Ingrese la ciudad." });
    }
  });

export type ProfileAddressInput = z.infer<typeof profileAddressSchema>;
