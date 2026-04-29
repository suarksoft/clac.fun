export function formatNumber(num: number): string {
  if (!Number.isFinite(num)) return '$0.00'
  if (num >= 1_000_000_000) return `$${(num / 1_000_000_000).toFixed(2)}B`
  if (num >= 1_000_000) return `$${(num / 1_000_000).toFixed(2)}M`
  if (num >= 1_000) return `$${(num / 1_000).toFixed(2)}K`
  if (num >= 1) return `$${num.toFixed(2)}`
  return `$${num.toFixed(4)}`
}

export function formatTokenPrice(price: number): string {
  if (!Number.isFinite(price) || price <= 0) return '0'
  if (price >= 1) {
    return price.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  }
  if (price >= 0.01) return price.toFixed(4)
  if (price >= 0.0001) return price.toFixed(6)

  const str = price.toFixed(18)
  const match = str.match(/^0\.(0+)([1-9]\d{0,3})/)
  if (match) {
    const zeroCount = match[1].length
    const significantDigits = match[2]
    return `0.0{${zeroCount}}${significantDigits}`
  }

  return price.toExponential(4)
}

export function formatMonAmount(value: number, maxFractionDigits = 4): string {
  if (!Number.isFinite(value)) return '0'
  return value.toLocaleString('en-US', { maximumFractionDigits: maxFractionDigits })
}

/** Short display for large token amounts (trade tables, mobile). */
export function formatAbbreviatedTokenAmount(amount: number): string {
  if (!Number.isFinite(amount)) return '0'
  const n = Math.abs(amount)
  const sign = amount < 0 ? '-' : ''
  if (n >= 1_000_000_000) return `${sign}${(amount / 1_000_000_000).toFixed(2)}B`
  if (n >= 1_000_000) return `${sign}${(amount / 1_000_000).toFixed(2)}M`
  if (n >= 1_000) return `${sign}${(amount / 1_000).toFixed(2)}K`
  if (n >= 1) return `${sign}${amount.toLocaleString('en-US', { maximumFractionDigits: 2 })}`
  return `${sign}${amount.toFixed(4)}`
}

export function formatAddress(address: string): string {
  if (!address) return '--'
  if (address.length <= 10) return address
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

export function formatTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000)

  if (seconds < 60) return `${seconds}s ago`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  return `${Math.floor(seconds / 86400)}d ago`
}
