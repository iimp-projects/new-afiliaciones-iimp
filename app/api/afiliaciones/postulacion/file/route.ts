import { NextRequest, NextResponse } from "next/server";
import { S3StorageService } from "@/modules/shared/Services/S3StorageService";
import { QUERY_COOKIE, queryAuthorization } from "@/modules/afiliaciones/consulta/Services/QueryAuthorizationService";
import { contextService } from "@/modules/auth/context/service";
import { getInternalApiUser } from "@/modules/auth/context/api-authorization";
import { resolveApplicationDocumentScope } from "@/modules/afiliaciones/postulacion/Services/ApplicationDocumentAccess";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const url = request.nextUrl.searchParams.get("url");
    if (!url) return NextResponse.json({ message: "URL no proporcionada" }, { status: 400 });

    const s3Service = new S3StorageService();
    const key = s3Service.getObjectKey(url);

    const user = await getInternalApiUser();
    const canReadAll = Boolean(user && await contextService.hasPermission("read", "memberships"));
    const applicationIds = queryAuthorization.allowedIds(request.cookies.get(QUERY_COOKIE)?.value);
    const scope = resolveApplicationDocumentScope({ isInternal: canReadAll, applicantApplicationIds: applicationIds });
    if (!scope) {
      return NextResponse.json({ message: "No autenticado." }, { status: 401 });
    }

    const ownedLegacyDocument = !canReadAll && applicationIds.length > 0
      ? await prisma.applicationDocument.findFirst({
          where: {
            applicationId: { in: applicationIds },
            OR: [{ fileUrl: url }, { fileUrl: { endsWith: key } }],
          },
          select: { fileUrl: true },
        })
      : null;
    const allowedKeys = ownedLegacyDocument ? [s3Service.getObjectKey(ownedLegacyDocument.fileUrl)] : [];
    const secureUrl = await s3Service.getPresignedApplicationDocumentUrl(url, scope.allowedPrefixes, allowedKeys);

    return NextResponse.json({ success: true, data: { url: secureUrl } });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "No se pudo autorizar el archivo.";
    const status = message.includes("acceso") || message.includes("pertenece") ? 403 : 400;
    return NextResponse.json({ message }, { status });
  }
}
