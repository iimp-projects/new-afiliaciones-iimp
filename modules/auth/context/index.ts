import { contextService } from './service';

export * from './types';

// Exportación destructurada para una DX más limpia en Server Components/Actions
export const {
  getCurrentSession,
  getCurrentUser,
  requireAuth,
  hasRole,
  requireRole,
  hasPermission,
  requirePermission,
} = contextService;