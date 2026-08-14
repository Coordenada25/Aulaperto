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
    "Piano", "Guitarra", "Violão", "Bateria", "Canto",
    "Teclado", "Saxofone", "Violino", "Baixo", "Ukulele"
];

const CACHE_KEY = "aulaperto_teachers_cache";
const CACHE_TTL = 5 * 60 * 1000; // 5 minutos

let professores = [];
let allLocations = [];

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
    
    return `
        <div class="teacher-card">
            <div class="card-top">
                ${p.foto
                    ? `<img src="${escapeHtml(p.foto)}" alt="${escapeHtml(p.nome)}" class="card-avatar" style="object-fit:cover;" />`
                    : `<div class="card-avatar" style="background: ${getInitialsColor(p.nome)}">${initials(p.nome)}</div>`
                }
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
            <p class="card-bio">${escapeHtml(p.bio) || 'Professor particular de música disponível para aulas.'}</p>
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
}

function renderAdCard(type, title, description) {
    const isFeatured = type === 'featured';
    const icon = isFeatured ? 'fa-star' : 'fa-store';
    
    return `
        <div class="ad-card ${isFeatured ? 'ad-featured' : ''}">
            <div class="ad-content">
                <span class="ad-badge">${isFeatured ? 'Destaque' : 'Anúncio'}</span>
                <i class="fas ${icon} ad-icon"></i>
                <h4>${escapeHtml(title)}</h4>
                <p>${escapeHtml(description)}</p>
                ${isFeatured ? '<a href="#contacto" class="btn-ad">Saiba mais</a>' : ''}
            </div>
        </div>
    `;
}

function renderTeachers() {
    const bairro = $('#f-bairro').value;
    const provincia = $('#f-provincia').value;
    const instr = $('#f-instr').value;
    const maxPreco = $('#f-preco') ? Number($('#f-preco').value) : null;
    
    let filtered = professores.filter(p => {
        const matchProvincia = !provincia || p.provincia === provincia;
        const matchBairro = !bairro || p.bairro === bairro;
        const matchInstr = !instr || p.instrumentos.includes(instr);
        const matchPreco = !maxPreco || p.preco <= maxPreco;
        return matchProvincia && matchBairro && matchInstr && matchPreco;
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
    
    // Intercalar anúncios
    let html = '';
    const adPositions = [3, 7];
    
    filtered.forEach((p, index) => {
        if (adPositions.includes(index)) {
            html += renderAdCard('standard', 'Loja de Música', 'Instrumentos com desconto');
        }
        if (index === 5) {
            html += renderAdCard('featured', 'Anuncie aqui', 'Seja um parceiro AulaPerto');
        }
        html += renderTeacherCard(p);
    });
    
    $('#results-grid').innerHTML = html;
}

function limparFiltros() {
    $('#f-provincia').value = '';
    $('#f-bairro').value = '';
    $('#f-instr').value = '';
    if ($('#f-preco')) $('#f-preco').value = '';
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
            .select('id, name, neighborhood, province, instruments, price, bio, experience, rating, total_reviews, photo_url')
            .eq('status', 'approved')
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        
        professores = data.map(p => ({
            id: p.id,
            nome: p.name,
            bairro: p.neighborhood,
            provincia: p.province || 'Maputo Cidade',
            instrumentos: p.instruments || [],
            preco: p.price,
            bio: p.bio || '',
            experiencia: p.experience || 1,
            avaliacao: p.rating || null,
            total_avaliacoes: p.total_reviews || 0,
            foto: p.photo_url || null
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
function abrirModalContacto(nome, instrumentos) {
    $('#modal-teacher-subtitle').textContent = `Solicitar contacto com ${nome}`;
    $('#lead-teacher-name').value = nome;
    
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

// Event Delegation para botões "Pedir Aula"
$('#results-grid').addEventListener('click', (e) => {
    const btn = e.target.closest('.btn-pedir-aula');
    if (btn) {
        abrirModalContacto(btn.dataset.nome, btn.dataset.instrumentos);
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
    const exp = $('#t-exp') ? $('#t-exp').value : 1;
    const instrumentos = Array.from(document.querySelectorAll('#t-instrumentos .chip.active')).map(c => c.dataset.value);
    
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
    if (instrumentos.length === 0) {
        showToast('Selecione pelo menos um instrumento.', 'error');
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
        
        // Salvar professor
        const { error } = await supabaseClient.from('professors').insert([{
            name: nome,
            province: provincia,
            neighborhood: bairro,
            instruments: instrumentos,
            price: Number(preco),
            whatsapp: formatarTelefoneMZ(rawWhatsapp),
            bio: bio,
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
    await carregarProfessores();
    
    // Event listeners de filtros
    $('#f-provincia').addEventListener('change', renderTeachers);
    $('#f-instr').addEventListener('change', renderTeachers);
    if ($('#f-preco')) $('#f-preco').addEventListener('change', renderTeachers);
    $('#btn-search').addEventListener('click', renderTeachers);
});
