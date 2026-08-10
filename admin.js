const SUPABASE_URL = "https://zxxwxwtsolbnyzbrabwp.supabase.co";
const SUPABASE_KEY = "sb_publishable_x0Ehx6SckG0JHXqdvOusXw_5LG12KPm";
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let currentPin = '';

const $ = (s) => document.querySelector(s);

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function showToast(mensagem, tipo = 'info') {
  const container = $('#toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `toast toast-${tipo}`;
  toast.innerHTML = `<span>${escapeHtml(mensagem)}</span>`;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3500);
}

async function carregarLeads() {
  const { data, error } = await supabaseClient.rpc('get_admin_leads', { admin_pin: currentPin });
  if (error) {
    showToast('Erro ao carregar solicitações.', 'error');
    return;
  }

  const tbody = $('#leads-list');
  if (!data || data.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:#64748B;">Nenhuma solicitação de aula recebida ainda.</td></tr>';
    return;
  }

  tbody.innerHTML = data.map(l => {
    const dataFormatada = new Date(l.created_at).toLocaleDateString('pt-MZ');
    
    // Texto pré-formatado para o Aluno
    const msgAluno = encodeURIComponent(`Olá ${l.student_name}, recebemos o teu pedido no AulaPerto para aulas de ${l.instrument} com o professor ${l.teacher_name}! Vamos encaminhar o teu contacto.`);
    
    // Texto pré-formatado para o Professor
    const msgProf = encodeURIComponent(`Olá ${l.teacher_name}! Temos um novo aluno do AulaPerto para ti:\n\n👤 Aluno: ${l.student_name}\n🎸 Instrumento: ${l.instrument}\n📱 WhatsApp do Aluno: https://wa.me/${l.student_whatsapp}\n\nPor favor entra em contacto para agendar a aula!`);

    const linkProf = l.teacher_whatsapp 
      ? `<a href="https://wa.me/${l.teacher_whatsapp}?text=${msgProf}" target="_blank" class="btn-approve" style="text-decoration:none; display:inline-flex; align-items:center; gap:4px;"><i class="fab fa-whatsapp"></i> Encaminhar ao Professor</a>`
      : `<span style="color:#94A3B8; font-size:12px;">N/A</span>`;

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

async function carregarPendentes() {
  const { data, error } = await supabaseClient.rpc('get_admin_pending_professors', { admin_pin: currentPin });
  if (error) throw error;

  const tbody = $('#pending-list');
  if (!data || data.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:#64748B;">Nenhum professor pendente de aprovação.</td></tr>';
    return;
  }

  tbody.innerHTML = data.map(p => `
    <tr>
      <td><strong>${escapeHtml(p.name)}</strong><br><small>${p.experience || 1} anos exp.</small></td>
      <td>${escapeHtml(p.neighborhood)}</td>
      <td>${(p.instruments || []).map(i => escapeHtml(i)).join(', ')}</td>
      <td>${p.price} MT</td>
      <td><a href="https://wa.me/${p.whatsapp}" target="_blank" class="btn-wa"><i class="fab fa-whatsapp"></i> ${p.whatsapp}</a></td>
      <td>
        <button class="btn-approve" onclick="aprovarProfessor('${p.id}')"><i class="fas fa-check"></i> Aprovar</button>
        <button class="btn-reject" onclick="rejeitarProfessor('${p.id}')"><i class="fas fa-times"></i></button>
      </td>
    </tr>
  `).join('');
}

async function aprovarProfessor(id) {
  if (!confirm('Desejas aprovar este professor para publicação imediata?')) return;
  try {
    const { error } = await supabaseClient.rpc('approve_professor', { admin_pin: currentPin, prof_id: id });
    if (error) throw error;
    
    showToast('Professor aprovado com sucesso!', 'success');
    localStorage.removeItem('aulaperto_teachers_cache'); // Limpa a cache para atualizar a lista pública
    carregarPendentes();
  } catch (err) {
    showToast('Erro ao aprovar professor.', 'error');
  }
}

async function rejeitarProfessor(id) {
  if (!confirm('Tem a certeza que deseja rejeitar este cadastro?')) return;
  try {
    const { error } = await supabaseClient.rpc('reject_professor', { admin_pin: currentPin, prof_id: id });
    if (error) throw error;
    
    showToast('Cadastro rejeitado.', 'info');
    carregarPendentes();
  } catch (err) {
    showToast('Erro ao rejeitar cadastro.', 'error');
  }
}

async function carregarLeads() {
  const { data, error } = await supabaseClient.rpc('get_admin_leads', { admin_pin: currentPin });
  if (error) throw error;

  const tbody = $('#leads-list');
  if (!data || data.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:#64748B;">Nenhuma solicitação de aula recebida ainda.</td></tr>';
    return;
  }

  tbody.innerHTML = data.map(l => {
    const dataFormatada = new Date(l.created_at).toLocaleDateString('pt-MZ');
    const msgWhatsApp = encodeURIComponent(`Olá ${l.student_name}, recebemos o teu pedido no AulaPerto para aulas de ${l.instrument} com o professor ${l.teacher_name}!`);
    
    return `
      <tr>
        <td>${dataFormatada}</td>
        <td><strong>${escapeHtml(l.student_name)}</strong></td>
        <td>${escapeHtml(l.teacher_name)}</td>
        <td><span class="card-tag card-tag-instrument">${escapeHtml(l.instrument)}</span></td>
        <td>
          <a href="https://wa.me/${l.student_whatsapp}?text=${msgWhatsApp}" target="_blank" class="btn-wa">
            <i class="fab fa-whatsapp"></i> Falar com Aluno (${l.student_whatsapp})
          </a>
        </td>
      </tr>
    `;
  }).join('');
}
