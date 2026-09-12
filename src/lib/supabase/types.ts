export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      graphql: {
        Args: {
          extensions?: Json;
          operationName?: string;
          query?: string;
          variables?: Json;
        };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  public: {
    Tables: {
      draw_secrets: {
        Row: {
          draw_id: string;
          seed: string;
        };
        Insert: {
          draw_id: string;
          seed: string;
        };
        Update: {
          draw_id?: string;
          seed?: string;
        };
        Relationships: [
          {
            foreignKeyName: "draw_secrets_draw_id_fkey";
            columns: ["draw_id"];
            isOneToOne: true;
            referencedRelation: "draws";
            referencedColumns: ["id"];
          },
        ];
      };
      draws: {
        Row: {
          amount_per_winner: number;
          chain_blockhash: string | null;
          commit_signature: string | null;
          commit_slot: number | null;
          created_at: string;
          entries_root: string;
          entry_hashes: string[];
          event_id: string;
          id: string;
          reveal_signature: string | null;
          revealed_seed: string | null;
          seed_commit: string;
          status: Database["public"]["Enums"]["draw_status"];
          target_slot: number;
          winner_entry_ids: string[] | null;
          winners_count: number;
        };
        Insert: {
          amount_per_winner: number;
          chain_blockhash?: string | null;
          commit_signature?: string | null;
          commit_slot?: number | null;
          created_at?: string;
          entries_root: string;
          entry_hashes: string[];
          event_id: string;
          id?: string;
          reveal_signature?: string | null;
          revealed_seed?: string | null;
          seed_commit: string;
          status?: Database["public"]["Enums"]["draw_status"];
          target_slot: number;
          winner_entry_ids?: string[] | null;
          winners_count: number;
        };
        Update: {
          amount_per_winner?: number;
          chain_blockhash?: string | null;
          commit_signature?: string | null;
          commit_slot?: number | null;
          created_at?: string;
          entries_root?: string;
          entry_hashes?: string[];
          event_id?: string;
          id?: string;
          reveal_signature?: string | null;
          revealed_seed?: string | null;
          seed_commit?: string;
          status?: Database["public"]["Enums"]["draw_status"];
          target_slot?: number;
          winner_entry_ids?: string[] | null;
          winners_count?: number;
        };
        Relationships: [
          {
            foreignKeyName: "draws_event_id_fkey";
            columns: ["event_id"];
            isOneToOne: false;
            referencedRelation: "events";
            referencedColumns: ["id"];
          },
        ];
      };
      entries: {
        Row: {
          created_at: string;
          event_id: string;
          id: string;
          social_handle: string | null;
          social_provider: string | null;
          user_id: string | null;
          wallet_address: string;
        };
        Insert: {
          created_at?: string;
          event_id: string;
          id?: string;
          social_handle?: string | null;
          social_provider?: string | null;
          user_id?: string | null;
          wallet_address: string;
        };
        Update: {
          created_at?: string;
          event_id?: string;
          id?: string;
          social_handle?: string | null;
          social_provider?: string | null;
          user_id?: string | null;
          wallet_address?: string;
        };
        Relationships: [
          {
            foreignKeyName: "entries_event_id_fkey";
            columns: ["event_id"];
            isOneToOne: false;
            referencedRelation: "events";
            referencedColumns: ["id"];
          },
        ];
      };
      events: {
        Row: {
          closed_at: string | null;
          created_at: string;
          creator_id: string;
          entry_count: number;
          id: string;
          mint: string;
          mint_decimals: number;
          mint_symbol: string | null;
          opened_at: string | null;
          slug: string;
          status: Database["public"]["Enums"]["event_status"];
          title: string;
        };
        Insert: {
          closed_at?: string | null;
          created_at?: string;
          creator_id: string;
          entry_count?: number;
          id?: string;
          mint: string;
          mint_decimals: number;
          mint_symbol?: string | null;
          opened_at?: string | null;
          slug: string;
          status?: Database["public"]["Enums"]["event_status"];
          title: string;
        };
        Update: {
          closed_at?: string | null;
          created_at?: string;
          creator_id?: string;
          entry_count?: number;
          id?: string;
          mint?: string;
          mint_decimals?: number;
          mint_symbol?: string | null;
          opened_at?: string | null;
          slug?: string;
          status?: Database["public"]["Enums"]["event_status"];
          title?: string;
        };
        Relationships: [];
      };
      payouts: {
        Row: {
          amount: number;
          created_at: string;
          draw_id: string | null;
          entry_id: string;
          event_id: string;
          id: string;
          signature: string | null;
          status: string;
        };
        Insert: {
          amount: number;
          created_at?: string;
          draw_id?: string | null;
          entry_id: string;
          event_id: string;
          id?: string;
          signature?: string | null;
          status?: string;
        };
        Update: {
          amount?: number;
          created_at?: string;
          draw_id?: string | null;
          entry_id?: string;
          event_id?: string;
          id?: string;
          signature?: string | null;
          status?: string;
        };
        Relationships: [
          {
            foreignKeyName: "payouts_draw_id_fkey";
            columns: ["draw_id"];
            isOneToOne: false;
            referencedRelation: "draws";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "payouts_entry_id_fkey";
            columns: ["entry_id"];
            isOneToOne: false;
            referencedRelation: "entries";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "payouts_event_id_fkey";
            columns: ["event_id"];
            isOneToOne: false;
            referencedRelation: "events";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          created_at: string;
          display_name: string | null;
          id: string;
          wallet_address: string;
        };
        Insert: {
          created_at?: string;
          display_name?: string | null;
          id: string;
          wallet_address: string;
        };
        Update: {
          created_at?: string;
          display_name?: string | null;
          id?: string;
          wallet_address?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      assert_draw_event_closed: {
        Args: { p_event_id: string };
        Returns: undefined;
      };
    };
    Enums: {
      draw_status: "committed" | "revealed" | "abandoned";
      event_status: "draft" | "open" | "closed" | "paid";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof Database,
  "public"
>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      draw_status: ["committed", "revealed", "abandoned"],
      event_status: ["draft", "open", "closed", "paid"],
    },
  },
} as const;
