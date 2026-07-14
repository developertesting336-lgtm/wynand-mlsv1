import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    'Missing Supabase environment variables. ' +
    'Make sure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set in your .env file.'
  )
}

export const supabase = createClient(
  supabaseUrl || '',
  supabaseAnonKey || '',
  {
    auth: {
      // Store session in localStorage (jwt-local strategy)
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    }
  }
)

function parseOrder(orderStr) {
  if (!orderStr) return { column: 'created_date', ascending: false }
  var ascending = !orderStr.startsWith('-')
  var column = ascending ? orderStr : orderStr.slice(1)
  return { column: column, ascending: ascending }
}

function wrapError(err) {
  if (err && err.code) return err
  return {
    status: err && err.status || 500,
    message: err && err.message || 'Unknown error',
    data: err && err.data || null
  }
}

class SupabaseEntityAdapter {
  constructor(tableName) {
    this.tableName = tableName
  }

  async list(order, limit) {
    var parsed = parseOrder(order)
    var query = supabase
      .from(this.tableName)
      .select('*')
      .order(parsed.column, { ascending: parsed.ascending })

    if (limit) {
      query = query.limit(limit)
    }

    var result = await query
    if (result.error) throw wrapError(result.error)
    return result.data || []
  }

  async filter(filters, order, limit) {
    var parsed = parseOrder(order)
    var query = supabase.from(this.tableName).select('*')

    if (filters && typeof filters === 'object') {
      var keys = Object.keys(filters)
      for (var k = 0; k < keys.length; k++) {
        query = query.eq(keys[k], filters[keys[k]])
      }
    }

    if (parsed.column) {
      query = query.order(parsed.column, { ascending: parsed.ascending })
    }
    if (limit) {
      query = query.limit(limit)
    }

    var result = await query
    if (result.error) throw wrapError(result.error)
    return result.data || []
  }

async create(data) {
    var record = Object.assign({}, data)
    if (!record.id) {
      record.id = typeof crypto !== 'undefined' && crypto.randomUUID 
        ? crypto.randomUUID() 
        : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
          });
    }

    var result = await supabase
      .from(this.tableName)
      .insert(record)
      .select()
      .single()

    if (result.error) throw wrapError(result.error)
    return result.data
  }

  async update(id, data) {
    var result = await supabase
      .from(this.tableName)
      .update(data)
      .eq('id', id)
      .select()
      .single()

    if (result.error) throw wrapError(result.error)
    return result.data
  }

  async delete(id) {
    var result = await supabase
      .from(this.tableName)
      .delete()
      .eq('id', id)

    if (result.error) throw wrapError(result.error)
    return { success: true }
  }
}

export { SupabaseEntityAdapter }