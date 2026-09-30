import { _electron as electron, chromium, expect, test } from '@playwright/test'

test('starts a host session and allows a separate browser to join through the generated URL', async () => {
  const environment = { ...process.env } as Record<string, string>
  delete environment.ELECTRON_RUN_AS_NODE
  const app = await electron.launch({ args: ['.'], env: environment })
  const participantBrowser = await chromium.launch()
  const secondParticipantBrowser = await chromium.launch()
  try {
    const host = await app.firstWindow()
    await host.goto('http://127.0.0.1:5173')
    await expect(host.getByRole('heading', { name: /kaiok/i })).toBeVisible()
    await host.getByRole('button', { name: 'Criar sessão' }).click()
    await expect(host.getByRole('heading', { name: 'Fila de pedidos' })).toBeVisible()
    const entryUrl = await host.locator('.session-details__url').textContent()
    expect(entryUrl).toBeTruthy()
    const participantContext = await participantBrowser.newContext()
    await participantContext.addInitScript(() => localStorage.setItem('kaiokeDeviceId', 'e2e-ana'))
    const participant = await participantContext.newPage()
    await participant.goto(entryUrl!)
    await participant.getByLabel('Seu nome').fill('Ana')
    await participant.getByRole('button', { name: 'Entrar' }).click()
    await expect(participant.getByRole('status')).toContainText('Conectado')
    await expect(participant.getByRole('heading', { name: 'Fila' })).toBeVisible()
    const queueCountBefore = await host.locator('.host-dashboard__queue li').count()
    const uniqueVideoId = `e2a${Date.now().toString(36)}xxxxx`.slice(0, 11)
    await participant.getByLabel('Link ou ID do YouTube').fill(uniqueVideoId)
    await participant.getByRole('button', { name: 'Adicionar música' }).click()
    await expect.poll(() => host.locator('.host-dashboard__queue li').count()).toBeGreaterThan(queueCountBefore)
    await expect(host.getByRole('status')).toContainText('1 participante')

    const biaContext = await secondParticipantBrowser.newContext()
    await biaContext.addInitScript(() => localStorage.setItem('kaiokeDeviceId', 'e2e-bia'))
    const bia = await biaContext.newPage()
    await bia.goto(entryUrl!)
    await bia.getByLabel('Seu nome').fill('Bia')
    await bia.getByRole('button', { name: 'Entrar' }).click()
    await expect(bia.getByRole('heading', { name: 'Fila' })).toBeVisible()

    const biaVideoId = `e2b${Date.now().toString(36)}xxxxx`.slice(0, 11)
    const countBeforeBia = await host.locator('.host-dashboard__queue li').count()
    await bia.getByLabel('Link ou ID do YouTube').fill(biaVideoId)
    await bia.getByRole('button', { name: 'Adicionar música' }).click()
    await expect.poll(() => host.locator('.host-dashboard__queue li').count()).toBeGreaterThan(countBeforeBia)
    await bia.getByRole('button', { name: 'Remover' }).click()
    await expect.poll(() => host.locator('.host-dashboard__queue li').count()).toBe(countBeforeBia)

    const secondAnaVideoId = `e2c${Date.now().toString(36)}xxxx`.slice(0, 11)
    const thirdAnaVideoId = `e2d${Date.now().toString(36)}xxxx`.slice(0, 11)
    for (const videoId of [secondAnaVideoId, thirdAnaVideoId]) {
      await participant.getByLabel('Link ou ID do YouTube').fill(videoId)
      await participant.getByRole('button', { name: 'Adicionar música' }).click()
      await expect(host.getByText(videoId)).toBeVisible()
    }
    await participant.getByLabel('Link ou ID do YouTube').fill(`e2e${Date.now().toString(36)}xxxx`.slice(0, 11))
    await participant.getByRole('button', { name: 'Adicionar música' }).click()
    await expect(participant.getByRole('alert')).toContainText('no máximo três')

    await host.getByRole('button', { name: `Mover ${thirdAnaVideoId} para cima` }).click()
    await expect.poll(async () => {
      const entries = await participant.locator('#queue-list li').allTextContents()
      return entries.findIndex(entry => entry.includes(thirdAnaVideoId)) < entries.findIndex(entry => entry.includes(secondAnaVideoId))
    }).toBe(true)
    await participant.reload()
    await expect(participant.getByLabel('Seu nome')).toHaveValue('Ana')
  } finally {
    await participantBrowser.close()
    await secondParticipantBrowser.close()
    await app.close()
  }
})
