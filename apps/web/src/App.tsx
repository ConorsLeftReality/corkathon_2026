import { LazyMotion, MotionConfig } from 'motion/react'
import { createBrowserRouter, RouterProvider } from 'react-router'
import { SessionProvider } from '#src/features/auth/SessionProvider.tsx'
import { LandingPage } from '#src/routes/LandingPage.tsx'
import { LoginPage } from '#src/routes/LoginPage.tsx'
import { NotesPage } from '#src/routes/NotesPage.tsx'
import { NotFoundPage } from '#src/routes/NotFoundPage.tsx'
import { TodayPage } from '#src/routes/TodayPage.tsx'
import { RadarPage } from '#src/routes/RadarPage.tsx'
import { RequireSession } from '#src/routes/RequireSession.tsx'
import { Shell } from '#src/shell/Shell.tsx'

const loadMotionFeatures = () =>
  import('#src/lib/motion-features.ts').then((features) => features.domAnimation)

const router = createBrowserRouter([
  { path: '/', element: <LandingPage /> },
  { path: '/login', element: <LoginPage /> },
  {
    path: '/app',
    element: <RequireSession />,
    children: [
      {
        element: <Shell />,
        children: [
          { index: true, element: <TodayPage /> },
          { path: 'radar', element: <RadarPage /> },
          { path: 'notes', element: <NotesPage /> },
        ],
      },
    ],
  },
  { path: '*', element: <NotFoundPage /> },
])

export function App() {
  return (
    <MotionConfig reducedMotion="user">
      <LazyMotion features={loadMotionFeatures} strict>
        <SessionProvider>
          <RouterProvider router={router} />
        </SessionProvider>
      </LazyMotion>
    </MotionConfig>
  )
}
