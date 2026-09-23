import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchJsonOrNull, loadDashboardGeoData, PERU_GEOJSON_URL, WORLD_TOPOJSON_URL } from "./GeoDataLoader";

describe("fetchJsonOrNull", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("devuelve null cuando fetch rechaza sin propagar el error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    await expect(fetchJsonOrNull("https://example.test/map.json")).resolves.toBeNull();
  });

  it("devuelve null cuando la respuesta no es exitosa", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, json: async () => ({}) }));
    await expect(fetchJsonOrNull("https://example.test/map.json")).resolves.toBeNull();
  });

  it("devuelve null cuando el cuerpo no es JSON válido", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => { throw new SyntaxError("Unexpected token"); },
    }));
    await expect(fetchJsonOrNull("https://example.test/map.json")).resolves.toBeNull();
  });

  it("devuelve el JSON cuando la respuesta es exitosa", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ type: "FeatureCollection", features: [] }),
    }));
    await expect(fetchJsonOrNull<{ type: string; features: unknown[] }>("https://example.test/map.json"))
      .resolves.toEqual({ type: "FeatureCollection", features: [] });
  });
});

describe("loadDashboardGeoData", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("continúa sin datos del mapa cuando todos los recursos fallan", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    await expect(loadDashboardGeoData()).resolves.toEqual({ peru: null, world: null });
  });

  it("usa las rutas locales y devuelve ambos datasets cuando están disponibles", async () => {
    const fetchMock = vi.fn().mockImplementation(async (url: string) => ({
      ok: true,
      json: async () => (url === PERU_GEOJSON_URL
        ? { type: "FeatureCollection", features: [] }
        : { type: "Topology", objects: {} }),
    }));
    vi.stubGlobal("fetch", fetchMock);

    const data = await loadDashboardGeoData();
    expect(data.peru).toEqual({ type: "FeatureCollection", features: [] });
    expect(data.world).toEqual({ type: "Topology", objects: {} });
    expect(fetchMock).toHaveBeenCalledWith(PERU_GEOJSON_URL, undefined);
    expect(fetchMock).toHaveBeenCalledWith(WORLD_TOPOJSON_URL, undefined);
  });

  it("propaga la señal de aborto a cada petición", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    vi.stubGlobal("fetch", fetchMock);
    const controller = new AbortController();

    await loadDashboardGeoData(controller.signal);
    expect(fetchMock).toHaveBeenCalledWith(PERU_GEOJSON_URL, { signal: controller.signal });
    expect(fetchMock).toHaveBeenCalledWith(WORLD_TOPOJSON_URL, { signal: controller.signal });
  });
});
