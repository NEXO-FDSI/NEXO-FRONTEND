/** Marca NEXO: hexágono con tres nodos enlazados (indicador → entidad → técnica). */
export function Logo({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <path
        d="M16 2.5 27.7 9.25v13.5L16 29.5 4.3 22.75V9.25L16 2.5Z"
        stroke="var(--color-accent)"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path d="M11 20.5 16 11l5 9.5" stroke="var(--color-text)" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="16" cy="11" r="2.6" fill="var(--color-accent)" />
      <circle cx="11" cy="20.5" r="2.3" fill="var(--color-text)" />
      <circle cx="21" cy="20.5" r="2.3" fill="var(--color-info)" />
    </svg>
  )
}
