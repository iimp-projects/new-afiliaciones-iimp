import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const dni = searchParams.get("dni");
    const applicationId = searchParams.get("applicationId"); // Opcional, para bloquear avales anteriores

    if (!dni || dni.trim().length !== 8) {
      return NextResponse.json(
        { error: "Debe ingresar un DNI válido de 8 dígitos." },
        { status: 400 }
      );
    }

    const cleanDni = dni.trim();

    // 1. Buscar a la persona e incluir usuario y contactos
    const person = await prisma.person.findFirst({
      where: {
        documentNumber: cleanDni,
      },
      include: {
        user: true,      // Para verificar su estado y tipo de usuario
        contacts: true,  // Para extraer el email
        endorsementsGiven: {
          where: applicationId ? { applicationId: Number(applicationId) } : undefined,
        },
      },
    });

    // 2. Si no existe la persona
    if (!person) {
      return NextResponse.json(
        { error: "El DNI ingresado no está registrado en el sistema." },
        { status: 404 }
      );
    }

    // 3. Validar que sea un Asociado Activo
    // Se verifica si su usuario existe y está en estado ACTIVE o es tipo AFFILIATE/SYSTEM_ADMIN
    const isAffiliate =
      person.user &&
      person.user.status === "ACTIVE" &&
      (person.user.type === "AFFILIATE" || person.user.type === "SYSTEM_ADMIN" || person.user.type === "VALIDATOR");

    if (!isAffiliate) {
      return NextResponse.json(
        { error: "El DNI ingresado no corresponde a un Asociado Activo hábil." },
        { status: 400 }
      );
    }

    // 4. Validar si este DNI ya fue utilizado como aval en esta misma solicitud (Aprobado, Rechazado o Pendiente)
    if (person.endorsementsGiven && person.endorsementsGiven.length > 0) {
      return NextResponse.json(
        { error: "Este asociado ya fue registrado previamente como aval en esta solicitud." },
        { status: 400 }
      );
    }

    // 5. Nombre completo
    const fullName = [person.firstName, person.paternalLastName, person.maternalLastName]
      .filter(Boolean)
      .join(" ");

    // 6. Obtener el correo (priorizar email de User o primer email de contactos)
    const email =
      person.user?.email ||
      person.contacts.find((c) => c.email)?.email ||
      "Sin correo registrado";

    const existingEndorsement = person.endorsementsGiven?.[0];
    const sponsorCode = existingEndorsement?.sponsorCode || (person.user ? `A-${person.user.id}` : "---");

    return NextResponse.json({
    personId: person.id,
    dni: person.documentNumber,
    fullName: fullName,
    iimpCode: String(sponsorCode),
    sponsorCode: String(sponsorCode),
    email: email,
    isActive: true,
    });
  } catch (error: any) {
    console.error("Error al consultar asociado:", error);
    return NextResponse.json(
      { error: "Error en el servidor al consultar el DNI." },
      { status: 500 }
    );
  }
}