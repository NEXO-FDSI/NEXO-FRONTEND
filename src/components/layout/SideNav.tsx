import { FolderSearch, LayoutDashboard } from 'lucide-react'
import type { Route } from '../../hooks/useRoute'
import { rutas } from '../../hooks/useRoute'
import { useInvestigations } from '../../state/InvestigationsContext'
import { Logo } from './Logo'
import styles from './SideNav.module.css'

export function SideNav({ route }: { route: Route }) {
  const { items } = useInvestigations()
  const enlaces = [
    { href: rutas.panel, label: 'Panel', icon: <LayoutDashboard aria-hidden="true" />, activo: route.view === 'panel' },
    {
      href: rutas.investigaciones,
      label: 'Investigaciones',
      icon: <FolderSearch aria-hidden="true" />,
      activo: route.view === 'investigaciones' || route.view === 'investigacion',
      count: items.length,
    },
  ]

  return (
    <nav className={styles.side} aria-label="Navegación principal">
      <a className={styles.brand} href={rutas.panel}>
        <Logo size={26} />
        <span>
          NEXO <span className={styles.accent}>Intel</span>
        </span>
      </a>
      <ul className={styles.links}>
        {enlaces.map((e) => (
          <li key={e.href}>
            <a className={styles.link} href={e.href} aria-current={e.activo ? 'page' : undefined}>
              {e.icon}
              <span className={styles.label}>{e.label}</span>
              {e.count !== undefined && <span className={styles.count}>{e.count}</span>}
            </a>
          </li>
        ))}
      </ul>
      <p className={styles.foot}>Enriquecimiento de IoC · MITRE ATT&amp;CK 19.1</p>
    </nav>
  )
}
