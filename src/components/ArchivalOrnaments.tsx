export function GoldHairlineDivider({ className = '' }: { className?: string }) {
  return (
    <div className={`flex items-center gap-4 ${className}`} aria-hidden="true">
      <div className="h-px flex-1 bg-gradient-to-r from-transparent via-[#DCC8AD] to-[#B58A45]/75" />
      <svg width="36" height="18" viewBox="0 0 36 18" fill="none" className="shrink-0">
        <path d="M18 1L22 9L18 17L14 9L18 1Z" stroke="#B58A45" strokeWidth="1.2" fill="#DCC8AD" fillOpacity="0.65" />
        <circle cx="8" cy="9" r="2.2" fill="#7993AC" fillOpacity="0.85" />
        <circle cx="28" cy="9" r="2.2" fill="#B58A45" fillOpacity="0.85" />
        <path d="M1 9H5M31 9H35" stroke="#22324B" strokeWidth="1.2" />
      </svg>
      <div className="h-px flex-1 bg-gradient-to-l from-transparent via-[#DCC8AD] to-[#B58A45]/75" />
    </div>
  );
}

export function MandalaCrest({ className = 'w-9 h-9' }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" fill="none" className={className} aria-hidden="true">
      <circle cx="24" cy="24" r="21" stroke="#DCC8AD" strokeWidth="1.3" strokeOpacity="0.9" />
      <circle cx="24" cy="24" r="14" stroke="#B58A45" strokeWidth="1.2" strokeOpacity="0.95" />
      <path
        d="M24 3V45M3 24H45M9.15 9.15L38.85 38.85M38.85 9.15L9.15 38.85"
        stroke="#7993AC"
        strokeWidth="1"
        strokeOpacity="0.7"
      />
      <path d="M24 12L29 24L24 36L19 24L24 12Z" fill="#DCC8AD" fillOpacity="0.45" stroke="#F4EDE1" strokeWidth="1" />
      <circle cx="24" cy="24" r="3.2" fill="#B58A45" />
    </svg>
  );
}
