import { MousePointer2 } from 'lucide-react'
import { useBlockUserInput } from './hooks/useBlockUserInput'
import { useHudState } from './hooks/useHudState'

export function OverlayApp() {
    const { goal, cursor } = useHudState()
    useBlockUserInput()

    return (
        <div className="hud">
            <div className="scrim" />
            <div className="cursor" style={{ left: cursor.x, top: cursor.y }}>
                <MousePointer2 size={24} fill="#2563eb" stroke="#fff" strokeWidth={1.4} />
            </div>
            <div className="banner">{goal}</div>
        </div>
    )
}
