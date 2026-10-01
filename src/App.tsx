import { ChevronRight, FolderSearch } from 'lucide-react'
import type { MouseEvent } from 'react'
import { CaseDetail } from './components/case/CaseDetail'
import { KpiStrip } from './components/dashboard/KpiStrip'
import { Welcome } from './components/dashboard/Welcome'
import { ErrorBoundary } from './components/ErrorBoundary'
import { SideNav } from './components/layout/SideNav'
import { TopBar } from './components/layout/TopBar'
import { CaseList } from './components/sidebar/CaseList'
import { IndicatorForm } from './components/sidebar/IndicatorForm'
import { EmptyState } from './components/ui/EmptyState'
import { truncateMiddle } from './domain/format'
import { rutas, useRoute, type Route } from './hooks/useRoute'
import { useTheme } from './hooks/useTheme'
import { useInvestigations } from './state/InvestigationsContext'
import { InvestigationsProvider } from './state/InvestigationsProvider'
import styles from './App.module.css'

function InvestigationPage({ id }: { id: number }) {
  const inv = useInvestigations().items.find((i) => i.indicator.id === id)
  if (!inv) {
    return (
      <EmptyState icon={<FolderSearch />} title={`La investigación #${id} no está en este navegador`}>
        <p>
          El backend no expone consultas: solo se ven las investigaciones registradas desde este navegador.{' '}
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
      return <InvestigationPage id={route.id} />
    case 'panel':
      return (
        <>
          <KpiStrip />
          <Welcome />
        </>
      )
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
