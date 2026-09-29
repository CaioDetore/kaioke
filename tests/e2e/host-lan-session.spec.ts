import { _electron as electron, chromium, expect, test } from '@playwright/test'

test('starts a host session and allows a separate browser to join through the generated URL', async () => {
  const environment = { ...process.env } as Record<string, string>
  delete environment.ELECTRON_RUN_AS_NODE
  const app = await electron.launch({ args: ['.'], env: environment })
  const participantBrowser = await chromium.launch()
  try {
    const host = await app.firstWindow()
    await host.goto('http://127.0.0.1:5173')
    await expect(host.getByRole('heading', { name: /kaiok/i })).toBeVisible()
    await host.getByRole('button', { name: 'Criar sessão' }).click()
    const entryUrl = await host.locator('.session-details a').getAttribute('href')
    expect(entryUrl).toBeTruthy()

    const participant = await participantBrowser.newPage()
    await participant.goto(entryUrl!)
    await participant.getByLabel('Seu nome').fill('Ana')
    await participant.getByRole('button', { name: 'Entrar' }).click()
    await expect(participant.getByRole('status')).toContainText('Conectado')
    await expect(host.getByRole('status')).toContainText('1 participante')
  } finally {
    await participantBrowser.close()
    await app.close()
  }
})
