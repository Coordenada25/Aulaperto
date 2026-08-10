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

// SUPABASE (Chave Pública)
const SUPABASE_URL = "https://zxxwxwtsolbnyzbrabwp.supabase.co";
const SUPABASE_KEY = "sb_publishable_x0Ehx6SckG0JHXqdvOusXw_5LG12KPm";
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let professores = [];

// DOM ELEMENTS
const $ = (s) => document.querySelector(s);
const fBairro = $('#f-bairro');
const fInstr = $('#f-instr');
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
// SEGURANÇA & UTILITÁRIOS (XSS + VALIDAÇÃO)
// ==========================================

/**
 * Sanitiza strings para evitar ataques XSS (Cross-Site Scripting)
 */
function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Valida número de telemóvel de Moçambique (82, 83, 84, 85, 86, 87 + 7 dígitos)
 */
function validarTelefoneMZ(numero) {
  const limpo = numero.replace(/\D/g, '');
  // Aceita formatos: 841234567 ou 258841234567
  const regex = /^(?:258)?(8[234567]\d{7})$/;
  return regex.test(limpo);
}

/**
 * Formata o número para o padrão internacional 258XXXXXXXXX
 */
function formatarTelefoneMZ(numero) {
  const limpo = numero.replace(/\D/g, '');
  if (limpo.startsWith('258')) return limpo;
  return '258' + limpo;
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

// exibe mensagem de erro abaixo do campo
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

/**
 * Renderiza os cartões de professores de forma segura e sem prova social falsa
 */
function renderTeachers() {
  const bairro = fBairro.value;
  const instr = fInstr.value;

  const filtered = professores.filter(p => {
    const matchBairro = !bairro || p.bairro === bairro;
    const matchInstr = !instr || p.instrumentos.includes(instr);
    return matchBairro && matchInstr;
  });

  resultsCount.textContent = `${filtered.length} ${filtered.length === 1 ? 'professor verificado' : 'professores verificados'}`;

  if (filtered.length === 0) {
    resultsGrid.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-music"></i><br>
        Nenhum professor verificado encontrado para estes filtros.<br>
        <button class="btn-clear-filters" onclick="limparFiltros()">Limpar Filtros</button>
      </div>
    `;
    return;
  }

  resultsGrid.innerHTML = filtered.map((p) => {
    // ELIMINAÇÃO DE PROVA SOCIAL FALSA:
    // Se não tiver avaliações reais na base de dados, mostra badge de "Novo no AulaPerto"
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
              <span class="badge badge-gold" title="Perfil verificado pela administração"><i class="fas fa-check-circle"></i> Aprovado</span>
            </div>
            ${ratingHTML}
            <div class="card-experience"><i class="fas fa-briefcase"></i> ${p.experiencia || 1} ${p.experiencia === 1 ? 'ano' : 'anos'} de experiência</div>
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
  renderTeachers();
}

// ==========================================
// EVENT DELEGATION (EVENTOS SEGUROS NO GRID)
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
// MODAL DE CONTATO & SOLICITAÇÕES
// ==========================================
function abrirModalContacto(nome, instrumentos) {
  $('#modal-teacher-subtitle').textContent = `Solicitar contacto com ${nome}`;
  $('#lead-teacher-name').value = nome;

  const lInstr = $('#l-instrumento');
  lInstr.innerHTML = '<option value="">Selecione o instrumento...</option>' + 
    INSTRUMENTOS.map(i => `<option value="${escapeHtml(i)}">${escapeHtml(i)}</option>`).join('');

  $('#modal-contacto').style.display = 'flex';
}

function fecharModal() {
  $('#modal-contacto').style.display = 'none';
  const formLead = $('#form-lead');
  if (formLead) {
    formLead.reset();
    limparErrosFormulario(formLead);
  }
}

// SUBMETER LEADS COM VALIDAÇÃO ROBUSTA
$('#form-lead').addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.target;
  limparErrosFormulario(form);

  const alunoNome = $('#l-nome').value.trim();
  const rawWhatsapp = $('#l-whatsapp').value.trim();
  const instrumento = $('#l-instrumento').value;
  const professorNome = $('#lead-teacher-name').value;

  let temErro = false;

  if (alunoNome.length < 3) {
    mostrarErroCampo('#l-nome', 'Insira o seu nome completo (mínimo 3 letras).');
    temErro = true;
  }

  if (!validarTelefoneMZ(rawWhatsapp)) {
    mostrarErroCampo('#l-whatsapp', 'Número de WhatsApp inválido. Exemplo: 841234567 ou 821234567.');
    temErro = true;
  }

  if (!instrumento) {
    mostrarErroCampo('#l-instrumento', 'Selecione o instrumento pretendido.');
    temErro = true;
  }

  if (temErro) return;

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

    alert(`Obrigado, ${alunoNome}!\n\nO teu pedido para aulas de ${instrumento} com ${professorNome} foi registado.\n\nA nossa equipa irá validar a solicitação e entrará em contacto via WhatsApp (${alunoWhatsapp}) em breve.`);
    fecharModal();

  } catch (err) {
    console.error('Erro ao guardar solicitação:', err);
    alert('Ocorreu um erro ao enviar a sua solicitação. Por favor tente novamente.');
  }
});

// ==========================================
// CONSULTA SUPABASE (OMITE DADOS SENSÍVEIS)
// ==========================================
async function carregarProfessores() {
  renderSkeletons();
  try {
    const { data, error } = await supabaseClient
      .from('professors')
      // SEGURANÇA: Pedimos explicitamente APENAS os campos públicos
      // O campo 'whatsapp' do professor NÃO é trazido no payload da API!
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

  } catch (e) {
    console.error('Erro ao carregar dados do Supabase:', e);
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
// CADASTRO DE PROFESSOR (VALIDAÇÃO E REGISTO)
// ==========================================
teacherForm.addEventListener('submit', async (e) => {
  e.preventDefault();
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
    mostrarErroCampo('#t-bairro', 'Selecione o seu bairro principal.');
    temErro = true;
  }

  if (!preco || Number(preco) <= 0) {
    mostrarErroCampo('#t-preco', 'Insira um valor válido por hora/aula.');
    temErro = true;
  }

  if (!validarTelefoneMZ(rawWhatsapp)) {
    mostrarErroCampo('#t-whatsapp', 'Número de WhatsApp inválido (ex: 84 123 4567).');
    temErro = true;
  }

  if (instrumentos.length === 0) {
    alert('Por favor, selecione pelo menos um instrumento que leciona.');
    temErro = true;
  }

  if (temErro) return;

  const whatsappFormatted = formatarTelefoneMZ(rawWhatsapp);

  try {
    const { error } = await supabaseClient.from('professors').insert([{
      name: nome, 
      neighborhood: bairro, 
      instruments: instrumentos,
      price: Number(preco), 
      whatsapp: whatsappFormatted, 
      bio: bio,
      experience: Number(exp) || 1,
      status: 'pending' // Fica pendente para validação do Admin
    }]);

    if (error) throw error;

    successText.textContent = 'O seu perfil foi submetido com sucesso! A equipa do AulaPerto irá analisar e aprovar o seu cadastro em breve.';
    successMsg.classList.add('show');
    teacherForm.reset();
    document.querySelectorAll('#t-instrumentos .chip.active').forEach(c => c.classList.remove('active'));
    
  } catch (err) {
    console.error('Erro no cadastro:', err);
    alert('Ocorreu um erro ao submeter o formulário. Tente novamente.');
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
  const btnSearch = $('#btn-search');
  if (btnSearch) btnSearch.addEventListener('click', renderTeachers);
});
