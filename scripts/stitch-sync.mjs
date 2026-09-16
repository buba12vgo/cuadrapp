#!/usr/bin/env node
/**
 * Sincroniza el sistema de diseño Puerto con Google Stitch.
 * Requiere STITCH_API_KEY en el entorno o en .env / .env.local (nunca VITE_).
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const metaPath = join(root, '.stitch', 'project.json')
const screensDir = join(root, '.stitch', 'screens')

function loadEnvFile(path) {
  if (!existsSync(path)) return
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq < 1) continue
    const name = trimmed.slice(0, eq).trim()
    if (process.env[name]) continue
    let value = trimmed.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    process.env[name] = value
  }
}

loadEnvFile(join(root, '.env.local'))
loadEnvFile(join(root, '.env'))

const apiKey = process.env.STITCH_API_KEY?.trim()
if (!apiKey) {
  console.error(
    'Falta STITCH_API_KEY. Añádela a .env.local (sin prefijo VITE_) y ejecuta: npm run stitch:sync',
  )
  process.exit(1)
}

const designMd = readFileSync(join(root, 'DESIGN.md'), 'utf8')

const theme = {
  colorMode: 'LIGHT',
  colorVariant: 'TONAL_SPOT',
  roundness: 'ROUND_EIGHT',
  headlineFont: 'PLUS_JAKARTA_SANS',
  bodyFont: 'IBM_PLEX_SANS',
  labelFont: 'IBM_PLEX_SANS',
  font: 'IBM_PLEX_SANS',
  overridePrimaryColor: '#0B4F6C',
  overrideSecondaryColor: '#1A7A6D',
  overrideTertiaryColor: '#C45C26',
  backgroundLight: '#F2F5F7',
}

const SCREENS = [
  {
    file: 'login.html',
    title: 'Login',
    prompt:
      'Desktop login for a restricted internal shift-scheduling tool used by port police administrators. Centered institutional card with app name Cuadrapp, subtitle Cuadrantes de la Policía Portuaria, and a single Continue with Google button. Calm operational atmosphere, no marketing badges.',
  },
  {
    file: 'agentes.html',
    title: 'Agentes',
    prompt:
      'Desktop admin workspace for Cuadrapp. Sticky top bar with app mark, grouped navigation (Plantilla, Operación, Normativa), user chip and Salir. Main view is a dense agents roster table: badge number, name, role, unit. Page header with title Agentes, short subtitle, and primary action to add an agent. Full-height panel, operational density.',
  },
  {
    file: 'cuadrante-mensual.html',
    title: 'Cuadrante mensual',
    prompt:
      'Desktop monthly shift matrix for port police. Left column agent badge and name, top headers are days of the month. Cells show shift codes M T N L D V with distinct semantic colors. Toolbar with month selector, filters, and Export. Sticky sum column. Dense grid filling the viewport. Sidebar of job posts to drag onto cells.',
  },
  {
    file: 'cuadrante-jefes.html',
    title: 'Cuadrante jefes',
    prompt:
      'Desktop monthly matrix for service chiefs and responsables. Agents on the left (badge + name), days on top. Weekend-only M-T double shift cells. Sticky totals column where M-T counts as two days. Toolbar with month, PDF export, and a pool of posts to drop onto a badge to assign the post to every working day. Same chrome as the rest of Cuadrapp.',
  },
]

const { Stitch } = await import('@google/stitch-sdk')
const stitch = new Stitch({ apiKey })

mkdirSync(join(root, '.stitch'), { recursive: true })
mkdirSync(screensDir, { recursive: true })

let projectName
if (existsSync(metaPath)) {
  projectName = JSON.parse(readFileSync(metaPath, 'utf8')).name
  console.log(`Proyecto Stitch existente: ${projectName}`)
} else {
  const project = await stitch.createProject({
    title: 'Cuadrapp',
    deviceType: 'DESKTOP',
    projectType: 'TEXT_TO_UI',
    designTheme: theme,
  })
  projectName = project.name
  writeFileSync(
    metaPath,
    `${JSON.stringify(
      { name: project.name, title: project.title ?? 'Cuadrapp' },
      null,
      2,
    )}\n`,
  )
  console.log(`Proyecto Stitch creado: ${projectName}`)
}

const designSystem = await stitch.createDesignSystem({
  parent: projectName,
  designSystem: {
    displayName: 'Puerto',
    styleGuidelines: designMd,
    theme,
  },
})
console.log(`Design system Puerto: ${designSystem.name ?? 'ok'}`)

for (const screen of SCREENS) {
  console.log(`Generando ${screen.title}…`)
  const generated = await stitch.generate({
    generateScreen: {
      prompt: screen.prompt,
      deviceType: 'DESKTOP',
      modelId: 'GEMINI_3_1_PRO',
      projectId: projectName,
    },
  })
  const html =
    generated.htmlCode?.fileContentBase64 != null
      ? Buffer.from(generated.htmlCode.fileContentBase64, 'base64').toString(
          'utf8',
        )
      : null
  const out = {
    title: screen.title,
    id: generated.id,
    name: generated.name,
    htmlFile: html ? screen.file : null,
  }
  if (html) {
    writeFileSync(join(screensDir, screen.file), html)
  }
  writeFileSync(
    join(screensDir, `${screen.file.replace(/\.html$/, '')}.json`),
    `${JSON.stringify(out, null, 2)}\n`,
  )
  console.log(`  ${screen.title}: ${generated.id ?? generated.name ?? 'sin id'}`)
}

console.log('Stitch sync completo. Pantallas en .stitch/screens/')
