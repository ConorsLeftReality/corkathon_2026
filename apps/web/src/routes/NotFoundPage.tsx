import { Link } from 'react-router'

export function NotFoundPage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-3 px-4">
      <h1 className="text-h1 font-semibold">Page not found</h1>
      <p className="text-graphite">That address does not match anything here.</p>
      <Link to="/">Go to the home page</Link>
    </main>
  )
}
