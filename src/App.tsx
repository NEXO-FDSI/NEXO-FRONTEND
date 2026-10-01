import { ChevronRight, FolderSearch } from 'lucide-react'
import { useEffect, useState, type MouseEvent } from 'react'
import type { ErrorInfo } from './api/http'
import { CaseDetail } from './components/case/CaseDetail'
import { Dashboard } from './components/dashboard/Dashboard'
import { ErrorBoundary } from './components/ErrorBoundary'
import { SideNav } from './components/layout/SideNav'
import { TopBar } from './components/layout/TopBar'
import { CaseList } from './components/sidebar/CaseList'
import { IndicatorForm } from './components/sidebar/IndicatorForm'
import { EmptyState } from './components/ui/EmptyState'
import { Spinner } from './components/ui/Spinner'
import { truncateMiddle } from './domain/format'
import { rutas, useRoute, type Route } from './hooks/useRoute'
import { useTheme } from './hooks/useTheme'
import { useInvestigations } from './state/InvestigationsContext'
import { InvestigationsProvider } from './state/InvestigationsProvider'
import styles from './App.module.css'

function InvestigationPage({ id }: { id: number }) {
  const { items, load } = useInvestigations()
  const inv = items.find((i) => i.indicator.id === id)
  // Al abrir un caso se refresca desde el backend (fuente de verdad): lo que está en caché se
  // muestra al instante y se fusiona con lo remoto. El error se reinicia al cambiar de caso
  // porque la página se monta con key={id}.
  const [error, setError] = useState<ErrorInfo | null>(null)

  useEffect(() => {
    let active = true
    void load(id).then((r) => {
      if (active && !r.ok) setError(r.error)
    })
    return () => {
      active = false
    }
  }, [id, load])

  if (!inv) {
    if (!error) {
      return (
        <EmptyState icon={<Spinner size={20} />} title={`Cargando la investigación #${id} desde el backend…`} />
      )
    }
    return (
      <EmptyState
        icon={<FolderSearch />}
        title={error.status === 404 ? `La investigación #${id} no existe en el backend` : 'No se pudo cargar la investigación'}
      >
        <p>
          {error.status === 404 ? 'Puede que la base de datos se haya reiniciado.' : error.message}{' '}
          <a href={rutas.investigaciones}>Ver investigaciones</a>
        </p>
      </EmptyState>
    )
  }
  return (
    <>
      <nav aria-label="Ruta de navegación" className={styles.breadcrumb}>
        <a href={rutas.investigaciones}>Investigaciones</a>
        <ChevronRight size={14} aria-hidden="true" />
        <span className="mono" aria-current="page">
          {truncateMiddle(inv.indicator.valor, 40)}
        </span>
      </nav>
      <ErrorBoundary key={inv.indicator.id}>
        <CaseDetail key={inv.indicator.id} inv={inv} />
      </ErrorBoundary>
    </>
  )
}

function View({ route }: { route: Route }) {
  switch (route.view) {
    case 'analizar':
      return (
        <div className={styles.narrow}>
          <IndicatorForm />
        </div>
      )
    case 'investigaciones':
      return <CaseList />
    case 'investigacion':
      return <InvestigationPage key={route.id} id={route.id} />
    case 'panel':
      return <Dashboard />
  }
}

/** Con router por hash, un enlace "#contenido" cambiaría de vista: se enfoca a mano. */
function skipToContent(event: MouseEvent<HTMLAnchorElement>) {
  event.preventDefault()
  document.getElementById('contenido')?.focus()
}

function Workspace() {
  const route = useRoute()
  const [theme, toggleTheme] = useTheme()
  return (
    <div className={styles.shell}>
      <SideNav route={route} />
      <div className={styles.column}>
        <TopBar theme={theme} onToggleTheme={toggleTheme} />
        <main id="contenido" className={styles.main} tabIndex={-1}>
          <View route={route} />
        </main>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <InvestigationsProvider>
      <a className={styles.skip} href="#contenido" onClick={skipToContent}>
        Saltar al contenido
      </a>
      <Workspace />
    </InvestigationsProvider>
  )
}
