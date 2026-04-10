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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      account_settings: {
        Row: {
          created_at: string
          currency: string
          dashboard_layout: Json | null
          id: string
          initial_deposit: number
          portfolio_id: string | null
          starting_balance: number
          timezone: string | null
          updated_at: string
          user_id: string
          weekly_goal: number | null
        }
        Insert: {
          created_at?: string
          currency?: string
          dashboard_layout?: Json | null
          id?: string
          initial_deposit?: number
          portfolio_id?: string | null
          starting_balance?: number
          timezone?: string | null
          updated_at?: string
          user_id: string
          weekly_goal?: number | null
        }
        Update: {
          created_at?: string
          currency?: string
          dashboard_layout?: Json | null
          id?: string
          initial_deposit?: number
          portfolio_id?: string | null
          starting_balance?: number
          timezone?: string | null
          updated_at?: string
          user_id?: string
          weekly_goal?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "account_settings_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "portfolios"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_insights: {
        Row: {
          created_at: string
          id: string
          payload: Json
          scope: string
          time_end: string | null
          time_start: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          payload: Json
          scope: string
          time_end?: string | null
          time_start?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          payload?: Json
          scope?: string
          time_end?: string | null
          time_start?: string | null
          user_id?: string
        }
        Relationships: []
      }
      alerts: {
        Row: {
          alert_type: string
          created_at: string
          fast_period: number | null
          id: string
          is_active: boolean
          slow_period: number | null
          target_value: number | null
          threshold: number | null
          triggered_at: string | null
          user_id: string
          watchlist_item_id: string
        }
        Insert: {
          alert_type: string
          created_at?: string
          fast_period?: number | null
          id?: string
          is_active?: boolean
          slow_period?: number | null
          target_value?: number | null
          threshold?: number | null
          triggered_at?: string | null
          user_id: string
          watchlist_item_id: string
        }
        Update: {
          alert_type?: string
          created_at?: string
          fast_period?: number | null
          id?: string
          is_active?: boolean
          slow_period?: number | null
          target_value?: number | null
          threshold?: number | null
          triggered_at?: string | null
          user_id?: string
          watchlist_item_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "alerts_watchlist_item_id_fkey"
            columns: ["watchlist_item_id"]
            isOneToOne: false
            referencedRelation: "watchlist_items"
            referencedColumns: ["id"]
          },
        ]
      }
      announcements: {
        Row: {
          content: string
          created_at: string
          expires_at: string | null
          id: string
          is_pinned: boolean
          priority: string
          scheduled_at: string | null
          title: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          expires_at?: string | null
          id?: string
          is_pinned?: boolean
          priority?: string
          scheduled_at?: string | null
          title: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          is_pinned?: boolean
          priority?: string
          scheduled_at?: string | null
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      app_settings: {
        Row: {
          app_description: string | null
          app_name: string
          background_color: string | null
          card_color: string | null
          created_at: string
          destructive_color: string | null
          foreground_color: string | null
          id: string
          logo_url: string | null
          muted_foreground_color: string | null
          primary_color: string | null
          show_logo: boolean | null
          success_color: string | null
          twofa_enforcement: string | null
          updated_at: string
        }
        Insert: {
          app_description?: string | null
          app_name?: string
          background_color?: string | null
          card_color?: string | null
          created_at?: string
          destructive_color?: string | null
          foreground_color?: string | null
          id?: string
          logo_url?: string | null
          muted_foreground_color?: string | null
          primary_color?: string | null
          show_logo?: boolean | null
          success_color?: string | null
          twofa_enforcement?: string | null
          updated_at?: string
        }
        Update: {
          app_description?: string | null
          app_name?: string
          background_color?: string | null
          card_color?: string | null
          created_at?: string
          destructive_color?: string | null
          foreground_color?: string | null
          id?: string
          logo_url?: string | null
          muted_foreground_color?: string | null
          primary_color?: string | null
          show_logo?: boolean | null
          success_color?: string | null
          twofa_enforcement?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      backup_codes: {
        Row: {
          code_hash: string
          created_at: string
          id: string
          used_at: string | null
          user_id: string
        }
        Insert: {
          code_hash: string
          created_at?: string
          id?: string
          used_at?: string | null
          user_id: string
        }
        Update: {
          code_hash?: string
          created_at?: string
          id?: string
          used_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      billing_events: {
        Row: {
          created_at: string | null
          event_type: string
          id: string
          payload: Json | null
          stripe_event_id: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          event_type: string
          id?: string
          payload?: Json | null
          stripe_event_id?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          event_type?: string
          id?: string
          payload?: Json | null
          stripe_event_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "billing_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      channel_members: {
        Row: {
          added_at: string
          added_by: string | null
          channel_id: string
          id: string
          user_id: string
        }
        Insert: {
          added_at?: string
          added_by?: string | null
          channel_id: string
          id?: string
          user_id: string
        }
        Update: {
          added_at?: string
          added_by?: string | null
          channel_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "channel_members_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
        ]
      }
      channels: {
        Row: {
          channel_type: string
          created_at: string
          created_by: string
          description: string | null
          id: string
          name: string
        }
        Insert: {
          channel_type?: string
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          name: string
        }
        Update: {
          channel_type?: string
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      chat_messages: {
        Row: {
          channel: string
          channel_id: string | null
          content: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          channel?: string
          channel_id?: string | null
          content: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          channel?: string
          channel_id?: string | null
          content?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
        ]
      }
      deposits: {
        Row: {
          amount: number
          created_at: string
          deposit_date: string
          id: string
          notes: string | null
          portfolio_id: string | null
          transaction_type: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          deposit_date?: string
          id?: string
          notes?: string | null
          portfolio_id?: string | null
          transaction_type?: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          deposit_date?: string
          id?: string
          notes?: string | null
          portfolio_id?: string | null
          transaction_type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "deposits_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "portfolios"
            referencedColumns: ["id"]
          },
        ]
      }
      email_ingest_addresses: {
        Row: {
          created_at: string
          email_address: string
          id: string
          is_active: boolean
          provider: string
          token: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email_address: string
          id?: string
          is_active?: boolean
          provider?: string
          token: string
          user_id: string
        }
        Update: {
          created_at?: string
          email_address?: string
          id?: string
          is_active?: boolean
          provider?: string
          token?: string
          user_id?: string
        }
        Relationships: []
      }
      market_news: {
        Row: {
          created_at: string
          id: string
          image_url: string | null
          published_at: string
          sentiment: string | null
          sentiment_score: number | null
          source: string | null
          summary: string | null
          ticker: string | null
          tickers: string[] | null
          title: string
          url: string
        }
        Insert: {
          created_at?: string
          id?: string
          image_url?: string | null
          published_at: string
          sentiment?: string | null
          sentiment_score?: number | null
          source?: string | null
          summary?: string | null
          ticker?: string | null
          tickers?: string[] | null
          title: string
          url: string
        }
        Update: {
          created_at?: string
          id?: string
          image_url?: string | null
          published_at?: string
          sentiment?: string | null
          sentiment_score?: number | null
          source?: string | null
          summary?: string | null
          ticker?: string | null
          tickers?: string[] | null
          title?: string
          url?: string
        }
        Relationships: []
      }
      message_reactions: {
        Row: {
          created_at: string
          emoji: string
          id: string
          message_id: string
          message_type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          emoji: string
          id?: string
          message_id: string
          message_type: string
          user_id: string
        }
        Update: {
          created_at?: string
          emoji?: string
          id?: string
          message_id?: string
          message_type?: string
          user_id?: string
        }
        Relationships: []
      }
      note_shares: {
        Row: {
          created_at: string
          id: string
          note_id: string
          permission: string
          shared_by: string
          shared_with: string
        }
        Insert: {
          created_at?: string
          id?: string
          note_id: string
          permission?: string
          shared_by: string
          shared_with: string
        }
        Update: {
          created_at?: string
          id?: string
          note_id?: string
          permission?: string
          shared_by?: string
          shared_with?: string
        }
        Relationships: [
          {
            foreignKeyName: "note_shares_note_id_fkey"
            columns: ["note_id"]
            isOneToOne: false
            referencedRelation: "notes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "note_shares_shared_by_fkey"
            columns: ["shared_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "note_shares_shared_with_fkey"
            columns: ["shared_with"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notes: {
        Row: {
          category: string
          content: string | null
          created_at: string
          id: string
          images: string[] | null
          is_pinned: boolean
          links: string[] | null
          ticker: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          category?: string
          content?: string | null
          created_at?: string
          id?: string
          images?: string[] | null
          is_pinned?: boolean
          links?: string[] | null
          ticker?: string | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string
          content?: string | null
          created_at?: string
          id?: string
          images?: string[] | null
          is_pinned?: boolean
          links?: string[] | null
          ticker?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      notification_preferences: {
        Row: {
          announcement_alerts: boolean
          created_at: string
          id: string
          inbox_alerts: boolean | null
          mute_all_notifications: boolean
          price_alerts: boolean
          reminder_alerts: boolean
          show_toast_banners: boolean
          trade_inbox_daily_reminder: boolean | null
          trade_inbox_push_mode: string | null
          trade_updates: boolean
          updated_at: string
          user_id: string
          weekly_summary: boolean
        }
        Insert: {
          announcement_alerts?: boolean
          created_at?: string
          id?: string
          inbox_alerts?: boolean | null
          mute_all_notifications?: boolean
          price_alerts?: boolean
          reminder_alerts?: boolean
          show_toast_banners?: boolean
          trade_inbox_daily_reminder?: boolean | null
          trade_inbox_push_mode?: string | null
          trade_updates?: boolean
          updated_at?: string
          user_id: string
          weekly_summary?: boolean
        }
        Update: {
          announcement_alerts?: boolean
          created_at?: string
          id?: string
          inbox_alerts?: boolean | null
          mute_all_notifications?: boolean
          price_alerts?: boolean
          reminder_alerts?: boolean
          show_toast_banners?: boolean
          trade_inbox_daily_reminder?: boolean | null
          trade_inbox_push_mode?: string | null
          trade_updates?: boolean
          updated_at?: string
          user_id?: string
          weekly_summary?: boolean
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string | null
          data: Json | null
          id: string
          is_read: boolean | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string | null
          data?: Json | null
          id?: string
          is_read?: boolean | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string | null
          data?: Json | null
          id?: string
          is_read?: boolean | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      portfolio_holdings: {
        Row: {
          asset_type: string
          avg_cost: number
          created_at: string
          id: string
          notes: string | null
          portfolio_id: string
          quantity: number
          ticker: string
          updated_at: string
          user_id: string
        }
        Insert: {
          asset_type?: string
          avg_cost?: number
          created_at?: string
          id?: string
          notes?: string | null
          portfolio_id: string
          quantity?: number
          ticker: string
          updated_at?: string
          user_id: string
        }
        Update: {
          asset_type?: string
          avg_cost?: number
          created_at?: string
          id?: string
          notes?: string | null
          portfolio_id?: string
          quantity?: number
          ticker?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "portfolio_holdings_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "portfolios"
            referencedColumns: ["id"]
          },
        ]
      }
      portfolio_routing_rules: {
        Row: {
          created_at: string
          id: string
          match_type: string
          match_value: string
          portfolio_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          match_type: string
          match_value: string
          portfolio_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          match_type?: string
          match_value?: string
          portfolio_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "portfolio_routing_rules_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "portfolios"
            referencedColumns: ["id"]
          },
        ]
      }
      portfolios: {
        Row: {
          category: string
          created_at: string
          id: string
          is_archived: boolean
          is_default: boolean
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          category?: string
          created_at?: string
          id?: string
          is_archived?: boolean
          is_default?: boolean
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string
          created_at?: string
          id?: string
          is_archived?: boolean
          is_default?: boolean
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          comped_access: boolean
          comped_at: string | null
          comped_by: string | null
          comped_reason: string | null
          created_at: string
          display_name: string | null
          early_supporter: boolean
          email: string | null
          grandfathered: boolean
          has_used_trial: boolean | null
          id: string
          last_stripe_event_at: string | null
          notification_prompt_shown: boolean | null
          onboarding_completed: boolean | null
          onboarding_dismissed_until: string | null
          onesignal_subscription_id: string | null
          plan_status: string
          stripe_current_period_end: string | null
          stripe_customer_id: string | null
          stripe_price_id: string | null
          stripe_status: string | null
          stripe_subscription_id: string | null
          subscription_end: string | null
          subscription_tier:
            | Database["public"]["Enums"]["subscription_tier"]
            | null
          terms_accepted_at: string | null
          terms_version: string | null
          trial_ends_at: string | null
          trial_started_at: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          comped_access?: boolean
          comped_at?: string | null
          comped_by?: string | null
          comped_reason?: string | null
          created_at?: string
          display_name?: string | null
          early_supporter?: boolean
          email?: string | null
          grandfathered?: boolean
          has_used_trial?: boolean | null
          id: string
          last_stripe_event_at?: string | null
          notification_prompt_shown?: boolean | null
          onboarding_completed?: boolean | null
          onboarding_dismissed_until?: string | null
          onesignal_subscription_id?: string | null
          plan_status?: string
          stripe_current_period_end?: string | null
          stripe_customer_id?: string | null
          stripe_price_id?: string | null
          stripe_status?: string | null
          stripe_subscription_id?: string | null
          subscription_end?: string | null
          subscription_tier?:
            | Database["public"]["Enums"]["subscription_tier"]
            | null
          terms_accepted_at?: string | null
          terms_version?: string | null
          trial_ends_at?: string | null
          trial_started_at?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          comped_access?: boolean
          comped_at?: string | null
          comped_by?: string | null
          comped_reason?: string | null
          created_at?: string
          display_name?: string | null
          early_supporter?: boolean
          email?: string | null
          grandfathered?: boolean
          has_used_trial?: boolean | null
          id?: string
          last_stripe_event_at?: string | null
          notification_prompt_shown?: boolean | null
          onboarding_completed?: boolean | null
          onboarding_dismissed_until?: string | null
          onesignal_subscription_id?: string | null
          plan_status?: string
          stripe_current_period_end?: string | null
          stripe_customer_id?: string | null
          stripe_price_id?: string | null
          stripe_status?: string | null
          stripe_subscription_id?: string | null
          subscription_end?: string | null
          subscription_tier?:
            | Database["public"]["Enums"]["subscription_tier"]
            | null
          terms_accepted_at?: string | null
          terms_version?: string | null
          trial_ends_at?: string | null
          trial_started_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_comped_by_fkey"
            columns: ["comped_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      push_device_subscriptions: {
        Row: {
          created_at: string
          device_label: string | null
          id: string
          last_active_at: string
          onesignal_subscription_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          device_label?: string | null
          id?: string
          last_active_at?: string
          onesignal_subscription_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          device_label?: string | null
          id?: string
          last_active_at?: string
          onesignal_subscription_id?: string
          user_id?: string
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          device_id: string | null
          device_label: string | null
          device_metadata: Json | null
          endpoint: string
          id: string
          last_successful_push_at: string | null
          p256dh: string
          user_id: string
          vapid_key_hash: string | null
        }
        Insert: {
          auth: string
          created_at?: string
          device_id?: string | null
          device_label?: string | null
          device_metadata?: Json | null
          endpoint: string
          id?: string
          last_successful_push_at?: string | null
          p256dh: string
          user_id: string
          vapid_key_hash?: string | null
        }
        Update: {
          auth?: string
          created_at?: string
          device_id?: string | null
          device_label?: string | null
          device_metadata?: Json | null
          endpoint?: string
          id?: string
          last_successful_push_at?: string | null
          p256dh?: string
          user_id?: string
          vapid_key_hash?: string | null
        }
        Relationships: []
      }
      reminders: {
        Row: {
          created_at: string
          description: string | null
          dismissed_at: string | null
          due_at: string | null
          due_date: string | null
          id: string
          is_completed: boolean
          note_id: string | null
          notified_at: string | null
          priority: string
          reminder_time: string | null
          ticker: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          dismissed_at?: string | null
          due_at?: string | null
          due_date?: string | null
          id?: string
          is_completed?: boolean
          note_id?: string | null
          notified_at?: string | null
          priority?: string
          reminder_time?: string | null
          ticker?: string | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          dismissed_at?: string | null
          due_at?: string | null
          due_date?: string | null
          id?: string
          is_completed?: boolean
          note_id?: string | null
          notified_at?: string | null
          priority?: string
          reminder_time?: string | null
          ticker?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reminders_note_id_fkey"
            columns: ["note_id"]
            isOneToOne: false
            referencedRelation: "notes"
            referencedColumns: ["id"]
          },
        ]
      }
      totp_secrets: {
        Row: {
          created_at: string | null
          encrypted_secret: string
          id: string
          user_id: string
          verified: boolean | null
          verified_at: string | null
        }
        Insert: {
          created_at?: string | null
          encrypted_secret: string
          id?: string
          user_id: string
          verified?: boolean | null
          verified_at?: string | null
        }
        Update: {
          created_at?: string | null
          encrypted_secret?: string
          id?: string
          user_id?: string
          verified?: boolean | null
          verified_at?: string | null
        }
        Relationships: []
      }
      trade_enrichment: {
        Row: {
          above_sma20_entry: boolean | null
          above_sma50_entry: boolean | null
          created_at: string
          earnings_in_days: number | null
          entry_datetime: string
          exit_datetime: string | null
          id: string
          mae: number | null
          mae_pct: number | null
          mfe: number | null
          mfe_pct: number | null
          news: Json | null
          sma20_entry: number | null
          sma50_entry: number | null
          ticker: string
          trade_id: string
          trend_regime_entry: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          above_sma20_entry?: boolean | null
          above_sma50_entry?: boolean | null
          created_at?: string
          earnings_in_days?: number | null
          entry_datetime: string
          exit_datetime?: string | null
          id?: string
          mae?: number | null
          mae_pct?: number | null
          mfe?: number | null
          mfe_pct?: number | null
          news?: Json | null
          sma20_entry?: number | null
          sma50_entry?: number | null
          ticker: string
          trade_id: string
          trend_regime_entry?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          above_sma20_entry?: boolean | null
          above_sma50_entry?: boolean | null
          created_at?: string
          earnings_in_days?: number | null
          entry_datetime?: string
          exit_datetime?: string | null
          id?: string
          mae?: number | null
          mae_pct?: number | null
          mfe?: number | null
          mfe_pct?: number | null
          news?: Json | null
          sma20_entry?: number | null
          sma50_entry?: number | null
          ticker?: string
          trade_id?: string
          trend_regime_entry?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trade_enrichment_trade_id_fkey"
            columns: ["trade_id"]
            isOneToOne: true
            referencedRelation: "trades"
            referencedColumns: ["id"]
          },
        ]
      }
      trade_fills: {
        Row: {
          created_at: string
          dedupe_key: string | null
          effect: string
          fill_date: string
          fill_time: string | null
          id: string
          notes: string | null
          price: number
          qty: number
          side: string
          source: string
          source_inbox_id: string | null
          trade_group_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          dedupe_key?: string | null
          effect: string
          fill_date: string
          fill_time?: string | null
          id?: string
          notes?: string | null
          price: number
          qty: number
          side: string
          source?: string
          source_inbox_id?: string | null
          trade_group_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          dedupe_key?: string | null
          effect?: string
          fill_date?: string
          fill_time?: string | null
          id?: string
          notes?: string | null
          price?: number
          qty?: number
          side?: string
          source?: string
          source_inbox_id?: string | null
          trade_group_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trade_fills_trade_group_id_fkey"
            columns: ["trade_group_id"]
            isOneToOne: false
            referencedRelation: "trade_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      trade_groups: {
        Row: {
          avg_entry_price: number
          avg_exit_price: number | null
          closed_qty: number
          created_at: string
          entry_date: string
          exit_date: string | null
          expiration_date: string | null
          id: string
          images: string[] | null
          notes: string | null
          opened_qty: number
          portfolio_id: string | null
          realized_pnl: number | null
          remaining_qty: number
          status: string
          strategy: string | null
          strike_price: number | null
          ticker: string
          trade_type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avg_entry_price?: number
          avg_exit_price?: number | null
          closed_qty?: number
          created_at?: string
          entry_date: string
          exit_date?: string | null
          expiration_date?: string | null
          id?: string
          images?: string[] | null
          notes?: string | null
          opened_qty?: number
          portfolio_id?: string | null
          realized_pnl?: number | null
          remaining_qty?: number
          status?: string
          strategy?: string | null
          strike_price?: number | null
          ticker: string
          trade_type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avg_entry_price?: number
          avg_exit_price?: number | null
          closed_qty?: number
          created_at?: string
          entry_date?: string
          exit_date?: string | null
          expiration_date?: string | null
          id?: string
          images?: string[] | null
          notes?: string | null
          opened_qty?: number
          portfolio_id?: string | null
          realized_pnl?: number | null
          remaining_qty?: number
          status?: string
          strategy?: string | null
          strike_price?: number | null
          ticker?: string
          trade_type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trade_groups_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "portfolios"
            referencedColumns: ["id"]
          },
        ]
      }
      trade_inbox: {
        Row: {
          actioned_at: string | null
          confidence: number
          errors: string | null
          id: string
          imported_group_id: string | null
          imported_trade_id: string | null
          parsed_trade: Json | null
          raw_payload: Json | null
          raw_text: string | null
          received_at: string
          source: string
          source_hash: string
          source_message_id: string | null
          status: string
          user_id: string
        }
        Insert: {
          actioned_at?: string | null
          confidence?: number
          errors?: string | null
          id?: string
          imported_group_id?: string | null
          imported_trade_id?: string | null
          parsed_trade?: Json | null
          raw_payload?: Json | null
          raw_text?: string | null
          received_at?: string
          source?: string
          source_hash: string
          source_message_id?: string | null
          status?: string
          user_id: string
        }
        Update: {
          actioned_at?: string | null
          confidence?: number
          errors?: string | null
          id?: string
          imported_group_id?: string | null
          imported_trade_id?: string | null
          parsed_trade?: Json | null
          raw_payload?: Json | null
          raw_text?: string | null
          received_at?: string
          source?: string
          source_hash?: string
          source_message_id?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trade_inbox_imported_group_id_fkey"
            columns: ["imported_group_id"]
            isOneToOne: false
            referencedRelation: "trade_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      trade_inbox_push_log: {
        Row: {
          id: string
          item_ids: string[]
          push_type: string
          sent_at: string
          user_id: string
          user_local_date: string
        }
        Insert: {
          id?: string
          item_ids: string[]
          push_type: string
          sent_at?: string
          user_id: string
          user_local_date: string
        }
        Update: {
          id?: string
          item_ids?: string[]
          push_type?: string
          sent_at?: string
          user_id?: string
          user_local_date?: string
        }
        Relationships: []
      }
      trade_shares: {
        Row: {
          created_at: string
          expires_at: string | null
          id: string
          is_public: boolean
          share_code: string
          shared_by: string
          trade_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          id?: string
          is_public?: boolean
          share_code: string
          shared_by: string
          trade_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          id?: string
          is_public?: boolean
          share_code?: string
          shared_by?: string
          trade_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trade_shares_trade_id_fkey"
            columns: ["trade_id"]
            isOneToOne: false
            referencedRelation: "trades"
            referencedColumns: ["id"]
          },
        ]
      }
      trades: {
        Row: {
          created_at: string
          entry_date: string
          entry_datetime: string | null
          entry_price: number
          entry_time: string | null
          exit_date: string | null
          exit_datetime: string | null
          exit_price: number | null
          exit_time: string | null
          expiration_date: string | null
          id: string
          images: string[] | null
          notes: string | null
          pnl: number | null
          position_id: string | null
          quantity: number
          status: Database["public"]["Enums"]["trade_status"]
          strategy: string | null
          strike_price: number | null
          ticker: string
          trade_type: Database["public"]["Enums"]["trade_type"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          entry_date: string
          entry_datetime?: string | null
          entry_price: number
          entry_time?: string | null
          exit_date?: string | null
          exit_datetime?: string | null
          exit_price?: number | null
          exit_time?: string | null
          expiration_date?: string | null
          id?: string
          images?: string[] | null
          notes?: string | null
          pnl?: number | null
          position_id?: string | null
          quantity: number
          status?: Database["public"]["Enums"]["trade_status"]
          strategy?: string | null
          strike_price?: number | null
          ticker: string
          trade_type: Database["public"]["Enums"]["trade_type"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          entry_date?: string
          entry_datetime?: string | null
          entry_price?: number
          entry_time?: string | null
          exit_date?: string | null
          exit_datetime?: string | null
          exit_price?: number | null
          exit_time?: string | null
          expiration_date?: string | null
          id?: string
          images?: string[] | null
          notes?: string | null
          pnl?: number | null
          position_id?: string | null
          quantity?: number
          status?: Database["public"]["Enums"]["trade_status"]
          strategy?: string | null
          strike_price?: number | null
          ticker?: string
          trade_type?: Database["public"]["Enums"]["trade_type"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      trusted_devices: {
        Row: {
          created_at: string | null
          device_name: string | null
          device_token: string
          expires_at: string
          id: string
          ip_address: string | null
          last_used_at: string | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          device_name?: string | null
          device_token: string
          expires_at: string
          id?: string
          ip_address?: string | null
          last_used_at?: string | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          device_name?: string | null
          device_token?: string
          expires_at?: string
          id?: string
          ip_address?: string | null
          last_used_at?: string | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_features: {
        Row: {
          created_at: string
          enabled: boolean
          feature_name: string
          granted_at: string | null
          granted_by: string | null
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          feature_name: string
          granted_at?: string | null
          granted_by?: string | null
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          feature_name?: string
          granted_at?: string | null
          granted_by?: string | null
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_features_granted_by_fkey"
            columns: ["granted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_features_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
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
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      watchlist_items: {
        Row: {
          added_at: string
          id: string
          notes: string | null
          ticker: string
          watchlist_id: string
        }
        Insert: {
          added_at?: string
          id?: string
          notes?: string | null
          ticker: string
          watchlist_id: string
        }
        Update: {
          added_at?: string
          id?: string
          notes?: string | null
          ticker?: string
          watchlist_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "watchlist_items_watchlist_id_fkey"
            columns: ["watchlist_id"]
            isOneToOne: false
            referencedRelation: "watchlists"
            referencedColumns: ["id"]
          },
        ]
      }
      watchlists: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_default: boolean | null
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_default?: boolean | null
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_default?: boolean | null
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      weekly_balances: {
        Row: {
          closing_balance: number
          created_at: string
          id: string
          notes: string | null
          opening_balance: number
          portfolio_id: string | null
          updated_at: string
          user_id: string
          week_end_date: string
          week_start_date: string
          withdrawn_amount: number
        }
        Insert: {
          closing_balance: number
          created_at?: string
          id?: string
          notes?: string | null
          opening_balance: number
          portfolio_id?: string | null
          updated_at?: string
          user_id: string
          week_end_date: string
          week_start_date: string
          withdrawn_amount?: number
        }
        Update: {
          closing_balance?: number
          created_at?: string
          id?: string
          notes?: string | null
          opening_balance?: number
          portfolio_id?: string | null
          updated_at?: string
          user_id?: string
          week_end_date?: string
          week_start_date?: string
          withdrawn_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "weekly_balances_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "portfolios"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      announcements_public: {
        Row: {
          content: string | null
          created_at: string | null
          expires_at: string | null
          id: string | null
          is_pinned: boolean | null
          priority: string | null
          scheduled_at: string | null
          title: string | null
        }
        Insert: {
          content?: string | null
          created_at?: string | null
          expires_at?: string | null
          id?: string | null
          is_pinned?: boolean | null
          priority?: string | null
          scheduled_at?: string | null
          title?: string | null
        }
        Update: {
          content?: string | null
          created_at?: string | null
          expires_at?: string | null
          id?: string | null
          is_pinned?: boolean | null
          priority?: string | null
          scheduled_at?: string | null
          title?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      count_user_trade_groups: { Args: { _user_id: string }; Returns: number }
      count_user_watchlists: { Args: { _user_id: string }; Returns: number }
      get_dashboard_data:
        | { Args: never; Returns: Json }
        | { Args: { p_portfolio_id?: string }; Returns: Json }
      get_journal_data:
        | { Args: never; Returns: Json }
        | { Args: { p_portfolio_id?: string }; Returns: Json }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      set_default_watchlist: {
        Args: { p_user_id: string; p_watchlist_id: string }
        Returns: undefined
      }
      user_has_full_access: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "user" | "owner" | "moderator"
      subscription_tier: "free" | "trial" | "monthly" | "lifetime"
      trade_status: "open" | "closed"
      trade_type: "call" | "put" | "stock"
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
      app_role: ["admin", "user", "owner", "moderator"],
      subscription_tier: ["free", "trial", "monthly", "lifetime"],
      trade_status: ["open", "closed"],
      trade_type: ["call", "put", "stock"],
    },
  },
} as const
