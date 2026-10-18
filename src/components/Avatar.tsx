import type { Profile } from '../types'

function initials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export function Avatar({ profile, size = 'sm' }: { profile?: Profile | null; size?: 'sm' | 'lg' }) {
  if (!profile) {
    return (
      <span className={`avatar ${size === 'lg' ? 'lg' : ''}`} style={{ background: '#8993a4' }} title="Unassigned">
        –
      </span>
    )
  }
  return (
    <span
      className={`avatar ${size === 'lg' ? 'lg' : ''}`}
      style={{ background: profile.avatar_color }}
      title={profile.name}
    >
      {initials(profile.name)}
    </span>
  )
}
