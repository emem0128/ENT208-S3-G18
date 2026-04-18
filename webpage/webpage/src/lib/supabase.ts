import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://rwjbladqwubgjotlygyy.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ3amJsYWRxd3ViZ2pvdGx5Z3l5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMyNDUwNTYsImV4cCI6MjA4ODgyMTA1Nn0.dR9w2xmK9UpbNfO_dEAnJ2FqXcj1S2vQ15xexzskhA4';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
