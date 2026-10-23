import puppeteer from 'puppeteer-core'
const b = await puppeteer.launch({ browser: 'firefox', executablePath: process.env.FF ?? '/usr/bin/firefox', headless: true })
const p = await b.newPage()
await p.setViewport({ width: 1920, height: 1080 })
const errs = []
p.on('pageerror', (e) => errs.push(String(e)))
for (const [n, u] of [['veto', '/veto?a=ufmt_turuna&b=azure_bears_golden'], ['posplant', '/posplant?time=ufmt_turuna&mapa=ascent&site=A'], ['economia', '/economia?time=ufmt_turuna']]) {
  await p.goto('http://localhost:4173' + u, { waitUntil: 'networkidle0' })
  await new Promise((r) => setTimeout(r, 800))
  await p.screenshot({ path: `/home/bagiel/hackathon-valorant/docs/screenshots/firefox-${n}.png` })
  console.log(n, await p.$eval('h1', (e) => e.textContent))
}
console.log('erros:', errs)
await b.close()
