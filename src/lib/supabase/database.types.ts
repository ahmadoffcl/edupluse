export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      organizations: {
        Row: {
          id: string;
          name: string;
          slug: string;
          tenant_type: string;
          status: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          tenant_type?: string;
          status?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["organizations"]["Insert"]
        >;
      };
      profiles: {
        Row: {
          id: string;
          firebase_uid: string;
          email: string | null;
          display_name: string;
          phone: string | null;
          username: string | null;
          bio: string | null;
          onboarding_completed_at: string | null;
          avatar_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          firebase_uid: string;
          email?: string | null;
          display_name: string;
          phone?: string | null;
          username?: string | null;
          bio?: string | null;
          onboarding_completed_at?: string | null;
          avatar_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["profiles"]["Insert"]>;
      };
      memberships: {
        Row: {
          id: string;
          org_id: string;
          profile_id: string;
          role: Database["public"]["Enums"]["app_role"];
          status: Database["public"]["Enums"]["membership_status"];
          invited_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          org_id: string;
          profile_id: string;
          role: Database["public"]["Enums"]["app_role"];
          status?: Database["public"]["Enums"]["membership_status"];
          invited_by?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["memberships"]["Insert"]>;
      };
      ai_interactions: {
        Row: {
          id: string;
          org_id: string;
          firebase_uid: string;
          role: Database["public"]["Enums"]["app_role"];
          kind: string;
          prompt: string;
          response: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          org_id: string;
          firebase_uid: string;
          role: Database["public"]["Enums"]["app_role"];
          kind: string;
          prompt: string;
          response?: string | null;
          created_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["ai_interactions"]["Insert"]
        >;
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      app_role: "student" | "teacher" | "admin" | "super_admin";
      membership_status: "invited" | "active" | "suspended";
      assignment_status: "draft" | "published" | "closed";
      submission_status: "submitted" | "late" | "graded" | "returned";
      attendance_status: "present" | "absent" | "late" | "excused";
      resource_type: "pdf" | "video" | "image" | "rich_note" | "link";
      message_kind: "direct" | "class_channel" | "announcement_thread";
    };
    CompositeTypes: Record<string, never>;
  };
};
