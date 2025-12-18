export default function CenteredCard({ title, children, actions, maxWidthClass = 'max-w-md' }) {
  return (
    <div className="flex items-center justify-center flex-1 px-4">
      <div className={`card w-full ${maxWidthClass} bg-base-200 shadow-xl border border-base-300/60`}>
        <div className="card-body space-y-4 text-center">
          {title ? <div className="text-xl font-bold">{title}</div> : null}
          {children}
          {actions ? <div className="flex gap-2 justify-center">{actions}</div> : null}
        </div>
      </div>
    </div>
  )
}

