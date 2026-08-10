// ==========================================
// CONFIGURAÇÕES & CONSTANTES
// ==========================================
const BAIRROS = [
  "Magoanine A", "Magoanine B", "Magoanine C", "Zimpeto", "Costa do Sol", 
  "Sommerschield", "Polana", "Matola-Sede", "Malhazine", "Jardim", "Alto Maé", "Central"
];

const INSTRUMENTOS = [
  "Piano", "Guitarra", "Violão", "Bateria", "Canto", "Teclado", "Saxofone", "Violino", "Baixo", "Ukulele"
];

const CACHE_KEY = "aulaperto_teachers_cache";
const CACHE_TTL = 5 * 60 * 1000; // 5 Minutos em milissegundos

// SUPABASE (Chave Pública)
const SUPABASE_URL = "https://zxxwxwtsolbnyzbrabwp.supabase.co";
const SUPABASE_KEY = "sb_publishable_x0Ehx6SckG0JHXqdvOusXw_5LG12KPm";
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let professores = [];

// DOM ELEMENTS
const $ = (s) => document.querySelector(s);
const fBairro = $('#f-bairro');
const fInstr = $('#f-instr');
const fPreco = $('#f-preco');
const tBairro = $('#t-bairro');
const tInstrumentos = $('#t-instrumentos');
const resultsGrid = $('#results-grid');
const resultsCount = $('#results-count');
const totalTeachers = $('#total-teachers');
const totalInstruments = $('#total-instruments');
const teacherForm = $('#teacher-form');
const successMsg = $('#success-msg');
const successText = $('#success-text');

// ==========================================
// TOASTS & UX (FEEDBACKS FLUTUANTES)
// ==========================================
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
  }, 4000);
}

function setButtonLoading(btn, isLoading, originalText) {
  if (isLoading) {
    btn.classList.add('btn-loading');
    btn.disabled = true;
    btn.innerHTML = `<span class="spinner"></span> Processando...`;
  } else {
    btn.classList.remove('btn-loading');
    btn.disabled = false;
    btn.innerHTML = originalText;
  }
}

// ==========================================
// SEGURANÇA & UTILITÁRIOS
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

function validarTelefoneMZ(numero) {
  const limpo = numero.replace(/\D/g, '');
  return /^(?:258)?(8[234567]\d{7})$/.test(limpo);
}

function formatarTelefoneMZ(numero) {
  const limpo = numero.replace(/\D/g, '');
  return limpo.startsWith('258') ? limpo : '258' + limpo;
}

function initials(name) {
  if (!name) return 'P';
  return name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();
}

function getInitialsColor(name) {
  const colors = ['#2563EB', '#1D4ED8', '#0284C7', '#7C3AED', '#4F46E5'];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

function renderStars(rating) {
  const full = Math.floor(rating || 0);
  let stars = '';
  for (let i = 0; i < full; i++) stars += '⭐';
  return stars;
}

function mostrarErroCampo(elementId, mensagem) {
  const el = $(elementId);
  if (!el) return;
  el.classList.add('input-error');
  
  let errEl = el.parentNode.querySelector('.error-text');
  if (!errEl) {
    errEl = document.createElement('small');
    errEl.className = 'error-text';
    el.parentNode.appendChild(errEl);
  }
  errEl.textContent = mensagem;
}

function limparErrosFormulario(form) {
  form.querySelectorAll('.input-error').forEach(e => e.classList.remove('input-error'));
  form.querySelectorAll('.error-text').forEach(e => e.remove());
}

// ==========================================
// RENDERIZAÇÃO & UI
// ==========================================
function renderSkeletons() {
  resultsGrid.innerHTML = Array(3).fill(`
    <div class="skeleton" aria-hidden="true">
      <div style="display:flex;gap:14px;">
        <div class="skeleton-avatar"></div>
        <div style="flex:1;">
          <div class="skeleton-line medium"></div>
          <div class="skeleton-line short" style="margin-top:6px;"></div>
        </div>
      </div>
      <div class="skeleton-line long"></div>
      <div class="skeleton-line medium"></div>
    </div>
  `).join('');
}

function populateSelects() {
  BAIRROS.forEach(b => {
    fBairro.insertAdjacentHTML('beforeend', `<option value="${escapeHtml(b)}">${escapeHtml(b)}</option>`);
    tBairro.insertAdjacentHTML('beforeend', `<option value="${escapeHtml(b)}">${escapeHtml(b)}</option>`);
  });
  INSTRUMENTOS.forEach(i => {
    fInstr.insertAdjacentHTML('beforeend', `<option value="${escapeHtml(i)}">${escapeHtml(i)}</option>`);
    const chip = document.createElement('div');
    chip.className = 'chip';
    chip.textContent = i;
    chip.dataset.value = i;
    chip.addEventListener('click', () => chip.classList.toggle('active'));
    tInstrumentos.appendChild(chip);
  });
}

function renderTeachers() {
  const bairro = fBairro.value;
  const instr = fInstr.value;
  const maxPreco = fPreco ? Number(fPreco.value) : null;

  const filtered = professores.filter(p => {
    const matchBairro = !bairro || p.bairro === bairro;
    const matchInstr = !instr || p.instrumentos.includes(instr);
    const matchPreco = !maxPreco || p.preco <= maxPreco;
    return matchBairro && matchInstr && matchPreco;
  });

  resultsCount.textContent = `${filtered.length} ${filtered.length === 1 ? 'professor verificado' : 'professores verificados'}`;

  if (filtered.length === 0) {
    resultsGrid.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-music" style="font-size:32px;margin-bottom:8px;opacity:0.4;"></i><br>
        Nenhum professor verificado encontrado com estes filtros.<br>
        <button class="btn-clear-filters" onclick="limparFiltros()">Limpar Filtros</button>
      </div>
    `;
    return;
  }

  resultsGrid.innerHTML = filtered.map((p) => {
    const temAvaliacoesReais = p.total_avaliacoes && p.total_avaliacoes > 0 && p.avaliacao;
    const ratingHTML = temAvaliacoesReais 
      ? `<div class="card-rating">${renderStars(p.avaliacao)} ${p.avaliacao.toFixed(1)} <span>(${p.total_avaliacoes})</span></div>`
      : `<div class="card-rating"><span class="badge-new"><i class="fas fa-sparkles"></i> Novo no AulaPerto</span></div>`;

    return `
      <div class="teacher-card">
        <div class="card-top">
          <div class="card-avatar" style="background: ${getInitialsColor(p.nome)}">${initials(p.nome)}</div>
          <div class="card-info">
            <div class="card-name">
              ${escapeHtml(p.nome)}
              <span class="badge badge-gold"><i class="fas fa-check-circle"></i> Aprovado</span>
            </div>
            ${ratingHTML}
            <div class="card-experience"><i class="fas fa-briefcase"></i> ${p.experiencia || 1} ${p.experiencia === 1 ? 'ano' : 'anos'} de exp.</div>
            <div class="card-location"><i class="fas fa-map-pin"></i> ${escapeHtml(p.bairro)}</div>
          </div>
        </div>
        <div class="card-tags">
          ${p.instrumentos.map(i => `<span class="card-tag card-tag-instrument">${escapeHtml(i)}</span>`).join('')}
        </div>
        <p class="card-bio">${escapeHtml(p.bio) || 'Professor particular de música disponível para aulas presenciais e/ou ao domicílio.'}</p>
        <div class="card-footer">
          <div class="card-price">${p.preco} MT <span>/ aula</span></div>
          <button class="btn-whatsapp btn-pedir-aula" 
                  data-nome="${escapeHtml(p.nome)}" 
                  data-instrumentos="${escapeHtml(p.instrumentos.join(', '))}">
            <i class="fas fa-paper-plane"></i> Pedir Aula
          </button>
        </div>
      </div>
    `;
  }).join('');
}

function limparFiltros() {
  fBairro.value = '';
  fInstr.value = '';
  if (fPreco) fPreco.value = '';
  renderTeachers();
}

// ==========================================
// EVENT DELEGATION
// ==========================================
resultsGrid.addEventListener('click', (e) => {
  const btn = e.target.closest('.btn-pedir-aula');
  if (btn) {
    const nome = btn.dataset.nome;
    const instrumentos = btn.dataset.instrumentos;
    abrirModalContacto(nome, instrumentos);
  }
});

// ==========================================
// MODAL DE CONTATO & ACESSIBILIDADE
// ==========================================
function abrirModalContacto(nome, instrumentos) {
  $('#modal-teacher-subtitle').textContent = `Solicitar contacto com ${nome}`;
  $('#lead-teacher-name').value = nome;

  const lInstr = $('#l-instrumento');
  lInstr.innerHTML = '<option value="">Selecione o instrumento...</option>' + 
    INSTRUMENTOS.map(i => `<option value="${escapeHtml(i)}">${escapeHtml(i)}</option>`).join('');

  const modal = $('#modal-contacto');
  modal.style.display = 'flex';
  $('#l-nome').focus();
}

function fecharModal() {
  $('#modal-contacto').style.display = 'none';
  const formLead = $('#form-lead');
  if (formLead) {
    formLead.reset();
    limparErrosFormulario(formLead);
  }
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && $('#modal-contacto').style.display === 'flex') {
    fecharModal();
  }
});

$('#modal-contacto').addEventListener('click', (e) => {
  if (e.target.id === 'modal-contacto') fecharModal();
});

// SUBMETER SOLICITAÇÃO (LEADS)
$('#form-lead').addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.target;
  const btnSubmit = form.querySelector('button[type="submit"]');
  const originalBtnContent = btnSubmit.innerHTML;

  limparErrosFormulario(form);

  const alunoNome = $('#l-nome').value.trim();
  const rawWhatsapp = $('#l-whatsapp').value.trim();
  const instrumento = $('#l-instrumento').value;
  const professorNome = $('#lead-teacher-name').value;

  let temErro = false;

  if (alunoNome.length < 3) {
    mostrarErroCampo('#l-nome', 'Insira o seu nome completo.');
    temErro = true;
  }

  if (!validarTelefoneMZ(rawWhatsapp)) {
    mostrarErroCampo('#l-whatsapp', 'Número de WhatsApp inválido (ex: 841234567).');
    temErro = true;
  }

  if (!instrumento) {
    mostrarErroCampo('#l-instrumento', 'Selecione o instrumento.');
    temErro = true;
  }

  if (temErro) return;

  setButtonLoading(btnSubmit, true);

  const alunoWhatsapp = formatarTelefoneMZ(rawWhatsapp);

  try {
    const { error } = await supabaseClient.from('leads').insert([{
      student_name: alunoNome,
      student_whatsapp: alunoWhatsapp,
      teacher_name: professorNome,
      instrument: instrumento,
      status: 'pending'
    }]);

    if (error) throw error;

    fecharModal();
    showToast(`Obrigado, ${alunoNome}! Pedido registado. Entraremos em contacto em breve.`, 'success');

  } catch (err) {
    console.error('Erro ao guardar solicitação:', err);
    showToast('Ocorreu um erro ao enviar o pedido. Tenta novamente.', 'error');
  } finally {
    setButtonLoading(btnSubmit, false, originalBtnContent);
  }
});

// ==========================================
// CONSULTA SUPABASE + CACHE (LOCALSTORAGE)
// ==========================================
async function carregarProfessores() {
  renderSkeletons();

  // 1. Verificar Cache Válida
  const cachedData = localStorage.getItem(CACHE_KEY);
  if (cachedData) {
    try {
      const { timestamp, data } = JSON.parse(cachedData);
      if (Date.now() - timestamp < CACHE_TTL) {
        professores = data;
        updateStats();
        renderTeachers();
        return;
      }
    } catch (e) {
      localStorage.removeItem(CACHE_KEY);
    }
  }

  // 2. Consulta API se não houver cache
  try {
    const { data, error } = await supabaseClient
      .from('professors')
      .select('id, name, neighborhood, instruments, price, bio, experience, rating, total_reviews')
      .eq('status', 'approved')
      .order('created_at', { ascending: false });

    if (error || !data) throw error;

    professores = data.map(p => ({
      id: p.id,
      nome: p.name,
      bairro: p.neighborhood,
      instrumentos: p.instruments || [],
      preco: p.price,
      bio: p.bio || '',
      experiencia: p.experience || 1,
      avaliacao: p.rating || null,
      total_avaliacoes: p.total_reviews || 0
    }));

    // Guardar na Cache
    localStorage.setItem(CACHE_KEY, JSON.stringify({
      timestamp: Date.now(),
      data: professores
    }));

  } catch (e) {
    console.error('Erro ao carregar dados:', e);
    showToast('Erro ao carregar lista de professores.', 'error');
    professores = [];
  }

  updateStats();
  renderTeachers();
}

function updateStats() {
  totalTeachers.textContent = professores.length;
  const allInstr = new Set();
  professores.forEach(p => p.instrumentos.forEach(i => allInstr.add(i)));
  totalInstruments.textContent = allInstr.size;
}

// ==========================================
// CADASTRO DE PROFESSOR
// ==========================================
teacherForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const btnSubmit = teacherForm.querySelector('button[type="submit"]');
  const originalBtnContent = btnSubmit.innerHTML;

  limparErrosFormulario(teacherForm);

  const nome = $('#t-nome').value.trim();
  const bairro = tBairro.value;
  const preco = $('#t-preco').value;
  const rawWhatsapp = $('#t-whatsapp').value.trim();
  const bio = $('#t-bio').value.trim();
  const exp = $('#t-exp') ? $('#t-exp').value : 1;
  const instrumentos = Array.from(document.querySelectorAll('#t-instrumentos .chip.active')).map(c => c.dataset.value);

  let temErro = false;

  if (nome.length < 3) {
    mostrarErroCampo('#t-nome', 'Insira o seu nome completo.');
    temErro = true;
  }

  if (!bairro) {
    mostrarErroCampo('#t-bairro', 'Selecione o seu bairro.');
    temErro = true;
  }

  if (!preco || Number(preco) <= 0) {
    mostrarErroCampo('#t-preco', 'Insira o valor por hora/aula.');
    temErro = true;
  }

  if (!validarTelefoneMZ(rawWhatsapp)) {
    mostrarErroCampo('#t-whatsapp', 'Número de WhatsApp inválido (ex: 841234567).');
    temErro = true;
  }

  if (instrumentos.length === 0) {
    showToast('Selecione pelo menos um instrumento.', 'error');
    temErro = true;
  }

  if (temErro) return;

  setButtonLoading(btnSubmit, true);

  try {
    const { error } = await supabaseClient.from('professors').insert([{
      name: nome, 
      neighborhood: bairro, 
      instruments: instrumentos,
      price: Number(preco), 
      whatsapp: formatarTelefoneMZ(rawWhatsapp), 
      bio: bio,
      experience: Number(exp) || 1,
      status: 'pending'
    }]);

    if (error) throw error;

    showToast('Perfil submetido! A equipa irá analisar e aprovar em breve.', 'success');
    successText.textContent = 'O teu perfil foi submetido com sucesso! Irá aparecer na plataforma após validação.';
    successMsg.classList.add('show');
    teacherForm.reset();
    document.querySelectorAll('#t-instrumentos .chip.active').forEach(c => c.classList.remove('active'));
    
    // Invalida a cache para que o registo atualize após aprovação
    localStorage.removeItem(CACHE_KEY);

  } catch (err) {
    console.error('Erro no cadastro:', err);
    showToast('Erro ao submeter o formulário.', 'error');
  } finally {
    setButtonLoading(btnSubmit, false, originalBtnContent);
  }
});

// ==========================================
// NAVEGAÇÃO ENTRE ABAS
// ==========================================
document.querySelectorAll('.nav-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    
    $(`#view-${btn.dataset.view}`).classList.add('active');
    btn.classList.add('active');
    if (btn.dataset.view === 'search') renderTeachers();
  });
});

// ==========================================
// INICIALIZAÇÃO
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
  populateSelects();
  carregarProfessores();

  fBairro.addEventListener('change', renderTeachers);
  fInstr.addEventListener('change', renderTeachers);
  if (fPreco) fPreco.addEventListener('change', renderTeachers);

  const btnSearch = $('#btn-search');
  if (btnSearch) btnSearch.addEventListener('click', renderTeachers);
});
