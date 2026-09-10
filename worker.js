// ============================================
// Worker principal do AulaPerto (Cloudflare Workers + Static Assets)
// ============================================
// Este projeto e publicado como um Worker com ficheiros estaticos
// (nao como "Cloudflare Pages" classico), por isso a logica de SEO
// dinamico vive aqui, no ponto de entrada do Worker, em vez de numa
// pasta functions/ (essa convencao so funciona no Pages classico).
//
// Comportamento:
// - Pedidos a /professor ou /professor.html: vao buscar os dados do
//   professor ao Supabase e trocam o <title>/meta description antes
//   de responder, para o Google (e o WhatsApp/Facebook ao gerar preview
//   de link) verem o nome do professor certo, nao um titulo generico.
// - Todos os outros pedidos: servidos tal e qual, sem trabalho extra.

const SUPABASE_URL = "https://zxxwxwtsolbnyzbrabwp.supabase.co";
const SUPABASE_KEY = "sb_publishable_x0Ehx6SckG0JHXqdvOusXw_5LG12KPm";

function comCabecalhosDebug(resp, estado) {
    const nova = new Response(resp.body, resp);
    nova.headers.set('X-Aulaperto-Function', 'hit');
    nova.headers.set('X-Aulaperto-Status', estado);
    return nova;
}

async function tratarPerfilProfessor(request, env) {
    const url = new URL(request.url);
    const slug = (url.searchParams.get('p') || '').trim();

    const assetResponse = await env.ASSETS.fetch(request);

    if (!slug) {
        return comCabecalhosDebug(assetResponse, 'sem-slug');
    }

    let professor = null;
    let erroSupabase = null;
    try {
        const apiUrl = `${SUPABASE_URL}/rest/v1/professors`
            + `?select=name,bio,neighborhood,province,instruments`
            + `&slug=eq.${encodeURIComponent(slug)}`
            + `&status=eq.approved`
            + `&limit=1`;

        const res = await fetch(apiUrl, {
            headers: {
                apikey: SUPABASE_KEY,
                Authorization: `Bearer ${SUPABASE_KEY}`
            }
        });

        if (res.ok) {
            const data = await res.json();
            professor = (data && data[0]) ? data[0] : null;
        } else {
            erroSupabase = `http-${res.status}`;
        }
    } catch (err) {
        erroSupabase = 'excecao';
    }

    if (!professor) {
        return comCabecalhosDebug(assetResponse, erroSupabase || 'professor-nao-encontrado');
    }

    const instrumentos = professor.instruments || [];
    const instrumentoPrincipal = instrumentos[0] || 'Música';
    const localizacao = [professor.neighborhood, professor.province].filter(Boolean).join(', ');

    const titulo = `${professor.name} - Professor(a) de ${instrumentoPrincipal} | AulaPerto`;
    const descricao = professor.bio
        ? `${professor.name} ensina ${instrumentos.join(', ')} em ${localizacao}. ${professor.bio}`.slice(0, 160)
        : `${professor.name} ensina ${instrumentos.join(', ')} em ${localizacao}. Contacta via AulaPerto.`;

    const rewriter = new HTMLRewriter()
        .on('title', { element(el) { el.setInnerContent(titulo); } })
        .on('meta[name="description"]', { element(el) { el.setAttribute('content', descricao); } })
        .on('meta[property="og:title"]', { element(el) { el.setAttribute('content', titulo); } })
        .on('meta[property="og:description"]', { element(el) { el.setAttribute('content', descricao); } })
        .on('meta[name="twitter:title"]', { element(el) { el.setAttribute('content', titulo); } })
        .on('meta[name="twitter:description"]', { element(el) { el.setAttribute('content', descricao); } });

    const transformado = rewriter.transform(assetResponse);
    return comCabecalhosDebug(transformado, 'ok');
}

export default {
    async fetch(request, env, ctx) {
        const url = new URL(request.url);

        if (url.pathname === '/professor' || url.pathname === '/professor.html') {
            return tratarPerfilProfessor(request, env);
        }

        return env.ASSETS.fetch(request);
    }
};
