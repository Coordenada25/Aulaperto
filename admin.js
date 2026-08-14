// ============================================
// CONFIGURAÇÃO
// ============================================
const SUPABASE_URL = "https://zxxwxwtsolbnyzbrabwp.supabase.co";
const SUPABASE_KEY = "sb_publishable_x0Ehx6SckG0JHXqdvOusXw_5LG12KPm";
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let currentPin = '';
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

function setButtonLoading(btn, isLoading, originalText) {
    if (!btn) return;
    if (isLoading) {
        btn.classList.add('btn-loading');
        btn.disabled = true;
        btn.innerHTML = `<span class="spinner"></span> A verificar...`;
    } else {
        btn.classList.remove('btn-loading');
        btn.disabled = false;
        btn.innerHTML = originalText;
    }
}

// ============================================
// AUTENTICAÇÃO
// ============================================
async function autenticarAdmin() {
    const pinInput = $('#admin-pin-input');
    const btnLogin = $('#btn-admin-login');
    if (!pinInput || !btnLogin) return;
    
    const pinValue = pinInput.value.trim();
    if (!pinValue) {
        alert('Insere o PIN de administrador.');
        return;
    }
    
    const originalText = btnLogin.innerHTML;
    setButtonLoading(btnLogin, true, originalText);
    currentPin = pinValue;
    
    try {
        await carregarPendentes();
        await carregarLeads();
        await carregarEstatisticas();
        $('#pin-modal').style.display = 'none';
        showToast('Acesso concedido com sucesso!', 'success');
    } catch (err) {
        console.error('Erro de autenticação:', err);
        alert('Erro ao entrar: ' + (err.message || 'PIN incorreto.'));
        currentPin = '';
    } finally {
        setButtonLoading(btnLogin, false, originalText);
    }
}

// Enter key
document.addEventListener('DOMContentLoaded', () => {
    const pinInput = $('#admin-pin-input');
    if (pinInput) {
        pinInput.focus();
        pinInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') autenticarAdmin();
        });
    }
});

// ============================================
// CARREGAR ESTATÍSTICAS
// ============================================
async function carregarEstatisticas() {
    try {
        // Total de professores
        const { count: total, error: err1 } = await supabaseClient
            .from('professors')
            .select('*', { count: 'exact', head: true });
        
        // Pendentes
        const { count: pending, error: err2 } = await supabaseClient
            .from('professors')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'pending');
        
        // Aprovados
        const { count: approved, error: err3 } = await supabaseClient
            .from('professors')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'approved');
        
        // Leads
        const { count: leads, error: err4 } = await supabaseClient
            .from('leads')
            .select('*', { count: 'exact', head: true });
        
        if (err1 || err2 || err3 || err4) throw new Error('Erro ao carregar estatísticas');
        
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
    const { data, error } = await supabaseClient
        .rpc('get_admin_pending_professors', { admin_pin: currentPin });
    
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
                <span class="badge-province">${escapeHtml(p.province || 'N/A')}</span>
                <br />
                <small>${escapeHtml(p.neighborhood)}</small>
            </td>
            <td>${(p.instruments || []).map(i => `<span class="card-tag card-tag-instrument">${escapeHtml(i)}</span>`).join(' ')}</td>
            <td><strong>${p.price} MT</strong></td>
            <td>
                <a href="https://wa.me/${p.whatsapp}" target="_blank" class="btn-wa">
                    <i class="fab fa-whatsapp"></i> ${p.whatsapp}
                </a>
            </td>
            <td>
                <div style="display:flex; gap:6px; flex-wrap:wrap;">
                    <button class="btn-approve" onclick="aprovarProfessor('${p.id}')">
                        <i class="fas fa-check"></i> Aprovar
                    </button>
                    <button class="btn-reject" onclick="rejeitarProfessor('${p.id}')">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
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
    if (!confirm('Desejas aprovar este professor para publicação?')) return;
    try {
        const { error } = await supabaseClient.rpc('approve_professor', {
            admin_pin: currentPin,
            prof_id: id
        });
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
    if (!confirm('Tem certeza que deseja rejeitar este cadastro?')) return;
    try {
        const { error } = await supabaseClient.rpc('reject_professor', {
            admin_pin: currentPin,
            prof_id: id
        });
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
    const { data, error } = await supabaseClient.rpc('get_admin_leads', {
        admin_pin: currentPin
    });
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
        const msgProf = encodeURIComponent(`Olá ${l.teacher_name}! Temos um novo aluno: ${l.student_name} (${l.instrument}).`);
        
        return `
            <tr>
                <td>${dataFormatada}</td>
                <td><strong>${escapeHtml(l.student_name)}</strong></td>
                <td>${escapeHtml(l.teacher_name)}</td>
                <td><span class="card-tag card-tag-instrument">${escapeHtml(l.instrument)}</span></td>
                <td>
                    <div style="display:flex; gap:6px; flex-wrap:wrap;">
                        <a href="https://wa.me/${l.student_whatsapp}?text=${msgAluno}" target="_blank" class="btn-wa">
                            <i class="fab fa-whatsapp"></i> Aluno
                        </a>
                        ${l.teacher_whatsapp
                            ? `<a href="https://wa.me/${l.teacher_whatsapp}?text=${msgProf}" target="_blank" class="btn-approve" style="text-decoration:none;">
                                <i class="fab fa-whatsapp"></i> Professor
                            </a>`
                            : `<span style="color:#94A3B8; font-size:12px;">Sem WhatsApp</span>`
                        }
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}
