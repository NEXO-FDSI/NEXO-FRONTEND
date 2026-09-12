import { useEffect, useState } from 'react'
import './App.css'

function App() {
  const [status, setStatus] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch(`${import.meta.env.VITE_API_URL}/health`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then((data) => setStatus(data.status))
      .catch((e) => setError(String(e.message ?? e)))
  }, [])

  return (
    <>
      <h1>NEXO</h1>
      {error ? (
        <p>Backend unreachable at {import.meta.env.VITE_API_URL}: {error}</p>
      ) : (
        <p>Backend status: {status ?? 'loading...'}</p>
      )}
    </>
  )
}

export default App
