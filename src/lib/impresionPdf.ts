export function escapeHtml(valor: string) {
  return valor
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** Abre el HTML en una ventana nueva y lanza el diálogo de imprimir / guardar como PDF. */
export function imprimirHtml(html: string) {
  const ventana = window.open('', '_blank')
  if (!ventana) {
    throw new Error(
      'El navegador bloqueó la ventana de impresión. Permite ventanas emergentes para exportar el PDF.',
    )
  }
  ventana.opener = null
  ventana.document.open()
  ventana.document.write(html)
  ventana.document.close()
  ventana.focus()
  const imprimir = () => {
    ventana.print()
    ventana.addEventListener('afterprint', () => ventana.close())
  }
  if (ventana.document.readyState === 'complete') {
    window.setTimeout(imprimir, 50)
  } else {
    ventana.addEventListener('load', imprimir, { once: true })
  }
}
