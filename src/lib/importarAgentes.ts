import * as XLSX from 'xlsx'
import { agenteNuevo } from '@/lib/db'
import type { FichaPolicia, RolPolicia } from '@/types'

const ROLES: RolPolicia[] = [
  'RESPONSABLE',
  'JEFE_SERVICIO',
  'JEFE_EQUIPO',
  'POLICIA',
  'POLICIA_BOLSA',
]

const ALIAS_CABECERA: Record<string, 'numeroPlaca' | 'nombre' | 'apellidos' | 'rolBase'> =
  {
    'numero de agente': 'numeroPlaca',
    'numero agente': 'numeroPlaca',
    'n de agente': 'numeroPlaca',
    'n agente': 'numeroPlaca',
    placa: 'numeroPlaca',
    'numero placa': 'numeroPlaca',
    'numero de placa': 'numeroPlaca',
    numero: 'numeroPlaca',
    'nombre agente': 'nombre',
    nombre: 'nombre',
    'apellidos agente': 'apellidos',
    'apellido agente': 'apellidos',
    apellidos: 'apellidos',
    apellido: 'apellidos',
    rol: 'rolBase',
    'rol agente': 'rolBase',
    'rol base': 'rolBase',
  }

const ALIAS_ROL: Record<string, RolPolicia> = {
  responsable: 'RESPONSABLE',
  'jefe de servicio': 'JEFE_SERVICIO',
  'jefe servicio': 'JEFE_SERVICIO',
  jefeservicio: 'JEFE_SERVICIO',
  'jefe de equipo': 'JEFE_EQUIPO',
  'jefe equipo': 'JEFE_EQUIPO',
  jefeequipo: 'JEFE_EQUIPO',
  policia: 'POLICIA',
  agente: 'POLICIA',
  'policia bolsa': 'POLICIA_BOLSA',
  'policia de bolsa': 'POLICIA_BOLSA',
  policiabolsa: 'POLICIA_BOLSA',
}

export type FilaImportacionAgente = {
  numeroPlaca: string
  nombre: string
  apellidos: string
  rolBase: RolPolicia
}

export type ResultadoParseoAgentes = {
  filas: FilaImportacionAgente[]
  avisos: string[]
}

function normalizarTexto(valor: string) {
  return valor
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function celdaTexto(valor: unknown) {
  if (valor == null) return ''
  if (typeof valor === 'number' && Number.isFinite(valor)) {
    return Number.isInteger(valor) ? String(valor) : String(valor).trim()
  }
  return String(valor).trim()
}

function leerRol(valor: string): RolPolicia | null {
  const clave = normalizarTexto(valor)
  if (!clave) return 'POLICIA'
  if (ROLES.includes(valor.trim().toUpperCase() as RolPolicia)) {
    return valor.trim().toUpperCase() as RolPolicia
  }
  return ALIAS_ROL[clave] ?? null
}

function mapaCabeceras(claves: string[]) {
  const mapa: Partial<
    Record<'numeroPlaca' | 'nombre' | 'apellidos' | 'rolBase', string>
  > = {}

  for (const clave of claves) {
    const campo = ALIAS_CABECERA[normalizarTexto(clave)]
    if (campo && !mapa[campo]) mapa[campo] = clave
  }

  return mapa
}

export function parsearBufferAgentes(
  buffer: ArrayBuffer,
): ResultadoParseoAgentes {
  const libro = XLSX.read(buffer, { type: 'array' })
  const hojaNombre = libro.SheetNames[0]
  if (!hojaNombre) {
    throw new Error('El archivo Excel no tiene ninguna hoja')
  }

  const filasRaw = XLSX.utils.sheet_to_json<Record<string, unknown>>(
    libro.Sheets[hojaNombre],
    { defval: '' },
  )

  if (filasRaw.length === 0) {
    throw new Error('El Excel no tiene filas de datos')
  }

  const cabeceras = mapaCabeceras(Object.keys(filasRaw[0] ?? {}))
  if (!cabeceras.numeroPlaca || !cabeceras.nombre) {
    throw new Error(
      'No se encontraron las columnas «número de agente» y «nombre agente». Revisa la primera fila.',
    )
  }

  const filas: FilaImportacionAgente[] = []
  const avisos: string[] = []
  const placasVistas = new Set<string>()

  filasRaw.forEach((fila, indice) => {
    const numero = fila[cabeceras.numeroPlaca!]
    const nombre = fila[cabeceras.nombre!]
    const apellidos = cabeceras.apellidos ? fila[cabeceras.apellidos] : ''
    const rolRaw = cabeceras.rolBase ? fila[cabeceras.rolBase] : ''
    const linea = indice + 2

    const numeroPlaca = celdaTexto(numero)
    const nombreTexto = celdaTexto(nombre)
    const apellidosTexto = celdaTexto(apellidos)

    if (!numeroPlaca && !nombreTexto && !apellidosTexto) return

    if (!numeroPlaca || !nombreTexto) {
      avisos.push(`Fila ${linea}: faltan número de agente o nombre. Se omite.`)
      return
    }

    const rolBase = leerRol(celdaTexto(rolRaw))
    if (!rolBase) {
      avisos.push(
        `Fila ${linea}: rol «${celdaTexto(rolRaw)}» no reconocido. Se omite.`,
      )
      return
    }

    if (placasVistas.has(numeroPlaca)) {
      avisos.push(
        `Fila ${linea}: la placa ${numeroPlaca} está duplicada en el Excel. Se omite.`,
      )
      return
    }

    placasVistas.add(numeroPlaca)
    filas.push({
      numeroPlaca,
      nombre: nombreTexto,
      apellidos: apellidosTexto,
      rolBase,
    })
  })

  if (filas.length === 0) {
    throw new Error(
      avisos[0] ?? 'No hay filas válidas para importar en el Excel',
    )
  }

  return { filas, avisos }
}

export async function parsearExcelAgentes(
  archivo: File,
): Promise<ResultadoParseoAgentes> {
  return parsearBufferAgentes(await archivo.arrayBuffer())
}

export function fichasDesdeImportacion(
  filas: FilaImportacionAgente[],
  existentes: FichaPolicia[],
): FichaPolicia[] {
  const porPlaca = new Map(
    existentes.map((agente) => [agente.numeroPlaca, agente]),
  )

  return filas.map((fila) => {
    const actual = porPlaca.get(fila.numeroPlaca)
    if (actual) {
      return {
        ...actual,
        numeroPlaca: fila.numeroPlaca,
        nombre: fila.nombre,
        apellidos: fila.apellidos,
        rolBase: fila.rolBase,
      }
    }

    const alta = agenteNuevo()
    return {
      ...alta,
      id: fila.numeroPlaca,
      numeroPlaca: fila.numeroPlaca,
      nombre: fila.nombre,
      apellidos: fila.apellidos,
      rolBase: fila.rolBase,
    }
  })
}

export function descargarPlantillaAgentes() {
  const hoja = XLSX.utils.aoa_to_sheet([
    ['número de agente', 'nombre agente', 'apellidos agente', 'rol'],
    ['1001', 'Elena', 'Vázquez Souto', 'Responsable'],
    ['1020', 'Marcos', 'Rivas Freire', 'Jefe de servicio'],
    ['1108', 'Xoán', 'Pérez Otero', 'Policía'],
  ])
  const libro = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(libro, hoja, 'Agentes')
  XLSX.writeFile(libro, 'plantilla-agentes.xlsx')
}
