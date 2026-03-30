'use server'

import { getServerSession } from 'next-auth'

import authOptions from '@/lib/auth-options'
import { getBillingStatusForUser } from '@/lib/billing'

import { streamComplete } from '@chatbotkit/react/actions/complete'
import { ChatBotKit } from '@chatbotkit/sdk'

import crypto from 'node:crypto'

const cbk = new ChatBotKit({
  secret: process.env.CHATBOTKIT_API_SECRET,
})

/**
 * @note Namespace for generating deterministic UUID v5 fingerprints from user
 * emails. This ensures the same email always produces the same fingerprint
 * without leaking PII.
 */
const CONTACT_NAMESPACE = 'e676f123-b5eb-4c44-a80b-8aa0e723cfe6'

/**
 * Generates a deterministic UUID v5 from an email address and namespace.
 *
 * @param {string} email - The email to derive a fingerprint from
 * @returns {string} A deterministic UUID v5 string
 */
function generateFingerprint(email) {
  const namespaceBytes = Buffer.from(CONTACT_NAMESPACE.replace(/-/g, ''), 'hex')

  const hash = crypto
    .createHash('sha1')
    .update(namespaceBytes)
    .update(email.toLowerCase())
    .digest()

  // Set version to 5 (SHA-1 based)
  hash[6] = (hash[6] & 0x0f) | 0x50

  // Set variant to RFC 4122
  hash[8] = (hash[8] & 0x3f) | 0x80

  const hex = hash.toString('hex').slice(0, 32)

  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32),
  ].join('-')
}

/**
 * Parses the CHATBOTKIT_BOT_IDS environment variable into an array of bot IDs.
 *
 * @returns {string[]|null} Array of bot IDs to allow, or null for all bots
 */
function getAllowedBotIds() {
  const raw = process.env.CHATBOTKIT_BOT_IDS

  if (!raw || !raw.trim()) {
    return null
  }

  return raw
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean)
}

/**
 * Returns the authenticated session or throws.
 */
async function requireSession() {
  const session = await getServerSession(authOptions)

  if (!session?.user?.email) {
    throw new Error('Unauthorized')
  }

  const billing = await getBillingStatusForUser(session.user)

  if (!billing.hasAccess) {
    throw new Error('Subscription required')
  }

  return { session, billing }
}

/**
 * Ensures a ChatBotKit contact exists for the authenticated user.
 *
 * Generates a deterministic UUID v5 fingerprint from the user's email so the
 * fingerprint is stable and doesn't leak raw PII.
 *
 * @returns {Promise<string>} The contact ID
 */
export async function ensureContact() {
  const { session } = await requireSession()

  const { id } = await cbk.contact.ensure({
    fingerprint: generateFingerprint(session.user.email),
    email: session.user.email,
    name: session.user.name || '',
  })

  return id
}

/**
 * Lists available bots from the ChatBotKit platform.
 *
 * When CHATBOTKIT_BOT_IDS is set (comma-separated), only those bots are
 * returned. Otherwise, all bots from the platform are listed.
 */
export async function listBots() {
  await requireSession()

  const { items } = await cbk.bot.list()

  const allowedIds = getAllowedBotIds()

  const filtered = allowedIds
    ? items.filter(({ id }) => allowedIds.includes(id))
    : items

  return filtered.map(({ id, name, description }) => ({
    id,
    name: name || 'Unnamed Bot',
    description: description || '',
  }))
}

/**
 * Lists conversations for a contact, ordered by most recent first.
 *
 * @param {string} contactId - The contact ID to list conversations for
 */
export async function listConversations(contactId) {
  await requireSession()

  const { items } = await cbk.contact.conversation.list(contactId, {
    order: 'desc',
    take: 50,
  })

  return items.map(({ id, name, description, createdAt }) => ({
    id,
    name: name || '',
    description: description || '',
    createdAt,
  }))
}

/**
 * Deletes a conversation from the platform.
 *
 * @param {string} conversationId - The conversation ID to delete
 */
export async function deleteConversation(conversationId) {
  await requireSession()

  await cbk.conversation.delete(conversationId)
}

/**
 * Fetches the messages of an existing conversation.
 *
 * @param {string} conversationId - The conversation ID
 * @returns {Promise<Array<{ id: string, type: string, text: string, createdAt: string }>>}
 */
export async function fetchConversationMessages(conversationId) {
  await requireSession()

  const { items } = await cbk.conversation.message.list(conversationId)

  return items
    .filter(({ type }) => type === 'user' || type === 'bot')
    .map(({ id, type, text, createdAt }) => ({
      id,
      type,
      text,
      createdAt: new Date(createdAt).toISOString(),
    }))
}

/**
 * Generates a short name and description for a conversation based on its
 * messages, used as labels in the conversation history sidebar.
 *
 * @param {Array<{ type: string, text: string }>} messages
 * @returns {Promise<{ name: string, description: string }>}
 */
async function generateConversationLabel(messages) {
  const userMessages = messages
    .filter((m) => m.type === 'user')
    .map((m) => m.text)
    .slice(0, 3)
    .join(' ')

  // Use the first ~80 chars of user input as the name
  const name = userMessages.slice(0, 80) || 'New conversation'
  const description = userMessages.slice(0, 200) || ''

  return { name, description }
}

/**
 * Completes a conversation turn using ChatBotKit streaming.
 *
 * The flow is stateless on the wire (full message history sent each turn)
 * but conversations are persisted server-side:
 *
 * 1. `onStart` - creates or fetches the conversation, associating it with
 *    the contact. Returns a `conversation` event to the client with the ID.
 * 2. The completion streams normally.
 * 3. `onFinish` - saves the new messages (user input + bot response) to the
 *    conversation and updates its name/description label.
 *
 * @param {object} params
 * @param {string} [params.botId] - The platform bot ID to use
 * @param {string} [params.contactId] - The contact ID to associate with
 * @param {string} [params.conversationId] - Resume an existing conversation
 * @param {Array} params.messages - The conversation messages
 */
export async function complete({ botId, contactId, conversationId, messages }) {
  const { session, billing } = await requireSession()

  return streamComplete({
    client: cbk.conversation,

    // When a botId is provided, the platform uses that bot's full
    // configuration (backstory, model, skills, datasets, etc.) directly.
    // Otherwise, fall back to a simple inline backstory.

    ...(botId
      ? { botId }
      : {
          backstory: `You are a helpful AI assistant. You are friendly, concise, and knowledgeable. You help users with their questions and tasks. The current user is ${
            session.user.name || 'a user'
          }. Billing status: ${billing.status}.`,
          model: 'gpt-4o',
        }),

    // Associate the conversation with the contact for the stateless
    // complete call itself (the API uses this for tracking).
    ...(contactId ? { contactId } : {}),

    // Pass the conversation messages.

    messages,

    // Define functions the AI agent can call. Add your own functions here
    // to give the agent capabilities like fetching data, creating records, etc.

    functions: [
      {
        name: 'getCurrentTime',
        description: 'Gets the current date and time',
        parameters: {},
        handler: async () => {
          return {
            result: {
              time: new Date().toISOString(),
            },
          }
        },
      },
    ],

    /**
     * Called when the streaming begins. Creates a new conversation if one
     * doesn't exist yet, or verifies ownership of an existing one.
     * Returns a `conversation` event so the client knows the conversation ID.
     */
    async onStart() {
      if (!contactId) {
        return
      }

      if (!conversationId) {
        // Create a new conversation associated with the contact
        const conversation = await cbk.conversation.create({
          contactId,
          botId,
        })

        conversationId = conversation.id
      }

      return {
        type: 'conversation',
        data: { id: conversationId },
      }
    },

    /**
     * Called when the streaming completes. Persists the new messages
     * (from this turn) to the conversation and updates the label.
     */
    async onFinish({ messages: allMessages }) {
      if (!conversationId) {
        return
      }

      // The new messages are those beyond what the client originally sent
      const newMessages = allMessages.slice(messages.length - 1)

      if (newMessages.length === 0) {
        return
      }

      // Save messages to the conversation
      for (const msg of newMessages) {
        await cbk.conversation.message.create(conversationId, {
          type: msg.type,
          text: msg.text,
        })
      }

      // Update the conversation label based on content
      const { name, description } = await generateConversationLabel(allMessages)

      await cbk.conversation.update(conversationId, { name, description })

      return {
        type: 'conversation',
        data: { id: conversationId, name, description },
      }
    },
  })
}
