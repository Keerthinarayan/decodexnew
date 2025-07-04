import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Database types
export interface Database {
  public: {
    Tables: {
      teams: {
        Row: {
          id: string;
          name: string;
          email: string;
          score: number;
          current_question: number;
          power_ups: {
            doublePoints: number;
            hint: number;
            skip: number;
            brainBoost: number;
          };
          last_answered: string | null;
          brain_boost_active: boolean;
          created_at: string;
          updated_at: string;
          password_hash: string | null;
          completion_time: string | null;
          question_path: any[];
          bonus_points: number;
          current_question_id: string | null;
        };
        Insert: {
          id?: string;
          name: string;
          email: string;
          score?: number;
          current_question?: number;
          power_ups?: {
            doublePoints: number;
            hint: number;
            skip: number;
            brainBoost: number;
          };
          last_answered?: string | null;
          brain_boost_active?: boolean;
          created_at?: string;
          updated_at?: string;
          password_hash?: string | null;
          completion_time?: string | null;
          question_path?: any[];
          bonus_points?: number;
          current_question_id?: string | null;
        };
        Update: {
          id?: string;
          name?: string;
          email?: string;
          score?: number;
          current_question?: number;
          power_ups?: {
            doublePoints: number;
            hint: number;
            skip: number;
            brainBoost: number;
          };
          last_answered?: string | null;
          brain_boost_active?: boolean;
          created_at?: string;
          updated_at?: string;
          password_hash?: string | null;
          completion_time?: string | null;
          question_path?: any[];
          bonus_points?: number;
          current_question_id?: string | null;
        };
      };
      questions: {
        Row: {
          id: string;
          title: string;
          question: string;
          answer: string;
          hint: string | null;
          type: 'text' | 'image' | 'video' | 'audio' | 'file';
          media_url: string | null;
          points: number;
          category: string;
          explanation: string | null;
          is_active: boolean;
          order_index: number;
          created_at: string;
          updated_at: string;
          is_branch_point: boolean;
          branch_choices: any[] | null;
          difficulty_level: 'easy' | 'normal' | 'hard' | 'expert';
          next_question_id: string | null;
          is_choice_question: boolean;
          choice_type: 'difficulty' | 'speed' | 'topic' | null;
          easy_question_id: string | null;
          hard_question_id: string | null;
        };
        Insert: {
          id?: string;
          title: string;
          question: string;
          answer: string;
          hint?: string | null;
          type: 'text' | 'image' | 'video' | 'audio' | 'file';
          media_url?: string | null;
          points?: number;
          category: string;
          explanation?: string | null;
          is_active?: boolean;
          order_index?: number;
          created_at?: string;
          updated_at?: string;
          is_branch_point?: boolean;
          branch_choices?: any[] | null;
          difficulty_level?: 'easy' | 'normal' | 'hard' | 'expert';
          next_question_id?: string | null;
          is_choice_question?: boolean;
          choice_type?: 'difficulty' | 'speed' | 'topic' | null;
          easy_question_id?: string | null;
          hard_question_id?: string | null;
        };
        Update: {
          id?: string;
          title?: string;
          question?: string;
          answer?: string;
          hint?: string | null;
          type?: 'text' | 'image' | 'video' | 'audio' | 'file';
          media_url?: string | null;
          points?: number;
          category?: string;
          explanation?: string | null;
          is_active?: boolean;
          order_index?: number;
          created_at?: string;
          updated_at?: string;
          is_branch_point?: boolean;
          branch_choices?: any[] | null;
          difficulty_level?: 'easy' | 'normal' | 'hard' | 'expert';
          next_question_id?: string | null;
          is_choice_question?: boolean;
          choice_type?: 'difficulty' | 'speed' | 'topic' | null;
          easy_question_id?: string | null;
          hard_question_id?: string | null;
        };
      };
      game_settings: {
        Row: {
          id: string;
          quiz_active: boolean;
          quiz_paused: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          quiz_active?: boolean;
          quiz_paused?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          quiz_active?: boolean;
          quiz_paused?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
    };
  };
}