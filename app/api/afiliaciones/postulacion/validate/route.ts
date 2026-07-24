import { NextRequest, NextResponse } from "next/server";

import { ApplicationValidator } from "@/modules/afiliaciones/postulacion/Validators/ApplicationValidator";
import { ApplicationDraft } from "@/modules/afiliaciones/postulacion/Models/ApplicationDraft";
import { ValidationException } from "@/modules/afiliaciones/postulacion/Services/Exceptions/ValidationException";

export async function POST(request: NextRequest) {

    try {

        const draft =
            await request.json() as ApplicationDraft;

        const validator =
            new ApplicationValidator();

        const result =
            validator.validate(draft);

        if (!result.valid) {

            throw new ValidationException(
                result.errors
            );

        }

        return NextResponse.json(
            {
                success: true,
                message: "La validación fue exitosa."
            },
            {
                status: 200
            }
        );

    } catch (error) {

        if (error instanceof ValidationException) {

            return NextResponse.json(
                {
                    success: false,
                    errors: error.errors
                },
                {
                    status: 422
                }
            );

        }

        return NextResponse.json(
            {
                success: false,
                message:
                    error instanceof Error
                        ? error.message
                        : "Error al validar la información."
            },
            {
                status: 400
            }
        );

    }

}