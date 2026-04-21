'use client'

import { formatAddress } from '@/lib/format'
import { useLiveEvents } from '@/hooks/use-live-events'
import Image from 'next/image'

export function LiveTicker() {
  const liveEvents = useLiveEvents()
  // Duplicate events for seamless loop
  const events = [...liveEvents, ...liveEvents]

  return (
    <div className="w-full overflow-hidden border-b border-border/50 bg-secondary/30">
      <div className="flex animate-ticker">
        {events.map((event, index) => (
          <div
            key={`${event.id}-${index}`}
            className="flex shrink-0 items-center gap-2 px-4 py-2"
          >
            <div className="relative h-5 w-5 overflow-hidden rounded-full">
              <Image
                src={event.tokenImage}
                alt={event.tokenSymbol}
                fill
                className="object-cover"
              />
            </div>
            <span className="text-xs text-muted-foreground">
              {formatAddress(event.account)}
            </span>
            <span
              className={`text-xs font-semibold ${
                event.type === 'buy'
                  ? 'text-emerald-500'
                  : event.type === 'sell'
                  ? 'text-red-500'
                  : event.type === 'clac'
                  ? 'text-red-500'
                  : event.type === 'lottery'
                  ? 'text-amber-400'
                  : event.type === 'win'
                  ? 'text-emerald-400'
                  : 'text-amber-500'
              }`}
            >
              {event.type === 'buy' && 'BOUGHT'}
              {event.type === 'sell' && 'SOLD'}
              {event.type === 'clac' && "GOT CLAC'D"}
              {event.type === 'lottery' && 'WON LOTTERY'}
              {event.type === 'win' && 'MADE'}
            </span>
            {event.amount > 0 && event.type !== 'win' && (
              <span className="text-xs text-foreground">
                {event.amount.toFixed(2)} MON
              </span>
            )}
            {event.type === 'win' && (
              <span className="text-xs text-foreground">
                {event.amount.toFixed(1)}x
              </span>
            )}
            <span className="text-xs font-medium text-foreground">
              ${event.tokenSymbol}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
