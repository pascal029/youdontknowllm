import AppShell from './components/AppShell'

export default function App() {
  return (
    <AppShell
      sidebar={<p>Settings</p>}
      main={<p>Chat</p>}
      inspector={<p>Steps &amp; stats</p>}
    />
  )
}
