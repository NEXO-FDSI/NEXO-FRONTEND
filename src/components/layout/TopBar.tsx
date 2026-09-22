import { BookOpen } from 'lucide-react'
import { API_URL } from '../../config'
import { useHealth, type HealthStatus } from '../../hooks/useHealth'
import { Logo } from './Logo'
import styles from './TopBar.module.css'

const HEALTH_LABEL: Record<HealthStatus, string> = {
  checking: 'Verificando API…',
  online: 'API en línea',
  offline: 'API fuera de línea',
}

export function TopBar() {
  const health = useHealth()
  return (
    <header className={styles.bar}>
      <div className={styles.brand}>
        <Logo />
        <div>
          <p className={styles.name}>
            NEXO <span>Intel</span>
          </p>
          <p className={styles.tagline}>Enriquecimiento de IoC · MITRE ATT&amp;CK</p>
        </div>
      </div>
      <div className={styles.tools}>
        <span className={`${styles.health} ${styles[health]}`} role="status" title={API_URL}>
          <span className={styles.dot} aria-hidden="true" />
          {HEALTH_LABEL[health]}
        </span>
        <a
          className={styles.docs}
          href={`${API_URL}/docs`}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Documentación de la API (Swagger)"
        >
          <BookOpen size={16} aria-hidden="true" />
          <span>API docs</span>
        </a>
      </div>
    </header>
  )
}
