import type { Prisma } from "@prisma/client";

export const addressTypesData: Prisma.AddressTypeCreateManyInput[] = [
  {
    code: "HOME",
    name: "Domicilio",
    isActive: true,
  },
];
