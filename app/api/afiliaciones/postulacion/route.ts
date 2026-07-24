import { NextRequest, NextResponse } from "next/server";

import { ApplicationRepository } from "@/modules/afiliaciones/postulacion/Repositories/ApplicationRepository";
import { StartApplicationService } from "@/modules/afiliaciones/postulacion/Services/StartApplicationService";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const repository = new ApplicationRepository();

    const service = new StartApplicationService(repository);

    const application = await service.execute(body);

    return NextResponse.json(application, {
      status: 201,
    });

  } catch (error) {

    console.error(error);

    return NextResponse.json(
      {
        message: "Ocurrió un error al iniciar la postulación.",
      },
      {
        status: 500,
      }
    );

  }
}