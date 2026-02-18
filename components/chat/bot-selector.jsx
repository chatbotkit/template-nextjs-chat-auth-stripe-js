'use client'

import { useEffect, useState } from 'react'

import { listBots } from '@/actions/conversation'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

import { Bot, ChevronDown, Loader2 } from 'lucide-react'

/**
 * Dropdown component for selecting a ChatBotKit platform bot.
 *
 * Fetches bots on mount and allows the user to pick which agent to chat with.
 * The selected bot's ID is passed to the conversation server action.
 */
export default function BotSelector({ selectedBotId, onSelect }) {
  const [bots, setBots] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    listBots()
      .then((items) => {
        setBots(items)

        // Auto-select the first bot if none is selected
        if (!selectedBotId && items.length > 0) {
          onSelect(items[0].id)
        }
      })
      .catch((err) => {
        console.error('[BotSelector] Failed to load bots:', err)
        setError(err.message || 'Failed to load bots')
        setBots([])
      })
      .finally(() => {
        setLoading(false)
      })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const selectedBot = bots.find((b) => b.id === selectedBotId)

  if (loading) {
    return (
      <Button variant="outline" size="sm" disabled className="gap-2">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        <span className="text-xs">Loading agents...</span>
      </Button>
    )
  }

  if (error) {
    return (
      <Button
        variant="outline"
        size="sm"
        disabled
        className="gap-2 text-destructive"
      >
        <Bot className="h-3.5 w-3.5" />
        <span className="text-xs truncate max-w-[160px]">{error}</span>
      </Button>
    )
  }

  if (bots.length === 0) {
    return (
      <Button variant="outline" size="sm" disabled className="gap-2">
        <Bot className="h-3.5 w-3.5" />
        <span className="text-xs">No agents found</span>
      </Button>
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Bot className="h-3.5 w-3.5" />
          <span className="text-xs max-w-[120px] truncate">
            {selectedBot?.name || 'Select agent'}
          </span>
          <ChevronDown className="h-3 w-3 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className="w-64 max-h-[calc(100vh-4rem)] overflow-y-auto"
      >
        <DropdownMenuLabel className="text-xs">
          Select an agent
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {bots.map((bot) => (
          <DropdownMenuItem
            key={bot.id}
            onClick={() => onSelect(bot.id)}
            className="flex flex-col items-start gap-0.5 cursor-pointer"
          >
            <div className="flex items-center gap-2 w-full">
              <Bot className="h-3.5 w-3.5 shrink-0" />
              <span className="text-sm font-medium truncate">{bot.name}</span>
              {bot.id === selectedBotId ? (
                <span className="ml-auto text-xs text-primary">Active</span>
              ) : null}
            </div>
            {bot.description ? (
              <span className="text-xs text-muted-foreground pl-[22px] line-clamp-1">
                {bot.description}
              </span>
            ) : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
