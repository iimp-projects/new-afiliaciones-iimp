import { NextRequest, NextResponse } from "next/server";
import { contextService } from "@/modules/auth/context/service";
import { UserService } from "@/modules/security/Users/Services/UserService";
import { S3StorageService } from "@/modules/shared/Services/S3StorageService";
import { resolveAffiliatePhoto } from "@/modules/shared/Services/AffiliatePhotoResolver";

export async function GET(request: NextRequest) {
  try {
    // 1. Verificamos permisos
    await contextService.requirePermission("read", "users");

    // 2. Obtenemos los parámetros de la URL
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get("page") || "1");
    const pageSize = parseInt(searchParams.get("pageSize") || "12");
    const search = searchParams.get("search") || undefined;
    const status = searchParams.get("status") || undefined;
    const roleId = searchParams.get("roleId") ? Number(searchParams.get("roleId")) : undefined;
    const sort = searchParams.get("sort") || "desc"; // Agregamos ordenamiento

    // 3. Consultamos al servicio
    const service = new UserService();
    const result = await service.getList(page, pageSize, search, status, roleId);

    // 4. Resolver la fotografía (documento de postulación) y firmar el avatar de
    //    respaldo. Nunca se exponen los documentos ni las claves privadas de S3.
    const s3Service = new S3StorageService();
    const data = await Promise.all(
      result.data.map(async (user) => {
        const photo = await resolveAffiliatePhoto(user.person?.applications ?? []);
        const image = photo ?? (user.image ? await s3Service.getPresignedAvatarUrl(user.image) : null);

        let person: typeof user.person = null;
        if (user.person) {
          const { applications: _applications, ...safePerson } = user.person;
          void _applications;
          person = safePerson as typeof user.person;
        }

        return { ...user, image, person };
      }),
    );

    // 5. Devolvemos la respuesta formateada como en Expedientes
    return NextResponse.json({
      success: true,
      data,
      meta: {
        total: result.total,
        page: result.page,
        pageSize: result.pageSize,
        totalPages: Math.ceil(result.total / result.pageSize)
      }
    }, { status: 200 });

  } catch (error: any) {
    console.error("[Users API Error]:", error);
    return NextResponse.json(
      { success: false, message: "Error al obtener los usuarios." },
      { status: 500 }
    );
  }
}
