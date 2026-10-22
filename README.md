# ScrapyWeb

爬虫任务监控仪表盘 + 爬虫工程演示：

- `src/` —— React + TypeScript + Vite + Arco Design 的监控仪表盘（图表基于 AntV G2）
- `crawlers/` —— Scrapy 爬虫工程，含两个抓取项目：
  - `eastmoney_stock`：东方财富公开行情接口（实时快照 + 日 K 线）
  - `fcfco_reports`：第一创业期货官网「一创研究」研究报告

## 快速开始

```powershell
# 前端仪表盘
npm install
npm run dev

# 爬虫工程（详见 crawlers/README.md）
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
