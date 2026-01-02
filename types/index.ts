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
