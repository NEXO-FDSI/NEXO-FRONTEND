import { CaseDetail } from './components/case/CaseDetail'
import { KpiStrip } from './components/dashboard/KpiStrip'
import { Welcome } from './components/dashboard/Welcome'
import { ErrorBoundary } from './components/ErrorBoundary'
import { TopBar } from './components/layout/TopBar'
import { CaseList } from './components/sidebar/CaseList'
import { IndicatorForm } from './components/sidebar/IndicatorForm'
import { useInvestigations } from './state/InvestigationsContext'
import { InvestigationsProvider } from './state/InvestigationsProvider'
import styles from './App.module.css'

function Workspace() {
  const { selected } = useInvestigations()
  return (
    <div className={styles.layout}>
      <aside className={styles.sidebar} aria-label="Registro e historial de indicadores">
        <IndicatorForm />
        <CaseList />
      </aside>
      <main id="case-detail" className={styles.main} tabIndex={-1}>
        <KpiStrip />
        <ErrorBoundary key={selected?.indicator.id}>
          {selected ? <CaseDetail key={selected.indicator.id} inv={selected} /> : <Welcome />}
        </ErrorBoundary>
      </main>
    </div>
  )
}

export default function App() {
  return (
    <InvestigationsProvider>
      <a className={styles.skip} href="#case-detail">
        Saltar al detalle de la investigación
      </a>
      <TopBar />
      <Workspace />
    </InvestigationsProvider>
  )
}
