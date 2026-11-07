import { FlipWords } from '#src/components/ui/flip-words'
import { GlassBorderButton } from '#src/components/ui/glass-border-button'
import { MagneticButton } from '#src/components/ui/magnetic-button'
import { StickyBanner } from '#src/components/ui/sticky-banner'

const WORDS = ['useful', 'loud', 'strange'] as const

export function LandingPage() {
  return (
    <>
      <StickyBanner label="Project status" className="bg-signal text-rim">
        <p className="text-label">Placeholder page. Replace it with your project.</p>
      </StickyBanner>
      <main className="mx-auto flex min-h-[80dvh] max-w-4xl flex-col justify-center gap-6 px-4 py-16">
        <h1 className="text-h1 font-semibold sm:text-display">
          Corkathon, built to be <span className="sr-only">{WORDS[0]}</span>
          <FlipWords words={WORDS} className="text-signal" />
        </h1>
        <p className="max-w-xl text-graphite">
          Placeholder. Say what the project does in one plain sentence here.
        </p>
        <MagneticButton className="self-start">
          <GlassBorderButton to="/app" className="h-11">
            Open the app
          </GlassBorderButton>
        </MagneticButton>
      </main>
    </>
  )
}
