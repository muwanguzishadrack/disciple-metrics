import type { Tables as SupabaseTables } from './supabase'

export type { Database, Tables, TablesInsert, TablesUpdate, Enums } from './supabase'

export type Profile = SupabaseTables<'profiles'>

export type Theme = 'light' | 'dark' | 'system'

export type User = {
  id: string
  email: string
}

// Team management types
export type RoleName = 'admin' | 'manager' | 'fob_leader' | 'pastor'

export interface TeamMember {
  id: string
  email: string | null
  role: {
    id: string
    name: string
    description: string | null
  } | null
  fob: {
    id: string
    name: string
  } | null
  location: {
    id: string
    name: string
  } | null
  createdAt: string | null
}

export interface TeamInvitation {
  id: string
  email: string
  role: {
    id: string
    name: string
  }
  fob: {
    id: string
    name: string
  } | null
  location: {
    id: string
    name: string
  } | null
  invitedBy: {
    id: string
    email: string | null
  }
  expiresAt: string
  createdAt: string | null
}

export interface InviteMemberData {
  email: string
  roleId: string
  fobId?: string | null
  locationId?: string | null
}

export interface UpdateMemberData {
  roleId: string
  fobId?: string | null
  locationId?: string | null
}

export const ROLE_DISPLAY_NAMES: Record<RoleName, string> = {
  admin: 'Admin',
  manager: 'Manager',
  fob_leader: 'FOB Leader',
  pastor: 'Pastor',
} as const

// Location management types
export interface LocationWithFob {
  id: string
  name: string
  fob_id: string
  pastor: string | null
  contact: string | null
  created_at: string | null
  updated_at: string | null
  fob: {
    id: string
    name: string
  }
}
