import { ExpedienteRepository } from "../Repositories/ExpedienteRepository";

export class GetExpedientesService {
    constructor(private readonly repository: ExpedienteRepository) {}

    async execute(params: {
        page: number;
        pageSize: number;
        search?: string;
        status?: string;
    }) {
        return await this.repository.getPaginated(params);
    }
}