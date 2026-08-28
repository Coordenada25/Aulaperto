// ============================================
// CONFIGURAÇÃO
// ============================================
const SUPABASE_URL = "https://zxxwxwtsolbnyzbrabwp.supabase.co";
const SUPABASE_KEY = "sb_publishable_x0Ehx6SckG0JHXqdvOusXw_5LG12KPm";
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// CONSTANTES
const PROVINCIAS = [
    "Cabo Delgado", "Gaza", "Inhambane", "Manica",
    "Maputo Cidade", "Maputo Província", "Nampula",
    "Niassa", "Sofala", "Tete", "Zambézia"
];

const INSTRUMENTOS = [
    "Piano", "Guitarra", "Saxofone", "Clarinete", "Guitarra Baixo",
    "Contrabaixo", "Viola de Arco", "Violino", "Violoncelo",
    "Guitarra Clássica", "Voz", "Ukulele", "Flauta Doce", "Timbila", "Mbira"
];

const CACHE_KEY = "aulaperto_teachers_cache";
const CACHE_TTL = 5 * 60 * 1000; // 5 minutos

let professores = [];
let allLocations = [];
let sponsors = [];

// DOM Helpers
const $ = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);

// ============================================
// UTILITÁRIOS
// ============================================
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
    }, 4000);
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
    if (!form) return;
    form.querySelectorAll('.input-error').forEach(e => e.classList.remove('input-error'));
    form.querySelectorAll('.error-text').forEach(e => e.remove());
}

// Link partilhável do perfil individual de um professor, resolvido
// corretamente independentemente da pasta onde o site está hospedado.
function linkPerfilProfessor(slug) {
    return new URL(`professor.html?p=${encodeURIComponent(slug)}`, window.location.href).href;
}

async function copiarLink(url) {
    try {
        await navigator.clipboard.writeText(url);
        showToast('Link copiado! Já podes partilhar no WhatsApp ou Facebook.', 'success');
    } catch (err) {
        console.error('Erro ao copiar link:', err);
        showToast(`Não foi possível copiar automaticamente. Link: ${url}`, 'info');
    }
}

// ============================================
// UPLOAD DE FOTO
// ============================================
const FOTO_MAX_BYTES = 3 * 1024 * 1024;
const FOTO_TIPOS_ACEITES = ['image/jpeg', 'image/png', 'image/webp'];

async function uploadFotoProfessor(file) {
    if (!file) return null;
    if (!FOTO_TIPOS_ACEITES.includes(file.type)) {
        throw new Error('Formato de imagem inválido. Usa JPG, PNG ou WEBP.');
    }
    if (file.size > FOTO_MAX_BYTES) {
        throw new Error('A imagem é demasiado grande (máx. 3MB).');
    }
    
    const ext = file.name.split('.').pop().toLowerCase();
    const nomeUnico = `${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
    
    const { error: uploadError } = await supabaseClient
        .storage
        .from('professor-photos')
        .upload(nomeUnico, file, { cacheControl: '3600', upsert: false });
    
    if (uploadError) throw uploadError;
    
    const { data } = supabaseClient
        .storage
        .from('professor-photos')
        .getPublicUrl(nomeUnico);
    
    return data.publicUrl;
}

// ============================================
// CARREGAR LOCALIZAÇÕES
// ============================================
async function carregarLocalizacoes() {
    const { data, error } = await supabaseClient
        .from('locations')
        .select('province, neighborhood')
        .order('province')
        .order('neighborhood');
    
    if (error) return [];
    allLocations = data || [];
    return allLocations;
}

async function getBairrosPorProvincia(provincia) {
    if (!provincia) return allLocations;
    return allLocations.filter(l => l.province === provincia);
}

// ============================================
// POPULAR SELECTS
// ============================================
function populateSelects() {
    // Províncias
    const fProvincia = $('#f-provincia');
    const tProvincia = $('#t-provincia');
    
    PROVINCIAS.forEach(p => {
        fProvincia.insertAdjacentHTML('beforeend', `<option value="${escapeHtml(p)}">${escapeHtml(p)}</option>`);
        tProvincia.insertAdjacentHTML('beforeend', `<option value="${escapeHtml(p)}">${escapeHtml(p)}</option>`);
    });
    
    // Instrumentos
    const fInstr = $('#f-instr');
    const lInstr = $('#l-instrumento');
    const tInstrumentos = $('#t-instrumentos');
    
    INSTRUMENTOS.forEach(i => {
        fInstr.insertAdjacentHTML('beforeend', `<option value="${escapeHtml(i)}">${escapeHtml(i)}</option>`);
        lInstr.insertAdjacentHTML('beforeend', `<option value="${escapeHtml(i)}">${escapeHtml(i)}</option>`);
        
        const chip = document.createElement('div');
        chip.className = 'chip';
        chip.textContent = i;
        chip.dataset.value = i;
        chip.addEventListener('click', () => chip.classList.toggle('active'));
        tInstrumentos.appendChild(chip);
    });

    // Chip "Outro" — para o professor poder indicar um instrumento que não
    // está na lista fixa (ex: Marimba, Órgão, Kalimba...).
    const chipOutro = document.createElement('div');
    chipOutro.className = 'chip chip-outro';
    chipOutro.textContent = '+ Outro';
    chipOutro.dataset.value = 'outro';
    chipOutro.addEventListener('click', () => {
        chipOutro.classList.toggle('active');
        const wrapper = $('#instrumento-outro-wrapper');
        if (wrapper) wrapper.style.display = chipOutro.classList.contains('active') ? 'block' : 'none';
        if (!chipOutro.classList.contains('active')) {
            const campo = $('#t-instrumento-outro');
            if (campo) campo.value = '';
        }
    });
    tInstrumentos.appendChild(chipOutro);
}

// ============================================
// RENDERIZAR PROFESSORES
// ============================================
function renderSkeletons() {
    const grid = $('#results-grid');
    grid.innerHTML = Array(3).fill(`
        <div class="skeleton">
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

function renderTeacherCard(p) {
    const temAvaliacoes = p.total_avaliacoes && p.total_avaliacoes > 0 && p.avaliacao;
    const ratingHTML = temAvaliacoes
        ? `<div class="card-rating">${renderStars(p.avaliacao)} ${p.avaliacao.toFixed(1)} <span>(${p.total_avaliacoes})</span></div>`
        : `<div class="card-rating"><span class="badge-new"><i class="fas fa-sparkles"></i> Novo</span></div>`;

    const featuredBadge = p.featured
        ? `<span class="badge badge-featured"><i class="fas fa-star"></i> Destaque</span>`
        : '';

    return `
        <div class="teacher-card ${p.featured ? 'is-featured' : ''}">
            <div class="card-top">
                ${p.foto
                    ? `<img src="${escapeHtml(p.foto)}" alt="${escapeHtml(p.nome)}" class="card-avatar" style="object-fit:cover;" />`
                    : `<div class="card-avatar" style="background: ${getInitialsColor(p.nome)}">${initials(p.nome)}</div>`
                }
                <div class="card-info">
                    <div class="card-name">
                        ${escapeHtml(p.nome)}
                        ${featuredBadge}
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
            <p class="card-bio">${escapeHtml(p.bio) || 'Professor particular de música disponível para aulas.'}</p>
            <div class="card-footer">
                <div class="card-price">${p.preco} MT <span>/ aula</span></div>
                <button class="btn-whatsapp btn-pedir-aula"
                    data-id="${p.id}"
                    data-nome="${escapeHtml(p.nome)}"
                    data-instrumentos="${escapeHtml(p.instrumentos.join(', '))}">
                    <i class="fas fa-paper-plane"></i> Pedir Aula
                </button>
            </div>
            ${p.slug ? `
            <div class="card-links">
                <a class="card-link-profile" href="professor.html?p=${encodeURIComponent(p.slug)}" target="_blank" rel="noopener">
                    <i class="fas fa-id-badge"></i> Ver perfil completo
                </a>
                <button class="btn-share-profile" data-slug="${escapeHtml(p.slug)}" title="Copiar link do perfil para partilhar">
                    <i class="fas fa-share-nodes"></i>
                </button>
            </div>` : ''}
        </div>
    `;
}

// ============================================
// PATROCÍNIOS (ANÚNCIOS REAIS)
// ============================================
async function carregarSponsors() {
    try {
        const { data, error } = await supabaseClient
            .from('sponsors')
            .select('*')
            .eq('active', true)
            .order('display_order', { ascending: true })
            .order('created_at', { ascending: false });

        if (error) throw error;
        sponsors = data || [];
    } catch (err) {
        console.error('Erro ao carregar patrocínios:', err);
        sponsors = [];
    }
}

// Slot "Destaque" — o banner principal do hero. Um único patrocínio em
// destaque, se existir; senão mantém o convite de venda original.
function renderHeroBanner() {
    const container = $('#hero-banner-content');
    if (!container) return;

    const featuredSponsor = sponsors.find(s => s.style === 'featured');

    if (!featuredSponsor) {
        container.innerHTML = `
            <span class="banner-tag">🎵 Parcerias</span>
            <h3>Anuncie no AulaPerto</h3>
            <p>Conecte-se com milhares de alunos</p>
            <a href="mailto:parcerias@aulaperto.co.mz" class="btn-banner">Saiba mais</a>
        `;
        return;
    }

    const cta = featuredSponsor.link_url
        ? `<a href="${escapeHtml(featuredSponsor.link_url)}" target="_blank" rel="noopener sponsored" class="btn-banner sponsor-link" data-sponsor-id="${featuredSponsor.id}">Saiba mais</a>`
        : '';

    container.innerHTML = `
        <span class="banner-tag">🎵 Patrocinado</span>
        <h3>${escapeHtml(featuredSponsor.title)}</h3>
        <p>${escapeHtml(featuredSponsor.description)}</p>
        ${cta}
    `;
}

// Slot "Padrão" — faixa fina por baixo da pesquisa. Fica invisível se não
// houver nenhum patrocínio padrão ativo, para manter o site limpo.
function renderSponsorStrip() {
    const section = $('#sponsor-strip-section');
    const container = $('#sponsor-strip');
    if (!section || !container) return;

    const standardSponsors = sponsors.filter(s => s.style === 'standard');

    if (standardSponsors.length === 0) {
        section.style.display = 'none';
        container.innerHTML = '';
        return;
    }

    section.style.display = 'block';
    container.innerHTML = standardSponsors.map(s => {
        const inner = `
            <i class="fas fa-store"></i>
            <span>
                <span class="sponsor-chip-label">Anúncio</span><br />
                <strong>${escapeHtml(s.title)}</strong>
            </span>
        `;
        if (s.link_url) {
            return `<a class="sponsor-chip sponsor-link" data-sponsor-id="${s.id}" href="${escapeHtml(s.link_url)}" target="_blank" rel="noopener sponsored" title="${escapeHtml(s.description)}">${inner}</a>`;
        }
        return `<div class="sponsor-chip" title="${escapeHtml(s.description)}">${inner}</div>`;
    }).join('');
}

function renderTeachers() {
    const bairro = $('#f-bairro').value;
    const provincia = $('#f-provincia').value;
    const instr = $('#f-instr').value;
    
    let filtered = professores.filter(p => {
        const matchProvincia = !provincia || p.provincia === provincia;
        const matchBairro = !bairro || p.bairro === bairro;
        const matchInstr = !instr || p.instrumentos.includes(instr);
        return matchProvincia && matchBairro && matchInstr;
    });
    
    $('#results-count').textContent = `${filtered.length} ${filtered.length === 1 ? 'professor' : 'professores'}`;
    
    if (filtered.length === 0) {
        $('#results-grid').innerHTML = `
            <div class="empty-state">
                <i class="fas fa-music" style="font-size:32px;margin-bottom:8px;opacity:0.4;"></i><br />
                Nenhum professor encontrado com estes filtros.<br />
                <button class="btn-clear-filters" onclick="limparFiltros()">Limpar Filtros</button>
            </div>
        `;
        return;
    }
    
    // Grelha 100% limpa — só professores. Patrocínios vivem no banner
    // Destaque (topo) e na faixa Padrão (acima desta lista), não aqui.
    const html = filtered.map(p => renderTeacherCard(p)).join('');
    
    $('#results-grid').innerHTML = html;
}

function limparFiltros() {
    $('#f-provincia').value = '';
    $('#f-bairro').value = '';
    $('#f-instr').value = '';
    renderTeachers();
}

// ============================================
// CARREGAR PROFESSORES (COM CACHE)
// ============================================
async function carregarProfessores() {
    renderSkeletons();
    
    // Verificar cache
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
    
    // Buscar dados
    try {
        const { data, error } = await supabaseClient
            .from('professors')
            .select('id, slug, name, neighborhood, province, instruments, price, bio, experience, rating, total_reviews, photo_url, featured')
            .eq('status', 'approved')
            .order('featured', { ascending: false })
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        
        professores = data.map(p => ({
            id: p.id,
            slug: p.slug,
            nome: p.name,
            bairro: p.neighborhood,
            provincia: p.province || 'Maputo Cidade',
            instrumentos: p.instruments || [],
            preco: p.price,
            bio: p.bio || '',
            experiencia: p.experience || 1,
            avaliacao: p.rating || null,
            total_avaliacoes: p.total_reviews || 0,
            foto: p.photo_url || null,
            featured: !!p.featured
        }));
        
        // Guardar cache
        localStorage.setItem(CACHE_KEY, JSON.stringify({
            timestamp: Date.now(),
            data: professores
        }));
        
    } catch (e) {
        console.error('Erro ao carregar professores:', e);
        showToast('Erro ao carregar lista de professores.', 'error');
        professores = [];
    }
    
    updateStats();
    renderTeachers();
}

function updateStats() {
    $('#total-teachers').textContent = professores.length;
    
    const provincias = new Set();
    const allInstr = new Set();
    professores.forEach(p => {
        if (p.provincia) provincias.add(p.provincia);
        p.instrumentos.forEach(i => allInstr.add(i));
    });
    
    $('#total-provinces').textContent = provincias.size;
    $('#total-instruments').textContent = allInstr.size;
    
    // Atualizar about
    const aboutTeachers = $('#about-teachers');
    const aboutProvinces = $('#about-provinces');
    const aboutInstruments = $('#about-instruments');
    if (aboutTeachers) aboutTeachers.textContent = professores.length;
    if (aboutProvinces) aboutProvinces.textContent = provincias.size;
    if (aboutInstruments) aboutInstruments.textContent = allInstr.size;
}

// ============================================
// EVENTOS DE FILTRO POR PROVÍNCIA
// ============================================
$('#f-provincia').addEventListener('change', async function() {
    const provincia = this.value;
    const bairroSelect = $('#f-bairro');
    bairroSelect.innerHTML = '<option value="">Todos os bairros</option>';
    
    if (provincia) {
        const bairros = await getBairrosPorProvincia(provincia);
        const uniqueBairros = [...new Set(bairros.map(b => b.neighborhood))];
        uniqueBairros.forEach(b => {
            bairroSelect.insertAdjacentHTML('beforeend', `<option value="${escapeHtml(b)}">${escapeHtml(b)}</option>`);
        });
    }
    renderTeachers();
});

// ============================================
// MODAL DE CONTACTO
// ============================================
function abrirModalContacto(nome, instrumentos, teacherId) {
    $('#modal-teacher-subtitle').textContent = `Solicitar contacto com ${nome}`;
    $('#lead-teacher-name').value = nome;
    const idField = $('#lead-teacher-id');
    if (idField) idField.value = teacherId || '';
    
    const lInstr = $('#l-instrumento');
    lInstr.innerHTML = '<option value="">Selecione o instrumento...</option>';
    INSTRUMENTOS.forEach(i => {
        lInstr.insertAdjacentHTML('beforeend', `<option value="${escapeHtml(i)}">${escapeHtml(i)}</option>`);
    });
    
    $('#modal-contacto').style.display = 'flex';
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

// Event Delegation para botões "Pedir Aula" e "Partilhar Perfil"
$('#results-grid').addEventListener('click', (e) => {
    const shareBtn = e.target.closest('.btn-share-profile');
    if (shareBtn) {
        const slug = shareBtn.dataset.slug;
        if (slug) copiarLink(linkPerfilProfessor(slug));
        return;
    }
    const btn = e.target.closest('.btn-pedir-aula');
    if (btn) {
        abrirModalContacto(btn.dataset.nome, btn.dataset.instrumentos, btn.dataset.id);
    }
});

// Track de cliques em patrocínios (banner Destaque + faixa Padrão) —
// não bloqueia a navegação, já que os links abrem em nova aba.
document.addEventListener('click', (e) => {
    const link = e.target.closest('.sponsor-link');
    if (link && link.dataset.sponsorId) {
        supabaseClient.rpc('registar_click_patrocinio', { p_sponsor_id: link.dataset.sponsorId })
            .then(({ error }) => { if (error) console.error('Erro ao registar clique:', error); });
    }
});

// Fechar modal com Escape
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && $('#modal-contacto').style.display === 'flex') {
        fecharModal();
    }
});

// Fechar ao clicar no overlay
$('#modal-contacto').addEventListener('click', (e) => {
    if (e.target.id === 'modal-contacto') fecharModal();
});

// ============================================
// SUBMETER SOLICITAÇÃO (LEADS)
// ============================================
$('#form-lead').addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.target;
    const btnSubmit = form.querySelector('button[type="submit"]');
    const originalBtnContent = btnSubmit.innerHTML;
    
    limparErrosFormulario(form);
    
    // Honeypot
    if ($('#l-website') && $('#l-website').value.trim() !== '') {
        fecharModal();
        showToast('Obrigado! Pedido registado.', 'success');
        return;
    }
    
    const alunoNome = $('#l-nome').value.trim();
    const rawWhatsapp = $('#l-whatsapp').value.trim();
    const instrumento = $('#l-instrumento').value;
    const professorNome = $('#lead-teacher-name').value;
    const professorIdRaw = $('#lead-teacher-id') ? $('#lead-teacher-id').value : '';
    
    let temErro = false;
    
    if (alunoNome.length < 3) {
        mostrarErroCampo('#l-nome', 'Insira o seu nome completo.');
        temErro = true;
    }
    if (!validarTelefoneMZ(rawWhatsapp)) {
        mostrarErroCampo('#l-whatsapp', 'Número inválido (ex: 841234567).');
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
            teacher_id: professorIdRaw ? Number(professorIdRaw) : null,
            instrument: instrumento,
            status: 'pending'
        }]);
        if (error) throw error;
        
        fecharModal();
        showToast(`Obrigado, ${alunoNome}! Pedido registado.`, 'success');
    } catch (err) {
        console.error('Erro:', err);
        showToast('Erro ao enviar pedido. Tenta novamente.', 'error');
    } finally {
        setButtonLoading(btnSubmit, false, originalBtnContent);
    }
});

// ============================================
// CADASTRO DE PROFESSOR
// ============================================
$('#teacher-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.target;
    const btnSubmit = form.querySelector('button[type="submit"]');
    const originalBtnContent = btnSubmit.innerHTML;
    
    limparErrosFormulario(form);
    
    // Honeypot
    if ($('#t-website') && $('#t-website').value.trim() !== '') {
        showToast('Perfil submetido!', 'success');
        $('#success-text').textContent = 'Perfil submetido com sucesso! Aguarde validação.';
        $('#success-msg').classList.add('show');
        form.reset();
        return;
    }
    
    const nome = $('#t-nome').value.trim();
    const provincia = $('#t-provincia').value;
    let bairro = $('#t-bairro').value;
    const preco = $('#t-preco').value;
    const rawWhatsapp = $('#t-whatsapp').value.trim();
    const bio = $('#t-bio').value.trim();
    const programa = $('#t-programa').value.trim();
    const exp = $('#t-exp') ? $('#t-exp').value : 1;
    const instrumentosChips = Array.from(document.querySelectorAll('#t-instrumentos .chip.active'));
    const instrumentoOutroAtivo = instrumentosChips.some(c => c.dataset.value === 'outro');
    const instrumentoOutroValor = $('#t-instrumento-outro') ? $('#t-instrumento-outro').value.trim() : '';
    const instrumentos = instrumentosChips
        .map(c => c.dataset.value)
        .filter(v => v !== 'outro');
    if (instrumentoOutroAtivo && instrumentoOutroValor) {
        instrumentos.push(instrumentoOutroValor);
    }
    
    // Verificar se é "outro" bairro
    if (bairro === 'outro') {
        bairro = $('#t-novo-bairro').value.trim();
    }
    
    let temErro = false;
    
    if (nome.length < 3) {
        mostrarErroCampo('#t-nome', 'Insira o seu nome completo.');
        temErro = true;
    }
    if (!provincia) {
        mostrarErroCampo('#t-provincia', 'Selecione a província.');
        temErro = true;
    }
    if (!bairro) {
        mostrarErroCampo('#t-bairro', 'Selecione ou adicione o bairro.');
        temErro = true;
    }
    if (!preco || Number(preco) <= 0) {
        mostrarErroCampo('#t-preco', 'Insira o valor da aula.');
        temErro = true;
    }
    if (!validarTelefoneMZ(rawWhatsapp)) {
        mostrarErroCampo('#t-whatsapp', 'Número inválido (ex: 841234567).');
        temErro = true;
    }
    if (bio.length < 20) {
        mostrarErroCampo('#t-bio', 'Escreve uma breve biografia (mínimo 20 caracteres).');
        temErro = true;
    }
    if (programa.length < 20) {
        mostrarErroCampo('#t-programa', 'Descreve o que o aluno vai aprender (mínimo 20 caracteres).');
        temErro = true;
    }
    if (instrumentos.length === 0) {
        showToast('Selecione pelo menos um instrumento.', 'error');
        temErro = true;
    }
    if (instrumentoOutroAtivo && !instrumentoOutroValor) {
        mostrarErroCampo('#t-instrumento-outro', 'Escreve o nome do instrumento.');
        temErro = true;
    }
    if (temErro) return;
    
    setButtonLoading(btnSubmit, true);
    
    try {
        // Upload da foto
        let fotoUrl = null;
        const ficheiroFoto = $('#t-foto') && $('#t-foto').files[0];
        if (ficheiroFoto) {
            try {
                fotoUrl = await uploadFotoProfessor(ficheiroFoto);
            } catch (fotoErr) {
                showToast(fotoErr.message || 'Erro ao enviar foto.', 'error');
                setButtonLoading(btnSubmit, false, originalBtnContent);
                return;
            }
        }
        
        // Salvar localização
        await supabaseClient.from('locations').insert([{
            province: provincia,
            neighborhood: bairro
        }]).select();
        
        // Salvar professor (o "slug" é gerado automaticamente pela base de dados)
        const { error } = await supabaseClient.from('professors').insert([{
            name: nome,
            province: provincia,
            neighborhood: bairro,
            instruments: instrumentos,
            price: Number(preco),
            whatsapp: formatarTelefoneMZ(rawWhatsapp),
            bio: bio,
            course_program: programa,
            experience: Number(exp) || 1,
            status: 'pending',
            photo_url: fotoUrl
        }]);
        
        if (error) throw error;
        
        showToast('Perfil submetido! Aguarde aprovação.', 'success');
        $('#success-text').textContent = 'Perfil submetido com sucesso! Irá aparecer após validação.';
        $('#success-msg').classList.add('show');
        form.reset();
        document.querySelectorAll('#t-instrumentos .chip.active').forEach(c => c.classList.remove('active'));
        const outroWrapper = $('#instrumento-outro-wrapper');
        if (outroWrapper) outroWrapper.style.display = 'none';
        localStorage.removeItem(CACHE_KEY);
        
    } catch (err) {
        console.error('Erro no cadastro:', err);
        showToast('Erro ao submeter o formulário.', 'error');
    } finally {
        setButtonLoading(btnSubmit, false, originalBtnContent);
    }
});

// ============================================
// EVENTO: Província mudar no formulário
// ============================================
$('#t-provincia').addEventListener('change', async function() {
    const provincia = this.value;
    const bairroSelect = $('#t-bairro');
    bairroSelect.innerHTML = '<option value="">Selecione o bairro...</option>';
    const novoBairroWrapper = $('#novo-bairro-wrapper');
    
    if (provincia) {
        const bairros = await getBairrosPorProvincia(provincia);
        const uniqueBairros = [...new Set(bairros.map(b => b.neighborhood))];
        uniqueBairros.forEach(b => {
            bairroSelect.insertAdjacentHTML('beforeend', `<option value="${escapeHtml(b)}">${escapeHtml(b)}</option>`);
        });
        bairroSelect.insertAdjacentHTML('beforeend', `<option value="outro">+ Adicionar novo bairro</option>`);
        novoBairroWrapper.style.display = 'block';
    } else {
        novoBairroWrapper.style.display = 'none';
    }
});

// ============================================
// NAVEGAÇÃO ENTRE VIEWS
// ============================================
$$('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const view = btn.dataset.view;
        
        $$('.view').forEach(v => v.classList.remove('active'));
        $$('.nav-btn').forEach(b => b.classList.remove('active'));
        
        const targetView = $(`#view-${view}`);
        if (targetView) targetView.classList.add('active');
        btn.classList.add('active');
        window.scrollTo({ top: 0, behavior: 'smooth' });
        
        if (view === 'search') renderTeachers();
        if (view === 'about') updateStats();
    });
});

// Links do footer
$$('.footer-links a').forEach(link => {
    link.addEventListener('click', (e) => {
        e.preventDefault();
        const view = link.dataset.view;
        const btn = document.querySelector(`.nav-btn[data-view="${view}"]`);
        if (btn) btn.click();
    });
});

// ============================================
// INICIALIZAÇÃO
// ============================================
document.addEventListener('DOMContentLoaded', async () => {
    populateSelects();
    await carregarLocalizacoes();
    await carregarSponsors();
    renderHeroBanner();
    renderSponsorStrip();
    await carregarProfessores();
    
    // Event listeners de filtros
    $('#f-provincia').addEventListener('change', renderTeachers);
    $('#f-instr').addEventListener('change', renderTeachers);
    $('#btn-search').addEventListener('click', renderTeachers);
});
