import { Link } from 'react-router'

export function OverviewPage() {
  return (
    <>
      <h1 className="text-h1 font-semibold">Overview</h1>
      <section className="surface flex flex-col gap-2 p-6">
        <h2 className="text-h2 font-semibold">Placeholder</h2>
        <p className="text-graphite">
          Your main screen goes here. <Link to="/app/notes">Notes</Link> shows a full feature to
          copy.
        </p>
      </section>
    </>
  )
}
