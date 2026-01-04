import type { Tables as SupabaseTables } from './supabase'

export type { Database, Tables, TablesInsert, TablesUpdate, Enums } from './supabase'

export type Profile = SupabaseTables<'profiles'>

export type Theme = 'light' | 'dark' | 'system'

export type User = {
  id: string
  email: string
  firstName: string | null
  lastName: string | null
}

// Team management types
export type RoleName = 'admin' | 'fob_leader' | 'pastor'

export interface TeamMember {
  id: string
  email: string | null
  firstName: string | null
  lastName: string | null
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
  firstName: string | null
  lastName: string | null
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
    firstName: string | null
    lastName: string | null
  }
  expiresAt: string
  createdAt: string | null
}

export interface InviteMemberData {
  firstName: string
  lastName: string
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
  fob_leader: 'FOB Leader',
  pastor: 'Pastor',
} as const
