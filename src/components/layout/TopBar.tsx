import { BookOpen, Moon, ScanSearch, Sparkles, Sun } from 'lucide-react'
import { API_URL } from '../../config'
import { useHealth, type HealthStatus } from '../../hooks/useHealth'
import { rutas } from '../../hooks/useRoute'
import { useStatus } from '../../hooks/useStatus'
import type { Theme } from '../../hooks/useTheme'
import styles from './TopBar.module.css'

const HEALTH_LABEL: Record<HealthStatus, string> = {
  checking: 'Verificando API…',
  online: 'API en línea',
  offline: 'API fuera de línea',
}

interface TopBarProps {
  theme: Theme
  onToggleTheme: () => void
}

export function TopBar({ theme, onToggleTheme }: TopBarProps) {
  const health = useHealth()
  const status = useStatus()
  const respaldo = status?.ia.respaldo

  return (
    <header className={styles.bar}>
      <a className={styles.primary} href={rutas.analizar}>
        <ScanSearch size={16} aria-hidden="true" />
        Analizar indicador
      </a>
      <div className={styles.tools}>
        <span className={`${styles.pill} ${styles[health]}`} role="status" title={API_URL}>
          <span className={styles.dot} aria-hidden="true" />
          <span className={styles.pillText}>{HEALTH_LABEL[health]}</span>
        </span>
        {status && (
          <span
            className={`${styles.pill} ${styles.ia}`}
            title={respaldo ? `Respaldo: ${respaldo.proveedor} · ${respaldo.modelo}` : 'Sin proveedor de respaldo'}
          >
            <Sparkles size={14} aria-hidden="true" />
            <span className={styles.iaText}>
              IA: {status.ia.proveedor} · <span className="mono">{status.ia.modelo}</span>
            </span>
          </span>
        )}
        <button
          type="button"
          className={styles.icon}
          onClick={onToggleTheme}
          aria-label={theme === 'dark' ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'}
        >
          {theme === 'dark' ? <Sun size={16} aria-hidden="true" /> : <Moon size={16} aria-hidden="true" />}
        </button>
        <a
          className={styles.icon}
          href={`${API_URL}/docs`}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Documentación de la API (Swagger)"
        >
          <BookOpen size={16} aria-hidden="true" />
        </a>
      </div>
    </header>
  )
}
