import { NextRequest, NextResponse } from "next/server";
import { contextService } from "@/modules/auth/context/service";
import { UserService } from "@/modules/security/Users/Services/UserService";
import { S3StorageService } from "@/modules/shared/Services/S3StorageService";

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

    // 4. Firmar URLs de S3 para las imágenes
    const s3Service = new S3StorageService();
    for (const user of result.data) {
      if (user.image) {
        user.image = await s3Service.getPresignedUrl(user.image);
      }
    }

    // 5. Devolvemos la respuesta formateada como en Expedientes
    return NextResponse.json({
      success: true,
      data: result.data,
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