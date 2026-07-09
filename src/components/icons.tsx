interface P {
  s?: number
}

export const Logo = ({ s = 24 }: P) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
    <path d="M6 2h8.5L20 7.5V20a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Z" fill="#A32035" />
    <path d="M14.5 2 20 7.5h-4.5a1 1 0 0 1-1-1V2Z" fill="#E08A96" />
    <circle cx="9.4" cy="13" r="1.3" fill="#fff" />
    <circle cx="14.6" cy="13" r="1.3" fill="#fff" />
    <path d="M9.2 16.4c.8.9 1.8 1.4 2.8 1.4s2-.5 2.8-1.4" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" fill="none" />
  </svg>
)

const I = ({ d, s = 18, sw = 1.8 }: { d: string; s?: number; sw?: number }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
)

export const IcSelect = () => <I d="M5 3l14 8-6.5 1.5L9 19 5 3z" />
export const IcText = () => <I d="M5 5h14M12 5v14" />
export const IcSign = () => <I d="M3 17c2-6 4-8 5-6s0 7 2 5 3-9 5-7-1 8 1 7 3-4 5-3" />
export const IcHighlight = () => <I d="M9 15 4 20M14 4l6 6-8 8-6-6 8-8zM4 20h5" />
export const IcDraw = () => <I d="M17 3a2.8 2.8 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
export const IcMore = () => (
  <svg width={18} height={18} viewBox="0 0 24 24" fill="currentColor">
    <circle cx="5" cy="12" r="1.6" />
    <circle cx="12" cy="12" r="1.6" />
    <circle cx="19" cy="12" r="1.6" />
  </svg>
)
export const IcWhiteout = () => (
  <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
    <rect x="4" y="8" width="16" height="9" rx="1.5" />
  </svg>
)
export const IcCheck = () => <I d="m4 12.5 5 5L20 6.5" sw={2.2} />
export const IcCross = () => <I d="M6 6l12 12M18 6 6 18" sw={2.2} />
export const IcDate = () => <I d="M8 3v4M16 3v4M3 10h18M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z" />
export const IcImage = () => (
  <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <circle cx="8.5" cy="10" r="1.5" />
    <path d="m21 15-5-5-9 9" />
  </svg>
)
export const IcPages = () => <I d="M8 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h3M16 3h3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-3" />
export const IcUndo = () => <I d="M9 14 4 9l5-5M4 9h10a6 6 0 0 1 0 12h-3" />
export const IcRedo = () => <I d="m15 14 5-5-5-5M20 9H10a6 6 0 0 0 0 12h3" />
export const IcDownload = () => <I d="M12 3v12M7 10l5 5 5-5M4 19h16" sw={2.2} />
export const IcTrash = () => <I d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
export const IcDup = () => (
  <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <rect x="9" y="9" width="12" height="12" rx="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </svg>
)
export const IcRotate = () => <I d="M21 8a9 9 0 1 0 .5 5M21 3v5h-5" sw={2} />
export const IcChevR = () => <I d="m9 6 6 6-6 6" sw={2} />
export const IcChevL = () => <I d="m15 6-6 6 6 6" sw={2} />
export const IcClose = () => <I d="M6 6l12 12M18 6 6 18" sw={2} />
export const IcLock = () => <I d="M8 10V7a4 4 0 0 1 8 0v3M6 10h12a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1z" sw={2} />
export const IcUpload = () => <I d="M12 3v12M7 8l5-5 5 5M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" sw={2} />
export const IcForm = () => <I d="M4 7V5a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v2M4 17v2a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-2M8 12h8" sw={2} />
