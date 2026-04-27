import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function fix() {
  console.log('⏳ データベースを修正中...');
  const { error } = await supabase.rpc('exec_sql', { sql_query: `
    drop table if exists documents;
    create table documents (
      id text primary key,
      user_id uuid references auth.users not null,
      data jsonb not null default '{}'::jsonb,
      updated_at bigint not null default 0
    );
    alter table documents enable row level security;
    create policy "Own documents" on documents using (auth.uid() = user_id) with check (auth.uid() = user_id);
  ` });
  
  if (error) {
    console.error('❌ 自動修正に失敗しました。SupabaseのSQL Editorで手動実行してください。', error);
  } else {
    console.log('✅ 完了！データベースが最新になりました。');
  }
}
fix();
