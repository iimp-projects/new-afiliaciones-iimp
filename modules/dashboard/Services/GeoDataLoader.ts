import type { FeatureCollection } from "geojson";
import type { Topology } from "topojson-specification";

export const PERU_GEOJSON_URL = "/data/peru-departamental-simple.geojson";
export const WORLD_TOPOJSON_URL = "/data/countries-50m.json";

export interface DashboardGeoData {
  readonly peru: FeatureCollection | null;
  readonly world: Topology | null;
}

/**
 * Descarga y parsea un JSON sin propagar errores.
 *
 * El mapa es información accesoria del dashboard: un recurso ausente, una
 * respuesta no exitosa, un cuerpo inválido o una petición abortada se
 * resuelven como `null` para no generar `unhandledRejection` ni romper la vista.
 */
export async function fetchJsonOrNull<T>(url: string, init?: RequestInit): Promise<T | null> {
  try {
    const response = await fetch(url, init);
    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

export async function loadDashboardGeoData(signal?: AbortSignal): Promise<DashboardGeoData> {
  const init = signal ? { signal } : undefined;
  const [peru, world] = await Promise.all([
    fetchJsonOrNull<FeatureCollection>(PERU_GEOJSON_URL, init),
    fetchJsonOrNull<Topology>(WORLD_TOPOJSON_URL, init),
  ]);

  return { peru, world };
}
