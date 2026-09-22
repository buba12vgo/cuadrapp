import { useEffect, useMemo, useState } from 'react'
import { PageHeader } from '@/components/ui/PageHeader'
import { useAcceso } from '@/contexts/AccesoContext'
import { useAgentesData } from '@/lib/agentesStore'
import { cuentasFijas, ETIQUETA_ROL_ACCESO } from '@/lib/acceso'
import { isDesignPreview } from '@/lib/designPreview'
import { esRolCuadranteJefes, ROL_LABEL } from '@/lib/rolesCuadrante'
import {
  crearUsuarioConsulta,
  listarUsuariosAcceso,
  mensajeErrorAuth,
  type UsuarioAccesoDoc,
} from '@/lib/usuariosAcceso'
import {
  ALERT_ERROR,
  ALERT_INFO,
  BLOQUE,
  BTN_PRIMARY,
  CAMPO,
  PAGE_SECTION,
  TABLE,
  TD,
  TH,
  TITULO_BLOQUE,
} from '@/lib/uiStyles'

export function UsuariosPage() {
  const acceso = useAcceso()
  const [agentes] = useAgentesData()
  const [usuarios, setUsuarios] = useState<UsuarioAccesoDoc[]>([])
  const [agenteId, setAgenteId] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)

  const jefes = useMemo(
    () => agentes.filter((agente) => esRolCuadranteJefes(agente.rolBase)),
    [agentes],
  )

  useEffect(() => {
    let cancelado = false
    void listarUsuariosAcceso()
      .then((lista) => {
        if (!cancelado) setUsuarios(lista)
      })
      .catch((err) => {
        if (!cancelado) setError(mensajeErrorAuth(err))
      })
    return () => {
      cancelado = true
    }
  }, [])

  const porPlaca = useMemo(() => {
    const mapa = new Map<string, UsuarioAccesoDoc>()
    for (const usuario of usuarios) mapa.set(usuario.numeroPlaca, usuario)
    return mapa
  }, [usuarios])

  async function alta(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    setAviso(null)
    const agente = jefes.find((item) => item.id === agenteId)
    if (!agente) {
      setError('Elige un jefe de servicio o un responsable.')
      return
    }
    if (acceso.perfil?.rol !== 'SUPERADMIN') {
      setError('Solo el superadmin puede dar de alta usuarios.')
      return
    }
    setGuardando(true)
    try {
      const creado = await crearUsuarioConsulta({
        email,
        password,
        numeroPlaca: agente.numeroPlaca,
        agenteId: agente.id,
        nombre: `${agente.nombre} ${agente.apellidos}`.trim(),
      })
      setUsuarios((actual) => {
        const sinEste = actual.filter((item) => item.agenteId !== creado.agenteId)
        return [...sinEste, creado].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
      })
      setAviso(
        isDesignPreview
          ? `Vista previa: ${creado.nombre} quedaría con ${creado.email}. En producción se crea la cuenta de Firebase y le pasas la contraseña temporal.`
          : `Cuenta creada para ${creado.nombre} (${creado.email}). Pásale la contraseña temporal; la cambia en Opciones.`,
      )
      setEmail('')
      setPassword('')
    } catch (err) {
      setError(mensajeErrorAuth(err))
    } finally {
      setGuardando(false)
    }
  }

  if (acceso.perfil && acceso.perfil.rol !== 'SUPERADMIN') {
    return (
      <section className={PAGE_SECTION}>
        <PageHeader title="Usuarios" subtitle="Solo el superadmin gestiona las cuentas" />
        <p className={ALERT_INFO}>No tienes permiso para dar de alta usuarios.</p>
      </section>
    )
  }

  return (
    <section className={PAGE_SECTION}>
      <PageHeader
        title="Usuarios"
        subtitle="Cuentas de consulta para jefes de servicio y responsables"
      />
      <div className="min-h-0 flex-1 overflow-auto">
        <div className="flex flex-col gap-3">
          <p className={ALERT_INFO}>
            Tú (placa 102, buba12@gmail.com) eres superadmin. Jonathan (placa 108,
            jonymivi@gmail.com) es admin. Al resto de jefes les creas aquí un correo
            y una contraseña temporal. Entran en el login y la cambian en Opciones.
            Más adelante el mismo alta servirá para policía, jefe de equipo y bolsa.
          </p>
          {isDesignPreview ? (
            <p className="text-sm text-slate-500">
              Vista previa: el alta no llama a Firebase. Sirve para revisar el flujo.
            </p>
          ) : null}

          <section className={BLOQUE}>
            <h2 className={TITULO_BLOQUE}>Cuentas fijas</h2>
            <table className={TABLE}>
              <thead>
                <tr>
                  <th className={TH}>Placa</th>
                  <th className={TH}>Nombre</th>
                  <th className={TH}>Correo</th>
                  <th className={TH}>Rol</th>
                </tr>
              </thead>
              <tbody>
                {cuentasFijas().map((cuenta) => (
                  <tr key={cuenta.email}>
                    <td className={TD}>{cuenta.numeroPlaca}</td>
                    <td className={`${TD} font-medium`}>{cuenta.nombre}</td>
                    <td className={TD}>{cuenta.email}</td>
                    <td className={TD}>{ETIQUETA_ROL_ACCESO[cuenta.rol]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-2 text-sm text-slate-500">
              Jonathan también entra con jony.mivi@gmail.com, el correo que ya estaba
              autorizado.
            </p>
          </section>

          <section className={BLOQUE}>
            <h2 className={TITULO_BLOQUE}>Dar de alta un jefe</h2>
            <form className="grid gap-2 sm:grid-cols-2" onSubmit={(event) => void alta(event)}>
              <label className="flex flex-col gap-0.5 sm:col-span-2">
                <span className="text-sm font-semibold text-slate-600">Agente</span>
                <select
                  className={`${CAMPO} w-full`}
                  value={agenteId}
                  onChange={(event) => setAgenteId(event.target.value)}
                  required
                >
                  <option value="">Elige jefe o responsable</option>
                  {jefes.map((agente) => (
                    <option key={agente.id} value={agente.id}>
                      {agente.numeroPlaca} · {agente.apellidos}, {agente.nombre} (
                      {ROL_LABEL[agente.rolBase]})
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-0.5">
                <span className="text-sm font-semibold text-slate-600">Correo</span>
                <input
                  type="email"
                  className={`${CAMPO} w-full`}
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                />
              </label>
              <label className="flex flex-col gap-0.5">
                <span className="text-sm font-semibold text-slate-600">
                  Contraseña temporal
                </span>
                <input
                  type="text"
                  className={`${CAMPO} w-full`}
                  value={password}
                  minLength={8}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                />
              </label>
              <div className="sm:col-span-2">
                <button type="submit" className={BTN_PRIMARY} disabled={guardando}>
                  {guardando ? 'Creando…' : 'Crear usuario de consulta'}
                </button>
              </div>
            </form>
            {aviso ? <p className="mt-2 text-sm text-emerald-800">{aviso}</p> : null}
            {error ? <p className={`${ALERT_ERROR} mt-2`}>{error}</p> : null}
          </section>

          <section className={BLOQUE}>
            <h2 className={TITULO_BLOQUE}>Jefes y responsables</h2>
            <table className={TABLE}>
              <thead>
                <tr>
                  <th className={TH}>Placa</th>
                  <th className={TH}>Nombre</th>
                  <th className={TH}>Puesto</th>
                  <th className={TH}>Acceso</th>
                </tr>
              </thead>
              <tbody>
                {jefes.map((agente) => {
                  const usuario = porPlaca.get(agente.numeroPlaca)
                  return (
                    <tr key={agente.id}>
                      <td className={TD}>{agente.numeroPlaca}</td>
                      <td className={`${TD} font-medium`}>
                        {agente.apellidos}, {agente.nombre}
                      </td>
                      <td className={TD}>{ROL_LABEL[agente.rolBase]}</td>
                      <td className={TD}>
                        {usuario
                          ? `${usuario.email} · consulta`
                          : 'Sin usuario'}
                      </td>
                    </tr>
                  )
                })}
                {jefes.length === 0 ? (
                  <tr>
                    <td className={`${TD} text-slate-500`} colSpan={4}>
                      No hay jefes de servicio ni responsables en la plantilla cargada.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </section>
        </div>
      </div>
    </section>
  )
}
