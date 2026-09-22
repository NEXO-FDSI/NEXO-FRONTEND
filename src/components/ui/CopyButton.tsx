import { Check, Copy } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button } from './Button'

interface CopyButtonProps {
  text: string
  label: string
}

export function CopyButton({ text, label }: CopyButtonProps) {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle')

  useEffect(() => {
    if (state === 'idle') return
    const timer = setTimeout(() => setState('idle'), 2000)
    return () => clearTimeout(timer)
  }, [state])

  async function copy() {
    try {
      await navigator.clipboard.writeText(text)
      setState('copied')
    } catch {
      setState('failed')
    }
  }

  const feedback = { idle: '', copied: 'Copiado', failed: 'No se pudo copiar' }[state]
  return (
    <Button
      size="sm"
      variant="ghost"
      onClick={copy}
      icon={state === 'copied' ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
      aria-label={label}
    >
      <span aria-live="polite">{feedback}</span>
    </Button>
  )
}
