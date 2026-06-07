import {
    MousePointerClick, Hand, Keyboard, Globe, MoveVertical, ListChecks
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
    scroll: { icon: MoveVertical, runningLabel: 'Scrolling…' },
    done: { icon: ListChecks, runningLabel: 'Verifying against goal…' }
}
