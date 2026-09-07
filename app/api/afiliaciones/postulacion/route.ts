import { NextRequest, NextResponse } from "next/server";

import { ApplicationRepository } from "@/modules/afiliaciones/postulacion/Repositories/ApplicationRepository";
import { StartApplicationService } from "@/modules/afiliaciones/postulacion/Services/StartApplicationService";
import { QUERY_COOKIE, queryAuthorization } from "@/modules/afiliaciones/consulta/Services/QueryAuthorizationService";
import { applicationHttpError } from "@/modules/afiliaciones/postulacion/Services/ApplicationHttpError";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const repository = new ApplicationRepository();

    const service = new StartApplicationService(repository);

    const token = request.cookies.get(QUERY_COOKIE)?.value;
    const application = await service.execute(body, token);

    const response = NextResponse.json(application, {
      status: 201,
    });
    response.cookies.set(QUERY_COOKIE, queryAuthorization.createAccess([Number(application.id), ...queryAuthorization.allowedIds(token)]), { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", path: "/api", maxAge: 900 });
    return response;

  } catch (error) {

    return applicationHttpError(error);

  }
}
