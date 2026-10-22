# ScrapyWeb 后端 API（Vite 中间件插件）

`server/api-plugin.ts` 在 Vite dev / preview 服务器上挂载 `/api/*` 路由，
为仪表盘提供真实数据与真实操作，不引入任何额外进程或依赖。

## 路由

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/overview` | 节点信息、KPI、项目/环境列表、产出文件清单、最近运行 |
| GET | `/api/metrics` | 真实系统指标：CPU（采样）、内存、磁盘、开机时长 |
| GET | `/api/tasks` | 任务列表（首次访问用爬虫注册表播种到 `data/tasks.json`） |
| POST | `/api/tasks` | 创建任务（持久化） |
| PUT | `/api/tasks/:id` | 更新任务（cron/状态/标签等） |
| DELETE | `/api/tasks/:id` | 删除任务 |
| POST | `/api/tasks/:id/run` | **真实运行**：spawn `.venv/Scripts/scrapy.exe crawl <spider>`，运行记录写入 `data/runs.json` |
| GET | `/api/runs` | 运行历史（`?spider=` 过滤） |
| GET | `/api/eastmoney/snapshot` | `data/eastmoney_600519_snapshot.json` |
| GET | `/api/eastmoney/kline` | `data/eastmoney_600519_kline.json` |
| GET | `/api/fcfco/reports` | `data/fcfco_reports.json` |

## 关键实现

- **运行爬虫**：`child_process.spawn` 调用工程虚拟环境里的 scrapy.exe，
  `cwd = crawlers/`，输出落到 `data/`；同一种爬虫同一时刻只允许一个进程；
  进程退出后统计产出 JSON 的条数并回写任务 `lastRun`。
- **CPU 指标**：请求内两次采样 `os.cpus()` 时间差计算每核占用与均值。
- **磁盘指标**：`fs.statfs` 读取项目所在卷的真实容量。
- 任务与运行记录均持久化在 `data/` 下，重启不丢。
