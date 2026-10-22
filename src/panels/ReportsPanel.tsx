import { useEffect, useState } from 'react'
import type { ReportItem } from '../api.ts'
import { fetchReports } from '../api.ts'
import { IconBars } from '../icons.tsx'

/** 真实数据：一创研究报告列表（data/fcfco_reports.json）。 */
export function ReportsPanel() {
  const [reports, setReports] = useState<ReportItem[] | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let alive = true
    fetchReports()
      .then((value) => {
        if (alive) setReports(value)
      })
      .catch((err: Error) => {
        if (alive) setError(err.message)
      })
    return () => {
      alive = false
    }
  }, [])

  if (error || reports === null) {
    return (
      <section className="panel">
        <div className="panel-head">
          <span className="panel-icon tone-orange">
            <IconBars />
          </span>
          <div className="panel-text">
            <h2>{error ? '暂无研报数据' : '加载中'}</h2>
            <p>{error || '正在读取 data/fcfco_reports.json'}</p>
          </div>
        </div>
      </section>
    )
  }

  return (
    <section className="panel">
      <div className="panel-head">
        <span className="panel-icon tone-orange">
          <IconBars />
        </span>
        <div className="panel-text">
          <h2>一创研究报告</h2>
          <p>共 {reports.length} 条 · 抓取自 futures.fcsc.com「一创研究」栏目</p>
        </div>
      </div>
      <div className="report-scroll">
        <table className="report-table">
          <thead>
            <tr>
              <th>日期</th>
              <th>标题</th>
              <th>正文来源</th>
            </tr>
          </thead>
          <tbody>
            {reports.map((report) => (
              <tr key={report.article_id}>
                <td className="report-date">{report.date ?? '—'}</td>
                <td>
                  <a className="report-link" href={report.detail_url} target="_blank" rel="noreferrer">
                    {report.title}
                  </a>
                </td>
                <td>
                  {report.outbound_url ? (
                    <a className="report-link" href={report.outbound_url} target="_blank" rel="noreferrer">
                      微信公众号文章 ↗
                    </a>
                  ) : (
                    <span className="report-muted">站内</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
