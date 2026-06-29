import React from 'react'
import { Plus, X, FileText } from 'lucide-react'
import { useBrowser } from '../contexts/BrowserContext'
import { Favicon } from '../components/Favicon'
import { TabBarButton } from '../components/TabBarButton'
import { cn } from '@common/lib/utils'

interface TabItemProps {
    id: string
    title: string
    favicon?: string | null
    isActive: boolean
    isPinned?: boolean
    isVirtual?: boolean
    onClose: () => void
    onActivate: () => void
}

const TabItem: React.FC<TabItemProps> = ({
    title,
    favicon,
    isActive,
    isPinned = false,
    isVirtual = false,
    onClose,
    onActivate
}) => {
    const baseClassName = cn(
        "relative flex items-center h-8 pl-2 pr-1.5 select-none rounded-md",
        "text-primary group/tab transition-all duration-200 cursor-pointer",
        "app-region-no-drag", // Make tabs clickable
        "border border-transparent", // reserve border space so active state doesn't shift layout
        isActive
            ? "bg-background !border-border/80 dark:bg-[#383838] dark:!border-white/10"
            : "hover:bg-foreground/[0.05] dark:hover:bg-white/[0.06]",
        isPinned ? "w-8 !px-0 justify-center" : ""
    )

    return (
        <div className="py-1 px-0.5">
            <div
                className={baseClassName}
                onClick={() => !isActive && onActivate()}
            >
                {/* Favicon */}
                <div className={cn(!isPinned && "mr-2")}>
                    {isVirtual ? (
                        <FileText className="size-4 text-muted-foreground" />
                    ) : (
                        <Favicon src={favicon} />
                    )}
                </div>

                {/* Title (hide for pinned tabs) */}
                {!isPinned && (
                    <span className="text-xs truncate max-w-[200px] flex-1">
                        {title || 'New Tab'}
                    </span>
                )}

                {/* Close button (shows on hover) */}
                {!isPinned && (
                    <div
                        onClick={(e) => {
                            e.stopPropagation()
                            onClose()
                        }}
                        className={cn(
                            "flex-shrink-0 p-1 rounded-md transition-opacity",
                            "hover:bg-muted dark:hover:bg-muted/50",
                            "opacity-0 group-hover/tab:opacity-100",
                            isActive && "opacity-100"
                        )}
                    >
                        <X className="size-3 text-primary dark:text-primary" />
                    </div>
                )}
            </div>
        </div>
    )
}

export const TabBar: React.FC = () => {
    const { tabs, createTab, closeTab, switchTab } = useBrowser()

    const handleCreateTab = () => {
        createTab('https://www.google.com')
    }

    // Extract favicon from URL (simplified - you might want to improve this)
    const getFavicon = (url: string) => {
        try {
            const domain = new URL(url).hostname
            return `https://www.google.com/s2/favicons?domain=${domain}&sz=32`
        } catch {
            return null
        }
    }

    return (
        <div className="flex-1 overflow-x-hidden flex items-center">
            {/* macOS traffic lights spacing */}
            <div className="pl-20" />

            {/* Tabs */}
            <div className="flex-1 overflow-x-auto flex">
                {tabs.map(tab => (
                    <TabItem
                        key={tab.id}
                        id={tab.id}
                        title={tab.title}
                        favicon={tab.isVirtual ? null : getFavicon(tab.url)}
                        isActive={tab.isActive}
                        isVirtual={tab.isVirtual}
                        onClose={() => closeTab(tab.id)}
                        onActivate={() => switchTab(tab.id)}
                    />
                ))}
            </div>

            {/* Add Tab Button */}
            <div className="pl-1 pr-2">
                <TabBarButton
                    Icon={Plus}
                    onClick={handleCreateTab}
                />
            </div>
        </div>
    )
}

