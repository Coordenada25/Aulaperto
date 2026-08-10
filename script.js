// CONFIGURAÇÃO
const BAIRROS = ["Magoanine A", "Magoanine B", "Magoanine C", "Zimpeto", "Costa do Sol", "Sommerschield", "Polana", "Matola-Sede", "Malhazine", "Jardim"];
const INSTRUMENTOS = ["Piano", "Guitarra", "Violão", "Bateria", "Canto", "Teclado", "Saxofone", "Violino", "Baixo", "Ukulele"];

// SUPABASE (Chave Pública)
const SUPABASE_URL = "https://zxxwxwtsolbnyzbrabwp.supabase.co";
const SUPABASE_KEY = "sb_publishable_x0Ehx6SckG0JHXqdvOusXw_5LG12KPm";
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// MOCK DATA (FALLBACK)
const DADOS_EXEMPLO = [
  { id: '1', nome: "Carlos Muianga", bairro: "Polana", instrumentos: ["Guitarra", "Violão"], preco: 500, bio: "Professor de guitarra com 10 anos de experiência.", experiencia: 10, avaliacao: 4.9, total_avaliacoes: 24 },
  { id: '2', nome: "Marta Sitoe", bairro: "Sommerschield", instrumentos: ["Piano", "Teclado"], preco: 600, bio: "Pianista profissional. Aulas de piano e teoria musical.", experiencia: 8, avaliacao: 4.8, total_avaliacoes: 18 },
  { id: '3', nome: "João Tembe", bairro: "Magoanine A", instrumentos: ["Bateria"], preco: 450, bio: "Baterista com experiência em estúdio e bandas.", experiencia: 8, avaliacao: 4.7, total_avaliacoes: 12 }
];

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

// UTILS
function initials(name) {
  return name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();
}
function getInitialsColor(name) {
  const colors = ['#2563EB', '#3B82F6', '#0EA5E9', '#8B5CF6', '#6366F1'];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}
function renderStars(rating) {
  const full = Math.floor(rating);
  let stars = '';
  for (let i = 0; i < full; i++) stars += '⭐';
  return stars;
}

// SKELETONS DE CARREGAMENTO
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

// PREENCHER DROPDOWNS E CHIPS
function populateSelects() {
  BAIRROS.forEach(b => {
    fBairro.insertAdjacentHTML('beforeend', `<option value="${b}">${b}</option>`);
    tBairro.insertAdjacentHTML('beforeend', `<option value="${b}">${b}</option>`);
  });
  INSTRUMENTOS.forEach(i => {
    fInstr.insertAdjacentHTML('beforeend', `<option value="${i}">${i}</option>`);
    const chip = document.createElement('div');
    chip.className = 'chip';
    chip.textContent = i;
    chip.dataset.value = i;
    chip.addEventListener('click', () => chip.classList.toggle('active'));
    tInstrumentos.appendChild(chip);
  });
}

// RENDERIZAR CARTÕES DE PROFESSORES (SEM REVELAR O NÚMERO DE WHATSAPP)
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
        <i class="fas fa-music"></i>
        Nenhum professor verificado para este filtro.<br>
        <button class="btn-clear-filters" onclick="limparFiltros()">Limpar Filtros</button>
      </div>
    `;
    return;
  }

  resultsGrid.innerHTML = filtered.map((p) => {
    const rating = p.avaliacao || 4.9;
    const totalAval = p.total_avaliacoes || 15;
    const exp = p.experiencia || 5;

    return `
      <div class="teacher-card">
        <div class="card-top">
          <div class="card-avatar" style="background: ${getInitialsColor(p.nome)}">${initials(p.nome)}</div>
          <div class="card-info">
            <div class="card-name">
              ${p.nome}
              <span class="badge badge-gold"><i class="fas fa-check-circle"></i> Aprovado</span>
            </div>
            <div class="card-rating">${renderStars(rating)} ${rating.toFixed(1)} <span>(${totalAval})</span></div>
            <div class="card-experience"><i class="fas fa-briefcase"></i> ${exp} anos de exp.</div>
            <div class="card-location"><i class="fas fa-map-pin"></i> ${p.bairro}</div>
          </div>
        </div>
        <div class="card-tags">
          ${p.instrumentos.map(i => `<span class="card-tag card-tag-instrument">${i}</span>`).join('')}
        </div>
        <p class="card-bio">${p.bio || 'Professor de música disponível para aulas particulares.'}</p>
        <div class="card-footer">
          <div class="card-price">${p.preco} MT <span>/ aula</span></div>
          <button class="btn-whatsapp" onclick="abrirModalContacto('${p.nome}', '${p.instrumentos.join(', ')}')">
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

// MODAL DE CONTATO
function abrirModalContacto(nome, instrumentos) {
  $('#modal-teacher-subtitle').textContent = `Solicitar contacto com ${nome}`;
  $('#lead-teacher-name').value = nome;

  const lInstr = $('#l-instrumento');
  lInstr.innerHTML = '<option value="">Selecione...</option>' + 
    INSTRUMENTOS.map(i => `<option value="${i}">${i}</option>`).join('');

  $('#modal-contacto').style.display = 'flex';
}

function fecharModal() {
  $('#modal-contacto').style.display = 'none';
  $('#form-lead').reset();
}

// SUBMETER SOLICITAÇÃO (SALVA LEAD NO SUPABASE - REQUER VALIDAÇÃO)
$('#form-lead').addEventListener('submit', async (e) => {
  e.preventDefault();

  const alunoNome = $('#l-nome').value.trim();
  const alunoWhatsapp = '258' + $('#l-whatsapp').value.replace(/\D/g, '').replace(/^258/, '');
  const instrumento = $('#l-instrumento').value;
  const professorNome = $('#lead-teacher-name').value;

  try {
    const { error } = await supabaseClient.from('leads').insert([{
      student_name: alunoNome,
      student_whatsapp: alunoWhatsapp,
      teacher_name: professorNome,
      instrument: instrumento,
      status: 'pending'
    }]);

    if (error) throw error;

    alert(`Obrigado, ${alunoNome}!\n\nO teu pedido para aulas de ${instrumento} com ${professorNome} foi registado com sucesso.\n\nA nossa equipa irá validar a disponibilidade e entrará em contacto contigo pelo WhatsApp (${alunoWhatsapp}) em breve.`);
    fecharModal();

  } catch (err) {
    console.error('Erro ao guardar solicitação:', err);
    alert('Ocorreu um erro ao enviar o pedido. Por favor tenta novamente.');
  }
});

// CARREGAR APENAS PROFESSORES APROVADOS (status = 'approved')
async function carregarProfessores() {
  renderSkeletons();
  try {
    const { data, error } = await supabaseClient
      .from('professors')
      .select('*')
      .eq('status', 'approved') // FILTRA APENAS OS VALIDADOS PELO ADMIN
      .order('created_at', { ascending: false });

    if (error || !data || data.length === 0) {
      professores = DADOS_EXEMPLO;
    } else {
      professores = data.map(p => ({
        id: p.id,
        nome: p.name,
        bairro: p.neighborhood,
        instrumentos: p.instruments,
        preco: p.price,
        bio: p.bio || '',
        experiencia: p.experience || 5,
        avaliacao: p.rating || 4.9,
        total_avaliacoes: p.total_reviews || 12
      }));
    }
  } catch (e) {
    professores = DADOS_EXEMPLO;
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

// CADASTRO DE NOVO PROFESSOR (ENTRA COMO 'pending')
teacherForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const nome = $('#t-nome').value.trim();
  const bairro = tBairro.value;
  const preco = $('#t-preco').value;
  const whatsapp = '258' + $('#t-whatsapp').value.replace(/\D/g, '').replace(/^258/, '');
  const bio = $('#t-bio').value.trim();
  const instrumentos = Array.from(document.querySelectorAll('#t-instrumentos .chip.active')).map(c => c.dataset.value);

  if (instrumentos.length === 0) {
    alert('Escolhe pelo menos um instrumento.');
    return;
  }

  try {
    const { error } = await supabaseClient.from('professors').insert([{
      name: nome, 
      neighborhood: bairro, 
      instruments: instrumentos,
      price: Number(preco), 
      whatsapp: whatsapp, 
      bio: bio,
      status: 'pending' // FICA PENDENTE PARA VALIDAÇÃO DO ADMIN
    }]);

    if (error) throw error;

    successText.textContent = 'O teu perfil foi submetido com sucesso! A nossa equipa irá analisar e aprovar o teu cadastro em breve.';
    successMsg.classList.add('show');
    teacherForm.reset();
    document.querySelectorAll('#t-instrumentos .chip.active').forEach(c => c.classList.remove('active'));
    
  } catch (err) {
    console.error('Erro no cadastro:', err);
    alert('Erro ao submeter o registo. Tenta novamente.');
  }
});

// NAVEGAÇÃO ENTRE ABAS
document.querySelectorAll('.nav-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    
    $(`#view-${btn.dataset.view}`).classList.add('active');
    btn.classList.add('active');
    if (btn.dataset.view === 'search') renderTeachers();
  });
});

// INICIALIZAÇÃO
document.addEventListener('DOMContentLoaded', () => {
  populateSelects();
  carregarProfessores();
  fBairro.addEventListener('change', renderTeachers);
  fInstr.addEventListener('change', renderTeachers);
  $('#btn-search').addEventListener('click', renderTeachers);
});
