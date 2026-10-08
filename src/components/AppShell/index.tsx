import type { ReactNode } from 'react'
import './index.css'

type Props = {
  sidebar: ReactNode
  main: ReactNode
  inspector: ReactNode
}

export default function AppShell({ sidebar, main, inspector }: Props) {
  return (
    <div className="shell">
      <header className="shell__header">
        <a className="shell__logo" href="/">youdontknowllm</a>
        <nav className="shell__nav" aria-label="Main">
          <a href="/learn/">Learn</a>
        </nav>
      </header>
      <aside className="shell__sidebar" aria-label="Settings">{sidebar}</aside>
      <main className="shell__main">{main}</main>
      <aside className="shell__inspector" aria-label="Steps and stats">{inspector}</aside>
    </div>
  )
}
