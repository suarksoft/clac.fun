'use client'

import { use } from 'react'
import Link from 'next/link'
import { Header } from '@/components/header'
import { TokenDetailV2 } from '@/components/v2/token-detail-v2'

export default function TokenDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)

  // V2: full address OR v2-* slug (e.g. v2-05d74fbf30c2)
  if (/^0x[a-fA-F0-9]{40}$/.test(id) || /^v2-[0-9a-f]{12}$/i.test(id)) {
    return <TokenDetailV2 idOrSlug={id} />
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      <main className="flex flex-1 flex-col items-center justify-center gap-3 px-4 text-center">
        <p className="text-xl font-semibold text-foreground">Token not found</p>
        <p className="max-w-md text-sm text-muted-foreground">
          Clac.fun artık yalnızca V2 tokenlarını gösteriyor. Bu link eski sürüme ait olabilir.
        </p>
        <Link href="/" className="mt-3 rounded-xl border border-border bg-secondary px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-secondary/70">
          ← Ana sayfaya dön
        </Link>
      </main>
    </div>
  )
}
