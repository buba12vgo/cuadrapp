import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from 'react'
import { BTN_DANGER, BTN_GHOST, BTN_PRIMARY } from '@/lib/uiStyles'
import { Modal } from '@/components/ui/Modal'

type DialogApi = {
  alert: (message: ReactNode, title?: string) => Promise<void>
  confirm: (message: ReactNode, title?: string, danger?: boolean) => Promise<boolean>
}

type DialogState = {
  kind: 'alert' | 'confirm'
  title: string
  message: ReactNode
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
  resolve: (value: boolean) => void
}

const AppDialogContext = createContext<DialogApi | null>(null)

function useDialogState() {
  const [dialog, setDialog] = useState<DialogState | null>(null)

  const alert = useCallback((message: ReactNode, title = 'Aviso') => {
    return new Promise<void>((resolve) => {
      setDialog({
        kind: 'alert',
        title,
        message,
        confirmLabel: 'Entendido',
        resolve: () => {
          setDialog(null)
          resolve()
        },
      })
    })
  }, [])

  const confirm = useCallback(
    (message: ReactNode, title = 'Confirmar', danger = false) => {
      return new Promise<boolean>((resolve) => {
        setDialog({
          kind: 'confirm',
          title,
          message,
          danger,
          confirmLabel: danger ? 'Eliminar' : 'Aceptar',
          cancelLabel: 'Cancelar',
          resolve: (value) => {
            setDialog(null)
            resolve(value)
          },
        })
      })
    },
    [],
  )

  const dialogNode = dialog ? (
    <Modal
      title={dialog.title}
      size="sm"
      onClose={() => dialog.resolve(dialog.kind === 'alert')}
      footer={
        <>
          {dialog.kind === 'confirm' ? (
            <button
              type="button"
              className={BTN_GHOST}
              onClick={() => dialog.resolve(false)}
            >
              {dialog.cancelLabel}
            </button>
          ) : null}
          <button
            type="button"
            className={dialog.danger ? BTN_DANGER : BTN_PRIMARY}
            onClick={() => dialog.resolve(true)}
          >
            {dialog.confirmLabel}
          </button>
        </>
      }
    >
      <p className="whitespace-pre-wrap leading-relaxed">{dialog.message}</p>
    </Modal>
  ) : null

  return { alert, confirm, dialogNode }
}

export function AppDialogProvider({ children }: { children: ReactNode }) {
  const { alert, confirm, dialogNode } = useDialogState()
  return (
    <AppDialogContext.Provider value={{ alert, confirm }}>
      {children}
      {dialogNode}
    </AppDialogContext.Provider>
  )
}

export function useAppDialog() {
  const ctx = useContext(AppDialogContext)
  if (!ctx) {
    throw new Error('useAppDialog debe usarse dentro de AppDialogProvider')
  }
  return ctx
}

/** Hook local para páginas fuera del layout admin. */
export function useLocalAppDialog() {
  return useDialogState()
}
