// Default global de FaceTec. Se sobreescribe por organización (organizations.facetec_enabled).
// Cambiar en .env.local: EXPO_PUBLIC_FACETEC_DEFAULT=true|false
export const FACETEC_DEFAULT = process.env.EXPO_PUBLIC_FACETEC_DEFAULT === 'true'

// Resuelve el toggle: el override de la organización manda; si es null/undefined, cae al default global.
export function resolveFacetecEnabled(orgOverride: boolean | null | undefined): boolean {
  return orgOverride ?? FACETEC_DEFAULT
}
