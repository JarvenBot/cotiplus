import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://tpgblvolrawlpybkkahi.supabase.co' 
const SUPABASE_ANON_KEY = 'sb_publishable_Y4sy9KbxEdG-fTn55qRwHA_jaSLL...' 

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
