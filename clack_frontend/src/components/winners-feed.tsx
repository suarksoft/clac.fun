'use client'

import { TokenImage } from '@/components/token-image'
import { useQuery } from '@tanstack/react-query'
import { apiClientV2 } from '@/lib/api/client-v2'
import { toUiRecentTradeV2 } from '@/lib/api/mappers-v2'
import { formatAddress } from '@/lib/format'

export function WinnersFeed() {
  const { data: winners = [] } = useQuery({
    queryKey: ['winners-v2'],
    queryFn: async () => {
      const response = await apiClientV2.getRecentTrades(20)
      return response.map(toUiRecentTradeV2).slice(0, 20)
    },
    refetchInterval: 10000,
  })
  const loopItems = [...winners, ...winners]

  return (
    <div className="rounded-lg bg-[#07090f] p-2">
      <h3 className="mb-2 text-xs font-semibold text-[#a5adff]">Live Winners 🔥</h3>
      <div className="w-full overflow-hidden">
        <div className="flex w-max animate-ticker gap-1.5">
          {loopItems.map((item, index) => (
            <div
              key={`${item.txHash}-${index}`}
              className={`min-w-[148px] shrink-0 rounded-md border-l-2 bg-[#0b0f18] px-2 py-1.5 animate-in fade-in duration-500 ${
                item.type === 'sell'
                  ? 'border-l-emerald-500'
                  : 'border-l-amber-400'
              }`}
            >
              <div className="flex items-center gap-1.5">
                <div className="relative h-7 w-7 overflow-hidden rounded-sm">
                  <TokenImage src={item.tokenImage} alt={item.tokenSymbol} fill className="object-cover" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-[11px] font-semibold leading-tight text-white">{formatAddress(item.account)}</p>
                  <p className="truncate text-[10px] leading-tight text-[#a5adff]">{item.tokenSymbol}</p>
                </div>
              </div>
              <p className="mt-1 text-[10px] leading-tight text-muted-foreground">
                {item.type === 'sell' ? 'Realized value' : 'Trade volume'}
              </p>
              <p
                className={`text-[11px] font-bold leading-tight ${
                  item.type === 'sell' ? 'text-emerald-400' : 'text-amber-400'
                }`}
              >
                {item.amount.toFixed(2)} MON
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
