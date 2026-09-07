/** Solo en dev: permite auditar la UI sin Firebase ni login real. */
export const isDesignPreview =
  import.meta.env.DEV && import.meta.env.VITE_DESIGN_PREVIEW === 'true'
