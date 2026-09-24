import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("../Actions/user.actions", () => ({
  toggleUserStatusAction: vi.fn(),
  deleteUserAction: vi.fn(),
  revokeUserSessionsAction: vi.fn(),
}));

import { UsersTable, RowActionsMenu } from "./UsersTable";

const activeUser = {
  id: 1,
  email: "ana.perez@iimp.org.pe",
  status: "ACTIVE",
  type: "VALIDATOR",
  createdAt: new Date("2026-09-23T12:00:00Z"),
  image: null,
  person: {
    firstName: "Ana",
    paternalLastName: "Pérez",
    maternalLastName: "Gómez",
    documentType: "DNI",
    documentNumber: "12345678",
  },
  role: { name: "Revisor de Área", slug: "VALIDADOR" },
};

describe("UsersTable", () => {
  it("renders users as table rows (no card grid)", () => {
    const html = renderToStaticMarkup(<UsersTable users={[activeUser]} roles={[]} onActionSuccess={vi.fn()} />);

    expect(html).toContain("<table");
    expect(html).toContain("<tr");
    expect(html).not.toContain("grid-cols");
    expect(html).toContain("Ana");
    expect(html).toContain("ana.perez@iimp.org.pe");
    expect(html).toContain("12345678");
    expect(html).toContain("DNI");
    expect(html).toContain("Revisor de Área");
    expect(html).toContain("Fecha de Registro");
  });

  it("shows ACTIVE users explicitly as Activo", () => {
    const html = renderToStaticMarkup(<UsersTable users={[activeUser]} roles={[]} onActionSuccess={vi.fn()} />);
    expect(html).toContain("Activo");
  });

  it("renders initials as avatar when there is no photo", () => {
    const html = renderToStaticMarkup(<UsersTable users={[activeUser]} roles={[]} onActionSuccess={vi.fn()} />);
    expect(html).toContain("AP");
  });

  it("renders an empty state when there are no users", () => {
    const html = renderToStaticMarkup(<UsersTable users={[]} roles={[]} onActionSuccess={vi.fn()} />);
    expect(html).toContain("No hay usuarios");
  });

  it("renders the actions trigger button for each row", () => {
    const html = renderToStaticMarkup(<UsersTable users={[activeUser]} roles={[]} onActionSuccess={vi.fn()} />);
    expect(html).toContain('aria-label="Acciones"');
  });
});

describe("RowActionsMenu", () => {
  const noop = vi.fn();

  it("keeps all existing actions for an ACTIVE user", () => {
    const html = renderToStaticMarkup(
      <RowActionsMenu user={activeUser} onEdit={noop} onChangePassword={noop} onToggleStatus={noop} onRevokeSessions={noop} onDelete={noop} />,
    );

    expect(html).toContain("Editar Datos");
    expect(html).toContain("Cambiar Contraseña");
    expect(html).toContain("Bloquear Acceso");
    expect(html).toContain("Cerrar Sesiones");
    expect(html).toContain("Eliminar Usuario");
  });

  it("shows Desbloquear Acceso and hides Cerrar Sesiones for an INACTIVE user", () => {
    const inactive = { ...activeUser, status: "INACTIVE" };
    const html = renderToStaticMarkup(
      <RowActionsMenu user={inactive} onEdit={noop} onChangePassword={noop} onToggleStatus={noop} onRevokeSessions={noop} onDelete={noop} />,
    );

    expect(html).toContain("Desbloquear Acceso");
    expect(html).not.toContain("Bloquear Acceso");
    expect(html).not.toContain("Cerrar Sesiones");
  });
});
