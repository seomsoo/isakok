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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      ai_guide_cache: {
        Row: {
          cache_key: string
          created_at: string
          guides: Json
          id: string
          master_version: number
          updated_at: string
        }
        Insert: {
          cache_key: string
          created_at?: string
          guides: Json
          id?: string
          master_version: number
          updated_at?: string
        }
        Update: {
          cache_key?: string
          created_at?: string
          guides?: Json
          id?: string
          master_version?: number
          updated_at?: string
        }
        Relationships: []
      }
      master_checklist_items: {
        Row: {
          category: string
          contract_types: string[]
          created_at: string
          d_day_offset: number
          description: string | null
          guide_content: string | null
          guide_type: string
          guide_url: string | null
          housing_types: string[]
          id: string
          is_skippable: boolean
          move_types: string[]
          sort_order: number
          title: string
          updated_at: string
        }
        Insert: {
          category: string
          contract_types: string[]
          created_at?: string
          d_day_offset: number
          description?: string | null
          guide_content?: string | null
          guide_type?: string
          guide_url?: string | null
          housing_types: string[]
          id?: string
          is_skippable?: boolean
          move_types: string[]
          sort_order: number
          title: string
          updated_at?: string
        }
        Update: {
          category?: string
          contract_types?: string[]
          created_at?: string
          d_day_offset?: number
          description?: string | null
          guide_content?: string | null
          guide_type?: string
          guide_url?: string | null
          housing_types?: string[]
          id?: string
          is_skippable?: boolean
          move_types?: string[]
          sort_order?: number
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      moves: {
        Row: {
          contract_type: string
          created_at: string
          deleted_at: string | null
          from_address: string | null
          housing_type: string
          id: string
          is_first_move: boolean
          move_type: string
          moving_date: string
          status: string
          to_address: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          contract_type: string
          created_at?: string
          deleted_at?: string | null
          from_address?: string | null
          housing_type: string
          id?: string
          is_first_move?: boolean
          move_type: string
          moving_date: string
          status?: string
          to_address?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          contract_type?: string
          created_at?: string
          deleted_at?: string | null
          from_address?: string | null
          housing_type?: string
          id?: string
          is_first_move?: boolean
          move_type?: string
          moving_date?: string
          status?: string
          to_address?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "moves_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      property_photos: {
        Row: {
          created_at: string
          deleted_at: string | null
          group_key: string | null
          id: string
          image_hash: string | null
          location_detail: string | null
          memo: string | null
          move_id: string
          photo_type: string
          room: string
          storage_path: string
          taken_at: string | null
          updated_at: string
          uploaded_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          group_key?: string | null
          id?: string
          image_hash?: string | null
          location_detail?: string | null
          memo?: string | null
          move_id: string
          photo_type: string
          room: string
          storage_path: string
          taken_at?: string | null
          updated_at?: string
          uploaded_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          group_key?: string | null
          id?: string
          image_hash?: string | null
          location_detail?: string | null
          memo?: string | null
          move_id?: string
          photo_type?: string
          room?: string
          storage_path?: string
          taken_at?: string | null
          updated_at?: string
          uploaded_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "property_photos_move_id_fkey"
            columns: ["move_id"]
            isOneToOne: false
            referencedRelation: "moves"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_photos_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_checklist_items: {
        Row: {
          assigned_date: string
          completed_at: string | null
          created_at: string
          custom_guide: string | null
          id: string
          is_completed: boolean
          master_item_id: string
          memo: string | null
          move_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          assigned_date: string
          completed_at?: string | null
          created_at?: string
          custom_guide?: string | null
          id?: string
          is_completed?: boolean
          master_item_id: string
          memo?: string | null
          move_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          assigned_date?: string
          completed_at?: string | null
          created_at?: string
          custom_guide?: string | null
          id?: string
          is_completed?: boolean
          master_item_id?: string
          memo?: string | null
          move_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_checklist_items_master_item_id_fkey"
            columns: ["master_item_id"]
            isOneToOne: false
            referencedRelation: "master_checklist_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_checklist_items_move_id_fkey"
            columns: ["move_id"]
            isOneToOne: false
            referencedRelation: "moves"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_checklist_items_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          created_at: string
          email: string | null
          id: string
          nickname: string | null
          provider: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          id: string
          nickname?: string | null
          provider?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          nickname?: string | null
          provider?: string | null
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      create_move_with_checklist: {
        Args: {
          p_contract_type: string
          p_from_address?: string
          p_housing_type: string
          p_is_first_move?: boolean
          p_move_type: string
          p_moving_date: string
          p_to_address?: string
          p_user_id: string
        }
        Returns: string
      }
      update_move_with_reschedule: {
        Args: {
          p_contract_type: string
          p_from_address?: string
          p_housing_type: string
          p_is_first_move?: boolean
          p_move_id: string
          p_move_type: string
          p_moving_date: string
          p_to_address?: string
        }
        Returns: undefined
      }
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
