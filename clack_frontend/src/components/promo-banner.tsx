'use client'

import { Button } from '@/components/ui/button'
import { ArrowRight } from 'lucide-react'
import Link from 'next/link'
import Image from 'next/image'

export function PromoBanner() {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-primary/20">
      {/* Background Image */}
      <div className="absolute inset-0">
        <Image
          src="/promo-banner.jpg"
          alt="Promo Background"
          fill
          priority
          loading="eager"
          className="object-cover opacity-40"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-background via-background/80 to-transparent" />
      </div>

      <div className="relative flex flex-col items-center justify-between gap-6 p-8 md:flex-row">
        <div className="flex flex-col gap-3 text-center md:text-left">
          <div className="flex items-center justify-center gap-2 md:justify-start">
            <Image 
              src="/clac-logo.svg" 
              alt="Clac" 
              width={24} 
              height={24}
              className="h-6 w-6"
            />
            <span className="inline-flex h-6 items-center rounded-full bg-primary/20 px-3 text-xs font-bold uppercase tracking-wider text-primary">
              Death Clock Live
            </span>
          </div>
          <h3 className="text-balance text-2xl font-bold text-foreground md:text-3xl">
            {'$5. 6 hours. 10x or clac.'}
          </h3>
          <p className="max-w-lg text-pretty text-muted-foreground">
            {'Every token has a death clock. Trade it, flip it, or hold for the lottery. When time\'s up: clac. 💀'}
          </p>
        </div>

        <Link href="/">
          <Button size="lg" className="gap-2 bg-primary px-8 text-primary-foreground shadow-lg shadow-primary/25 transition-all hover:bg-primary/90 hover:shadow-xl hover:shadow-primary/30">
            <Image 
              src="/clac-logo.svg" 
              alt="Snap" 
              width={20} 
              height={20}
              className="h-5 w-5"
            />
            Start Trading
            <ArrowRight className="h-4 w-4" />
          </Button>
        </Link>
      </div>
    </div>
  )
}
