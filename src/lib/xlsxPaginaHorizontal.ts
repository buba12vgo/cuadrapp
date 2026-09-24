const CRC_TAB = new Uint32Array(256)
for (let i = 0; i < 256; i++) {
  let c = i
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  CRC_TAB[i] = c >>> 0
}

function crc32(datos: Uint8Array) {
  let crc = 0xffffffff
  for (let i = 0; i < datos.length; i++) {
    crc = CRC_TAB[(crc ^ datos[i]!) & 0xff]! ^ (crc >>> 8)
  }
  return (crc ^ 0xffffffff) >>> 0
}

function leerU16(buf: Uint8Array, offset: number) {
  return buf[offset]! | (buf[offset + 1]! << 8)
}

function leerU32(buf: Uint8Array, offset: number) {
  return (
    (buf[offset]! |
      (buf[offset + 1]! << 8) |
      (buf[offset + 2]! << 16) |
      (buf[offset + 3]! << 24)) >>>
    0
  )
}

function escribirU16(buf: Uint8Array, offset: number, valor: number) {
  buf[offset] = valor & 0xff
  buf[offset + 1] = (valor >>> 8) & 0xff
}

function escribirU32(buf: Uint8Array, offset: number, valor: number) {
  buf[offset] = valor & 0xff
  buf[offset + 1] = (valor >>> 8) & 0xff
  buf[offset + 2] = (valor >>> 16) & 0xff
  buf[offset + 3] = (valor >>> 24) & 0xff
}

function encoder(texto: string) {
  return new TextEncoder().encode(texto)
}

/** Reescribe un xlsx sin comprimir inyectando impresión horizontal en la primera hoja. */
export function xlsxConPaginaHorizontal(xlsx: Uint8Array) {
  const archivos: Array<{ nombre: string; extra: Uint8Array; datos: Uint8Array }> = []
  let offset = 0
  while (offset + 4 <= xlsx.length && leerU32(xlsx, offset) === 0x04034b50) {
    const metodo = leerU16(xlsx, offset + 8)
    const nombreLen = leerU16(xlsx, offset + 26)
    const extraLen = leerU16(xlsx, offset + 28)
    const tam = leerU32(xlsx, offset + 18)
    const nombre = new TextDecoder().decode(
      xlsx.subarray(offset + 30, offset + 30 + nombreLen),
    )
    const extra = xlsx.subarray(
      offset + 30 + nombreLen,
      offset + 30 + nombreLen + extraLen,
    )
    const inicio = offset + 30 + nombreLen + extraLen
    if (metodo !== 0) {
      throw new Error('El Excel comprimido no admite orientación de página')
    }
    archivos.push({
      nombre,
      extra: extra.slice(),
      datos: xlsx.subarray(inicio, inicio + tam).slice(),
    })
    offset = inicio + tam
  }

  const hoja = archivos.find((item) =>
    /^xl\/worksheets\/sheet\d+\.xml$/.test(item.nombre),
  )
  if (!hoja) throw new Error('No se encontró la hoja del Excel')
  const xml = new TextDecoder().decode(hoja.datos)
  hoja.datos = encoder(insertarConfigPagina(xml))
  return escribirZip(archivos)
}

function insertarConfigPagina(xml: string) {
  const pageSetup =
    '<pageSetup paperSize="9" orientation="landscape" fitToWidth="1" fitToHeight="1"/>'
  let siguiente = xml
  if (!/<sheetPr[\s>]/.test(siguiente)) {
    siguiente = siguiente.replace(
      /<worksheet([^>]*)>/,
      '<worksheet$1><sheetPr><pageSetUpPr fitToPage="1"/></sheetPr>',
    )
  } else if (!/pageSetUpPr/.test(siguiente)) {
    siguiente = siguiente.replace(
      /<sheetPr([^>]*)\/>/,
      '<sheetPr$1><pageSetUpPr fitToPage="1"/></sheetPr>',
    )
    if (!/pageSetUpPr/.test(siguiente)) {
      siguiente = siguiente.replace(
        /<sheetPr([^>]*)>/,
        '<sheetPr$1><pageSetUpPr fitToPage="1"/>',
      )
    }
  }
  if (!/<pageSetup[\s>]/.test(siguiente)) {
    if (/<pageMargins[^/]*\/>/.test(siguiente)) {
      siguiente = siguiente.replace(/(<pageMargins[^/]*\/>)/, `$1${pageSetup}`)
    } else {
      siguiente = siguiente.replace('</worksheet>', `${pageSetup}</worksheet>`)
    }
  }
  return siguiente
}

function escribirZip(
  archivos: Array<{ nombre: string; extra: Uint8Array; datos: Uint8Array }>,
) {
  const locales: Uint8Array[] = []
  const centrales: Uint8Array[] = []
  let offset = 0
  for (const archivo of archivos) {
    const nombre = encoder(archivo.nombre)
    const crc = crc32(archivo.datos)
    const local = new Uint8Array(30 + nombre.length + archivo.extra.length)
    escribirU32(local, 0, 0x04034b50)
    escribirU16(local, 4, 20)
    escribirU16(local, 6, 0)
    escribirU16(local, 8, 0)
    escribirU16(local, 10, 0)
    escribirU16(local, 12, 0)
    escribirU32(local, 14, crc)
    escribirU32(local, 18, archivo.datos.length)
    escribirU32(local, 22, archivo.datos.length)
    escribirU16(local, 26, nombre.length)
    escribirU16(local, 28, archivo.extra.length)
    local.set(nombre, 30)
    local.set(archivo.extra, 30 + nombre.length)
    locales.push(local, archivo.datos)

    const central = new Uint8Array(46 + nombre.length + archivo.extra.length)
    escribirU32(central, 0, 0x02014b50)
    escribirU16(central, 4, 20)
    escribirU16(central, 6, 20)
    escribirU16(central, 8, 0)
    escribirU16(central, 10, 0)
    escribirU16(central, 12, 0)
    escribirU16(central, 14, 0)
    escribirU32(central, 16, crc)
    escribirU32(central, 20, archivo.datos.length)
    escribirU32(central, 24, archivo.datos.length)
    escribirU16(central, 28, nombre.length)
    escribirU16(central, 30, archivo.extra.length)
    escribirU16(central, 32, 0)
    escribirU16(central, 34, 0)
    escribirU16(central, 36, 0)
    escribirU32(central, 38, 0)
    escribirU32(central, 42, offset)
    central.set(nombre, 46)
    central.set(archivo.extra, 46 + nombre.length)
    centrales.push(central)
    offset += local.length + archivo.datos.length
  }

  const tamCentral = centrales.reduce((n, parte) => n + parte.length, 0)
  const eocd = new Uint8Array(22)
  escribirU32(eocd, 0, 0x06054b50)
  escribirU16(eocd, 8, archivos.length)
  escribirU16(eocd, 10, archivos.length)
  escribirU32(eocd, 12, tamCentral)
  escribirU32(eocd, 16, offset)

  const total =
    offset + tamCentral + eocd.length
  const salida = new Uint8Array(total)
  let cursor = 0
  for (const parte of locales) {
    salida.set(parte, cursor)
    cursor += parte.length
  }
  for (const parte of centrales) {
    salida.set(parte, cursor)
    cursor += parte.length
  }
  salida.set(eocd, cursor)
  return salida
}

export function descargarBinario(nombre: string, datos: Uint8Array) {
  const copia = new Uint8Array(datos.byteLength)
  copia.set(datos)
  const blob = new Blob([copia], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const url = URL.createObjectURL(blob)
  const enlace = document.createElement('a')
  enlace.href = url
  enlace.download = nombre
  enlace.click()
  URL.revokeObjectURL(url)
}
