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
      game_progress: {
        Row: {
          age_group: string | null
          best_score: number
          created_at: string
          game_key: string
          id: string
          last_played_at: string
          rounds_played: number
          score: number
          updated_at: string
          user_id: string
        }
        Insert: {
          age_group?: string | null
          best_score?: number
          created_at?: string
          game_key: string
          id?: string
          last_played_at?: string
          rounds_played?: number
          score?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          age_group?: string | null
          best_score?: number
          created_at?: string
          game_key?: string
          id?: string
          last_played_at?: string
          rounds_played?: number
          score?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      generated_pages: {
        Row: {
          created_at: string
          id: string
          image_path: string | null
          order_id: string
          page_number: number
          page_text: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          image_path?: string | null
          order_id: string
          page_number: number
          page_text?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          image_path?: string | null
          order_id?: string
          page_number?: number
          page_text?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "generated_pages_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          admin_notes: string | null
          child_age: number | null
          child_name: string
          child_name_en: string | null
          child_photo_path: string | null
          created_at: string
          custom_brief: string | null
          delivery_address: string | null
          gender: Database["public"]["Enums"]["child_gender"]
          gifted_by_name: string | null
          gifted_by_relation: string | null
          hero_character: string | null
          id: string
          is_custom_request: boolean
          kashier_order_id: string | null
          kashier_payload: Json | null
          kashier_transaction_id: string | null
          language: string
          notes: string | null
          pages_count: number
          paid_at: string | null
          payment_provider: string
          payment_rejection_reason: string | null
          payment_status: Database["public"]["Enums"]["payment_status"]
          payment_verified_at: string | null
          payment_verified_by: string | null
          photo_mode: string
          price_egp: number
          print_copy: boolean
          publish_consent: boolean
          published_at: string | null
          published_template_id: string | null
          published_to_library_at: string | null
          receipt_path: string | null
          status: Database["public"]["Enums"]["order_status"]
          template_id: string | null
          updated_at: string
          user_id: string
          whatsapp: string
        }
        Insert: {
          admin_notes?: string | null
          child_age?: number | null
          child_name: string
          child_name_en?: string | null
          child_photo_path?: string | null
          created_at?: string
          custom_brief?: string | null
          delivery_address?: string | null
          gender?: Database["public"]["Enums"]["child_gender"]
          gifted_by_name?: string | null
          gifted_by_relation?: string | null
          hero_character?: string | null
          id?: string
          is_custom_request?: boolean
          kashier_order_id?: string | null
          kashier_payload?: Json | null
          kashier_transaction_id?: string | null
          language?: string
          notes?: string | null
          pages_count?: number
          paid_at?: string | null
          payment_provider?: string
          payment_rejection_reason?: string | null
          payment_status?: Database["public"]["Enums"]["payment_status"]
          payment_verified_at?: string | null
          payment_verified_by?: string | null
          photo_mode?: string
          price_egp?: number
          print_copy?: boolean
          publish_consent?: boolean
          published_at?: string | null
          published_template_id?: string | null
          published_to_library_at?: string | null
          receipt_path?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          template_id?: string | null
          updated_at?: string
          user_id: string
          whatsapp: string
        }
        Update: {
          admin_notes?: string | null
          child_age?: number | null
          child_name?: string
          child_name_en?: string | null
          child_photo_path?: string | null
          created_at?: string
          custom_brief?: string | null
          delivery_address?: string | null
          gender?: Database["public"]["Enums"]["child_gender"]
          gifted_by_name?: string | null
          gifted_by_relation?: string | null
          hero_character?: string | null
          id?: string
          is_custom_request?: boolean
          kashier_order_id?: string | null
          kashier_payload?: Json | null
          kashier_transaction_id?: string | null
          language?: string
          notes?: string | null
          pages_count?: number
          paid_at?: string | null
          payment_provider?: string
          payment_rejection_reason?: string | null
          payment_status?: Database["public"]["Enums"]["payment_status"]
          payment_verified_at?: string | null
          payment_verified_by?: string | null
          photo_mode?: string
          price_egp?: number
          print_copy?: boolean
          publish_consent?: boolean
          published_at?: string | null
          published_template_id?: string | null
          published_to_library_at?: string | null
          receipt_path?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          template_id?: string | null
          updated_at?: string
          user_id?: string
          whatsapp?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_published_template_id_fkey"
            columns: ["published_template_id"]
            isOneToOne: false
            referencedRelation: "story_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "story_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_logs: {
        Row: {
          amount: number | null
          created_at: string
          currency: string | null
          event_type: string | null
          id: string
          kashier_order_id: string | null
          kashier_transaction_id: string | null
          provider: string
          raw_payload: Json
          signature_ok: boolean
          status: string | null
        }
        Insert: {
          amount?: number | null
          created_at?: string
          currency?: string | null
          event_type?: string | null
          id?: string
          kashier_order_id?: string | null
          kashier_transaction_id?: string | null
          provider: string
          raw_payload: Json
          signature_ok?: boolean
          status?: string | null
        }
        Update: {
          amount?: number | null
          created_at?: string
          currency?: string | null
          event_type?: string | null
          id?: string
          kashier_order_id?: string | null
          kashier_transaction_id?: string | null
          provider?: string
          raw_payload?: Json
          signature_ok?: boolean
          status?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          id: string
          updated_at: string
          whatsapp: string | null
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          id: string
          updated_at?: string
          whatsapp?: string | null
        }
        Update: {
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
          whatsapp?: string | null
        }
        Relationships: []
      }
      story_templates: {
        Row: {
          admin_approved_at: string | null
          admin_approved_by: string | null
          age_range: string
          approved_at: string | null
          book_meta: Json | null
          category: string
          content_type: string
          cover_url: string | null
          created_at: string
          created_by: string | null
          id: string
          is_custom: boolean
          is_gallery: boolean
          is_published: boolean
          language: string
          moral: string
          pages: Json
          slug: string
          source_order_id: string | null
          source_template_id: string | null
          summary: string
          title: string
          updated_at: string
        }
        Insert: {
          admin_approved_at?: string | null
          admin_approved_by?: string | null
          age_range?: string
          approved_at?: string | null
          book_meta?: Json | null
          category: string
          content_type?: string
          cover_url?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_custom?: boolean
          is_gallery?: boolean
          is_published?: boolean
          language?: string
          moral: string
          pages?: Json
          slug: string
          source_order_id?: string | null
          source_template_id?: string | null
          summary: string
          title: string
          updated_at?: string
        }
        Update: {
          admin_approved_at?: string | null
          admin_approved_by?: string | null
          age_range?: string
          approved_at?: string | null
          book_meta?: Json | null
          category?: string
          content_type?: string
          cover_url?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_custom?: boolean
          is_gallery?: boolean
          is_published?: boolean
          language?: string
          moral?: string
          pages?: Json
          slug?: string
          source_order_id?: string | null
          source_template_id?: string | null
          summary?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "story_templates_source_order_id_fkey"
            columns: ["source_order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "story_templates_source_template_id_fkey"
            columns: ["source_template_id"]
            isOneToOne: false
            referencedRelation: "story_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      wizard_drafts: {
        Row: {
          payload: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          payload: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          payload?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user"
      child_gender: "boy" | "girl"
      order_status:
        | "pending"
        | "approved"
        | "generating"
        | "ready"
        | "sent"
        | "rejected"
      payment_status: "unpaid" | "receipt_uploaded" | "verified" | "rejected"
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
    Enums: {
      app_role: ["admin", "user"],
      child_gender: ["boy", "girl"],
      order_status: [
        "pending",
        "approved",
        "generating",
        "ready",
        "sent",
        "rejected",
      ],
      payment_status: ["unpaid", "receipt_uploaded", "verified", "rejected"],
    },
  },
} as const
