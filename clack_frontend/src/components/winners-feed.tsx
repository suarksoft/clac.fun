'use client'

import Image from 'next/image'

const winners = [
  {
    id: 'w1',
    avatar: '/tokens/laser-eyes.jpg',
    wallet: '0xab3',
    token: 'BLITZ',
    subtitle: '$5 -> $47',
    value: '9.4x',
    status: 'Profit',
  },
  {
    id: 'w2',
    avatar: '/tokens/chad-bull.jpg',
    wallet: '0x8c1',
    token: 'KAYSERI',
    subtitle: 'Lottery win',
    value: '$180',
    status: 'Lottery',
  },
  {
    id: 'w3',
    avatar: '/tokens/rocket-cat.jpg',
    wallet: '0xfa2',
    token: 'LASER',
    subtitle: '$12 -> $61',
    value: '5.1x',
    status: 'Profit',
  },
  {
    id: 'w4',
    avatar: '/tokens/wagmi-wolf.jpg',
    wallet: '0x1d2',
    token: 'WAGMI',
    subtitle: 'Lottery win',
    value: '$92',
    status: 'Lottery',
  },
  {
    id: 'w5',
    avatar: '/tokens/fomo-fox.jpg',
    wallet: '0x7b4',
    token: 'MOON',
    subtitle: '$8 -> $53',
    value: '6.6x',
    status: 'Profit',
  },
]

export function WinnersFeed() {
  const loopItems = [...winners, ...winners]

  return (
    <div className="rounded-lg bg-[#07090f] p-2">
      <h3 className="mb-2 text-xs font-semibold text-[#a5adff]">Live Winners 🔥</h3>
      <div className="w-full overflow-hidden">
        <div className="flex w-max animate-ticker gap-1.5">
          {loopItems.map((item, index) => (
            <div
              key={`${item.id}-${index}`}
              className="min-w-[148px] shrink-0 rounded-md bg-[#0b0f18] px-2 py-1.5"
            >
              <div className="flex items-center gap-1.5">
                <div className="relative h-7 w-7 overflow-hidden rounded-sm">
                  <Image src={item.avatar} alt={item.token} fill className="object-cover" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-[11px] font-semibold leading-tight text-white">{item.wallet}</p>
                  <p className="truncate text-[10px] leading-tight text-[#a5adff]">{item.token}</p>
                </div>
              </div>
              <p className="mt-1 text-[10px] leading-tight text-muted-foreground">{item.subtitle}</p>
              <p
                className={`text-[11px] font-bold leading-tight ${item.status === 'Lottery' ? 'text-amber-400' : 'text-emerald-400'}`}
              >
                {item.value}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
