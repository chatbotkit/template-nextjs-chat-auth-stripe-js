'use client'

import { useCallback, useEffect, useState } from 'react'

import {
  deleteConversation,
  ensureContact,
  fetchConversationMessages,
} from '@/actions/conversation'
import ChatArea from '@/components/chat/chat-area'
import ChatHeader from '@/components/chat/chat-header'
import ConversationSidebar from '@/components/chat/conversation-sidebar'

import ConversationManager from '@chatbotkit/react/components/ConversationManager'

export default function ChatPage({ endpoint, userImage, userName }) {
  const [selectedBotId, setSelectedBotId] = useState(null)
  const [contactId, setContactId] = useState(null)
  const [activeConversationId, setActiveConversationId] = useState(null)
  const [restoredMessages, setRestoredMessages] = useState(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [sidebarRefreshKey, setSidebarRefreshKey] = useState(0)

  // Use a key to force-remount ConversationManager when switching conversations
  const [conversationKey, setConversationKey] = useState(0)

  // Resolve the contact on mount
  useEffect(() => {
    ensureContact()
      .then(setContactId)
      .catch((err) => {
        console.error('[ChatPage] Failed to ensure contact:', err)
      })
  }, [])

  const handleComplete = useCallback(
    (params) => {
      // Prepend restored messages so the bot sees the full conversation
      // history, not just the new messages from this session.
      const allMessages = [
        ...(restoredMessages || []),
        ...(params.messages || []),
      ]

      return endpoint({
        ...params,
        messages: allMessages,
        botId: selectedBotId,
        contactId,
        conversationId: activeConversationId,
      })
    },
    [endpoint, selectedBotId, contactId, activeConversationId, restoredMessages]
  )

  /**
   * Switches to an existing conversation by loading its messages.
   */
  const handleSelectConversation = useCallback(async (conversationId) => {
    try {
      const messages = await fetchConversationMessages(conversationId)

      setActiveConversationId(conversationId)
      setRestoredMessages(messages)
      setConversationKey((k) => k + 1)
    } catch (err) {
      console.error('[ChatPage] Failed to load conversation:', err)
    }
  }, [])

  /**
   * Starts a fresh conversation by clearing messages and the active ID.
   */
  const handleNewConversation = useCallback(() => {
    setActiveConversationId(null)
    setRestoredMessages(null)
    setConversationKey((k) => k + 1)
  }, [])

  /**
   * Handles deletion of a conversation. If the deleted conversation is the
   * active one, resets to a fresh state.
   */
  const handleDeleteConversation = useCallback(
    (conversationId) => {
      if (conversationId === activeConversationId) {
        setActiveConversationId(null)
        setRestoredMessages(null)
        setConversationKey((k) => k + 1)
      }
    },
    [activeConversationId]
  )

  return (
    <div className="flex h-screen">
      <ConversationSidebar
        contactId={contactId}
        activeConversationId={activeConversationId}
        onSelectConversation={handleSelectConversation}
        onNewConversation={handleNewConversation}
        onDeleteConversation={handleDeleteConversation}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        refreshKey={sidebarRefreshKey}
      />
      <div className="flex flex-col flex-1 min-w-0">
        <ChatHeader
          selectedBotId={selectedBotId}
          onSelectBot={setSelectedBotId}
          onToggleSidebar={() => setSidebarOpen((o) => !o)}
        />
        <ConversationManager key={conversationKey} endpoint={handleComplete}>
          <ChatArea
            userImage={userImage}
            userName={userName}
            restoredMessages={restoredMessages}
            onResponseComplete={() => setSidebarRefreshKey((k) => k + 1)}
          />
        </ConversationManager>
      </div>
    </div>
  )
}
