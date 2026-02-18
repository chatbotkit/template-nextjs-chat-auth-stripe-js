import './globals.css'

import Providers from '@/components/providers'
import { TooltipProvider } from '@/components/ui/tooltip'

export const metadata = {
  title: 'ChatBotKit SaaS Chat',
  description:
    'A full-featured chat SaaS template powered by ChatBotKit and Stripe',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="antialiased">
        <Providers>
          <TooltipProvider>{children}</TooltipProvider>
        </Providers>
      </body>
    </html>
  )
}
