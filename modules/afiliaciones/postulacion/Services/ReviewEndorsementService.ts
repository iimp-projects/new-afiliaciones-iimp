import jwt from "jsonwebtoken";
import { prisma } from "@/lib/prisma";
import { EndorsementStatus } from "@prisma/client";
import { ApplicationStatusCalculatorService } from "./ApplicationStatusCalculatorService";

export class ReviewEndorsementService {
  async execute(token: string, action: "APPROVE" | "REJECT"): Promise<void> {
    try {
      // 1. Verificar y decodificar el token
      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as {
        applicationId: number;
        sponsorPersonId: number;
      };

      // 2. Actualizar el estado del AVAL en la base de datos
      const result = await prisma.membershipApproval.updateMany({
        where: {
          applicationId: decoded.applicationId,
          sponsorPersonId: decoded.sponsorPersonId,
        },
        data: {
          status: action === "APPROVE" ? EndorsementStatus.APPROVED : EndorsementStatus.REJECTED,
          transactionDate: new Date(),
        },
      });

      if (result.count === 0) {
        throw new Error("No se encontró el registro de aval o ya fue procesado.");
      }

      // 3. DISPARADOR MÁGICO: Recalcular Estado Global Automáticamente
      const calculator = new ApplicationStatusCalculatorService();
      await calculator.recalculate(decoded.applicationId);

    } catch (error: any) {
      if (error.name === "TokenExpiredError") {
        throw new Error("El enlace ha expirado.");
      }
      throw new Error("El enlace es inválido o ha ocurrido un error al procesar su solicitud.");
    }
  }
}