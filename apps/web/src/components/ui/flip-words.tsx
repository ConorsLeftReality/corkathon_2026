import { useEffect, useState } from 'react'
import { AnimatePresence, m, useReducedMotion } from 'motion/react'
import { cn } from '#src/lib/cn'

/** from aceternity, aria-hidden so the caller must put the first word in sr-only text */
export function FlipWords({
  words,
  duration = 3000,
  className,
}: {
  words: readonly [string, ...string[]]
  duration?: number
  className?: string
}) {
  const [index, setIndex] = useState(0)
  const [isAnimating, setIsAnimating] = useState(false)
  // a word swapping itself is motion whatever the transition does
  const reduceMotion = useReducedMotion() === true
  const currentWord = words[index % words.length] ?? words[0]

  useEffect(() => {
    if (isAnimating || reduceMotion || words.length < 2) return undefined
    const timer = setTimeout(() => {
      setIndex((current) => (current + 1) % words.length)
      setIsAnimating(true)
    }, duration)
    return () => {
      clearTimeout(timer)
    }
  }, [isAnimating, reduceMotion, duration, words.length])

  return (
    <span aria-hidden data-flip-words className="relative inline-block">
      <AnimatePresence
        initial={false}
        onExitComplete={() => {
          setIsAnimating(false)
        }}
      >
        <m.span
          key={currentWord}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -40, x: 40, scale: 2, position: 'absolute' }}
          transition={{ type: 'spring', stiffness: 100, damping: 10 }}
          className={cn('relative z-10 inline-block text-left whitespace-nowrap', className)}
        >
          {currentWord.split('').map((letter, letterIndex) => (
            <m.span
              key={`${letter}-${letterIndex}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: letterIndex * 0.05, duration: 0.2 }}
              className="inline-block"
            >
              {letter === ' ' ? ' ' : letter}
            </m.span>
          ))}
        </m.span>
      </AnimatePresence>
    </span>
  )
}
