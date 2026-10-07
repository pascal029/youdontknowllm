import type { ReactNode } from 'react'
import './AppShell.css'

type Props = {
  sidebar: ReactNode
  main: ReactNode
  inspector: ReactNode
}

export default function AppShell({ sidebar, main, inspector }: Props) {
  return (
    <div className="shell">
      <header className="shell__header">
        <span className="shell__logo">youdontknowllm</span>
      </header>
      <aside className="shell__sidebar" aria-label="Settings">{sidebar}</aside>
      <main className="shell__main">{main}</main>
      <aside className="shell__inspector" aria-label="Steps and stats">{inspector}</aside>
    </div>
  )
}
