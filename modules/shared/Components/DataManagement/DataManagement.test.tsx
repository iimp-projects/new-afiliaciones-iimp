import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { DataFilterBar } from "./DataFilterBar";
import { DataTable } from "./DataTable";
import { getDataPaginationPages } from "./DataPagination";
import type { DataAction } from "./DataActionMenu";

describe("DataManagement", () => {
  it("renders table columns, rows, loading and empty states", () => {
    const columns = [{ key: "name", header: "Nombre", render: (row: { id: number; name: string }) => row.name }];
    expect(renderToStaticMarkup(<DataTable data={[{ id: 1, name: "Ana" }]} columns={columns} rowKey={(row) => row.id} />)).toContain("Ana");
    expect(renderToStaticMarkup(<DataTable data={[]} columns={columns} rowKey={(row) => row.id} emptyState="Sin registros" />)).toContain("Sin registros");
    expect(renderToStaticMarkup(<DataTable data={[]} columns={columns} rowKey={(row) => row.id} loading />)).toContain("Cargando registros");
  });

  it("renders configured filters and exposes apply, clear and value change callbacks", () => {
    const onChange = vi.fn(); const onApply = vi.fn(); const onClear = vi.fn();
    const filters = [{ key: "search", type: "search" as const, placeholder: "Buscar" }, { key: "status", type: "select" as const, placeholder: "Todos", options: [{ value: "OK", label: "OK" }] }];
    const markup = renderToStaticMarkup(<DataFilterBar filters={filters} values={{ search: "Ana", status: "" }} onChange={onChange} onApply={onApply} onClear={onClear} />);
    expect(markup).toContain("Buscar"); expect(markup).toContain("Todos"); expect(markup).toContain("Aplicar"); expect(markup).toContain("Limpiar");
  });

  it("builds pagination ranges including first, current and last pages", () => {
    expect(getDataPaginationPages(1, 8)).toEqual([1, 2, 3, 4, "...", 8]);
    expect(getDataPaginationPages(8, 8)).toEqual([1, "...", 5, 6, 7, 8]);
  });

  it("evaluates action visibility, disabled state and callback contracts", () => {
    const onClick = vi.fn(); const actions: DataAction<{ retryable: boolean }>[] = [{ key: "retry", label: "Reintentar", visible: (row) => row.retryable, disabled: (row) => !row.retryable, onClick }];
    const visible = actions[0].visible as (row: { retryable: boolean }) => boolean;
    const disabled = actions[0].disabled as (row: { retryable: boolean }) => boolean;
    expect(visible({ retryable: true })).toBe(true); expect(visible({ retryable: false })).toBe(false); expect(disabled({ retryable: false })).toBe(true);
    actions[0].onClick({ retryable: true }); expect(onClick).toHaveBeenCalledWith({ retryable: true });
  });
});
