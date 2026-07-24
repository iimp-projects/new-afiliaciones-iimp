import { NextResponse } from "next/server";

import { ApplicationRepository } from "@/modules/afiliaciones/postulacion/Repositories/ApplicationRepository";
import { SubmitApplicationService } from "@/modules/afiliaciones/postulacion/Services/SubmitApplicationService";
import { ApplicationValidator } from "@/modules/afiliaciones/postulacion/Validators/ApplicationValidator";
import { ValidationException } from "@/modules/afiliaciones/postulacion/Services/Exceptions/ValidationException";

export async function POST(
    request: Request,
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
            await service.execute(trackingCode);

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

        return NextResponse.json(
            {
                success: false,
                message:
                    error instanceof Error
                        ? error.message
                        : "Ocurrió un error al enviar la postulación.",
            },
            {
                status: 400,
            }
        );

    }
}