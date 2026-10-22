# ScrapyWeb

爬虫任务监控仪表盘 + 爬虫工程演示：

- `src/` —— React + TypeScript + Vite + Arco Design 的监控仪表盘（图表基于 AntV G2）
- `server/` —— 内嵌后端（Vite 中间件插件）：`/api/*` 提供真实系统指标、任务 CRUD、
  **真实运行爬虫**、运行历史与抓取数据（详见 `server/README.md`）
- `crawlers/` —— Scrapy 爬虫工程，含两个抓取项目：
  - `eastmoney_stock`：东方财富公开行情接口（实时快照 + 日 K 线）
  - `fcfco_reports`：第一创业期货官网「一创研究」研究报告
- `data/` —— 爬虫产物与运行记录（kline/csv/snapshot/reports/tasks/runs）

仪表盘页面全部读取 `/api/*` 真实数据；「任务管理」的运行按钮会真实执行
`scrapy crawl` 并轮询运行结果。运行历史与任务配置持久化在 `data/*.json`。

## 快速开始

```powershell
# 前端仪表盘 + 内嵌后端（同一进程，端口 5173；被占用时自动 +1）
npm install
npm run dev

# 爬虫工程也可以命令行直接跑（详见 crawlers/README.md）
cd crawlers
..\.venv\Scripts\scrapy crawl eastmoney_stock -O ../data/eastmoney_600519_kline.json
..\.venv\Scripts\scrapy crawl fcfco_reports -O ../data/fcfco_reports.json
```

---

# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend enabling type-aware lint rules by installing `oxlint-tsgolint` and editing `.oxlintrc.json`:

```json
{
  "$schema": "./node_modules/oxlint/configuration_schema.json",
  "plugins": ["react", "typescript", "oxc"],
  "options": {
    "typeAware": true
  },
  "rules": {
    "react/rules-of-hooks": "error",
    "react/only-export-components": ["warn", { "allowConstantExport": true }]
  }
}
```

See the [Oxlint rules documentation](https://oxc.rs/docs/guide/usage/linter/rules) for the full list of rules and categories.
