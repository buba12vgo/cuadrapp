/** Canal de suscripción para stores de módulo leídos con `useSyncExternalStore`. */
export function crearCanalStore() {
  const listeners = new Set<() => void>()
  return {
    subscribe(listener: () => void) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    emit() {
      for (const listener of listeners) listener()
    },
  }
}
