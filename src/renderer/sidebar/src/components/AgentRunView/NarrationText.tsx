type NarrationTextProps = {
    text: string
}

export function NarrationText({ text }: NarrationTextProps) {
    return (
        <div className="text-foreground whitespace-pre-wrap leading-relaxed animate-fade-in">
            {text}
        </div>
    )
}
