// ============================================
// CONFIGURAÇÃO
// ============================================
const SUPABASE_URL = "https://zxxwxwtsolbnyzbrabwp.supabase.co";
const SUPABASE_KEY = "sb_publishable_x0Ehx6SckG0JHXqdvOusXw_5LG12KPm";
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const $ = (s) => document.querySelector(s);

// ============================================
// TOASTS
// ============================================
function showToast(mensagem, tipo = 'info') {
    const container = $('#toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast toast-${tipo}`;
    toast.innerHTML = `
        <span>${mensagem}</span>
        <button style="background:none;border:none;cursor:pointer;color:inherit;font-size:16px;" onclick="this.parentElement.remove()">&times;</button>
    `;
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(100%)';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

function setButtonLoading(btn, isLoading, originalText, loadingText = 'A verificar...') {
    if (!btn) return;
    if (isLoading) {
        btn.classList.add('btn-loading');
        btn.disabled = true;
        btn.innerHTML = `<span class="spinner"></span> ${loadingText}`;
    } else {
        btn.classList.remove('btn-loading');
        btn.disabled = false;
        btn.innerHTML = originalText;
    }
}

// ============================================
// AUTENTICAÇÃO (Supabase Auth — email + palavra-passe)
// ============================================
function mostrarErroLogin(mensagem) {
    const errEl = $('#login-error');
    if (!errEl) return;
    errEl.textContent = mensagem;
    errEl.style.display = 'block';
}

function limparErroLogin() {
    const errEl = $('#login-error');
    if (errEl) errEl.style.display = 'none';
}

async function autenticarAdmin(e) {
    if (e) e.preventDefault();
    const emailInput = $('#admin-email-input');
    const passwordInput = $('#admin-password-input');
    const btnLogin = $('#btn-admin-login');
    if (!emailInput || !passwordInput || !btnLogin) return;

    limparErroLogin();

    const email = emailInput.value.trim();
    const password = passwordInput.value;

    if (!email || !password) {
        mostrarErroLogin('Preenche o email e a palavra-passe.');
        return;
    }

    const originalText = btnLogin.innerHTML;
    setButtonLoading(btnLogin, true, originalText);

    try {
        const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
        if (error) throw error;
        showToast('Acesso concedido com sucesso!', 'success');
    } catch (err) {
        console.error('Erro de autenticação:', err);
        mostrarErroLogin('Email ou palavra-passe incorretos.');
    } finally {
        setButtonLoading(btnLogin, false, originalText);
    }
}

async function terminarSessao() {
    try {
        await supabaseClient.auth.signOut();
    } catch (err) {
        console.error('Erro ao terminar sessão:', err);
    }
}

async function carregarPainel() {
    try {
        await Promise.all([
            carregarPendentes(),
            carregarAprovados(),
            carregarSponsorsAdmin(),
            carregarLeads(),
        ]);
        await carregarEstatisticas();
    } catch (err) {
        console.error('Erro ao carregar painel:', err);
        showToast('Erro ao carregar dados do painel.', 'error');
    }
}

supabaseClient.auth.onAuthStateChange((event, session) => {
    const modal = $('#login-modal');
    const btnLogout = $('#btn-logout');
    if (session) {
        if (modal) modal.style.display = 'none';
        if (btnLogout) btnLogout.style.display = 'inline-flex';
        carregarPainel();
    } else {
        if (modal) modal.style.display = 'flex';
        if (btnLogout) btnLogout.style.display = 'none';
    }
});

document.addEventListener('DOMContentLoaded', () => {
    const loginForm = $('#login-form');
    if (loginForm) loginForm.addEventListener('submit', autenticarAdmin);

    const sponsorForm = $('#sponsor-form');
    if (sponsorForm) sponsorForm.addEventListener('submit', criarSponsor);

    const emailInput = $('#admin-email-input');
    if (emailInput) emailInput.focus();
});

// ============================================
// HELPERS
// ============================================
function getColor(name) {
    const colors = ['#2563EB', '#7C3AED', '#0284C7', '#4F46E5', '#0EA5E9'];
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return colors[Math.abs(hash) % colors.length];
}

function initials(name) {
    if (!name) return 'P';
    return name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

// ============================================
// CARREGAR ESTATÍSTICAS
// ============================================
async function carregarEstatisticas() {
    try {
        const { count: total } = await supabaseClient
            .from('professors')
            .select('*', { count: 'exact', head: true });

        const { count: pending } = await supabaseClient
            .from('professors')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'pending');

        const { count: approved } = await supabaseClient
            .from('professors')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'approved');

        const { count: featured } = await supabaseClient
            .from('professors')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'approved')
            .eq('featured', true);

        const { count: leads } = await supabaseClient
            .from('leads')
            .select('*', { count: 'exact', head: true });

        const { count: sponsorsAtivos } = await supabaseClient
            .from('sponsors')
            .select('*', { count: 'exact', head: true })
            .eq('active', true);

        $('#stat-total').textContent = total || 0;
        $('#stat-pending').textContent = pending || 0;
        $('#stat-approved').textContent = approved || 0;
        $('#stat-featured').textContent = featured || 0;
        $('#stat-leads').textContent = leads || 0;
        $('#stat-sponsors').textContent = sponsorsAtivos || 0;

    } catch (err) {
        console.error('Erro nas estatísticas:', err);
    }
}

// ============================================
// PROFESSORES PENDENTES
// ============================================
async function carregarPendentes() {
    try {
        const { data, error } = await supabaseClient
            .from('professors')
            .select('*')
            .eq('status', 'pending')
            .order('created_at', { ascending: false });

        if (error) throw error;

        const tbody = $('#pending-list');
        if (!tbody) return;

        if (!data || data.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:#94A3B8; padding:20px;">Nenhum professor pendente.</td></tr>`;
            return;
        }

        tbody.innerHTML = data.map(p => `
            <tr>
                <td>
                    <div style="display:flex; align-items:center; gap:10px;">
                        ${p.photo_url
                            ? `<img src="${p.photo_url}" alt="" style="width:36px;height:36px;border-radius:50%;object-fit:cover;" />`
                            : `<div style="width:36px;height:36px;border-radius:50%;background:${getColor(p.name)};display:flex;align-items:center;justify-content:center;color:white;font-weight:700;font-size:14px;">${initials(p.name)}</div>`
                        }
                        <div>
                            <strong>${escapeHtml(p.name)}</strong>
                            <br />
                            <small style="color:#64748B;">${p.experience || 1} ano(s) exp.</small>
                        </div>
                    </div>
                </td>
                <td>
                    <span style="background:#DBEAFE;color:#1E40AF;padding:2px 10px;border-radius:999px;font-size:11px;font-weight:600;">${escapeHtml(p.province || 'N/A')}</span>
                    <br />
                    <small>${escapeHtml(p.neighborhood)}</small>
                </td>
                <td>${(p.instruments || []).map(i => `<span style="font-size:11px;font-weight:600;padding:4px 10px;border-radius:999px;background:#DBEAFE;color:#1D4ED8;border:1px solid #BFDBFE;display:inline-block;margin:2px;">${escapeHtml(i)}</span>`).join(' ')}</td>
                <td><strong>${p.price} MT</strong></td>
                <td>
                    <a href="https://wa.me/${p.whatsapp}" target="_blank" style="background:#25D366;color:white;padding:6px 12px;border-radius:6px;font-weight:600;display:inline-flex;align-items:center;gap:4px;text-decoration:none;font-size:13px;">
                        <i class="fab fa-whatsapp"></i> ${p.whatsapp}
                    </a>
                </td>
                <td>
                    <div style="display:flex; gap:6px; flex-wrap:wrap;">
                        <button onclick="aprovarProfessor('${p.id}')" class="btn-approve">
                            <i class="fas fa-check"></i> Aprovar
                        </button>
                        <button onclick="rejeitarProfessor('${p.id}')" class="btn-reject">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');

    } catch (err) {
        console.error('Erro ao carregar pendentes:', err);
        throw err;
    }
}

async function aprovarProfessor(id) {
    if (!confirm('Desejas aprovar este professor?')) return;
    try {
        const { error } = await supabaseClient
            .from('professors')
            .update({ status: 'approved' })
            .eq('id', id);

        if (error) throw error;

        showToast('Professor aprovado com sucesso!', 'success');
        localStorage.removeItem('aulaperto_teachers_cache');
        await carregarPendentes();
        await carregarAprovados();
        await carregarEstatisticas();
    } catch (err) {
        console.error('Erro ao aprovar:', err);
        showToast('Erro ao aprovar professor.', 'error');
    }
}

async function rejeitarProfessor(id) {
    if (!confirm('Tem certeza que deseja rejeitar?')) return;
    try {
        const { error } = await supabaseClient
            .from('professors')
            .update({ status: 'rejected' })
            .eq('id', id);

        if (error) throw error;

        showToast('Cadastro rejeitado.', 'info');
        await carregarPendentes();
        await carregarEstatisticas();
    } catch (err) {
        console.error('Erro ao rejeitar:', err);
        showToast('Erro ao rejeitar cadastro.', 'error');
    }
}

// ============================================
// PROFESSORES APROVADOS (DESTAQUE)
// ============================================
async function carregarAprovados() {
    try {
        const { data, error } = await supabaseClient
            .from('professors')
            .select('id, name, neighborhood, province, price, featured')
            .eq('status', 'approved')
            .order('featured', { ascending: false })
            .order('name', { ascending: true });

        if (error) throw error;

        const tbody = $('#approved-list');
        if (!tbody) return;

        if (!data || data.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:#94A3B8; padding:20px;">Nenhum professor aprovado ainda.</td></tr>`;
            return;
        }

        tbody.innerHTML = data.map(p => `
            <tr>
                <td><strong>${escapeHtml(p.name)}</strong></td>
                <td>
                    <span style="background:#DBEAFE;color:#1E40AF;padding:2px 10px;border-radius:999px;font-size:11px;font-weight:600;">${escapeHtml(p.province || 'N/A')}</span>
                    <br />
                    <small>${escapeHtml(p.neighborhood)}</small>
                </td>
                <td><strong>${p.price} MT</strong></td>
                <td>
                    ${p.featured
                        ? `<span class="badge-status approved"><i class="fas fa-star"></i> Destaque</span>`
                        : `<span class="badge-status pending" style="background:#F1F5F9;color:#64748B;">Normal</span>`
                    }
                </td>
                <td>
                    ${p.featured
                        ? `<button onclick="alternarDestaque('${p.id}', true)" class="btn-featured-off"><i class="fas fa-star-half-alt"></i> Remover Destaque</button>`
                        : `<button onclick="alternarDestaque('${p.id}', false)" class="btn-featured-on"><i class="fas fa-star"></i> Destacar</button>`
                    }
                </td>
            </tr>
        `).join('');

    } catch (err) {
        console.error('Erro ao carregar aprovados:', err);
        throw err;
    }
}

async function alternarDestaque(id, estaAtualmenteDestacado) {
    const novoValor = !estaAtualmenteDestacado;
    try {
        const { error } = await supabaseClient
            .from('professors')
            .update({ featured: novoValor, featured_at: novoValor ? new Date().toISOString() : null })
            .eq('id', id);

        if (error) throw error;

        showToast(novoValor ? 'Professor marcado como destaque!' : 'Destaque removido.', 'success');
        localStorage.removeItem('aulaperto_teachers_cache');
        await carregarAprovados();
        await carregarEstatisticas();
    } catch (err) {
        console.error('Erro ao alternar destaque:', err);
        showToast('Erro ao atualizar destaque.', 'error');
    }
}

// ============================================
// PATROCÍNIOS (ANÚNCIOS)
// ============================================
async function carregarSponsorsAdmin() {
    try {
        const { data, error } = await supabaseClient
            .from('sponsors')
            .select('*')
            .order('display_order', { ascending: true })
            .order('created_at', { ascending: false });

        if (error) throw error;

        // Contagens de cliques (não bloqueia a tabela principal se falhar)
        let cliquesPorSponsor = {};
        try {
            const { data: stats, error: statsError } = await supabaseClient
                .from('sponsor_click_stats')
                .select('*');
            if (statsError) throw statsError;
            (stats || []).forEach(s => { cliquesPorSponsor[s.sponsor_id] = s; });
        } catch (statsErr) {
            console.error('Erro ao carregar estatísticas de cliques:', statsErr);
        }

        const tbody = $('#sponsors-list');
        if (!tbody) return;

        if (!data || data.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:#94A3B8; padding:20px;">Nenhum patrocínio criado ainda.</td></tr>`;
            return;
        }

        tbody.innerHTML = data.map(s => {
            const stats = cliquesPorSponsor[s.id];
            const clicks7d = stats ? stats.clicks_7d : 0;
            const clicksTotal = stats ? stats.total_clicks : 0;
            return `
            <tr>
                <td>
                    <strong>${escapeHtml(s.title)}</strong>
                    <br />
                    <small style="color:#64748B;">${escapeHtml(s.description)}</small>
                </td>
                <td>${s.style === 'featured' ? 'Destaque' : 'Padrão'}</td>
                <td>
                    ${s.link_url
                        ? `<strong>${clicks7d}</strong> <span style="color:#94A3B8;">/ ${clicksTotal}</span>`
                        : `<span style="color:#94A3B8;" title="Sem link, não é possível clicar">—</span>`
                    }
                </td>
                <td>
                    ${s.active
                        ? `<span class="badge-status active">Ativo</span>`
                        : `<span class="badge-status inactive">Inativo</span>`
                    }
                </td>
                <td>
                    <div style="display:flex; gap:6px; flex-wrap:wrap;">
                        <button onclick="alternarSponsorAtivo('${s.id}', ${s.active})" class="${s.active ? 'btn-featured-off' : 'btn-approve'}">
                            ${s.active ? 'Desativar' : 'Ativar'}
                        </button>
                        <button onclick="eliminarSponsor('${s.id}')" class="btn-small-danger">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
        }).join('');

    } catch (err) {
        console.error('Erro ao carregar patrocínios:', err);
        throw err;
    }
}

async function criarSponsor(e) {
    e.preventDefault();
    const btnSubmit = e.target.querySelector('button[type="submit"]');
    const originalText = btnSubmit.innerHTML;

    const titulo = $('#s-titulo').value.trim();
    const descricao = $('#s-descricao').value.trim();
    const link = $('#s-link').value.trim();
    const estilo = $('#s-estilo').value;

    if (!titulo || !descricao) {
        showToast('Preenche o título e a descrição.', 'error');
        return;
    }

    setButtonLoading(btnSubmit, true, originalText, 'A criar...');

    try {
        const { error } = await supabaseClient.from('sponsors').insert([{
            title: titulo,
            description: descricao,
            link_url: link || null,
            style: estilo,
            active: true
        }]);

        if (error) throw error;

        showToast('Patrocínio criado com sucesso!', 'success');
        $('#sponsor-form').reset();
        await carregarSponsorsAdmin();
        await carregarEstatisticas();
    } catch (err) {
        console.error('Erro ao criar patrocínio:', err);
        showToast('Erro ao criar patrocínio.', 'error');
    } finally {
        setButtonLoading(btnSubmit, false, originalText);
    }
}

async function alternarSponsorAtivo(id, estaAtivo) {
    try {
        const { error } = await supabaseClient
            .from('sponsors')
            .update({ active: !estaAtivo })
            .eq('id', id);

        if (error) throw error;

        showToast(!estaAtivo ? 'Patrocínio ativado.' : 'Patrocínio desativado.', 'success');
        await carregarSponsorsAdmin();
        await carregarEstatisticas();
    } catch (err) {
        console.error('Erro ao atualizar patrocínio:', err);
        showToast('Erro ao atualizar patrocínio.', 'error');
    }
}

async function eliminarSponsor(id) {
    if (!confirm('Eliminar este patrocínio permanentemente?')) return;
    try {
        const { error } = await supabaseClient
            .from('sponsors')
            .delete()
            .eq('id', id);

        if (error) throw error;

        showToast('Patrocínio eliminado.', 'info');
        await carregarSponsorsAdmin();
        await carregarEstatisticas();
    } catch (err) {
        console.error('Erro ao eliminar patrocínio:', err);
        showToast('Erro ao eliminar patrocínio.', 'error');
    }
}

// ============================================
// LEADS (SOLICITAÇÕES)
// ============================================
async function carregarLeads() {
    try {
        const { data, error } = await supabaseClient
            .from('leads')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;

        const tbody = $('#leads-list');
        if (!tbody) return;

        if (!data || data.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:#94A3B8; padding:20px;">Nenhuma solicitação de aula.</td></tr>`;
            return;
        }

        tbody.innerHTML = data.map(l => {
            const dataFormatada = new Date(l.created_at).toLocaleDateString('pt-MZ');
            const msgAluno = encodeURIComponent(`Olá ${l.student_name}, recebemos o teu pedido no AulaPerto!`);

            return `
                <tr>
                    <td>${dataFormatada}</td>
                    <td><strong>${escapeHtml(l.student_name)}</strong></td>
                    <td>${escapeHtml(l.teacher_name || 'N/A')}</td>
                    <td><span style="font-size:11px;font-weight:600;padding:4px 10px;border-radius:999px;background:#DBEAFE;color:#1D4ED8;border:1px solid #BFDBFE;">${escapeHtml(l.instrument)}</span></td>
                    <td>
                        <div style="display:flex; gap:6px; flex-wrap:wrap;">
                            <a href="https://wa.me/${l.student_whatsapp}?text=${msgAluno}" target="_blank" style="background:#25D366;color:white;padding:6px 12px;border-radius:6px;font-weight:600;display:inline-flex;align-items:center;gap:4px;text-decoration:none;font-size:13px;">
                                <i class="fab fa-whatsapp"></i> Aluno
                            </a>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');

    } catch (err) {
        console.error('Erro ao carregar leads:', err);
        throw err;
    }
}
