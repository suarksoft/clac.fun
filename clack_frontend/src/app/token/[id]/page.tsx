'use client'

import { use } from 'react'
import { TokenDetailV2 } from '@/components/v2/token-detail-v2'
import { TokenDetailV1 } from '@/components/token-detail-v1'

export default function TokenDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)

  // V2: full address OR v2-* slug (e.g. v2-05d74fbf30c2)
  if (/^0x[a-fA-F0-9]{40}$/.test(id) || /^v2-[0-9a-f]{12}$/i.test(id)) {
    return <TokenDetailV2 idOrSlug={id} />
  }

  return <TokenDetailV1 id={id} />
}
