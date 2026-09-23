import { DataPagination } from "@/modules/shared/Components/DataManagement";
type Props = { total: number; page: number; pageSize: number; onPageChange: (page: number) => void; onPageSizeChange: (pageSize: number) => void };
export function AssociateIntegrationPagination({ total, page, pageSize, onPageChange, onPageSizeChange }: Props) { return <DataPagination total={total} page={page} pageSize={pageSize} totalPages={Math.max(1, Math.ceil(total / pageSize))} onPageChange={onPageChange} onPageSizeChange={onPageSizeChange} className="mt-3" />; }
