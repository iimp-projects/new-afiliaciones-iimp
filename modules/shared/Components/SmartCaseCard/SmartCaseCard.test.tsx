import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { SmartCaseCard } from "./SmartCaseCard";
import type { SmartCaseCardData } from "./types";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

const cardData = (hideContactDetails: boolean): SmartCaseCardData => ({
  id: 1,
  trackingCode: "A-001",
  hideContactDetails,
  identity: {
    title: "Andrea Paredes",
    subtitle: "DNI 41000057",
    email: "andrea@example.com",
    phone: "+51 999 123 456",
    avatarUrl: null,
    fallbackInitials: "AP",
  },
  atomicValidations: [],
  metadata: { priority: "low", lastUpdatedRelative: "Actualizado: 03/09/2026" },
  allowedActions: ["view"],
});

describe("SmartCaseCard", () => {
  it("does not render contact details for compact directory cards", () => {
    const markup = renderToStaticMarkup(<SmartCaseCard data={cardData(true)} />);

    expect(markup).not.toContain("andrea@example.com");
    expect(markup).not.toContain("+51 999 123 456");
  });

  it("keeps contact details visible for cards outside the compact directory", () => {
    const markup = renderToStaticMarkup(<SmartCaseCard data={cardData(false)} />);

    expect(markup).toContain("andrea@example.com");
    expect(markup).toContain("+51 999 123 456");
  });
});
