import { QUERY_COOKIE } from "@/modules/afiliaciones/consulta/Services/QueryAuthorizationService";
import { applicationHttpError } from "@/modules/afiliaciones/postulacion/Services/ApplicationHttpError";
import { NextRequest, NextResponse } from "next/server";

import { ApplicationRepository } from "@/modules/afiliaciones/postulacion/Repositories/ApplicationRepository";
import { SubmitApplicationService } from "@/modules/afiliaciones/postulacion/Services/SubmitApplicationService";
import { ApplicationValidator } from "@/modules/afiliaciones/postulacion/Validators/ApplicationValidator";
import { ValidationException } from "@/modules/afiliaciones/postulacion/Services/Exceptions/ValidationException";

export async function POST(
    request: NextRequest,
    {
        params,
    }: {
        params: Promise<{
            trackingCode: string;
        }>;
    }
) {
    try {

        const { trackingCode } = await params;

        const repository = new ApplicationRepository();

        const validator = new ApplicationValidator();

        const service = new SubmitApplicationService(
            repository,
            validator
        );

        const application =
            await service.execute(trackingCode, request.cookies.get(QUERY_COOKIE)?.value);

        return NextResponse.json(
            {
                success: true,
                data: application,
            },
            {
                status: 200,
            }
        );

    } catch (error) {

        if (error instanceof ValidationException) {

            return NextResponse.json(
                {
                    success: false,
                    errors: error.errors,
                },
                {
                    status: 422,
                }
            );

        }

        return applicationHttpError(error);

    }
}