import { IconBook } from '@arco-design/web-react/icon'
import { useEffect, useState } from 'react'

type Block =
  | { type: 'p'; text: string }
  | { type: 'list'; items: string[] }
  | { type: 'code'; text: string }
  | { type: 'table'; head: string[]; rows: string[][] }

type DocSection = { id: string; title: string; blocks: Block[] }

const SECTIONS: DocSection[] = [
  {
    id: 'overview',
    title: '1. 系统概览',
    blocks: [
      { type: 'p', text: 'ScrapyWeb 是一个单机部署的爬虫任务监控与编排平台，由四部分组成：' },
      {
        type: 'table',
        head: ['目录', '职责', '技术栈'],
        rows: [
          ['src/', '监控仪表盘前端（登录、任务、流程、节点、AI）', 'React 19 + Vite + Arco Design + AntV G2'],
          ['server/', '内嵌后端：/api/* 中间件插件，随 dev server 同进程运行', 'Node.js（零额外依赖）'],
          ['crawlers/', 'Scrapy 爬虫工程：eastmoney_stock、fcfco_reports 两个爬虫', 'Scrapy 2.19（.venv 虚拟环境）'],
          ['data/', '运行时数据：任务/流程/运行记录/用户/机器人/AI 配置与爬虫产出', 'JSON 文件'],
        ],
      },
      { type: 'p', text: '后端与前端同进程（Vite 中间件），无需单独启动 API 服务；爬虫通过 spawn .venv\\Scripts\\scrapy.exe 真实执行，产物落盘到 data/ 后由接口读取展示。' },
    ],
  },
  {
    id: 'quick-start',
    title: '2. 快速开始',
    blocks: [
      {
        type: 'code',
        text: 'npm install          # 安装前端依赖\npython -m venv .venv  # 创建爬虫虚拟环境\n.venv\\Scripts\\python -m pip install scrapy\nnpm run dev           # 启动（默认 5173，被占用自动 +1）',
      },
      { type: 'list', items: ['浏览器打开控制台输出的地址，使用内置管理员 admin / admin123 登录', '首次登录后在「用户管理」修改 admin 密码', '「任务管理」里点「运行」即可真实执行爬虫；「详细图表」查看运行数据'] },
    ],
  },
  {
    id: 'add-spider',
    title: '3. 新增一个爬虫（开发指南）',
    blocks: [
      { type: 'p', text: '三步接入新爬虫，任务管理 / 流程编排 / 运行历史会自动出现它：' },
      {
        type: 'list',
        items: [
          '1. 在 crawlers/scrapytask_demo/spiders/ 下新建 spider（参考 eastmoney_stock.py，使用 -O 把产物写到 ../data/ 下）',
          '2. 在 server/api-plugin.ts 的 SPIDERS 注册表中登记：name、project、title、description、env、command（输出文件）、outputs、cron、tags',
          '3. 重启 npm run dev（修改配置依赖会自动重启）——「任务管理」「流程编排」的节点面板即出现该爬虫',
        ],
      },
      { type: 'p', text: '要求：输出必须是 data/ 下的 JSON 数组文件（运行结束后后端会解析条数并写入运行记录）；robots/限流等合规问题由爬虫作者自行评估（东财接口 robots 为全站禁抓，工程中已显式声明仅限本地演示）。' },
    ],
  },
  {
    id: 'tasks',
    title: '4. 任务管理',
    blocks: [
      { type: 'list', items: [
        '运行：POST /api/tasks/:id/run，后台 spawn scrapy，前端轮询运行记录直到结束；同爬虫不允许并发',
        '持久化：任务配置在 data/tasks.json，运行历史在 data/runs.json（保留最近 100 条）',
        '角色：只读账号不能运行/编辑；操作员与管理员可运行',
        '标签：按名称自动配色，同色即同标签',
      ] },
    ],
  },
  {
    id: 'flow',
    title: '5. 流程编排',
    blocks: [
      { type: 'list', items: [
        '节点面板选择真实爬虫创建节点（标题/环境/命令自动生成，无需手输）',
        '连线：从节点右侧输出圆点拖到目标节点（或点一下输出圆点再点目标节点）；Esc 取消',
        '删除连线：单击连线选中后按 Delete，或直接双击连线',
        '运行：按「开始」节点沿连线深度优先的顺序依次真实执行，失败即停，后续步骤标记「已跳过」',
        '自动排布：按执行顺序从左到右整理节点位置；记得保存',
      ] },
    ],
  },
  {
    id: 'bots',
    title: '6. 告警机器人',
    blocks: [
      { type: 'p', text: '支持企业微信群机器人与飞书自定义机器人。在「AI 助手 → 机器人配置」添加 webhook（格式校验），点「测试」会真实发送一条消息。爬虫或流程每次运行结束后，向所有启用中的机器人推送结果；开启「仅失败告警」则只推失败。配置持久化在 data/bots.json。' },
    ],
  },
  {
    id: 'ai',
    title: '7. AI 能力',
    blocks: [
      { type: 'list', items: [
        '「AI 配置」：选择供应商（DeepSeek / OpenAI / Kimi / 通义千问 / 自定义 OpenAI 兼容）、模型、Base URL、API Key；「测试连接」真实调用一次并显示延迟',
        'API Key 持久化在 data/ai-config.json，页面回显打码；留空保存表示不修改',
        '「AI 助手」：用已保存配置真实对话（系统提示词已内置平台语境）；未配置/未启用时给出引导',
      ] },
    ],
  },
  {
    id: 'users',
    title: '8. 用户与角色',
    blocks: [
      {
        type: 'table',
        head: ['角色', '权限'],
        rows: [
          ['管理员 admin', '全部功能 + 用户管理（录入/导入/改角色/停用/重置密码/删除）'],
          ['操作员 operator', '除用户管理外的全部功能（运行爬虫、编辑任务/流程等）'],
          ['只读 readonly', '仅查看；所有写操作返回 403'],
        ],
      },
      { type: 'list', items: [
        '自助注册 → 只读角色；管理员可在用户管理调整',
        '保护规则：不能删除/停用自己；系统始终保留一个启用的管理员',
        '导入格式：CSV 每行「用户名,密码,昵称,角色」，可下载模板；重复用户名自动跳过',
      ] },
    ],
  },
  {
    id: 'data',
    title: '9. 数据文件说明（data/）',
    blocks: [
      {
        type: 'table',
        head: ['文件', '内容'],
        rows: [
          ['eastmoney_600519_kline.json/.csv', '东财日线（120 根，-O 覆盖式）'],
          ['eastmoney_600519_snapshot.json', '东财实时快照'],
          ['fcfco_reports.json', '一创研究报告（60 条）'],
          ['tasks.json / runs.json', '任务配置 / 爬虫运行历史'],
          ['flows.json / flow-runs.json', '流程配置 / 流程运行历史（含每步明细）'],
          ['bots.json', '告警机器人 webhook 配置'],
          ['users.json / .auth-secret', '用户（scrypt 哈希密码）/ token 签名密钥'],
          ['ai-config.json', 'AI 供应商/模型/API Key'],
          ['nodes.json / python-default.json', '远程节点登记 / 默认 Python 解释器'],
        ],
      },
    ],
  },
  {
    id: 'api',
    title: '10. API 一览',
    blocks: [
      {
        type: 'table',
        head: ['方法', '路径', '说明'],
        rows: [
          ['GET', '/api/overview', '聚合总览（KPI/项目/环境/产出/最近运行）'],
          ['GET', '/api/metrics', '真实系统指标（CPU 采样/内存/磁盘）'],
          ['GET·POST', '/api/tasks', '任务列表 / 创建'],
          ['PUT·DELETE', '/api/tasks/:id', '更新 / 删除任务'],
          ['POST', '/api/tasks/:id/run', '真实运行爬虫（异步，返回运行记录）'],
          ['GET', '/api/runs', '爬虫运行历史'],
          ['GET·POST·PUT·DELETE', '/api/flows(:id)', '流程 CRUD'],
          ['POST', '/api/flows/:id/run', '按顺序真实执行流程'],
          ['GET', '/api/flow-runs', '流程运行历史（含步骤明细）'],
          ['GET·POST·PUT·DELETE', '/api/bots(:id)', '告警机器人 CRUD'],
          ['POST', '/api/bots/:id/test', '真实发送测试消息'],
          ['GET', '/api/ai/config · POST /api/ai/test · /api/ai/chat', 'AI 配置读写 / 连通性测试 / 对话'],
          ['GET', '/api/nodes · /api/pythons', '节点体系 / Python 解释器检测'],
          ['POST', '/api/auth/login · /api/auth/register', '登录 / 注册（公开）'],
          ['GET·POST·PUT·DELETE', '/api/users(:id) · /api/users/import', '用户管理（仅管理员）'],
        ],
      },
    ],
  },
  {
    id: 'faq',
    title: '11. 常见问题',
    blocks: [
      { type: 'list', items: [
        '东财接口返回 0 条：短时高频触发东方财富 WAF 临时限流，等待几分钟后重跑即可；正常单次抓取只发 2 个请求。',
        '本机开了 Clash/Mihomo TUN：push2 接口会被 fake-ip 劫持且代理线路不通——后端已内置 DNS 钉扎（DoH 解析真实 IP + 端到端探测 + 自动换 IP），无需手工处理。',
        '运行记录里 status=success 但 items=0：爬虫进程退出码为 0 但全部请求被限流；以 items 判断产出。',
        '研报正文抓不到：一创研报正文发布在微信公众号（robots 全站禁抓且以图片为主），系统只保留外链。',
        '端口被占用：5173/5174 被其他项目占用时 Vite 自动 +1，以控制台输出的地址为准。',
        '修改了 server/ 或 vite.config.ts：Vite 会自动重启；若页面行为异常，手动重启一次 npm run dev。',
      ] },
    ],
  },
]

export function TechDocs() {
  const [activeId, setActiveId] = useState(SECTIONS[0].id)

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((entry) => entry.isIntersecting)
        if (visible.length) setActiveId(visible[0].target.id.replace('doc-', ''))
      },
      { rootMargin: '-20% 0px -70% 0px' },
    )
    for (const section of SECTIONS) {
      const element = document.getElementById(`doc-${section.id}`)
      if (element) observer.observe(element)
    }
    return () => observer.disconnect()
  }, [])

  return (
    <div className="page">
      <div className="page-inner">
        <header className="page-header">
          <div className="brand-text">
            <h1>技术文档</h1>
            <p>ScrapyWeb 爬虫管理系统的使用与开发指南</p>
          </div>
        </header>

        <div className="docs-layout">
          <nav className="docs-toc">
            <div className="docs-toc-title">
              <IconBook /> 目录
            </div>
            {SECTIONS.map((section) => (
              <a key={section.id} href={`#doc-${section.id}`} className={activeId === section.id ? 'docs-toc-link on' : 'docs-toc-link'}>
                {section.title}
              </a>
            ))}
          </nav>

          <div className="docs-content">
            {SECTIONS.map((section) => (
              <section key={section.id} id={`doc-${section.id}`} className="panel docs-section">
                <h2>{section.title}</h2>
                {section.blocks.map((block, index) => {
                  if (block.type === 'p') {
                    return <p key={index} className="docs-p">{block.text}</p>
                  }
                  if (block.type === 'list') {
                    return (
                      <ul key={index} className="docs-list">
                        {block.items.map((item, itemIndex) => (
                          <li key={itemIndex}>{item}</li>
                        ))}
                      </ul>
                    )
                  }
                  if (block.type === 'code') {
                    return (
                      <pre key={index} className="docs-code">
                        {block.text}
                      </pre>
                    )
                  }
                  return (
                    <div key={index} className="docs-table-wrap">
                      <table className="docs-table">
                        <thead>
                          <tr>
                            {block.head.map((cell) => (
                              <th key={cell}>{cell}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {block.rows.map((row, rowIndex) => (
                            <tr key={rowIndex}>
                              {row.map((cell, cellIndex) => (
                                <td key={cellIndex}>{cell}</td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )
                })}
              </section>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
