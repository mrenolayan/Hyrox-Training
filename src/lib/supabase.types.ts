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
      athlete_invites: {
        Row: {
          accepted_at: string | null
          athlete_id: string
          created_at: string
          email: string
          expires_at: string
          id: string
          team_id: string
          token: string
        }
        Insert: {
          accepted_at?: string | null
          athlete_id: string
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          team_id: string
          token: string
        }
        Update: {
          accepted_at?: string | null
          athlete_id?: string
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          team_id?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "athlete_invites_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "athletes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "athlete_invites_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      athlete_modalities: {
        Row: {
          athlete_id: string
          id: string
          modality: string
        }
        Insert: {
          athlete_id: string
          id?: string
          modality: string
        }
        Update: {
          athlete_id?: string
          id?: string
          modality?: string
        }
        Relationships: [
          {
            foreignKeyName: "athlete_modalities_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "athletes"
            referencedColumns: ["id"]
          },
        ]
      }
      athlete_profiles: {
        Row: {
          athlete_id: string
          id: string
          injuries_notes: string | null
          known_weights: string | null
          meta: Json
          team_split_notes: string | null
        }
        Insert: {
          athlete_id: string
          id?: string
          injuries_notes?: string | null
          known_weights?: string | null
          meta?: Json
          team_split_notes?: string | null
        }
        Update: {
          athlete_id?: string
          id?: string
          injuries_notes?: string | null
          known_weights?: string | null
          meta?: Json
          team_split_notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "athlete_profiles_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: true
            referencedRelation: "athletes"
            referencedColumns: ["id"]
          },
        ]
      }
      athletes: {
        Row: {
          coach_id: string
          color: string | null
          created_at: string
          id: string
          longest_run: number | null
          name: string
          role: string | null
          run_pace: string | null
          user_id: string | null
        }
        Insert: {
          coach_id: string
          color?: string | null
          created_at?: string
          id?: string
          longest_run?: number | null
          name: string
          role?: string | null
          run_pace?: string | null
          user_id?: string | null
        }
        Update: {
          coach_id?: string
          color?: string | null
          created_at?: string
          id?: string
          longest_run?: number | null
          name?: string
          role?: string | null
          run_pace?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "athletes_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "coaches"
            referencedColumns: ["id"]
          },
        ]
      }
      coach_notes: {
        Row: {
          body: string | null
          id: string
          plan_week_id: string
          updated_at: string
        }
        Insert: {
          body?: string | null
          id?: string
          plan_week_id: string
          updated_at?: string
        }
        Update: {
          body?: string | null
          id?: string
          plan_week_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "coach_notes_plan_week_id_fkey"
            columns: ["plan_week_id"]
            isOneToOne: true
            referencedRelation: "plan_weeks"
            referencedColumns: ["id"]
          },
        ]
      }
      coaches: {
        Row: {
          created_at: string
          email: string | null
          id: string
          name: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          name: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          user_id?: string | null
        }
        Relationships: []
      }
      logs: {
        Row: {
          athlete_id: string
          created_at: string
          done: boolean
          id: string
          logged_date: string | null
          metric: string | null
          notes: string | null
          plan_entry_id: string
          plan_id: string
        }
        Insert: {
          athlete_id: string
          created_at?: string
          done?: boolean
          id?: string
          logged_date?: string | null
          metric?: string | null
          notes?: string | null
          plan_entry_id: string
          plan_id: string
        }
        Update: {
          athlete_id?: string
          created_at?: string
          done?: boolean
          id?: string
          logged_date?: string | null
          metric?: string | null
          notes?: string | null
          plan_entry_id?: string
          plan_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "logs_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "athletes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "logs_plan_entry_id_fkey"
            columns: ["plan_entry_id"]
            isOneToOne: false
            referencedRelation: "plan_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "logs_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_days: {
        Row: {
          day_of_week: string
          id: string
          optional: boolean
          plan_week_id: string
          shared: boolean
        }
        Insert: {
          day_of_week: string
          id?: string
          optional?: boolean
          plan_week_id: string
          shared?: boolean
        }
        Update: {
          day_of_week?: string
          id?: string
          optional?: boolean
          plan_week_id?: string
          shared?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "plan_days_plan_week_id_fkey"
            columns: ["plan_week_id"]
            isOneToOne: false
            referencedRelation: "plan_weeks"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_entries: {
        Row: {
          athlete_id: string
          coach_note: string | null
          detail: string | null
          id: string
          label: string
          meta: Json
          metric_label: string | null
          plan_day_id: string
          session_type: string
        }
        Insert: {
          athlete_id: string
          coach_note?: string | null
          detail?: string | null
          id?: string
          label: string
          meta?: Json
          metric_label?: string | null
          plan_day_id: string
          session_type: string
        }
        Update: {
          athlete_id?: string
          coach_note?: string | null
          detail?: string | null
          id?: string
          label?: string
          meta?: Json
          metric_label?: string | null
          plan_day_id?: string
          session_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "plan_entries_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "athletes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_entries_plan_day_id_fkey"
            columns: ["plan_day_id"]
            isOneToOne: false
            referencedRelation: "plan_days"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_weeks: {
        Row: {
          focus: string | null
          id: string
          phase: number
          plan_id: string
          week_number: number
        }
        Insert: {
          focus?: string | null
          id?: string
          phase: number
          plan_id: string
          week_number: number
        }
        Update: {
          focus?: string | null
          id?: string
          phase?: number
          plan_id?: string
          week_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "plan_weeks_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      plans: {
        Row: {
          created_at: string
          days_per_week: number
          generated_at: string | null
          id: string
          race_city: string | null
          race_iso: string
          race_name: string
          start_iso: string
          status: string
          team_id: string
          weeks: number
        }
        Insert: {
          created_at?: string
          days_per_week: number
          generated_at?: string | null
          id?: string
          race_city?: string | null
          race_iso: string
          race_name: string
          start_iso: string
          status?: string
          team_id: string
          weeks: number
        }
        Update: {
          created_at?: string
          days_per_week?: number
          generated_at?: string | null
          id?: string
          race_city?: string | null
          race_iso?: string
          race_name?: string
          start_iso?: string
          status?: string
          team_id?: string
          weeks?: number
        }
        Relationships: [
          {
            foreignKeyName: "plans_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      race_results: {
        Row: {
          athlete_id: string
          created_at: string
          id: string
          race_date: string | null
          race_name: string | null
          splits: Json
          total_time: string | null
        }
        Insert: {
          athlete_id: string
          created_at?: string
          id?: string
          race_date?: string | null
          race_name?: string | null
          splits?: Json
          total_time?: string | null
        }
        Update: {
          athlete_id?: string
          created_at?: string
          id?: string
          race_date?: string | null
          race_name?: string | null
          splits?: Json
          total_time?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "race_results_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "athletes"
            referencedColumns: ["id"]
          },
        ]
      }
      station_ratings: {
        Row: {
          athlete_id: string
          id: string
          rating: string
          station: string
        }
        Insert: {
          athlete_id: string
          id?: string
          rating: string
          station: string
        }
        Update: {
          athlete_id?: string
          id?: string
          rating?: string
          station?: string
        }
        Relationships: [
          {
            foreignKeyName: "station_ratings_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "athletes"
            referencedColumns: ["id"]
          },
        ]
      }
      team_members: {
        Row: {
          athlete_id: string
          id: string
          joined_at: string
          left_at: string | null
          team_id: string
        }
        Insert: {
          athlete_id: string
          id?: string
          joined_at?: string
          left_at?: string | null
          team_id: string
        }
        Update: {
          athlete_id?: string
          id?: string
          joined_at?: string
          left_at?: string | null
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_members_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "athletes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_members_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      team_notes: {
        Row: {
          author_athlete_id: string
          body: string | null
          created_at: string
          id: string
          log_id: string
          reaction: string | null
        }
        Insert: {
          author_athlete_id: string
          body?: string | null
          created_at?: string
          id?: string
          log_id: string
          reaction?: string | null
        }
        Update: {
          author_athlete_id?: string
          body?: string | null
          created_at?: string
          id?: string
          log_id?: string
          reaction?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "team_notes_author_athlete_id_fkey"
            columns: ["author_athlete_id"]
            isOneToOne: false
            referencedRelation: "athletes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_notes_log_id_fkey"
            columns: ["log_id"]
            isOneToOne: false
            referencedRelation: "logs"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          coach_id: string
          created_at: string
          format_id: string
          id: string
          name: string
          require_auth: boolean
          units: string
        }
        Insert: {
          coach_id: string
          created_at?: string
          format_id: string
          id?: string
          name: string
          require_auth?: boolean
          units?: string
        }
        Update: {
          coach_id?: string
          created_at?: string
          format_id?: string
          id?: string
          name?: string
          require_auth?: boolean
          units?: string
        }
        Relationships: [
          {
            foreignKeyName: "teams_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "coaches"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_invite: { Args: { p_token: string }; Returns: string }
      athlete_id_of_caller: { Args: never; Returns: string }
      coach_id_of_caller: { Args: never; Returns: string }
      is_teammate: { Args: { p_athlete_id: string }; Returns: boolean }
      link_athlete_from_invite: { Args: never; Returns: string }
      my_team_ids: { Args: never; Returns: string[] }
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

type DefaultSchema = DatabaseWithoutInternals["public"]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
