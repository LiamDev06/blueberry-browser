import {
    MousePointerClick, Hand, Keyboard, Globe, ArrowLeft, ArrowRight,
    MoveVertical, Camera, Sparkles, ListChecks, Layers, Plus, ArrowLeftRight, X,
    MessageCircleQuestion, Brain
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { ToolName } from '@shared/types'

type ToolMeta = {
    icon: LucideIcon
    runningLabel: string
}

export const TOOL_META: Record<ToolName, ToolMeta> = {
    click: { icon: MousePointerClick, runningLabel: 'Clicking…' },
    hover: { icon: Hand, runningLabel: 'Hovering…' },
    type: { icon: Keyboard, runningLabel: 'Typing…' },
    navigate: { icon: Globe, runningLabel: 'Navigating…' },
    back: { icon: ArrowLeft, runningLabel: 'Going back…' },
    forward: { icon: ArrowRight, runningLabel: 'Going forward…' },
    scroll: { icon: MoveVertical, runningLabel: 'Scrolling…' },
    screenshot: { icon: Camera, runningLabel: 'Taking a screenshot…' },
    remix: { icon: Sparkles, runningLabel: 'Remixing…' },
    list_tabs: { icon: Layers, runningLabel: 'Listing tabs…' },
    create_tab: { icon: Plus, runningLabel: 'Opening a tab…' },
    switch_tab: { icon: ArrowLeftRight, runningLabel: 'Switching tabs…' },
    close_tab: { icon: X, runningLabel: 'Closing a tab…' },
    ask_user: { icon: MessageCircleQuestion, runningLabel: 'Waiting for your answer…' },
    write_memory: { icon: Brain, runningLabel: 'Writing to memory…' },
    done: { icon: ListChecks, runningLabel: 'Verifying against goal…' }
}
