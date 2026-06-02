import { useCallback, useEffect, useRef, useState } from 'react'

const TICK_MS = 100

export function useTimer() {
  const [elapsedMs, setElapsedMs] = useState(0)
  const [running, setRunning] = useState(false)
  const startRef = useRef(0)

  useEffect(() => {
    if (!running) {
      return undefined
    }

    const interval = window.setInterval(() => {
      setElapsedMs(performance.now() - startRef.current)
    }, TICK_MS)

    return () => window.clearInterval(interval)
  }, [running])

  const start = useCallback(() => {
    startRef.current = performance.now()
    setElapsedMs(0)
    setRunning(true)
  }, [])

  const stop = useCallback(() => {
    const finalElapsed = running ? performance.now() - startRef.current : elapsedMs
    setElapsedMs(finalElapsed)
    setRunning(false)
    return finalElapsed
  }, [elapsedMs, running])

  const reset = useCallback(() => {
    setElapsedMs(0)
    setRunning(false)
    startRef.current = 0
  }, [])

  return {
    elapsedMs,
    elapsedSeconds: elapsedMs / 1000,
    running,
    start,
    stop,
    reset,
  }
}
