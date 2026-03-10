// Supabase Edge Function - Notion API 프록시
// Deno 런타임 (TypeScript)

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // 인증 확인
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: '인증 필요' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
    );

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: '인증 실패' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { action, apiKey, databaseId, ...rest } = await req.json();

    if (!apiKey || !databaseId) {
      return new Response(JSON.stringify({ error: 'apiKey, databaseId 필수' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const notionHeaders = {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'Notion-Version': '2022-06-28',
    };

    let result: unknown;

    if (action === 'testConnection') {
      const res = await fetch(`https://api.notion.com/v1/databases/${databaseId}`, {
        headers: notionHeaders,
      });
      if (res.ok) {
        result = { ok: true, message: 'Notion 연결 성공' };
      } else {
        const err = await res.json();
        result = { ok: false, message: err.message || 'Notion 연결 실패' };
      }

    } else if (action === 'getDoingTasks') {
      const { statusProperty = 'Status', doingValue = '진행 중', assigneeProperty, userName } = rest;

      const filter: Record<string, unknown> = {
        property: statusProperty,
        status: { equals: doingValue },
      };

      const body: Record<string, unknown> = {
        filter: assigneeProperty && userName
          ? {
              and: [
                filter,
                { property: assigneeProperty, people: { contains: userName } },
              ],
            }
          : filter,
        sorts: [{ property: 'Created time', direction: 'descending' }],
      };

      const res = await fetch(`https://api.notion.com/v1/databases/${databaseId}/query`, {
        method: 'POST',
        headers: notionHeaders,
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok) {
        return new Response(JSON.stringify({ error: data.message }), {
          status: res.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const tasks = (data.results ?? []).map((page: Record<string, unknown>) => {
        const props = page.properties as Record<string, Record<string, unknown>>;
        const titleProp = Object.values(props).find(
          (p) => p.type === 'title'
        ) as Record<string, unknown> | undefined;

        return {
          id: page.id,
          title: (titleProp?.title as Array<{ plain_text: string }>)?.[0]?.plain_text ?? '(제목 없음)',
          status: doingValue,
          url: page.url,
          properties: props,
        };
      });

      result = { tasks };

    } else if (action === 'updateTask') {
      const { pageId, progress, isDone, progressProperty = 'Progress', statusProperty = 'Status', doneValue = '완료' } = rest;

      const properties: Record<string, unknown> = {};
      if (progressProperty) {
        properties[progressProperty] = { number: progress };
      }
      if (isDone && statusProperty && doneValue) {
        properties[statusProperty] = { status: { name: doneValue } };
      }

      const res = await fetch(`https://api.notion.com/v1/pages/${pageId}`, {
        method: 'PATCH',
        headers: notionHeaders,
        body: JSON.stringify({ properties }),
      });

      if (res.ok) {
        result = { ok: true };
      } else {
        const err = await res.json();
        result = { ok: false, error: err.message };
      }

    } else {
      return new Response(JSON.stringify({ error: `알 수 없는 action: ${action}` }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
