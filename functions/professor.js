// ============================================
// Cloudflare Pages Function — professor.html
// ============================================
// Intercepta pedidos a /professor.html?p=<slug> ANTES de o Cloudflare
// devolver o ficheiro estático, e troca o <title> / meta description
// genéricos pelos dados reais do professor (nome, instrumento, bairro).
//
// Porquê: o professor.html original só preenche esses campos via
// JavaScript no browser, depois de ir buscar os dados ao Supabase — o
// que faz com que o Google veja o mesmo título genérico para os 20+
// perfis de professores. Esta função resolve isso no servidor (edge),
// sem precisar de gerar ficheiros manualmente nem correr scripts.
//
// Corre automaticamente para qualquer professor aprovado, atual ou
// futuro — não exige manutenção quando aprovas alguém novo.

const SUPABASE_URL = "https://zxxwxwtsolbnyzbrabwp.supabase.co";
const SUPABASE_KEY = "sb_publishable_x0Ehx6SckG0JHXqdvOusXw_5LG12KPm";

export async function onRequestGet(context) {
    const { request, env } = context;
    const url = new URL(request.url);
    const slug = (url.searchParams.get('p') || '').trim();

    // Pede sempre o HTML estático original primeiro — se algo falhar
    // a seguir, devolvemos este e o site continua a funcionar na mesma
    // (só sem a melhoria de SEO), em vez de rebentar a página.
    const assetResponse = await env.ASSETS.fetch(request);

    if (!slug) {
        return assetResponse;
    }

    let professor = null;
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
        }
    } catch (err) {
        // Falha silenciosa (ex: Supabase em baixo) — segue com a página
        // genérica em vez de mostrar erro ao utilizador.
        professor = null;
    }

    // Sem professor encontrado (slug errado, pendente, inativo,
    // rejeitado) — devolve a página tal como está, sem tentar adivinhar.
    if (!professor) {
        return assetResponse;
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

    return rewriter.transform(assetResponse);
}
