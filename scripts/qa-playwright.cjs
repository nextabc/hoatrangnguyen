const { chromium } = require('playwright')
const path = require('path')

async function answerCurrent(page) {
  const choice = page.locator('.answer-button').first()
  if (await choice.count()) {
    await choice.click()
  } else {
    await page.locator('#answer').fill('đáp án thử')
    await page.getByRole('button', { name: 'Chốt đáp án' }).click()
  }
  await page.locator('.feedback').waitFor()
}

;(async () => {
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 })
  const errors = []
  page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()) })
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('http://127.0.0.1:4173/', { waitUntil: 'networkidle' })
  await page.screenshot({ path: path.resolve('qa/start-desktop.png'), fullPage: true })
  await page.getByRole('button', { name: /Luyện đủ 23 câu/i }).click()
  await page.locator('.question-panel').waitFor()
  await page.screenshot({ path: path.resolve('qa/game-desktop.png'), fullPage: true })

  await page.getByRole('button', { name: 'Tạm dừng' }).click()
  await page.locator('.pause-overlay').waitFor()
  await page.getByRole('button', { name: 'Tiếp tục' }).click()
  await answerCurrent(page)
  await page.screenshot({ path: path.resolve('qa/feedback-desktop.png'), fullPage: true })
  await page.locator('.feedback button').click()

  for (let i = 1; i < 23; i += 1) {
    await answerCurrent(page)
    await page.locator('.feedback button').click()
  }
  await page.locator('.result-card').waitFor()
  await page.screenshot({ path: path.resolve('qa/result-desktop.png'), fullPage: true })
  const oldSet = await page.locator('.result-kicker').textContent()
  await page.getByRole('button', { name: /Chơi bộ đề mới/i }).click()
  const newStartText = await page.locator('.intro').textContent()
  if (!/Bộ đề 02\/13/.test(newStartText)) throw new Error(`Next set did not advance: ${newStartText}`)

  await page.setViewportSize({ width: 390, height: 844 })
  await page.reload({ waitUntil: 'networkidle' })
  await page.screenshot({ path: path.resolve('qa/start-mobile.png'), fullPage: true })
  await page.getByRole('button', { name: /Luyện đủ 23 câu/i }).click()
  await page.locator('.question-panel').waitFor()
  await page.screenshot({ path: path.resolve('qa/game-mobile.png'), fullPage: true })

  const overflow = await page.evaluate(() => ({
    body: document.body.scrollWidth > document.documentElement.clientWidth,
    width: document.body.scrollWidth,
    client: document.documentElement.clientWidth,
  }))
  if (overflow.body) throw new Error(`Mobile horizontal overflow: ${JSON.stringify(overflow)}`)
  if (errors.length) throw new Error(`Browser errors: ${errors.join(' | ')}`)
  console.log(JSON.stringify({ ok: true, oldSet, nextSet: newStartText, overflow }, null, 2))
  await browser.close()
})().catch((error) => {
  console.error(error)
  process.exit(1)
})
