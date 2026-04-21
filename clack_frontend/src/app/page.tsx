import { Header } from '@/components/header'
import { LiveTicker } from '@/components/live-ticker'
import { PromoBanner } from '@/components/promo-banner'
import { TrendingCarousel } from '@/components/trending-carousel'
import { TokenGrid } from '@/components/token-grid'
import { WinnersFeed } from '@/components/winners-feed'

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <LiveTicker />
      
      <main className="flex-1">
        <div className="container mx-auto px-4 py-6">
          <div className="space-y-8">
            {/* Promo Banner */}
            <PromoBanner />
            <WinnersFeed />

            {/* Trending Tokens */}
            <TrendingCarousel />

            {/* Token Grid */}
            <TokenGrid />
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border bg-card py-6">
        <div className="container mx-auto flex flex-col items-center justify-between gap-4 px-4 text-sm text-muted-foreground md:flex-row">
          <div className="flex items-center gap-4">
            <span className="font-semibold text-foreground">Clac.fun</span>
            <span className="text-xs">Built for degens</span>
          </div>
          <div className="flex items-center gap-6">
            <a href="#" className="transition-colors hover:text-foreground">Docs</a>
            <a href="#" className="transition-colors hover:text-foreground">Twitter</a>
            <a href="#" className="transition-colors hover:text-foreground">Telegram</a>
            <a href="#" className="transition-colors hover:text-foreground">Contract</a>
          </div>
        </div>
      </footer>
    </div>
  )
}
