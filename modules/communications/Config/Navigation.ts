import type { ModuleDefinition } from "@/modules/navigation/Models/ModuleDefinition";

export const communicationsModuleDefinition: ModuleDefinition = {
  name: "communications",
  description: "Módulo de correos masivos y comunicación institucional",
  navigation: [
    {
      id: "group-comunicaciones",
      title: "Comunicaciones",
      type: "group",
      collapsible: true,
      icon: "Mail",
      audience: "administrative",
      order: 22,
      children: [
        {
          id: "nav-notifications",
          title: "Notificaciones",
          href: "/intranet/notificaciones",
          icon: "Bell",
          order: 1,
        },
        {
          id: "nav-correos-masivos",
          title: "Correos Masivos",
          href: "/intranet/correos-masivos",
          icon: "Mail",
          order: 2,
          permission: { action: "manage", subject: "all" },
        },
      ],
    },
  ],
};
