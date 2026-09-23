import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verificationTokenRateLimiter } from "@/modules/auth/rate-limit/VerificationTokenRateLimiter";
import { ApiAuthorizationError, requireApiPermission } from "@/modules/auth/context/api-authorization";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const dni = searchParams.get("dni");
    const applicationId = searchParams.get("applicationId"); // Opcional, para bloquear avales anteriores
    try {
      await requireApiPermission("read", "memberships");
    } catch (error) {
      if (error instanceof ApiAuthorizationError) {
        return NextResponse.json(
          { error: error.status === 401 ? "No autenticado." : "No autorizado." },
          { status: error.status },
        );
      }
      throw error;
    }

    if (!dni || dni.trim().length !== 8) {
      return NextResponse.json(
        { error: "Debe ingresar un DNI válido de 8 dígitos." },
        { status: 400 }
      );
    }

    const cleanDni = dni.trim();
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
    if (!(await verificationTokenRateLimiter.consume("associate-lookup", `${ip}:${cleanDni}`, 10, 15))) {
      return NextResponse.json({ error: "Demasiados intentos." }, { status: 429 });
    }

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

    return NextResponse.json({ eligible: true });
  } catch (error: any) {
    console.error("Error al consultar asociado:", error);
    return NextResponse.json(
      { error: "Error en el servidor al consultar el DNI." },
      { status: 500 }
    );
  }
}
