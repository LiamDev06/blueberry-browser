import { useEffect, useState } from 'react'

export type Point = {
    x: number
    y: number
}

export type HudState = {
    goal: string
    cursor: Point
}

function constructCenterPoint() {
    return { x: window.innerWidth / 2, y: window.innerHeight / 2 }
}

export function useHudState(): HudState {
    const [goal, setGoal] = useState('Working…')
    const [cursor, setCursor] = useState<Point>(constructCenterPoint())

    useEffect(() => {
        function start(nextGoal: string): void {
            setGoal(nextGoal.length > 0 ? nextGoal : 'Working…')
        }

        function move(point: Point): void {
            setCursor(point)
        }

        window.overlayAPI.onStart(start)
        window.overlayAPI.onMove(move)
        return () => window.overlayAPI.removeAll()
    }, [])

    return { goal, cursor }
}
