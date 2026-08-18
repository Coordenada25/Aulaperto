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

        // onAuthStateChange (registered below) picks up the new session
        // and handles hiding the modal + loading the dashboard data.
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
    // onAuthStateChange handles showing the login modal again.
}

async function carregarPainel() {
    try {
        await carregarPendentes();
        await carregarLeads();
        await carregarEstatisticas();
    } catch (err) {
        console.error('Erro ao carregar painel:', err);
        showToast('Erro ao carregar dados do painel.', 'error');
    }
}

// Reacts to sign-in / sign-out, including a session already stored
// from a previous visit (so the admin doesn't have to log in every time).
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

    const emailInput = $('#admin-email-input');
    if (emailInput) emailInput.focus();
});

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

        const { count: leads } = await supabaseClient
            .from('leads')
            .select('*', { count: 'exact', head: true });

        $('#stat-total').textContent = total || 0;
        $('#stat-pending').textContent = pending || 0;
        $('#stat-approved').textContent = approved || 0;
        $('#stat-leads').textContent = leads || 0;

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
                        <button onclick="aprovarProfessor('${p.id}')" style="background:#10B981;color:white;border:none;padding:6px 12px;border-radius:6px;cursor:pointer;font-weight:600;">
                            <i class="fas fa-check"></i> Aprovar
                        </button>
                        <button onclick="rejeitarProfessor('${p.id}')" style="background:#EF4444;color:white;border:none;padding:6px 12px;border-radius:6px;cursor:pointer;font-weight:600;">
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
// APROVAR / REJEITAR PROFESSOR
// ============================================
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
