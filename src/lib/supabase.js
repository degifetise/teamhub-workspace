import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

/** True only when real keys are in .env. Otherwise the app runs in mock mode with sample data. */
export const isConfigured = !!url && !!key && !url.includes('your-project-ref') && !key.startsWith('your_')
export const supabase = isConfigured ? createClient(url, key) : null
