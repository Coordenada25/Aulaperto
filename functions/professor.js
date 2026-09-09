// ============================================
// Cloudflare Pages Function — /professor (rota sem .html,
// porque o Cloudflare Pages remove automaticamente a extensao)
// ============================================
// Intercepta pedidos a /professor?p=<slug> ANTES de o Cloudflare
// devolver o ficheiro estatico, e troca o <title> / meta description
// genericos pelos dados reais do professor (nome, instrumento, bairro).
//
// Inclui cabecalhos de debug (X-Aulaperto-*) para diagnosticar se a
// funcao esta mesmo a correr e se encontrou o professor — remover
// depois de confirmarmos que esta tudo a funcionar.

const SUPABASE_URL = "https://zxxwxwtsolbnyzbrabwp.supabase.co";
const SUPABASE_KEY = "sb_publishable_x0Ehx6SckG0JHXqdvOusXw_5LG12KPm";

function comCabecalhosDebug(resp, estado) {
    const nova = new Response(resp.body, resp);
    nova.headers.set('X-Aulaperto-Function', 'hit');
    nova.headers.set('X-Aulaperto-Status', estado);
    return nova;
}

export async function onRequestGet(context) {
    const { request, env } = context;
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
        .on('title', {
            element(el) {
                el.setInnerContent(titulo);
            }
        })
        .on('meta[name="description"]', {
            element(el) {
                el.setAttribute('content', descricao);
            }
        })
        .on('meta[property="og:title"]', {
            element(el) {
                el.setAttribute('content', titulo);
            }
        })
        .on('meta[property="og:description"]', {
            element(el) {
                el.setAttribute('content', descricao);
            }
        })
        .on('meta[name="twitter:title"]', {
            element(el) {
                el.setAttribute('content', titulo);
            }
        })
        .on('meta[name="twitter:description"]', {
            element(el) {
                el.setAttribute('content', descricao);
            }
        });

    const transformado = rewriter.transform(assetResponse);
    return comCabecalhosDebug(transformado, 'ok');
}
