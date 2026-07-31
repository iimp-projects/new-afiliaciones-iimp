export interface ExpedienteDTO {
    id: number;
    applicationCode: string;
    documentType: string;
    documentNumber: string;
    fullName: string;
    email: string;
    phone: string;
    affiliateType: string;
    status: string;
    currentStep: number;
    submittedAt: string | null;
}

export interface PaginatedExpedientes {
    data: ExpedienteDTO[];
    meta: {
        total: number;
        page: number;
        pageSize: number;
        totalPages: number;
    };
}