interface SectionDividerProps {
  label: string
}

export default function SectionDivider({ label }: SectionDividerProps) {
  return (
    <div className="flex items-center gap-3 mb-3">
      <div className="h-px flex-1 bg-gray-100" />
      <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
        {label}
      </span>
      <div className="h-px flex-1 bg-gray-100" />
    </div>
  )
}
