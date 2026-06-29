import { useEffect, useState } from 'react'
import type { HudPatch, Point, RemixState } from '@shared/overlay'

export type HudState = {
    goal: string
    cursor: Point
    remix: RemixState
}

function constructCenterPoint() {
    return { x: window.innerWidth / 2, y: window.innerHeight / 2 }
}

export function useHudState(): HudState {
    const [goal, setGoal] = useState('Working…')
    const [cursor, setCursor] = useState<Point>(constructCenterPoint())
    const [remix, setRemix] = useState<RemixState>({ active: false })

    useEffect(() => {
        function hud(patch: HudPatch): void {
            if (patch.goal !== undefined) {
                setGoal(patch.goal.length > 0 ? patch.goal : 'Working…')
            }
            if (patch.remix !== undefined) {
                setRemix(patch.remix)
            }
        }

        function move(point: Point): void {
            setCursor(point)
        }

        window.overlayAPI.onHud(hud)
        window.overlayAPI.onMove(move)
        return () => window.overlayAPI.removeAll()
    }, [])

    return { goal, cursor, remix }
}
