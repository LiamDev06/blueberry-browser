import { useRef, useLayoutEffect } from 'react'

// Auto-scroll hook
export const useAutoScroll = (count: number) => {
    const scrollRef = useRef<HTMLDivElement>(null)
    const prevCount = useRef(0)

    useLayoutEffect(() => {
        if (count > prevCount.current) {
            setTimeout(() => {
                scrollRef.current?.scrollIntoView({
                    behavior: 'smooth',
                    block: 'end'
                })
            }, 100)
        }
        prevCount.current = count
    }, [count])

    return scrollRef
}
