/* 真实浏览器 UI 验证：登录 → 流程编排 → 节点配置 → 拖拽连线 → 截图 */
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

const base = 'http://127.0.0.1:5174'
mkdirSync('shots', { recursive: true })

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
const errors = []
page.on('console', (msg) => {
  if (msg.type() === 'error') errors.push('console: ' + msg.text().slice(0, 200))
})
page.on('pageerror', (err) => errors.push('pageerror: ' + err.message.slice(0, 200)))

const out = []
const log = (text) => {
  out.push(text)
  console.log(text)
}

try {
  // 1. 打开首页 → 应落在登录页
  await page.goto(base + '/', { waitUntil: 'networkidle' })
  await page.waitForTimeout(800)
  await page.screenshot({ path: 'shots/01-login.png' })
  const onAuth = (await page.locator('.auth-card').count()) > 0
  log('1. 登录页出现: ' + onAuth)

  // 2. 登录
  await page.locator('.auth-card input').nth(0).fill('admin')
  await page.locator('.auth-card input[type="password"]').fill('admin123')
  await page.locator('.auth-card .arco-btn', { hasText: '登录' }).click()
  await page.waitForTimeout(1200)
  await page.screenshot({ path: 'shots/02-dashboard.png' })
  const dashOk = (await page.locator('.brand-mark').count()) > 0
  log('2. 登录后进入仪表盘: ' + dashOk)

  // 3. 打开流程编排 → 进入编辑器
  await page.goto(base + '/workflow', { waitUntil: 'networkidle' })
  await page.waitForTimeout(1000)
  await page.screenshot({ path: 'shots/03-flowlist.png' })
  const card = page.locator('.flow-card').first()
  if ((await card.count()) === 0) throw new Error('流程列表为空')
  await card.click()
  await page.waitForTimeout(800)
  await page.screenshot({ path: 'shots/04-editor.png' })
  log('3. 进入编辑器: ' + ((await page.locator('.flow-screen').count()) > 0))

  // 4. 点选第一个脚本节点 → 属性面板 → 切换爬虫按钮
  const scriptNode = page.locator('.flow-node.script').first()
  await scriptNode.click()
  await page.waitForTimeout(500)
  const choiceButtons = page.locator('.spider-choice-btn')
  const choiceCount = await choiceButtons.count()
  log('4. 属性面板爬虫选择按钮数量: ' + choiceCount)
  // 切到第二个爬虫（一创研报）
  if (choiceCount > 1) {
    await choiceButtons.nth(1).click()
    await page.waitForTimeout(400)
  }
  const title = await page.locator('.flow-props input').first().inputValue()
  log('5. 选择后节点标题自动变为: ' + title)
  await page.screenshot({ path: 'shots/05-props.png' })

  // 5. 真实拖拽连线：第一个脚本节点的输出圆点 → 拖到下一个节点
  const nodes = page.locator('.flow-node')
  const nodeCount = await nodes.count()
  log('6. 画布节点数: ' + nodeCount)
  const before = await page.locator('.flow-edges path').count()
  const sourceNode = nodes.nth(0)
  // 目标选第 3 个节点（start→它 的连线不存在，验证真实新建连线；前两个节点间已有连线会被去重）
  const targetNode = nodes.nth(Math.min(2, nodeCount - 1))
  const sb = await sourceNode.boundingBox()
  const tb = await targetNode.boundingBox()
  // 输出圆点中心（right:-7px → 圆心在节点右缘内 1px）
  const startX = sb.x + sb.width - 1
  const startY = sb.y + sb.height / 2
  await page.mouse.move(startX, startY)
  await page.mouse.down()
  await page.waitForTimeout(120)
  const rubberDuringDrag = await page.locator('.flow-rubber').count()
  log('6a. 按下输出圆点后橡皮筋出现: ' + rubberDuringDrag + ' (1=已进入连线模式)')
  // 分几步移动，模拟真实拖拽
  for (let step = 1; step <= 8; step += 1) {
    const x = startX + ((tb.x + 20 - startX) * step) / 8
    const y = startY + ((tb.y + tb.height / 2 - startY) * step) / 8
    await page.mouse.move(x, y)
    await page.waitForTimeout(60)
  }
  const rubberBeforeUp = await page.locator('.flow-rubber').count()
  log('6b. 松手前橡皮筋仍在: ' + rubberBeforeUp)
  await page.mouse.up()
  await page.waitForTimeout(500)
  const after = await page.locator('.flow-edges path').count()
  log('7. 拖拽连线: 连线数 ' + before + ' -> ' + after + (after > before ? ' ✓ 成功' : ' ✗ 失败'))
  await page.screenshot({ path: 'shots/06-linked.png' })

  // 5b. 点选式连线兜底验证：点源节点输出圆点 → 点目标节点输入圆点
  const before2 = await page.locator('.flow-edges path').count()
  await page.mouse.move(startX, startY + 0)
  await page.mouse.down()
  await page.mouse.up()
  await page.waitForTimeout(300)
  const hintVisible = (await page.locator('.flow-link-hint').count()) > 0
  log('6c. 点选模式: 点击输出圆点后提示出现=' + hintVisible)
  const tb2 = await nodes.nth(Math.min(3, nodeCount - 1)).boundingBox()
  await page.mouse.move(tb2.x + 4, tb2.y + tb2.height / 2)
  await page.mouse.down()
  await page.mouse.up()
  await page.waitForTimeout(500)
  const after2 = await page.locator('.flow-edges path').count()
  log('6d. 点选连线: 连线数 ' + before2 + ' -> ' + after2 + (after2 > before2 ? ' ✓ 成功' : ' ✗ 失败'))

  // 6. 拖动节点本体（防回归）
  const nb = await nodes.nth(0).boundingBox()
  await page.mouse.move(nb.x + nb.width / 2, nb.y + 14)
  await page.mouse.down()
  await page.mouse.move(nb.x + nb.width / 2 + 60, nb.y + 40, { steps: 5 })
  await page.mouse.up()
  log('8. 节点拖动执行完毕')
} catch (err) {
  errors.push('script: ' + err.message)
  await page.screenshot({ path: 'shots/99-error.png' }).catch(() => {})
}

log('页面错误汇总: ' + (errors.length ? JSON.stringify(errors, null, 2) : '无 ✓'))
await browser.close()
