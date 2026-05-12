'use client'

import { ChevronLeft, ChevronRight, Flame } from 'lucide-react'
import { useRef } from 'react'
import { Button } from '@/components/ui/button'
import { TokenCard } from '@/components/token-card'
import { useQuery } from '@tanstack/react-query'
import { apiClientV2 } from '@/lib/api/client-v2'
import { toUiTokenFromV2 } from '@/lib/api/mappers-v2'

export function TrendingCarousel() {
  const scrollRef = useRef<HTMLDivElement>(null)
  const { data: trendingTokens = [] } = useQuery({
    queryKey: ['trending-tokens-v2'],
    queryFn: async () => {
      const response = await apiClientV2.getTokens('hot', 20)
      return response.map(toUiTokenFromV2)
    },
    refetchInterval: 10000,
  })

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const scrollAmount = 280
      scrollRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      })
    }
  }

  return (
    <div className="relative">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Flame className="h-5 w-5 text-orange-500" />
          <h2 className="text-lg font-semibold text-foreground">Trending Now</h2>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            onClick={() => scroll('left')}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            onClick={() => scroll('right')}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div
        ref={scrollRef}
        className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {trendingTokens.length === 0 && (
          <div className="rounded-xl border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
            Trending veri henuz yok.
          </div>
        )}
        {trendingTokens.map((token) => (
          <div key={token.id} className="w-[260px] shrink-0">
            <TokenCard token={token} />
          </div>
        ))}
      </div>
    </div>
  )
}
