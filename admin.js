// ==========================================
// CONFIGURAÇÃO & INICIALIZAÇÃO DO SUPABASE
// ==========================================
const SUPABASE_URL = "https://zxxwxwtsolbnyzbrabwp.supabase.co";
const SUPABASE_KEY = "sb_publishable_x0Ehx6SckG0JHXqdvOusXw_5LG12KPm";
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let currentPin = '';

// DOM Helper
const $ = (s) => document.querySelector(s);

// ==========================================
// UTILITÁRIOS & SEGURANÇA (ANTI-XSS & TOASTS)
// ==========================================
function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function showToast(mensagem, tipo = 'info') {
  const container = $('#toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `toast toast-${tipo}`;
  toast.innerHTML = `
    <span>${escapeHtml(mensagem)}</span>
    <button style="background:none;border:none;cursor:pointer;color:inherit;font-size:16px;" onclick="this.parentElement.remove()">&times;</button>
  `;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
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

// ==========================================
// AUTENTICAÇÃO VIA PIN DE SEGURANÇA
// ==========================================
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
    // Tenta carregar as duas visões para validar o PIN na BD
    await carregarPendentes();
    await carregarLeads();
    
    // Oculta modal de PIN se a validação for bem-sucedida
    $('#pin-modal').style.display = 'none';
    showToast('Acesso concedido com sucesso!', 'success');
  } catch (err) {
    console.error("Erro de Autenticação Admin:", err);
    alert('Erro ao entrar: ' + (err.message || 'PIN Incorreto ou sem permissão.'));
    currentPin = '';
  } finally {
    setButtonLoading(btnLogin, false, originalText);
  }
}

// ==========================================
// GESTÃO DE PROFESSORES PENDENTES
// ==========================================
async function carregarPendentes() {
  const { data, error } = await supabaseClient.rpc('get_admin_pending_professors', { admin_pin: currentPin });
  if (error) throw error;

  const tbody = $('#pending-list');
  if (!tbody) return;

  if (!data || data.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:#64748B; padding: 20px;">Nenhum professor pendente de aprovação.</td></tr>';
    return;
  }

  tbody.innerHTML = data.map(p => `
    <tr>
      <td style="display:flex; align-items:center; gap:10px;">
        ${p.photo_url
          ? `<img src="${escapeHtml(p.photo_url)}" alt="" style="width:36px;height:36px;border-radius:50%;object-fit:cover;flex-shrink:0;">`
          : ''}
        <div>
          <strong>${escapeHtml(p.name)}</strong><br><small style="color:#64748B;">${p.experience || 1} ano(s) exp.</small>
        </div>
      </td>
      <td>${escapeHtml(p.neighborhood)}</td>
      <td>${(p.instruments || []).map(i => `<span class="card-tag card-tag-instrument">${escapeHtml(i)}</span>`).join(' ')}</td>
      <td><strong>${p.price} MT</strong></td>
      <td>
        <a href="https://wa.me/${escapeHtml(p.whatsapp)}" target="_blank" class="btn-wa">
          <i class="fab fa-whatsapp"></i> ${escapeHtml(p.whatsapp)}
        </a>
      </td>
      <td>
        <div style="display:flex; gap:6px;">
          <button class="btn-approve" onclick="aprovarProfessor('${p.id}')">
            <i class="fas fa-check"></i> Aprovar
          </button>
          <button class="btn-reject" onclick="rejeitarProfessor('${p.id}')" title="Rejeitar">
            <i class="fas fa-times"></i>
          </button>
        </div>
      </td>
    </tr>
  `).join('');
}

async function aprovarProfessor(id) {
  if (!confirm('Desejas aprovar este professor para publicação imediata no site?')) return;
  
  try {
    const { error } = await supabaseClient.rpc('approve_professor', { 
      admin_pin: currentPin, 
      prof_id: id 
    });
    
    if (error) throw error;
    
    showToast('Professor aprovado com sucesso!', 'success');
    // Limpa a cache do site público para refletir a nova aprovação
    localStorage.removeItem('aulaperto_teachers_cache');
    await carregarPendentes();
  } catch (err) {
    console.error('Erro ao aprovar:', err);
    showToast('Erro ao aprovar professor.', 'error');
  }
}

async function rejeitarProfessor(id) {
  if (!confirm('Tem a certeza de que deseja rejeitar este cadastro?')) return;
  
  try {
    const { error } = await supabaseClient.rpc('reject_professor', { 
      admin_pin: currentPin, 
      prof_id: id 
    });
    
    if (error) throw error;
    
    showToast('Cadastro rejeitado.', 'info');
    await carregarPendentes();
  } catch (err) {
    console.error('Erro ao rejeitar:', err);
    showToast('Erro ao rejeitar cadastro.', 'error');
  }
}

// ==========================================
// GESTÃO DE SOLICITAÇÕES DE AULAS (LEADS)
// ==========================================
async function carregarLeads() {
  const { data, error } = await supabaseClient.rpc('get_admin_leads', { admin_pin: currentPin });
  if (error) throw error;

  const tbody = $('#leads-list');
  if (!tbody) return;

  if (!data || data.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:#64748B; padding: 20px;">Nenhuma solicitação de aula recebida ainda.</td></tr>';
    return;
  }

  tbody.innerHTML = data.map(l => {
    const dataFormatada = new Date(l.created_at).toLocaleDateString('pt-MZ');
    
    // Mensagem formatada para o Aluno
    const msgAluno = encodeURIComponent(`Olá ${l.student_name}, recebemos o teu pedido no AulaPerto para aulas de ${l.instrument} com o professor ${l.teacher_name}! Vamos conectar-te em breve.`);
    
    // Mensagem formatada para o Professor
    const msgProf = encodeURIComponent(`Olá ${l.teacher_name}! Temos um novo aluno do AulaPerto para ti:\n\n👤 Aluno: ${l.student_name}\n🎸 Instrumento: ${l.instrument}\n📱 WhatsApp do Aluno: https://wa.me/${l.student_whatsapp}\n\nPor favor, entra em contacto para agendar a primeira aula!`);
    
    const linkProf = l.teacher_whatsapp 
      ? `<a href="https://wa.me/${l.teacher_whatsapp}?text=${msgProf}" target="_blank" class="btn-approve" style="text-decoration:none; display:inline-flex; align-items:center; gap:4px;">
           <i class="fab fa-whatsapp"></i> Encaminhar ao Professor
         </a>`
      : `<span style="color:#94A3B8; font-size:12px;">Tel. Indisponível</span>`;

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
            ${linkProf}
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

// ==========================================
// INICIALIZAÇÃO & TECLA ENTER
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
  const pinInput = $('#admin-pin-input');
  if (pinInput) {
    pinInput.focus();
    pinInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        autenticarAdmin();
      }
    });
  }
});
