import { LazyMotion, MotionConfig } from 'motion/react'
import { createBrowserRouter, RouterProvider } from 'react-router'
import { DitherBackdrop } from '#src/components/DitherBackdrop.tsx'
import { SessionProvider } from '#src/features/auth/SessionProvider.tsx'
import { LandingPage } from '#src/routes/LandingPage.tsx'
import { NotFoundPage } from '#src/routes/NotFoundPage.tsx'
import { TodayPage } from '#src/routes/TodayPage.tsx'
import { RadarPage } from '#src/routes/RadarPage.tsx'
import { Shell } from '#src/shell/Shell.tsx'

const loadMotionFeatures = () =>
  import('#src/lib/motion-features.ts').then((features) => features.domAnimation)

// sign in is off for the demo, wrap /app in RequireSession and add /login back to turn it on
const router = createBrowserRouter([
  { path: '/', element: <LandingPage /> },
  {
    path: '/app',
    element: <Shell />,
    children: [
      { index: true, element: <TodayPage /> },
      { path: 'radar', element: <RadarPage /> },
    ],
  },
  { path: '*', element: <NotFoundPage /> },
])

export function App() {
  return (
    <MotionConfig reducedMotion="user">
      <LazyMotion features={loadMotionFeatures} strict>
        <SessionProvider>
          <DitherBackdrop />
          <RouterProvider router={router} />
        </SessionProvider>
      </LazyMotion>
    </MotionConfig>
  )
}
