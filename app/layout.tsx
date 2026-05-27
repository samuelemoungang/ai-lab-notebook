import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title:       'AI Lab Notebook',
  description: 'Interactive scientific notebook powered by AI + Python (Pyodide)',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        {/* JetBrains Mono for code */}
        <link
          href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
        {/* Plotly.js — loaded globally so Python plot outputs can use it */}
        {/* eslint-disable-next-line @next/next/no-sync-scripts */}
        <script src="https://cdn.plot.ly/plotly-2.34.0.min.js" />
      </head>
      <body className="min-h-screen bg-notebook-bg antialiased">
        {children}
      </body>
    </html>
  )
}
