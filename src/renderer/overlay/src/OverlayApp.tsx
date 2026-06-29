import { MousePointer2 } from 'lucide-react'
import { useBlockUserInput } from './hooks/useBlockUserInput'
import { useHudState } from './hooks/useHudState'
import { RemixLayer } from './components/RemixLayer'

export function OverlayApp() {
    const { goal, cursor, remix } = useHudState()
    useBlockUserInput()

    if (remix.active) {
        return (
            <div className="hud">
                <RemixLayer />
                <div className="banner banner--remix">
                    <span className="remix-spark">✨</span>
                    <span>Remixing this page</span>
                    <span className="remix-dots" />
                </div>
            </div>
        )
    }

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
