'use client'

import React from 'react'

interface State {
  error: Error | null
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback?: React.ReactNode },
  State
> {
  constructor(props: { children: React.ReactNode; fallback?: React.ReactNode }) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('ErrorBoundary caught:', error, info)
  }

  render() {
    if (this.state.error) {
      if (this.props.fallback) return this.props.fallback
      return (
        <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-muted-foreground">
          <p className="text-lg font-semibold text-foreground">Something went wrong</p>
          <p className="text-sm">{this.state.error.message?.slice(0, 120)}</p>
          <button
            onClick={() => {
              this.setState({ error: null })
              window.location.reload()
            }}
            className="mt-2 rounded-xl border border-border bg-secondary px-4 py-2 text-sm font-medium text-foreground hover:bg-secondary/70"
          >
            Reload page
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
