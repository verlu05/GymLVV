import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://hyghznhixakllftrdrly.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlnaWxvcmhpaGhsYmlzaXF1b2Z5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkxNDE0MDAsImV4cCI6MjEwNDcxNzQwMH0.3cJGqzP7HPGqn-P55dcHcZmX5ApTjgxhG4RaeprnVoU";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);