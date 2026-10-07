import './LoadProgress.css'

type Props = { progress: number; text: string }

/** Model download / load progress. `progress` is 0..1. */
export default function LoadProgress({ progress, text }: Props) {
  const pct = Math.round(progress * 100)
  return (
    <div className="load-progress" role="status">
      <div className="load-progress__row">
        <span>Loading model</span>
        <span className="load-progress__pct">{pct}%</span>
      </div>
      <progress max={100} value={pct} aria-label="Model load progress" />
      <p className="load-progress__text">{text}</p>
    </div>
  )
}
