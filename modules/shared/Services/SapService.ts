import axios from 'axios';
import https from 'https';
import { getSapConfig } from '@/lib/config/env';

export class SapService {
    private baseUrl: string;
    private companyDb: string;
    private username: string;
    private password: string;
    private agent: https.Agent;

    constructor() {
        // Configuración validada explícitamente: sin fallbacks silenciosos a ''.
        const config = getSapConfig();
        this.baseUrl = config.baseUrl;
        this.companyDb = config.companyDb;
        this.username = config.username;
        this.password = config.password;

        this.agent = new https.Agent({
            rejectUnauthorized: true
        });
    }

    /**
     * Inicia sesión en SAP Service Layer y retorna el SessionId
     */
    public async login(): Promise<string | null> {
        try {
            const response = await axios.post(`${this.baseUrl}/Login`, {
                CompanyDB: this.companyDb,
                UserName: this.username,
                Password: this.password
            }, {
                httpsAgent: this.agent,
                timeout: 10000 
            });

            return response.data.SessionId;
        } catch (error: any) {
            console.error("[SapService] Error en Login:", error?.response?.data || error.message);
            return null;
        }
    }

    /**
     * Cierra la sesión activa por seguridad y para no saturar las licencias de SAP
     */
    public async logout(sessionId: string): Promise<void> {
        try {
            await axios.post(`${this.baseUrl}/Logout`, {}, {
                headers: { 'Cookie': `B1SESSION=${sessionId}` },
                httpsAgent: this.agent
            });
        } catch (error) {
            console.error("[SapService] Error al cerrar sesión:", error);
        }
    }
}
