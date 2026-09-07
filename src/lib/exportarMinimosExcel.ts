import * as XLSX from 'xlsx'
import { DIAS_SEMANA_CONFIG } from '@/lib/calendarioPuestos'
import type { MinimosSemana, PuestoConfig } from '@/lib/calendarioPuestos'

export function exportarMinimosExcel(
  puestos: PuestoConfig[],
  minimos: MinimosSemana,
) {
  const filas: (string | number)[][] = [
    ['Mínimos semanales por puesto'],
    [],
    ['Puesto', 'Abrev.', ...DIAS_SEMANA_CONFIG.flatMap((d) => [`${d.label} M`, `${d.label} T`, `${d.label} N`])],
  ]

  for (const puesto of puestos) {
    const fila: (string | number)[] = [puesto.nombre, puesto.abreviatura]
    for (const dia of DIAS_SEMANA_CONFIG) {
      const vals = minimos[dia.dia][puesto.nombre] ?? { M: 0, T: 0, N: 0 }
      fila.push(vals.M, vals.T, vals.N)
    }
    filas.push(fila)
  }

  const hoja = XLSX.utils.aoa_to_sheet(filas)
  hoja['!cols'] = [{ wch: 22 }, { wch: 8 }, ...Array(21).fill({ wch: 6 })]
  const libro = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(libro, hoja, 'Minimos')
  XLSX.writeFile(libro, 'minimos-semanales.xlsx')
}
