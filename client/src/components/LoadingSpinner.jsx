export default function LoadingSpinner() {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3">
      <div className="relative">
        <div
          className="diamond-spin w-10 h-10 border-[3px] rounded-sm"
          style={{
            borderColor: 'var(--gold)',
            transform: 'rotate(45deg)',
            borderRadius: '3px',
          }}
        />
        <div
          className="absolute inset-0 diamond-spin w-10 h-10 border-[3px] rounded-sm"
          style={{
            borderColor: 'var(--powder)',
            opacity: 0.3,
            transform: 'rotate(45deg)',
            animationDelay: '-0.6s',
            borderRadius: '3px',
          }}
        />
      </div>
    </div>
  )
}
