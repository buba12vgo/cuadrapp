type MarcaMoappProps = {
  className?: string
}

export function MarcaMoapp({ className = 'h-10 w-10' }: MarcaMoappProps) {
  return <img src="/moapp-mark.png" alt="" className={`object-contain ${className}`} />
}
