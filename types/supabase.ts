export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      app_settings: {
        Row: {
          key: string
          updated_at: string | null
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string | null
          value: Json
        }
        Update: {
          key?: string
          updated_at?: string | null
          value?: Json
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string | null
          details: Json | null
          id: string
          ip_address: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string | null
          details?: Json | null
          id?: string
          ip_address?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string | null
          details?: Json | null
          id?: string
          ip_address?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      fobs: {
        Row: {
          archived_at: string | null
          created_at: string | null
          id: string
          name: string
          region_id: string | null
          updated_at: string | null
        }
        Insert: {
          archived_at?: string | null
          created_at?: string | null
          id?: string
          name: string
          region_id?: string | null
          updated_at?: string | null
        }
        Update: {
          archived_at?: string | null
          created_at?: string | null
          id?: string
          name?: string
          region_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fobs_region_id_fkey"
            columns: ["region_id"]
            isOneToOne: false
            referencedRelation: "regions"
            referencedColumns: ["id"]
          },
        ]
      }
      locations: {
        Row: {
          archived_at: string | null
          contact: string | null
          created_at: string | null
          fob_id: string
          id: string
          name: string
          pastor: string | null
          updated_at: string | null
        }
        Insert: {
          archived_at?: string | null
          contact?: string | null
          created_at?: string | null
          fob_id: string
          id?: string
          name: string
          pastor?: string | null
          updated_at?: string | null
        }
        Update: {
          archived_at?: string | null
          contact?: string | null
          created_at?: string | null
          fob_id?: string
          id?: string
          name?: string
          pastor?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "locations_fob_id_fkey"
            columns: ["fob_id"]
            isOneToOne: false
            referencedRelation: "fobs"
            referencedColumns: ["id"]
          },
        ]
      }
      pga_change_log: {
        Row: {
          changed_at: string
          changed_by: string | null
          id: number
          location_id: string | null
          new_data: Json | null
          old_data: Json | null
          operation: string
          report_date: string | null
          report_id: string | null
          row_id: string
          table_name: string
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          id?: never
          location_id?: string | null
          new_data?: Json | null
          old_data?: Json | null
          operation: string
          report_date?: string | null
          report_id?: string | null
          row_id: string
          table_name: string
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          id?: never
          location_id?: string | null
          new_data?: Json | null
          old_data?: Json | null
          operation?: string
          report_date?: string | null
          report_id?: string | null
          row_id?: string
          table_name?: string
        }
        Relationships: []
      }
      pga_entries: {
        Row: {
          baptisms: number | null
          created_at: string | null
          created_by: string | null
          fob_id: string
          hc1: number | null
          hc2: number | null
          id: string
          kids: number | null
          local: number | null
          location_id: string
          mca: number | null
          mechanics: number | null
          mechanics_get: number | null
          mechanics_training: number | null
          mechanics_worship: number | null
          region_id: string | null
          report_id: string
          salvations: number | null
          salvations_inhouse: number | null
          salvations_livestream_enc: number | null
          salvations_livestream_yxp: number | null
          salvations_mc: number | null
          salvations_other: number | null
          sv1: number | null
          sv2: number | null
          updated_at: string | null
          updated_by: string | null
          yxp: number | null
        }
        Insert: {
          baptisms?: number | null
          created_at?: string | null
          created_by?: string | null
          fob_id: string
          hc1?: number | null
          hc2?: number | null
          id?: string
          kids?: number | null
          local?: number | null
          location_id: string
          mca?: number | null
          mechanics?: number | null
          mechanics_get?: number | null
          mechanics_training?: number | null
          mechanics_worship?: number | null
          region_id?: string | null
          report_id: string
          salvations?: number | null
          salvations_inhouse?: number | null
          salvations_livestream_enc?: number | null
          salvations_livestream_yxp?: number | null
          salvations_mc?: number | null
          salvations_other?: number | null
          sv1?: number | null
          sv2?: number | null
          updated_at?: string | null
          updated_by?: string | null
          yxp?: number | null
        }
        Update: {
          baptisms?: number | null
          created_at?: string | null
          created_by?: string | null
          fob_id?: string
          hc1?: number | null
          hc2?: number | null
          id?: string
          kids?: number | null
          local?: number | null
          location_id?: string
          mca?: number | null
          mechanics?: number | null
          mechanics_get?: number | null
          mechanics_training?: number | null
          mechanics_worship?: number | null
          region_id?: string | null
          report_id?: string
          salvations?: number | null
          salvations_inhouse?: number | null
          salvations_livestream_enc?: number | null
          salvations_livestream_yxp?: number | null
          salvations_mc?: number | null
          salvations_other?: number | null
          sv1?: number | null
          sv2?: number | null
          updated_at?: string | null
          updated_by?: string | null
          yxp?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "pga_entries_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pga_entries_fob_id_fkey"
            columns: ["fob_id"]
            isOneToOne: false
            referencedRelation: "fobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pga_entries_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pga_entries_region_id_fkey"
            columns: ["region_id"]
            isOneToOne: false
            referencedRelation: "regions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pga_entries_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "four_week_epga_summary"
            referencedColumns: ["report_id"]
          },
          {
            foreignKeyName: "pga_entries_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "four_week_pga_summary"
            referencedColumns: ["report_id"]
          },
          {
            foreignKeyName: "pga_entries_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "pga_report_summary"
            referencedColumns: ["report_id"]
          },
          {
            foreignKeyName: "pga_entries_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "pga_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      pga_reports: {
        Row: {
          created_at: string | null
          created_by: string | null
          date: string
          id: string
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          date: string
          id?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          date?: string
          id?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pga_reports_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string | null
          email: string | null
          id: string
          theme: string | null
          two_factor_enabled: boolean | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          id: string
          theme?: string | null
          two_factor_enabled?: boolean | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string | null
          id?: string
          theme?: string | null
          two_factor_enabled?: boolean | null
          updated_at?: string | null
        }
        Relationships: []
      }
      regions: {
        Row: {
          created_at: string | null
          id: string
          name: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      roles: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      user_assignments: {
        Row: {
          created_at: string | null
          fob_id: string | null
          id: string
          location_id: string | null
          role_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          fob_id?: string | null
          id?: string
          location_id?: string | null
          role_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          fob_id?: string | null
          id?: string
          location_id?: string | null
          role_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_assignments_fob_id_fkey"
            columns: ["fob_id"]
            isOneToOne: false
            referencedRelation: "fobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_assignments_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_assignments_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_assignments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_invitations: {
        Row: {
          accepted_at: string | null
          created_at: string | null
          email: string
          expires_at: string
          fob_id: string | null
          id: string
          invited_by: string
          location_id: string | null
          role_id: string
          token: string
          updated_at: string | null
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string | null
          email: string
          expires_at: string
          fob_id?: string | null
          id?: string
          invited_by: string
          location_id?: string | null
          role_id: string
          token: string
          updated_at?: string | null
        }
        Update: {
          accepted_at?: string | null
          created_at?: string | null
          email?: string
          expires_at?: string
          fob_id?: string | null
          id?: string
          invited_by?: string
          location_id?: string | null
          role_id?: string
          token?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_invitations_fob_id_fkey"
            columns: ["fob_id"]
            isOneToOne: false
            referencedRelation: "fobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_invitations_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_invitations_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_invitations_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      four_week_epga_summary: {
        Row: {
          average: number | null
          date: string | null
          report_id: string | null
          wk1_date: string | null
          wk1_total: number | null
          wk2_date: string | null
          wk2_total: number | null
          wk3_date: string | null
          wk3_total: number | null
          wk4_date: string | null
          wk4_total: number | null
        }
        Relationships: []
      }
      four_week_pga_summary: {
        Row: {
          average: number | null
          date: string | null
          report_id: string | null
          wk1_date: string | null
          wk1_total: number | null
          wk2_date: string | null
          wk2_total: number | null
          wk3_date: string | null
          wk3_total: number | null
          wk4_date: string | null
          wk4_total: number | null
        }
        Relationships: []
      }
      pga_report_summary: {
        Row: {
          baptisms: number | null
          created_at: string | null
          date: string | null
          epga_total: number | null
          hc1: number | null
          hc2: number | null
          kids: number | null
          local: number | null
          mca: number | null
          mechanics: number | null
          mechanics_get: number | null
          mechanics_training: number | null
          mechanics_worship: number | null
          report_id: string | null
          salvations: number | null
          salvations_inhouse: number | null
          salvations_livestream_enc: number | null
          salvations_livestream_yxp: number | null
          salvations_mc: number | null
          salvations_other: number | null
          sv1: number | null
          sv2: number | null
          total: number | null
          yxp: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      auto_generate_weekly_pga_report: { Args: never; Returns: undefined }
      can_access_location: {
        Args: { p_location_id: string; p_user_id: string }
        Returns: boolean
      }
      get_deleted_pga_entries: {
        Args: { p_limit?: number }
        Returns: {
          deleted_at: string
          deleted_by: string
          deleted_by_name: string
          entry_id: string
          location_id: string
          location_name: string
          log_id: number
          report_date: string
          report_exists: boolean
          report_id: string
        }[]
      }
      get_deleted_pga_reports: {
        Args: never
        Returns: {
          deleted_at: string
          deleted_by: string
          deleted_by_name: string
          entry_count: number
          report_date: string
          report_id: string
        }[]
      }
      get_epga_detail: {
        Args: { p_date: string }
        Returns: {
          location_id: string
          location_name: string
          sv1: number
          sv2: number
          total: number
          yxp: number
        }[]
      }
      get_four_week_epga_detail: { Args: { p_date: string }; Returns: Json }
      get_four_week_pga_detail: { Args: { p_date: string }; Returns: Json }
      get_missing_pga_entries: {
        Args: { p_report_date: string }
        Returns: {
          fob_id: string
          fob_name: string
          location_id: string
          location_name: string
          region_id: string
          region_name: string
        }[]
      }
      get_pga_change_log: {
        Args: {
          p_from?: string
          p_limit?: number
          p_location_id?: string
          p_offset?: number
          p_to?: string
        }
        Returns: {
          changed_at: string
          changed_by: string
          changed_by_name: string
          id: number
          location_id: string
          location_name: string
          new_data: Json
          old_data: Json
          operation: string
          report_date: string
          row_id: string
          table_name: string
          total_count: number
        }[]
      }
      get_pga_lock_days: { Args: never; Returns: number }
      get_pga_period_totals: {
        Args: { p_end: string; p_group_by: string; p_start: string }
        Returns: {
          baptisms: number
          entry_count: number
          fob_name: string
          group_id: string
          group_name: string
          hc1: number
          hc2: number
          kids: number
          local: number
          mca: number
          mechanics: number
          mechanics_get: number
          mechanics_training: number
          mechanics_worship: number
          region_name: string
          report_count: number
          salvations: number
          salvations_inhouse: number
          salvations_livestream_enc: number
          salvations_livestream_yxp: number
          salvations_mc: number
          salvations_other: number
          sv1: number
          sv2: number
          yxp: number
        }[]
      }
      get_pga_trend: {
        Args: {
          p_end: string
          p_fob_id?: string
          p_location_id?: string
          p_region_id?: string
          p_start: string
        }
        Returns: {
          baptisms: number
          entry_count: number
          hc1: number
          hc2: number
          kids: number
          local: number
          mca: number
          mechanics: number
          mechanics_get: number
          mechanics_training: number
          mechanics_worship: number
          report_date: string
          salvations: number
          salvations_inhouse: number
          salvations_livestream_enc: number
          salvations_livestream_yxp: number
          salvations_mc: number
          salvations_other: number
          sv1: number
          sv2: number
          yxp: number
        }[]
      }
      get_user_fob_id: { Args: { p_user_id: string }; Returns: string }
      get_user_location_id: { Args: { p_user_id: string }; Returns: string }
      get_user_role: { Args: { p_user_id: string }; Returns: string }
      is_admin: { Args: { p_user_id: string }; Returns: boolean }
      is_admin_or_manager: { Args: { p_user_id: string }; Returns: boolean }
      is_fob_leader: { Args: { p_user_id: string }; Returns: boolean }
      is_pga_report_locked: {
        Args: { p_report_date: string }
        Returns: boolean
      }
      pga_assert_admin: { Args: never; Returns: undefined }
      pga_reinsert_row: {
        Args: { p_data: Json; p_table: string }
        Returns: undefined
      }
      restore_pga_entry: { Args: { p_log_id: number }; Returns: string }
      restore_pga_report: { Args: { p_report_id: string }; Returns: number }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const

