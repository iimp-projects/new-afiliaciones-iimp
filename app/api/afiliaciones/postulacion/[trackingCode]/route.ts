import { NextResponse } from "next/server";

import { ApplicationRepository } from "@/modules/afiliaciones/postulacion/Repositories/ApplicationRepository";
import { GetApplicationByTrackingService } from "@/modules/afiliaciones/postulacion/Services/GetApplicationByTrackingService";
import { UpdateDraftService } from "@/modules/afiliaciones/postulacion/Services/UpdateDraftService";

export async function GET(
    request: Request,
    { params }: {
        params: Promise<{
            trackingCode: string;
        }>
    }
) {

    try {

        const { trackingCode } = await params;

        const repository =
            new ApplicationRepository();

        const service =
            new GetApplicationByTrackingService(repository);

        const application =
            await service.execute(trackingCode);

        return NextResponse.json(application);

    } catch (error) {

        return NextResponse.json(
            {
                error:
                    error instanceof Error
                        ? error.message
                        : "Ocurrió un error."
            },
            {
                status: 404
            }
        );

    }

}

export async function PATCH(
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

        const body = await request.json();

        const repository =
            new ApplicationRepository();

        const service =
            new UpdateDraftService(repository);

        const application =
            await service.execute(
                trackingCode,
                body
            );

        return NextResponse.json(application);

    } catch (error) {

        return NextResponse.json(
            {
                error:
                    error instanceof Error
                        ? error.message
                        : "Ocurrió un error."
            },
            {
                status: 500
            }
        );

    }
}