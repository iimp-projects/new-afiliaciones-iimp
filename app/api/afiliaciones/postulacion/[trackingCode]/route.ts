import { QUERY_COOKIE } from "@/modules/afiliaciones/consulta/Services/QueryAuthorizationService";
import { applicationHttpError } from "@/modules/afiliaciones/postulacion/Services/ApplicationHttpError";
import { NextRequest, NextResponse } from "next/server";

import { ApplicationRepository } from "@/modules/afiliaciones/postulacion/Repositories/ApplicationRepository";
import { GetApplicationByTrackingService } from "@/modules/afiliaciones/postulacion/Services/GetApplicationByTrackingService";
import { UpdateDraftService } from "@/modules/afiliaciones/postulacion/Services/UpdateDraftService";

export async function GET(
    request: NextRequest,
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
            await service.execute(trackingCode, request.cookies.get(QUERY_COOKIE)?.value);

        return NextResponse.json(application);

    } catch (error) {

        return applicationHttpError(error);

    }

}

export async function PATCH(
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

        const body = await request.json();

        const repository =
            new ApplicationRepository();

        const service =
            new UpdateDraftService(repository);

        const application =
            await service.execute(
                trackingCode,
                body, request.cookies.get(QUERY_COOKIE)?.value
            );

        return NextResponse.json(application);

    } catch (error) {

        return applicationHttpError(error);

    }
}