// Tira screenshot de cada página (1920×1080) e roda axe-core. Uso: node scripts/a11y-and-screens.mjs [baseUrl]
// Requer o site rodando (npm run dev ou npm run preview) e o Chrome instalado (CHROME_PATH para sobrescrever).
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import puppeteer from 'puppeteer-core'

const require = createRequire(import.meta.url)
const axeSource = fs.readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8')
const base = process.argv[2] ?? 'http://localhost:5173'
const outDir = path.resolve(process.argv[3] ?? '../docs/screenshots')
const chrome = process.env.CHROME_PATH ?? '/usr/bin/google-chrome'
const team = process.env.DEMO_TEAM ?? 'ufmt_turuna'
const opp = process.env.DEMO_OPP ?? 'azure_bears_golden'

const pages = [
  ['01-inicio', '/'],
  ['02-dossie-resumo', `/time/${team}`],
  ['03-dossie-ataque', `/time/${team}?aba=ataque&mapa=ascent`],
  ['04-dossie-defesa', `/time/${team}?aba=defesa`],
  ['05-dossie-economia', `/time/${team}?aba=economia`],
  ['06-dossie-jogadores', `/time/${team}?aba=jogadores`],
  ['07-dossie-mapas', `/time/${team}?aba=mapas`],
  ['08-veto', `/veto?a=${team}&b=${opp}`],
  ['09-posplant', `/posplant?time=${team}&mapa=ascent&site=A`],
  ['10-economia', `/economia?time=${team}`],
  ['11-metodo', '/metodo'],
]

fs.mkdirSync(outDir, { recursive: true })
const browser = await puppeteer.launch({ executablePath: chrome, headless: true, args: ['--no-sandbox'] })
const page = await browser.newPage()
await page.setViewport({ width: 1920, height: 1080 })
const errors = []
page.on('pageerror', (e) => errors.push(String(e)))
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
let critical = 0
for (const [name, url] of pages) {
  await page.goto(base + url, { waitUntil: 'networkidle0' })
  await new Promise((r) => setTimeout(r, 400))
  await page.screenshot({ path: path.join(outDir, `${name}.png`), fullPage: process.env.FULL === '1' })
  await page.evaluate(axeSource)
  const res = await page.evaluate(async () => await window.axe.run(document, { resultTypes: ['violations'] }))
  const bad = res.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious')
  critical += res.violations.filter((v) => v.impact === 'critical').length
  console.log(`${name}: ${res.violations.length} violações (${bad.length} sérias/críticas)`)
  for (const v of bad) console.log(`   - [${v.impact}] ${v.id}: ${v.help} (${v.nodes.length}) ${v.nodes.slice(0, 2).map((n) => n.target.join(' ')).join(' | ')}`)
}
// Evidências: abre o drawer a partir do primeiro cartão.
await page.goto(`${base}/time/${team}`, { waitUntil: 'networkidle0' })
const btn = await page.$('article button')
if (btn) {
  await btn.click()
  await new Promise((r) => setTimeout(r, 600))
  await page.screenshot({ path: path.join(outDir, '12-evidencias.png') })
}
// Impressão
await page.emulateMediaType('print')
await page.pdf({ path: path.join(outDir, 'dossie-impressao.pdf'), format: 'A4', landscape: true, printBackground: true })
await browser.close()
if (errors.length) console.log('Erros no console:', [...new Set(errors)].slice(0, 10))
console.log(critical ? `FALHOU: ${critical} violações críticas` : 'axe: nenhuma violação crítica')
process.exit(critical ? 1 : 0)
