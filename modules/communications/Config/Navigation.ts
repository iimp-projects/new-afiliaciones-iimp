import type { ModuleDefinition } from "@/modules/navigation/Models/ModuleDefinition";

export const communicationsModuleDefinition: ModuleDefinition = {
  name: "communications",
  description: "Módulo de correos masivos y comunicación institucional",
  navigation: [
    {
      id: "group-communications",
      title: "COMUNICACIONES",
      type: "group",
      audience: "administrative",
      order: 22,
      children: [
        {
          id: "nav-correos-masivos",
          title: "Correos Masivos",
          href: "/intranet/correos-masivos",
          icon: "Mail",
          order: 1,
          permission: { action: "manage", subject: "all" },
        },
      ],
    },
  ],
};
