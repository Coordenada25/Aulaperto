// ==========================================
// CONFIGURAÇÕES & CONSTANTES (MOCAMBIQUE)
// ==========================================
const PROVINCIAS = [
  "Maputo Cidade", "Maputo Província", "Gaza", "Inhambane", 
  "Sofala", "Manica", "Tete", "Zambézia", "Nampula", "Cabo Delgado", "Niassa"
];

const INSTRUMENTOS = [
  "Piano", "Guitarra", "Violão", "Bateria", "Canto", "Teclado", "Saxofone", "Violino", "Baixo", "Ukulele"
];

const CACHE_KEY = "aulaperto_teachers_cache";
const CACHE_TTL = 5 * 60 * 1000;

const SUPABASE_URL = "https://zxxwxwtsolbnyzbrabwp.supabase.co";
const SUPABASE_KEY = "sb_publishable_x0Ehx6SckG0JHXqdvOusXw_5LG12KPm";
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let professores = [];

// DOM Helpers
const $ = (s) => document.querySelector(s);
const fProvincia = $('#f-provincia');
const fBairro = $('#f-bairro');
const fInstr = $('#f-instr');
const fPreco = $('#f-preco');
const tProvincia = $('#t-provincia');
const tInstrumentos = $('#t-instrumentos');
const resultsGrid = $('#results-grid');

// ==========================================
// POPULAR SELECTS & FILTROS DINÂMICOS
// ==========================================
function populateSelects() {
  PROVINCIAS.forEach(p => {
    fProvincia.insertAdjacentHTML('beforeend', `<option value="${escapeHtml(p)}">${escapeHtml(p)}</option>`);
    tProvincia.insertAdjacentHTML('beforeend', `<option value="${escapeHtml(p)}">${escapeHtml(p)}</option>`);
  });

  INSTRUMENTOS.forEach(i => {
    fInstr.insertAdjacentHTML('beforeend', `<option value="${escapeHtml(i)}">${escapeHtml(i)}</option>`);
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'chip';
    chip.textContent = i;
    chip.dataset.value = i;
    chip.addEventListener('click', () => chip.classList.toggle('active'));
    tInstrumentos.appendChild(chip);
  });
}

// Atualiza os bairros do filtro com base nos professores da província selecionada
function atualizarBairrosFiltro() {
  const provSelecionada = fProvincia.value;
  fBairro.innerHTML = '<option value="">Todos os bairros</option>';
  
  if (!provSelecionada) {
    fBairro.disabled = true;
    renderTeachers();
    return;
  }

  // Extrai apenas os bairros únicos que têm professores na província selecionada
  const bairrosDisponiveis = new Set();
  professores.forEach(p => {
    if (p.provincia === provSelecionada && p.bairro) {
      bairrosDisponiveis.add(p.bairro);
    }
  });

  bairrosDisponiveis.forEach(b => {
    fBairro.insertAdjacentHTML('beforeend', `<option value="${escapeHtml(b)}">${escapeHtml(b)}</option>`);
  });

  fBairro.disabled = false;
  renderTeachers();
}

// ==========================================
// RENDERIZAÇÃO
// ==========================================
function renderTeachers() {
  const prov = fProvincia.value;
  const bairro = fBairro.value;
  const instr = fInstr.value;
  const maxPreco = fPreco ? Number(fPreco.value) : null;

  const filtered = professores.filter(p => {
    const matchProv = !prov || p.provincia === prov;
    const matchBairro = !bairro || p.bairro === bairro;
    const matchInstr = !instr || p.instrumentos.includes(instr);
    const matchPreco = !maxPreco || p.preco <= maxPreco;
    return matchProv && matchBairro && matchInstr && matchPreco;
  });

  $('#results-count').textContent = `${filtered.length} ${filtered.length === 1 ? 'professor verificado' : 'professores verificados'}`;

  if (filtered.length === 0) {
    resultsGrid.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-music" style="font-size:32px;margin-bottom:8px;opacity:0.4;"></i><br>
        Nenhum professor verificado encontrado nesta localização.<br>
        <button class="btn-clear-filters" onclick="limparFiltros()">Limpar Filtros</button>
      </div>
    `;
    return;
  }

  resultsGrid.innerHTML = filtered.map((p) => {
    const temAvaliacoes = p.total_avaliacoes && p.total_avaliacoes > 0 && p.avaliacao;
    const ratingHTML = temAvaliacoes 
      ? `<div class="card-rating">${renderStars(p.avaliacao)} ${p.avaliacao.toFixed(1)} <span>(${p.total_avaliacoes})</span></div>`
      : `<div class="card-rating"><span class="badge-new"><i class="fas fa-sparkles"></i> Novo no AulaPerto</span></div>`;

    return `
      <div class="teacher-card">
        <div class="card-top">
          ${p.foto
            ? `<img src="${escapeHtml(p.foto)}" alt="${escapeHtml(p.nome)}" class="card-avatar" style="object-fit:cover;" loading="lazy">`
            : `<div class="card-avatar" style="background: ${getInitialsColor(p.nome)}">${initials(p.nome)}</div>`}
          <div class="card-info">
            <div class="card-name">
              ${escapeHtml(p.nome)}
              <span class="badge badge-gold"><i class="fas fa-check-circle"></i> Aprovado</span>
            </div>
            ${ratingHTML}
            <div class="card-experience"><i class="fas fa-briefcase"></i> ${p.experiencia || 1} ano(s) exp.</div>
            <div class="card-location"><i class="fas fa-map-pin"></i> ${escapeHtml(p.bairro)}, ${escapeHtml(p.provincia)}</div>
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
  fProvincia.value = '';
  fBairro.value = '';
  fBairro.disabled = true;
  fInstr.value = '';
  if (fPreco) fPreco.value = '';
  renderTeachers();
}

// Navegação simplificada por botão ou link
function mudarAba(viewName) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  
  const targetView = $(`#view-${viewName}`);
  const targetBtn = document.querySelector(`.nav-btn[data-view="${viewName}"]`);
  if (targetView) targetView.classList.add('active');
  if (targetBtn) targetBtn.classList.add('active');
}

// Event Listener dos Botões de Navegação
document.querySelectorAll('.nav-btn').forEach(btn => {
  btn.addEventListener('click', () => mudarAba(btn.dataset.view));
});

// Inicialização de Filtros
document.addEventListener('DOMContentLoaded', () => {
  populateSelects();
  carregarProfessores();
  
  fProvincia.addEventListener('change', atualizarBairrosFiltro);
  fBairro.addEventListener('change', renderTeachers);
  fInstr.addEventListener('change', renderTeachers);
  if (fPreco) fPreco.addEventListener('change', renderTeachers);
  if ($('#btn-search')) $('#btn-search').addEventListener('click', renderTeachers);
});
