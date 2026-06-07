import { useEffect } from 'react'

const BLOCKED_EVENTS = [
    'click',
    'mousedown',
    'mouseup',
    'dblclick',
    'contextmenu',
    'wheel',
    'keydown',
    'keyup'
]

export function useBlockUserInput() {
    useEffect(() => {
        function swallowEvent(event: Event) {
            event.preventDefault()
            event.stopPropagation()
        }

        BLOCKED_EVENTS.forEach((type) =>
            window.addEventListener(type, swallowEvent, { capture: true, passive: false })
        )

        return () =>
            BLOCKED_EVENTS.forEach((type) =>
                window.removeEventListener(type, swallowEvent, { capture: true })
            )
    }, [])
}
