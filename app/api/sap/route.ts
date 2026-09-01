import { NextResponse } from "next/server";
import { SapService } from "@/modules/shared/Services/SapService"; // Verifica que la ruta coincida con donde guardaste el servicio

export async function GET() {
    try {
        const sapService = new SapService();
        console.log("Intentando conectar a SAP...");
        
        // Intentamos obtener el token de sesión
        const sessionId = await sapService.login();

        if (sessionId) {
            // Si hay token, nos conectamos con éxito. 
            // Inmediatamente cerramos sesión para no dejar conexiones "fantasma" en el servidor SAP.
            await sapService.logout(sessionId);

            return NextResponse.json({
                success: true,
                message: "✅ ¡Conectado al SAP exitosamente!",
                sessionId: sessionId
            }, { status: 200 });
            
        } else {
            return NextResponse.json({ 
                success: false, 
                message: "❌ No se pudo conectar a SAP. Verifica el .env o la conexión VPN/Red." 
            }, { status: 401 });
        }

    } catch (error: any) {
        return NextResponse.json({ 
            success: false, 
            message: `Error interno: ${error.message}` 
        }, { status: 500 });
    }
}