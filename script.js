// CONFIGURAÇÃO
const BAIRROS = ["Magoanine A", "Magoanine B", "Magoanine C", "Zimpeto", "Costa do Sol", "Sommerschield", "Polana", "Matola-Sede", "Malhazine", "Jardim"];
const INSTRUMENTOS = ["Piano", "Guitarra", "Violão", "Bateria", "Canto", "Teclado", "Saxofone", "Violino", "Baixo", "Ukulele"];

// SUPABASE (Chave Pública)
const SUPABASE_URL = "https://zxxwxwtsolbnyzbrabwp.supabase.co";
const SUPABASE_KEY = "sb_publishable_x0Ehx6SckG0JHXqdvOusXw_5LG12KPm";
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// MOCK DATA (FALLBACK CASO A BD ESTEJA VAZIA)
const DADOS_EXEMPLO = [
  { nome: "Carlos Muianga", bairro: "Polana", instrumentos: ["Guitarra", "Violão"], preco: 500, whatsapp: "258821234567", bio: "Professor de guitarra com 10 anos de experiência.", experiencia: 10, avaliacao: 4.9, total_avaliacoes: 24 },
  { nome: "Marta Sitoe", bairro: "Sommerschield", instrumentos: ["Piano", "Teclado"], preco: 600, whatsapp: "258823456789", bio: "Pianista profissional. Aulas de piano e teoria musical.", experiencia: 8, avaliacao: 4.8, total_avaliacoes: 18 },
  { nome: "João Tembe", bairro: "Magoanine A", instrumentos: ["Bateria"], preco: 450, whatsapp: "258825678901", bio: "Baterista com experiência em estúdio e bandas.", experiencia: 8, avaliacao: 4.7, total_avaliacoes: 12 }
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

// RENDERIZAR CARTÕES DE PROFESSORES
function renderTeachers() {
  const bairro = fBairro.value;
  const instr = fInstr.value;
  const filtered = professores.filter(p => {
    const matchBairro = !bairro || p.bairro === bairro;
    const matchInstr = !instr || p.instrumentos.includes(instr);
    return matchBairro && matchInstr;
  });

  resultsCount.textContent = `${filtered.length} ${filtered.length === 1 ? 'professor encontrado' : 'professores encontrados'}`;

  if (filtered.length === 0) {
    resultsGrid.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-music"></i>
        Nenhum professor encontrado para este filtro.<br>
        <button class="btn-clear-filters" onclick="limparFiltros()">Limpar Filtros</button>
      </div>
    `;
    return;
  }

  resultsGrid.innerHTML = filtered.map((p) => {
    const rating = p.avaliacao || 4.8;
    const totalAval = p.total_avaliacoes || 15;
    const exp = p.experiencia || 5;

    return `
      <div class="teacher-card">
        <div class="card-top">
          <div class="card-avatar" style="background: ${getInitialsColor(p.nome)}">${initials(p.nome)}</div>
          <div class="card-info">
            <div class="card-name">
              ${p.nome}
              <span class="badge badge-gold"><i class="fas fa-check-circle"></i> Verificado</span>
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
          <button class="btn-whatsapp" onclick="abrirModalContacto('${p.nome}', '${p.whatsapp}', '${p.instrumentos.join(', ')}')">
            <i class="fab fa-whatsapp"></i> Contactar
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

// MODAL E SOLICITAÇÃO DE CONTATO (LEAD)
function abrirModalContacto(nome, whatsapp, instrumentos) {
  $('#modal-teacher-subtitle').textContent = `Solicitar aula com ${nome}`;
  $('#lead-teacher-name').value = nome;
  $('#lead-teacher-phone').value = whatsapp;

  const lInstr = $('#l-instrumento');
  lInstr.innerHTML = '<option value="">Selecione...</option>' + 
    INSTRUMENTOS.map(i => `<option value="${i}">${i}</option>`).join('');

  $('#modal-contacto').style.display = 'flex';
}

function fecharModal() {
  $('#modal-contacto').style.display = 'none';
  $('#form-lead').reset();
}

// SUBMETER SOLICITAÇÃO (SALVA LEAD NO SUPABASE E ABRE WHATSAPP)
$('#form-lead').addEventListener('submit', async (e) => {
  e.preventDefault();

  const alunoNome = $('#l-nome').value.trim();
  const alunoWhatsapp = '258' + $('#l-whatsapp').value.replace(/\D/g, '').replace(/^258/, '');
  const instrumento = $('#l-instrumento').value;
  const professorNome = $('#lead-teacher-name').value;
  const professorPhone = $('#lead-teacher-phone').value;

  // 1. Salvar Lead no Supabase
  try {
    await supabaseClient.from('leads').insert([{
      student_name: alunoNome,
      student_whatsapp: alunoWhatsapp,
      teacher_name: professorNome,
      instrument: instrumento,
      status: 'pending'
    }]);
  } catch (err) {
    console.warn('Erro ao registar lead no Supabase:', err);
  }

  // 2. Abrir WhatsApp com a mensagem pronta
  const texto = `Olá ${professorNome}! Meu nome é ${alunoNome}. Encontrei o seu perfil no AulaPerto e tenho interesse em aulas de ${instrumento}. Podemos falar?`;
  const urlWa = `https://wa.me/${professorPhone}?text=${encodeURIComponent(texto)}`;

  fecharModal();
  window.open(urlWa, '_blank');
});

// CARREGAR PROFESSORES DO SUPABASE
async function carregarProfessores() {
  renderSkeletons();
  try {
    const { data, error } = await supabaseClient
      .from('professors')
      .select('*')
      .order('created_at', { ascending: false });

    if (error || !data || data.length === 0) {
      professores = DADOS_EXEMPLO;
    } else {
      professores = data.map(p => ({
        nome: p.name,
        bairro: p.neighborhood,
        instrumentos: p.instruments,
        preco: p.price,
        whatsapp: p.whatsapp.replace(/\D/g, ''),
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

// CADASTRO DE NOVO PROFESSOR
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
    await supabaseClient.from('professors').insert([{
      name: nome, neighborhood: bairro, instruments: instrumentos,
      price: Number(preco), whatsapp: whatsapp, bio: bio
    }]);

    successText.textContent = 'Cadastro feito com sucesso!';
    successMsg.classList.add('show');
    teacherForm.reset();
    document.querySelectorAll('#t-instrumentos .chip.active').forEach(c => c.classList.remove('active'));
    carregarProfessores();
  } catch (err) {
    alert('Erro ao guardar cadastro.');
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
