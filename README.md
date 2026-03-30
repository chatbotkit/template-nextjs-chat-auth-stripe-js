# Chat + Auth + Stripe Template for Next.js / ChatBotKit / JS

A production-ready chat application template with authentication, conversation persistence, and full ChatBotKit platform integration - built with Next.js, ChatBotKit SDK, next-auth, and shadcn/ui.

## Why ChatBotKit?

Building an AI chat product typically means sourcing models, a conversation layer, background processing, storage, a tested abilities catalogue, authentication, security, monitoring, and more from separate systems. The cost adds up fast - not just in money, but in engineering time.

ChatBotKit brings all of this into one platform. This template gets you started with a monetizable chat app where your agents, skills, datasets, third-party integrations, guardrails, and conversation history are all managed through a single API - no need to stitch together disparate services.

## Features

- **Authentication** - Google OAuth via next-auth with JWT sessions
- **Protected Routes** - Middleware-based route protection for `/chat`
- **Streaming Chat** - Real-time AI responses using ChatBotKit streaming with `onStart`/`onFinish` lifecycle hooks
- **Platform Agents** - Select from your ChatBotKit bots via a dropdown (with optional filtering via `CHATBOTKIT_BOT_IDS`)
- **Conversation Persistence** - Conversations are saved to the platform and associated with contacts, so users can resume past conversations
- **Conversation History** - Slide-out sidebar showing previous conversations with auto-generated labels
- **Contact Tracking** - Authenticated users are automatically mapped to ChatBotKit contacts by email
- **Stripe Billing** - Subscription checkout, trials, billing portal, and access gating for SaaS-style plans
- **Modern UI** - Built with shadcn/ui components and Tailwind CSS
- **Server Actions** - Next.js server actions for secure API communication (API keys never reach the client)

## Technology Stack

- **Next.js 14** - App Router with server actions
- **ChatBotKit SDK** - `@chatbotkit/react` for client-side streaming, `@chatbotkit/sdk` for server-side API
- **next-auth** - Authentication with Google OAuth provider (extensible to GitHub, email, etc.)
- **shadcn/ui** - Accessible UI components built on Radix primitives
- **Tailwind CSS** - Utility-first styling with dark mode support

## Setup

### Prerequisites

- Node.js 18+
- A [ChatBotKit](https://chatbotkit.com) account with at least one bot configured
- Google OAuth credentials (for authentication)

### Automated Setup

```bash
npx create-cbk-app
```

Follow the prompts and configure environment variables (see below).

### Manual Setup

```bash
# Clone the repository
git clone <repo-url>
cd template-nextjs-chat-auth-stripe-js

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with your values (see Environment Variables below)

# Start the development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to get started.

## Environment Variables

| Variable                | Required | Description                                                                       |
| ----------------------- | -------- | --------------------------------------------------------------------------------- |
| `CHATBOTKIT_API_SECRET` | Yes      | ChatBotKit API token from [chatbotkit.com/tokens](https://chatbotkit.com/tokens)  |
| `CHATBOTKIT_BOT_IDS`    | No       | Comma-separated bot IDs to show (e.g., `bot_abc,bot_def`). Omit to show all bots. |
| `NEXTAUTH_SECRET`       | Yes      | Random secret for JWT signing - generate with `openssl rand -base64 32`           |
| `NEXTAUTH_URL`          | Yes      | Your app URL (e.g., `http://localhost:3000`)                                      |
| `GOOGLE_CLIENT_ID`      | Yes      | Google OAuth client ID                                                            |
| `GOOGLE_CLIENT_SECRET`  | Yes      | Google OAuth client secret                                                        |
| `STRIPE_SECRET_KEY`     | Yes\*    | Stripe secret API key                                                             |
| `STRIPE_PRICE_MONTHLY`  | Yes\*    | Stripe Price ID for your monthly subscription                                     |
| `STRIPE_PRICE_YEARLY`   | No       | Stripe Price ID for your yearly subscription                                      |
| `STRIPE_TRIAL_DAYS`     | No       | Trial length in days for new subscriptions (default: `14`)                        |
| `STRIPE_WEBHOOK_SECRET` | No       | Stripe webhook signing secret for `/api/stripe/webhook`                           |

\* Required only when you want to enforce paid access.

> **Note:** The AI model, backstory, skills, datasets, and all other agent configuration is managed per-bot on the [ChatBotKit platform](https://chatbotkit.com). Your app simply references the bot by ID - all capabilities come from the platform.

### Getting a ChatBotKit API Token

1. Sign up or log in at [chatbotkit.com](https://chatbotkit.com)
2. Go to [chatbotkit.com/tokens](https://chatbotkit.com/tokens)
3. Create a new API token and copy it to your `.env` file
4. Create at least one bot at [chatbotkit.com](https://chatbotkit.com) - it will appear in the agent dropdown

### Getting Google OAuth Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Create a new OAuth 2.0 Client ID
3. Set authorized redirect URI to `http://localhost:3000/api/auth/callback/google`
4. Copy the Client ID and Client Secret to your `.env` file

## How It Works

### Architecture

```
Browser (React)          Server Actions           ChatBotKit Platform
┌──────────────┐        ┌──────────────┐         ┌──────────────────┐
│ ConversationManager │──→│ complete()   │──→│ streamComplete()   │
│ (streaming client)  │←──│ onStart()    │   │ Bot config + skills│
│                     │   │ onFinish()   │   │ Datasets + RAG     │
│ Bot Selector        │──→│ listBots()   │──→│ Contacts           │
│ Conversation Sidebar│──→│ listConvos() │──→│ Conversations      │
└──────────────┘        └──────────────┘         └──────────────────┘
```

1. **Authentication** - User signs in via Google OAuth. The session is JWT-based (24h expiry).
2. **Contact Resolution** - On first chat load, the user's email is used to ensure a contact exists on the ChatBotKit platform via `cbk.contact.ensure()`.
3. **Bot Selection** - Available bots are fetched from the platform. The user selects one from the dropdown.
4. **Streaming** - Messages are sent via server actions. The `streamComplete` function streams the response token-by-token back to the browser.
5. **Persistence** - `onStart` creates a conversation on the platform; `onFinish` saves all messages and generates a label. The conversation is linked to the contact.
6. **History** - The sidebar fetches past conversations for the current contact and allows resuming them.
7. **Billing Gate** - Chat routes and server actions check Stripe subscription/trial status before allowing access.

### Stripe SaaS Billing Flow

1. Authenticated users who are not on an active/trialing plan are redirected from `/chat` to `/billing`.
2. The billing page creates Stripe Checkout sessions in subscription mode.
3. Returning subscribers can manage plans/cancellations through Stripe Billing Portal.
4. Every chat server action re-checks Stripe status, so expired subscriptions cannot continue using chat.
5. Optional webhook endpoint (`/api/stripe/webhook`) validates Stripe events and revalidates billing/chat routes.

### Stripe Webhook (Optional but Recommended)

1. In Stripe Dashboard, add an endpoint: `https://your-domain.com/api/stripe/webhook`
2. Subscribe to these events:
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.paid`
   - `invoice.payment_failed`
   - `checkout.session.completed`
3. Copy the webhook signing secret to `STRIPE_WEBHOOK_SECRET`

### Stateless Streaming with Server-Side Persistence

The chat uses a **stateless streaming** pattern - the full message history is sent with every request (no server-side session). Persistence is handled via lifecycle callbacks:

- **`onStart`** - Creates a new conversation on the platform (or reuses an existing one) and links it to the contact and bot.
- **`onFinish`** - Saves all messages to the conversation and generates a human-readable label from the first exchange.

This gives you the simplicity of stateless streaming with the durability of platform-managed conversations.

## Project Structure

```
├── actions/
│   ├── billing.js           # Server actions for checkout + portal redirects
│   └── conversation.jsx      # Server actions: complete, listBots, listConversations, etc.
├── app/
│   ├── layout.jsx            # Root layout with providers
│   ├── page.jsx              # Landing page (redirects to /chat or /auth)
│   ├── auth/signin/page.jsx  # Custom sign-in page
│   ├── billing/page.jsx      # Billing and subscription management page
│   ├── chat/
│   │   ├── page.jsx          # Chat page (server component, session gate)
│   │   └── chat-page.jsx     # Chat page (client component, all state)
│   └── api/auth/[...nextauth]/
│       └── route.ts          # NextAuth API route
│   └── api/stripe/webhook/
│       └── route.js          # Stripe webhook validation endpoint
├── components/
│   ├── providers.jsx         # Session provider wrapper
│   ├── chat/
│   │   ├── bot-selector.jsx          # Agent/bot dropdown selector
│   │   ├── chat-area.jsx             # Chat container with ConversationManager
│   │   ├── chat-header.jsx           # Header with sidebar toggle and user menu
│   │   ├── chat-input.jsx            # Auto-resizing textarea with Enter-to-send
│   │   ├── chat-messages.jsx         # Message bubbles with copy-to-clipboard
│   │   └── conversation-sidebar.jsx  # Slide-out conversation history panel
│   └── ui/                   # shadcn/ui primitives (avatar, button, card, etc.)
├── hooks/
│   └── useAutoRevert.js      # Auto-reverting state hook
├── lib/
│   ├── auth-options.js       # NextAuth configuration
│   ├── billing.js            # Stripe billing status and plan helpers
│   ├── stripe.js             # Stripe SDK singleton
│   └── utils.js              # cn() utility for Tailwind class merging
└── middleware.ts              # JWT-based route protection
```

## Customization

### Platform Agents

The template fetches your bots directly from the ChatBotKit platform. To configure agents:

1. Go to [chatbotkit.com](https://chatbotkit.com) and create bots
2. Configure each bot's backstory, model, skills, datasets, and integrations
3. The bots will automatically appear in the agent dropdown
4. Optionally set `CHATBOTKIT_BOT_IDS` in `.env` to restrict which bots are shown

When a bot is selected, its **full platform configuration** is used - including all skills, datasets, connected services, and guardrails. You can update any of these on the platform and the changes take effect immediately, without redeploying your app.

### Filter Available Bots

To only show specific bots in the dropdown, set `CHATBOTKIT_BOT_IDS`:

```env
CHATBOTKIT_BOT_IDS=bot_abc123,bot_def456
```

### Add AI Functions (Client-Side)

You can also add client-side functions to the `functions` array in `actions/conversation.jsx`. These run alongside the platform-configured skills:

```javascript
{
  name: 'lookupOrder',
  description: 'Look up an order by ID',
  parameters: {
    type: 'object',
    properties: {
      orderId: { type: 'string', description: 'The order ID' },
    },
    required: ['orderId'],
  },
  handler: async ({ orderId }) => {
    const order = await fetchOrder(orderId)
    return { result: order }
  },
},
```

> **Tip:** For most use cases, prefer adding skills on the ChatBotKit platform instead of hardcoding functions. Platform skills can be added, removed, and reconfigured without code changes.

### Add More Auth Providers

Edit `lib/auth-options.js` to add GitHub, email, or other providers:

```javascript
import GitHubProvider from 'next-auth/providers/github'

providers: [
  GoogleProvider({ ... }),
  GitHubProvider({
    clientId: process.env.GITHUB_CLIENT_ID,
    clientSecret: process.env.GITHUB_CLIENT_SECRET,
  }),
],
```

## Learn More

- [ChatBotKit Documentation](https://chatbotkit.com/docs)
- [ChatBotKit SDK Reference](https://chatbotkit.com/docs/node-sdk)
- [Next.js Documentation](https://nextjs.org/docs)
- [next-auth Documentation](https://next-auth.js.org)
- [shadcn/ui Documentation](https://ui.shadcn.com)
