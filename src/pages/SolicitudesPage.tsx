import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { CalendarioSolicitudPermiso } from '@/components/CalendarioSolicitudPermiso'
import { ListaCambiosDia } from '@/components/ListaCambiosDia'
import { PageHeader } from '@/components/ui/PageHeader'
import { useAppDialog } from '@/components/ui/ConfirmDialog'
import { useAcceso } from '@/contexts/AccesoContext'
import { agenteDelPerfil } from '@/lib/agenteSesion'
import { useAgentesData } from '@/lib/agentesStore'
import { diasDelMes } from '@/lib/convenio'
import { saldosPermisoAgente } from '@/lib/cuposPermiso'
import {
  getCuadrante,
  getCuadranteJefes,
  guardarSolicitud,
  listarSolicitudes,
  saveCuadrante,
  saveCuadranteJefes,
} from '@/lib/db'
import { isDesignPreview } from '@/lib/designPreview'
import { isFirebaseReady } from '@/lib/firebase'
import {
  cuadranteDesdeFirestore,
  cuadranteParaFirestore,
} from '@/lib/cuadranteFirestore'
import { permisoEsVisible, permisoRequiereSaldo } from '@/lib/permisos'
import { useTiposPermiso } from '@/lib/permisosStore'
import { esRolCuadranteJefes } from '@/lib/rolesCuadrante'
import {
  aplicarCambioDiaEnCuadrante,
  aplicarPermisoEnCuadrante,
  cambioDiaValidado,
  contextoCobertura,
  ETIQUETA_TIPO,
  etiquetaEstadoSolicitud,
  etiquetaTurnoServicio,
  ordenarSolicitudes,
  TIPOS_SOLICITUD,
  type CompaneroCobertura,
  type Solicitud,
  type TipoSolicitud,
} from '@/lib/solicitudes'
import { useSaldosPermisosAnio } from '@/lib/useSaldosPermisosAnio'
import {
  ALERT_ERROR,
  ALERT_INFO,
  BTN_GHOST,
  BTN_PRIMARY,
  CAMPO,
  FOCUS_RING,
  PAGE_SECTION,
  TABLE,
  TD,
  TH,
} from '@/lib/uiStyles'

const CAMPO_FECHA = `${CAMPO} h-9`

function hoyIso() {
  const hoy = new Date()
  const mes = String(hoy.getMonth() + 1).padStart(2, '0')
  const dia = String(hoy.getDate()).padStart(2, '0')
  return `${hoy.getFullYear()}-${mes}-${dia}`
}

function mesDe(iso: string) {
  return iso.slice(0, 7)
}

function semillaPreview(): Solicitud[] {
  const hoy = hoyIso()
  const [anio, mes] = hoy.split('-')
  const compensa = `${anio}-${mes}-02`
  return [
    {
      id: 'sol-preview-permiso',
      tipo: 'PERMISO',
      estado: 'PENDIENTE',
      agenteId: 'ag-003',
      placa: '1108',
      nombreAgente: '1108 Xoán Pérez Otero',
      fecha: hoy,
      permisoCodigo: 'ASUNTOS_PROPIOS',
      permisoNombre: 'Asuntos propios',
      creadaEn: new Date().toISOString(),
    },
    {
      id: 'sol-preview-cambio',
      tipo: 'CAMBIO_DIA',
      estado: 'PENDIENTE',
      validacionCompanero: 'PENDIENTE',
      agenteId: 'ag-003',
      placa: '1108',
      nombreAgente: '1108 Xoán Pérez Otero',
      fecha: hoy,
      fechaFin: compensa === hoy ? `${anio}-${mes}-03` : compensa,
      companeroId: 'ag-001',
      companeroNombre: '1001 Elena Vázquez Souto',
      turno: 'M',
      creadaEn: new Date().toISOString(),
    },
  ]
}

function delAgente(item: Solicitud, agenteId: string | undefined) {
  return item.agenteId === agenteId || item.companeroId === agenteId
}

function pendienteDeCompanero(solicitud: Solicitud) {
  return (
    solicitud.tipo === 'CAMBIO_DIA' &&
    solicitud.estado === 'PENDIENTE' &&
    solicitud.validacionCompanero === 'PENDIENTE'
  )
}

let memoriaPreview: Solicitud[] | null = null

function leerMemoria() {
  if (!memoriaPreview) {
    memoriaPreview = isDesignPreview ? semillaPreview() : []
  }
  return memoriaPreview
}

function resumenPedido(solicitud: Solicitud) {
  if (solicitud.tipo === 'PERMISO') return solicitud.permisoNombre ?? 'Permiso'
  if (solicitud.tipo === 'CAMBIO_DIA') {
    const cambio = solicitud.fechaFin ? `${solicitud.fecha} → ${solicitud.fechaFin}` : solicitud.fecha
    return solicitud.companeroNombre ? `${cambio} · ${solicitud.companeroNombre}` : cambio
  }
  if (solicitud.tipo === 'CAMBIO_MES') {
    return solicitud.mesDestino
      ? `${mesDe(solicitud.fecha)} → ${solicitud.mesDestino}`
      : mesDe(solicitud.fecha)
  }
  if (solicitud.fechaFin) return `${solicitud.fecha} → ${solicitud.fechaFin}`
  return solicitud.fecha
}

export function SolicitudesPage() {
  const { alert, confirm } = useAppDialog()
  const { perfil } = useAcceso()
  const [agentes] = useAgentesData()
  const [permisos] = useTiposPermiso()
  const [solicitudes, setSolicitudes] = useState<Solicitud[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tipo, setTipo] = useState<TipoSolicitud>('PERMISO')
  const [fecha, setFecha] = useState(hoyIso)
  const [fechaFin, setFechaFin] = useState('')
  const [companeroId, setCompaneroId] = useState('')
  const [companeroNombre, setCompaneroNombre] = useState('')
  const [turnoCambio, setTurnoCambio] = useState('')
  const [mesDestino, setMesDestino] = useState('')
  const [detalle, setDetalle] = useState('')
  const [permisoCodigo, setPermisoCodigo] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [aceptando, setAceptando] = useState<string | null>(null)
  const [cobertura, setCobertura] = useState('NO_CUBRIR')
  const [candidatos, setCandidatos] = useState<CompaneroCobertura[]>([])
  const [puestoLibre, setPuestoLibre] = useState<string | null>(null)
  const [turnoLibre, setTurnoLibre] = useState<string | null>(null)
  const firebaseOk = isFirebaseReady()
  const esSuperadmin = perfil?.rol === 'SUPERADMIN'
  const esAdmin = perfil?.rol === 'ADMIN'
  const veBandeja = esSuperadmin || esAdmin
  const agente = useMemo(
    () => agenteDelPerfil(agentes, perfil),
    [agentes, perfil],
  )
  const anio = Number(fecha.slice(0, 4)) || new Date().getFullYear()
  const { resumenes } = useSaldosPermisosAnio(agente ? [agente] : [], anio)
  const resumen = agente ? resumenes[agente.id] : undefined
  const saldos = useMemo(() => {
    if (!agente || !resumen) return []
    return saldosPermisoAgente(agente, permisos, anio, resumen)
  }, [agente, anio, permisos, resumen])

  const propias = useMemo(
    () => solicitudes.filter((item) => !agente || item.agenteId === agente.id),
    [solicitudes, agente],
  )
  const pendientesMismoConcepto = useMemo(() => {
    const mapa = new Map<string, number>()
    for (const item of propias) {
      if (item.estado !== 'PENDIENTE' || item.tipo !== 'PERMISO' || !item.permisoCodigo) {
        continue
      }
      if (!item.fecha.startsWith(String(anio))) continue
      mapa.set(item.permisoCodigo, (mapa.get(item.permisoCodigo) ?? 0) + 1)
    }
    return mapa
  }, [propias, anio])

  const conceptos = useMemo(() => {
    return permisos.filter(permisoEsVisible).flatMap((permiso) => {
      const saldo = saldos.find((item) => item.codigo === permiso.codigo)
      const exige = permisoRequiereSaldo(permiso)
      const reservados = pendientesMismoConcepto.get(permiso.codigo) ?? 0
      const restan =
        saldo?.restan == null ? null : saldo.restan - reservados
      if (exige && (restan == null || restan <= 0)) return []
      return [
        {
          codigo: permiso.codigo,
          nombre: permiso.nombre,
          exige,
          restan,
        },
      ]
    })
  }, [permisos, saldos, pendientesMismoConcepto])

  useEffect(() => {
    let cancelado = false
    async function cargar() {
      setCargando(true)
      setError(null)
      try {
        const lista = firebaseOk
          ? await listarSolicitudes(veBandeja ? undefined : agente?.id)
          : ordenarSolicitudes(
              veBandeja
                ? leerMemoria()
                : leerMemoria().filter((item) => delAgente(item, agente?.id)),
            )
        if (!cancelado) setSolicitudes(lista)
      } catch (err) {
        if (!cancelado) {
          setError(err instanceof Error ? err.message : 'No se pudieron cargar las solicitudes')
        }
      } finally {
        if (!cancelado) setCargando(false)
      }
    }
    if (!veBandeja && firebaseOk && !agente) {
      setCargando(false)
      setSolicitudes([])
      return
    }
    void cargar()
    return () => {
      cancelado = true
    }
  }, [agente, firebaseOk, veBandeja])

  async function recordar(siguiente: Solicitud) {
    if (firebaseOk) {
      const guardada = await guardarSolicitud(siguiente)
      setSolicitudes((actual) =>
        ordenarSolicitudes([
          ...actual.filter((item) => item.id !== guardada.id),
          guardada,
        ]),
      )
      return guardada
    }
    const memoria = leerMemoria().filter((item) => item.id !== siguiente.id)
    memoria.push(siguiente)
    memoriaPreview = ordenarSolicitudes(memoria)
    setSolicitudes(
      veBandeja
        ? memoriaPreview
        : memoriaPreview.filter((item) => delAgente(item, agente?.id)),
    )
    return siguiente
  }

  async function enviar(event: FormEvent) {
    event.preventDefault()
    if (!agente || veBandeja) return
    if (!fecha) {
      setError('Elige el día.')
      return
    }
    if (tipo === 'PERMISO' && !permisoCodigo) {
      setError('Elige el concepto del permiso.')
      return
    }
    if (tipo === 'CAMBIO_DIA' && (!fechaFin || !companeroId)) {
      setError('Elige el día que compensas y el compañero.')
      return
    }
    if (tipo === 'CAMBIO_MES' && !mesDestino) {
      setError('Elige el mes que propones.')
      return
    }
    if (tipo === 'VACACIONES' && !fechaFin) {
      setError('Elige el fin del periodo.')
      return
    }
    const concepto = conceptos.find((item) => item.codigo === permisoCodigo)
    if (tipo === 'PERMISO' && !concepto) {
      setError('Ese concepto no tiene saldo o no se puede pedir.')
      return
    }
    const repetida = solicitudes.some(
      (item) =>
        item.estado === 'PENDIENTE' &&
        item.agenteId === agente.id &&
        item.tipo === tipo &&
        item.fecha === (tipo === 'CAMBIO_MES' ? `${fecha}-01` : fecha) &&
        (tipo !== 'PERMISO' || item.permisoCodigo === permisoCodigo) &&
        (tipo !== 'CAMBIO_DIA' || item.companeroId === companeroId),
    )
    if (repetida) {
      setError('Ya tienes una solicitud pendiente igual.')
      return
    }
    const fechaSolicitud = tipo === 'CAMBIO_MES' ? `${fecha}-01` : fecha
    const solicitud: Solicitud = {
      id: `sol-${crypto.randomUUID()}`,
      tipo,
      estado: 'PENDIENTE',
      agenteId: agente.id,
      placa: agente.numeroPlaca,
      nombreAgente: `${agente.numeroPlaca} ${agente.nombre} ${agente.apellidos}`.trim(),
      fecha: fechaSolicitud,
      creadaEn: new Date().toISOString(),
      detalle: detalle.trim() || undefined,
      permisoCodigo: tipo === 'PERMISO' ? concepto?.codigo : undefined,
      permisoNombre: tipo === 'PERMISO' ? concepto?.nombre : undefined,
      fechaFin: tipo === 'CAMBIO_MES' ? undefined : fechaFin || undefined,
      mesDestino: tipo === 'CAMBIO_MES' ? mesDestino : undefined,
      companeroId: tipo === 'CAMBIO_DIA' ? companeroId : undefined,
      companeroNombre: tipo === 'CAMBIO_DIA' ? companeroNombre : undefined,
      turno: tipo === 'CAMBIO_DIA' ? turnoCambio : undefined,
      validacionCompanero: tipo === 'CAMBIO_DIA' ? 'PENDIENTE' : undefined,
    }
    setEnviando(true)
    setError(null)
    try {
      await recordar(solicitud)
      setDetalle('')
      setPermisoCodigo('')
      setFechaFin('')
      setCompaneroId('')
      setCompaneroNombre('')
      setTurnoCambio('')
      await alert(
        tipo === 'CAMBIO_DIA'
          ? 'La solicitud queda pendiente de que el compañero la valide.'
          : 'La solicitud queda pendiente de que el superadmin la resuelva.',
        'Enviada',
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo enviar la solicitud')
    } finally {
      setEnviando(false)
    }
  }

  async function abrirAceptar(solicitud: Solicitud) {
    setAceptando(solicitud.id)
    setCobertura('NO_CUBRIR')
    setCandidatos([])
    setPuestoLibre(null)
    setTurnoLibre(null)
    if (solicitud.tipo !== 'PERMISO') return
    const [anioDia, mesDia, dia] = solicitud.fecha.split('-').map(Number)
    if (!anioDia || !mesDia || !dia) return
    const ficha = agentes.find((item) => item.id === solicitud.agenteId)
    const jefes = ficha ? esRolCuadranteJefes(ficha.rolBase) : false
    const grupo = agentes.filter((item) =>
      jefes ? esRolCuadranteJefes(item.rolBase) : !esRolCuadranteJefes(item.rolBase),
    )
    const nombres = new Map(
      grupo.map((item) => [
        item.id,
        {
          placa: item.numeroPlaca,
          nombre: `${item.nombre} ${item.apellidos}`.trim(),
        },
      ]),
    )
    if (!firebaseOk) {
      const puestos = ['Centro de Control', 'Lonjas', 'Berbés Acceso']
      const demo = agentes
        .filter((item) => item.id !== solicitud.agenteId)
        .slice(0, 6)
        .map((item, indice) => ({
          id: item.id,
          placa: item.numeroPlaca,
          nombre: `${item.nombre} ${item.apellidos}`.trim(),
          puesto: puestos[indice % puestos.length]!,
        }))
      setPuestoLibre('Centro de Control')
      setTurnoLibre('M')
      setCandidatos(demo)
      return
    }
    try {
      const datos = jefes
        ? await getCuadranteJefes(mesDia, anioDia)
        : await getCuadrante(mesDia, anioDia)
      if (!datos) return
      const leido = cuadranteDesdeFirestore(
        datos,
        grupo,
        anioDia,
        mesDia,
        diasDelMes(anioDia, mesDia),
        jefes ? { migrarLibranzaAPermiso: true } : {},
      )
      const contexto = contextoCobertura({
        cuadrante: leido.cuadrante,
        asignaciones: leido.asignaciones,
        fecha: solicitud.fecha,
        dia,
        agenteId: solicitud.agenteId,
        nombres,
      })
      setTurnoLibre(contexto.turno)
      setPuestoLibre(contexto.puestoLibre)
      setCandidatos(contexto.candidatos)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo leer el cuadrante')
    }
  }

  async function confirmarAceptar(solicitud: Solicitud) {
    if (!esSuperadmin) return
    if (!cambioDiaValidado(solicitud)) {
      setError('El compañero todavía no ha validado el cambio.')
      return
    }
    setEnviando(true)
    setError(null)
    try {
      if (solicitud.tipo === 'PERMISO' && firebaseOk) {
        const [anioDia, mesDia, dia] = solicitud.fecha.split('-').map(Number)
        const ficha = agentes.find((item) => item.id === solicitud.agenteId)
        const jefes = ficha ? esRolCuadranteJefes(ficha.rolBase) : false
        const grupo = agentes.filter((item) =>
          jefes ? esRolCuadranteJefes(item.rolBase) : !esRolCuadranteJefes(item.rolBase),
        )
        const datos = jefes
          ? await getCuadranteJefes(mesDia!, anioDia!)
          : await getCuadrante(mesDia!, anioDia!)
        if (!datos) {
          throw new Error('No hay cuadrante de ese mes para aplicar el permiso.')
        }
        const leido = cuadranteDesdeFirestore(
          datos,
          grupo,
          anioDia!,
          mesDia!,
          diasDelMes(anioDia!, mesDia!),
          jefes ? { migrarLibranzaAPermiso: true } : {},
        )
        const aplicado = aplicarPermisoEnCuadrante({
          cuadrante: leido.cuadrante,
          asignaciones: leido.asignaciones,
          fecha: solicitud.fecha,
          dia: dia!,
          agenteId: solicitud.agenteId,
          permisoNombre: solicitud.permisoNombre ?? 'Permiso',
          coberturaId: cobertura === 'NO_CUBRIR' ? null : cobertura,
        })
        const payload = cuadranteParaFirestore(
          aplicado.cuadrante,
          aplicado.asignaciones,
          grupo,
          anioDia!,
          mesDia!,
          diasDelMes(anioDia!, mesDia!),
          jefes ? { migrarLibranzaAPermiso: true } : {},
        )
        if (jefes) await saveCuadranteJefes(mesDia!, anioDia!, payload)
        else await saveCuadrante(mesDia!, anioDia!, payload)
      }
      if (
        solicitud.tipo === 'CAMBIO_DIA' &&
        firebaseOk &&
        solicitud.fechaFin &&
        solicitud.companeroId
      ) {
        const [anioDia, mesDia] = solicitud.fecha.split('-').map(Number)
        const ficha = agentes.find((item) => item.id === solicitud.agenteId)
        const jefes = ficha ? esRolCuadranteJefes(ficha.rolBase) : false
        const grupo = agentes.filter((item) =>
          jefes ? esRolCuadranteJefes(item.rolBase) : !esRolCuadranteJefes(item.rolBase),
        )
        const datos = jefes
          ? await getCuadranteJefes(mesDia!, anioDia!)
          : await getCuadrante(mesDia!, anioDia!)
        if (!datos) {
          throw new Error('No hay cuadrante de ese mes para aplicar el cambio.')
        }
        const leido = cuadranteDesdeFirestore(
          datos,
          grupo,
          anioDia!,
          mesDia!,
          diasDelMes(anioDia!, mesDia!),
          jefes ? { migrarLibranzaAPermiso: true } : {},
        )
        const aplicado = aplicarCambioDiaEnCuadrante({
          cuadrante: leido.cuadrante,
          asignaciones: leido.asignaciones,
          agenteId: solicitud.agenteId,
          companeroId: solicitud.companeroId,
          fechaLibre: solicitud.fecha,
          fechaCompensa: solicitud.fechaFin,
        })
        const payload = cuadranteParaFirestore(
          aplicado.cuadrante,
          aplicado.asignaciones,
          grupo,
          anioDia!,
          mesDia!,
          diasDelMes(anioDia!, mesDia!),
          jefes ? { migrarLibranzaAPermiso: true } : {},
        )
        if (jefes) await saveCuadranteJefes(mesDia!, anioDia!, payload)
        else await saveCuadrante(mesDia!, anioDia!, payload)
      }
      const elegido = candidatos.find((item) => item.id === cobertura)
      await recordar({
        ...solicitud,
        estado: 'ACEPTADA',
        resueltaEn: new Date().toISOString(),
        cobertura: solicitud.tipo === 'PERMISO' ? cobertura : solicitud.cobertura,
        coberturaNombre:
          solicitud.tipo === 'PERMISO'
            ? cobertura === 'NO_CUBRIR'
              ? 'No cubrir'
              : elegido
                ? `${elegido.placa} ${elegido.nombre}`
                : undefined
            : solicitud.coberturaNombre,
      })
      setAceptando(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo aceptar la solicitud')
    } finally {
      setEnviando(false)
    }
  }

  async function validarCompanero(solicitud: Solicitud) {
    if (agente?.id !== solicitud.companeroId || !pendienteDeCompanero(solicitud)) return
    setEnviando(true)
    setError(null)
    try {
      await recordar({
        ...solicitud,
        validacionCompanero: 'VALIDADA',
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo validar el cambio')
    } finally {
      setEnviando(false)
    }
  }

  async function rechazarCompanero(solicitud: Solicitud) {
    if (agente?.id !== solicitud.companeroId || !pendienteDeCompanero(solicitud)) return
    const ok = await confirm(
      `¿Rechazar el cambio que te pide ${solicitud.nombreAgente}?`,
      'Rechazar cambio',
      true,
    )
    if (!ok) return
    setEnviando(true)
    setError(null)
    try {
      await recordar({
        ...solicitud,
        validacionCompanero: 'RECHAZADA',
        estado: 'RECHAZADA',
        resueltaEn: new Date().toISOString(),
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo rechazar el cambio')
    } finally {
      setEnviando(false)
    }
  }

  async function rechazar(solicitud: Solicitud) {
    if (!esSuperadmin || !cambioDiaValidado(solicitud)) return
    const ok = await confirm(
      `¿Rechazar la solicitud de ${solicitud.nombreAgente}?`,
      'Rechazar solicitud',
      true,
    )
    if (!ok) return
    setEnviando(true)
    setError(null)
    try {
      await recordar({
        ...solicitud,
        estado: 'RECHAZADA',
        resueltaEn: new Date().toISOString(),
      })
      if (aceptando === solicitud.id) setAceptando(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo rechazar la solicitud')
    } finally {
      setEnviando(false)
    }
  }

  const lista = useMemo(() => {
    if (veBandeja) return solicitudes
    if (!agente) return []
    return solicitudes.filter((item) => delAgente(item, agente.id))
  }, [agente, solicitudes, veBandeja])
  const muestraAcciones =
    esSuperadmin || lista.some((item) => agente?.id === item.companeroId && pendienteDeCompanero(item))

  return (
    <section className={PAGE_SECTION}>
      <PageHeader
        title="Solicitudes"
        subtitle={
          veBandeja
            ? 'Peticiones de la plantilla, por día y por fecha de solicitud'
            : 'Peticiones de permiso, cambios de días, de mes y de vacaciones'
        }
      />
      {error ? <p className={ALERT_ERROR}>{error}</p> : null}
      {!firebaseOk ? (
        <p className={ALERT_INFO}>
          Sin Firestore las solicitudes se ven en esta sesión, pero no se guardan en el servidor.
        </p>
      ) : null}
      {!veBandeja && !agente ? (
        <p className={ALERT_INFO}>Tu usuario no está vinculado a un agente.</p>
      ) : null}

      {!veBandeja && agente ? (
        <form className="flex flex-col gap-3" onSubmit={(event) => void enviar(event)}>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {TIPOS_SOLICITUD.map((item) => (
              <button
                key={item.tipo}
                type="button"
                aria-pressed={tipo === item.tipo}
                className={`rounded-xl border px-3 py-2 text-left ${FOCUS_RING} ${
                  tipo === item.tipo
                    ? 'border-brand-600 bg-brand-50'
                    : 'border-slate-200 bg-white hover:bg-slate-50'
                }`}
                onClick={() => setTipo(item.tipo)}
              >
                <span className="block text-sm font-bold text-slate-900">{item.label}</span>
                <span className="block text-xs text-slate-500">{item.hint}</span>
              </button>
            ))}
          </div>
          {tipo === 'PERMISO' ? (
            <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-3">
              <CalendarioSolicitudPermiso
                agente={agente}
                fecha={fecha}
                onElegir={setFecha}
              />
              <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600">
                Concepto
                <select
                  className={CAMPO_FECHA}
                  required
                  value={permisoCodigo}
                  onChange={(event) => setPermisoCodigo(event.target.value)}
                >
                  <option value="">Elige un concepto</option>
                  {conceptos.map((item) => (
                    <option key={item.codigo} value={item.codigo}>
                      {item.nombre}
                      {item.exige ? ` · quedan ${item.restan}` : ' · sin saldo'}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600">
                Nota
                <input
                  className={CAMPO_FECHA}
                  value={detalle}
                  onChange={(event) => setDetalle(event.target.value)}
                />
              </label>
            </div>
          ) : tipo === 'CAMBIO_DIA' ? (
            <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-3">
              <p className="text-xs font-semibold text-slate-600">
                Día que quieres librar. El compañero valida el cambio y después lo resuelve el superadmin.
              </p>
              <CalendarioSolicitudPermiso
                agente={agente}
                fecha={fecha}
                soloDiasTrabajados
                onElegir={(iso) => {
                  setFecha(iso)
                  setFechaFin('')
                  setCompaneroId('')
                  setCompaneroNombre('')
                  setTurnoCambio('')
                }}
              />
              <ListaCambiosDia
                agente={agente}
                fecha={fecha}
                fechaFin={fechaFin}
                companeroId={companeroId}
                onElegir={(opcion) => {
                  setFechaFin(opcion.fecha)
                  setCompaneroId(opcion.agenteId)
                  setCompaneroNombre(`${opcion.placa} ${opcion.nombre}`.trim())
                  setTurnoCambio(opcion.turno)
                }}
              />
              <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600">
                Nota
                <input
                  className={CAMPO_FECHA}
                  value={detalle}
                  onChange={(event) => setDetalle(event.target.value)}
                />
              </label>
            </div>
          ) : (
          <div className="grid gap-2 rounded-xl border border-slate-200 bg-white p-3 sm:grid-cols-2">
            {tipo === 'CAMBIO_MES' ? (
              <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600">
                Mes actual
                <input
                  className={CAMPO_FECHA}
                  type="month"
                  required
                  value={fecha.slice(0, 7)}
                  onChange={(event) => setFecha(event.target.value)}
                />
              </label>
            ) : (
              <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600">
                {tipo === 'VACACIONES' ? 'Desde' : 'Día a cambiar'}
                <input
                  className={CAMPO_FECHA}
                  type="date"
                  required
                  value={fecha}
                  onChange={(event) => setFecha(event.target.value)}
                />
              </label>
            )}
            {tipo === 'VACACIONES' ? (
              <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600">
                {tipo === 'VACACIONES' ? 'Hasta' : 'Día propuesto'}
                <input
                  className={CAMPO_FECHA}
                  type="date"
                  required
                  value={fechaFin}
                  onChange={(event) => setFechaFin(event.target.value)}
                />
              </label>
            ) : null}
            {tipo === 'CAMBIO_MES' ? (
              <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600">
                Mes propuesto
                <input
                  className={CAMPO_FECHA}
                  type="month"
                  required
                  value={mesDestino}
                  onChange={(event) => setMesDestino(event.target.value)}
                />
              </label>
            ) : null}
            <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600 sm:col-span-2">
              Nota
              <input
                className={CAMPO_FECHA}
                value={detalle}
                onChange={(event) => setDetalle(event.target.value)}
              />
            </label>
          </div>
          )}
          <div>
            <button type="submit" className={BTN_PRIMARY} disabled={enviando}>
              {enviando ? 'Enviando…' : 'Enviar solicitud'}
            </button>
          </div>
        </form>
      ) : null}

      <div className="min-h-0 flex-1 overflow-auto rounded-xl border border-slate-200 bg-white">
        {cargando ? <p className="px-3 py-4 text-sm text-slate-500">Cargando solicitudes…</p> : null}
        {!cargando && lista.length === 0 ? (
          <p className="px-3 py-4 text-sm text-slate-500">No hay solicitudes.</p>
        ) : null}
        {lista.length > 0 ? (
          <table className={TABLE}>
            <thead className="sticky top-0 z-10 bg-slate-50">
              <tr>
                <th className={TH}>Día</th>
                <th className={TH}>Tipo</th>
                <th className={TH}>Agente</th>
                <th className={TH}>Pedido</th>
                <th className={TH}>Solicitada</th>
                <th className={TH}>Estado</th>
                {muestraAcciones ? <th className={`${TH} text-right`}>Acciones</th> : null}
              </tr>
            </thead>
            <tbody>
              {lista.map((solicitud) => (
                <tr key={solicitud.id} className="align-top hover:bg-slate-50/70">
                  <td className={`${TD} whitespace-nowrap font-semibold tabular-nums`}>
                    {solicitud.tipo === 'CAMBIO_MES' ? mesDe(solicitud.fecha) : solicitud.fecha}
                  </td>
                  <td className={TD}>{ETIQUETA_TIPO[solicitud.tipo]}</td>
                  <td className={TD}>{solicitud.nombreAgente}</td>
                  <td className={TD}>
                    <span className="block">{resumenPedido(solicitud)}</span>
                    {solicitud.detalle ? (
                      <span className="block text-xs text-slate-500">{solicitud.detalle}</span>
                    ) : null}
                    {solicitud.estado === 'ACEPTADA' && solicitud.coberturaNombre ? (
                      <span className="block text-xs text-slate-500">
                        Cobertura: {solicitud.coberturaNombre}
                      </span>
                    ) : null}
                  </td>
                  <td className={`${TD} whitespace-nowrap text-xs text-slate-500`}>
                    {solicitud.creadaEn.slice(0, 16).replace('T', ' ')}
                  </td>
                  <td className={TD}>{etiquetaEstadoSolicitud(solicitud)}</td>
                  {muestraAcciones ? (
                    <td className={`${TD} text-right`}>
                      {agente?.id === solicitud.companeroId && pendienteDeCompanero(solicitud) ? (
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            className={BTN_PRIMARY}
                            disabled={enviando}
                            onClick={() => void validarCompanero(solicitud)}
                          >
                            Validar
                          </button>
                          <button
                            type="button"
                            className={BTN_GHOST}
                            disabled={enviando}
                            onClick={() => void rechazarCompanero(solicitud)}
                          >
                            Rechazar
                          </button>
                        </div>
                      ) : esSuperadmin &&
                        solicitud.estado === 'PENDIENTE' &&
                        cambioDiaValidado(solicitud) ? (
                        <div className="flex flex-col items-end gap-2">
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              className={BTN_PRIMARY}
                              disabled={enviando}
                              onClick={() => void abrirAceptar(solicitud)}
                            >
                              Aceptar
                            </button>
                            <button
                              type="button"
                              className={BTN_GHOST}
                              disabled={enviando}
                              onClick={() => void rechazar(solicitud)}
                            >
                              Rechazar
                            </button>
                          </div>
                          {aceptando === solicitud.id && solicitud.tipo === 'PERMISO' ? (
                            <div className="w-full max-w-xs rounded-lg border border-slate-200 bg-slate-50 p-2 text-left">
                              <p className="text-xs text-slate-600">
                                {puestoLibre
                                  ? `Deja libre ${puestoLibre}${
                                      turnoLibre ? ` (${etiquetaTurnoServicio(turnoLibre)})` : ''
                                    }.`
                                  : 'Ese día no deja un puesto asignado.'}
                              </p>
                              <label className="mt-1 flex flex-col gap-1 text-xs font-semibold text-slate-600">
                                Cubrir puesto
                                <select
                                  className={CAMPO_FECHA}
                                  aria-label={`Cubrir el puesto de ${solicitud.nombreAgente}`}
                                  value={cobertura}
                                  onChange={(event) => setCobertura(event.target.value)}
                                >
                                  <option value="NO_CUBRIR">No cubrir</option>
                                  {candidatos.map((item) => (
                                    <option key={item.id} value={item.id}>
                                      {item.placa} {item.nombre} · {item.puesto}
                                    </option>
                                  ))}
                                </select>
                              </label>
                              <button
                                type="button"
                                className={`${BTN_PRIMARY} mt-2`}
                                disabled={enviando}
                                onClick={() => void confirmarAceptar(solicitud)}
                              >
                                Confirmar
                              </button>
                            </div>
                          ) : null}
                          {aceptando === solicitud.id && solicitud.tipo !== 'PERMISO' ? (
                            <button
                              type="button"
                              className={BTN_PRIMARY}
                              disabled={enviando}
                              onClick={() => void confirmarAceptar(solicitud)}
                            >
                              Confirmar aceptación
                            </button>
                          ) : null}
                        </div>
                      ) : (
                        '—'
                      )}
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
      </div>
    </section>
  )
}
