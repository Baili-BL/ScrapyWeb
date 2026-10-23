/* README 截图：真实登录后逐页截图到 docs/images/ */
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

const base = 'http://127.0.0.1:5174'
const dir = 'docs/images'
mkdirSync(dir, { recursive: true })

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })

const shot = async (name) => page.screenshot({ path: `${dir}/${name}.png` })
const wait = (ms) => page.waitForTimeout(ms)

try {
  // 登录页
  await page.goto(base + '/', { waitUntil: 'networkidle' })
  await wait(600)
  await shot('01-login')

  // 登录
  await page.locator('.auth-card input').nth(0).fill('admin')
  await page.locator('.auth-card input[type="password"]').fill('admin123')
  await page.locator('.auth-card .arco-btn', { hasText: '登录' }).click()
  await wait(2000)
  await shot('02-dashboard')

  // 任务管理
  await page.goto(base + '/tasks', { waitUntil: 'networkidle' })
  await wait(1200)
  await shot('03-tasks')

  // 流程编排列表 + 编辑器
  await page.goto(base + '/workflow', { waitUntil: 'networkidle' })
  await wait(1000)
  await shot('04-flow-list')
  await page.locator('.flow-card').first().click()
  await wait(900)
  await shot('05-flow-editor')

  // 详细图表：股价走势
  await page.goto(base + '/', { waitUntil: 'networkidle' })
  await wait(800)
  await page.getByText('详细图表', { exact: true }).click()
  await wait(1800)
  await shot('06-chart-trend')

  // 研报数据
  await page.getByText('研报数据', { exact: true }).click()
  await wait(1200)
  await shot('07-reports')

  // 分布式节点
  await page.goto(base + '/nodes', { waitUntil: 'networkidle' })
  await wait(1200)
  await shot('08-nodes')

  // 用户管理
  await page.goto(base + '/users', { waitUntil: 'networkidle' })
  await wait(1000)
  await shot('09-users')

  // AI 配置
  await page.goto(base + '/ai/config', { waitUntil: 'networkidle' })
  await wait(1000)
  await shot('10-ai-config')

  console.log('截图完成：docs/images/ 共 10 张')
} catch (err) {
  console.error('截图失败：', err.message)
  await shot('99-error').catch(() => {})
}
await browser.close()
