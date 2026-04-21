'use client'

const winners = [
  '🟢 0xab3 → $5 → $47 (9.4x) on $BLITZ — 12m ago',
  '🎰 0x8c1 → lottery win $180 on $KAYSERI — 28m ago',
  '🟢 0xfa2 → $12 → $61 (5.1x) on $LASER — 34m ago',
  '🎰 0x1d2 → lottery win $92 on $WAGMI — 47m ago',
]

export function WinnersFeed() {
  return (
    <div className="rounded-xl border border-emerald-500/30 bg-card p-4">
      <h3 className="mb-3 text-sm font-semibold text-foreground">Live Winners Feed</h3>
      <div className="space-y-2">
        {winners.map((item) => (
          <p key={item} className="text-sm text-emerald-400">
            {item}
          </p>
        ))}
      </div>
    </div>
  )
}
