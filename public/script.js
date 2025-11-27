// ============================================
// CONFIGURAÇÃO
// ============================================

const PORTAL_URL = 'https://ir-comercio-portal-zcan.onrender.com';
const API_URL = '/api';

let users = [];
let loginAttempts = [];
let authorizedDevices = [];
let isOnline = false;
let editingUserId = null;
let sessionToken = null;

// ============================================
// INICIALIZAÇÃO E AUTENTICAÇÃO
// ============================================

document.addEventListener('DOMContentLoaded', async () => {
    console.log('Sistema de Gerenciamento de Usuários iniciado');
    
    // Verificar autenticação ANTES de tudo
    if (!verificarAutenticacao()) {
        return; // Para a execução se não autenticado
    }
    
    // Mostrar splash screen por 2 segundos
    setTimeout(() => {
        document.getElementById('splashScreen').style.display = 'none';
        document.querySelector('.app-content').style.display = 'block';
    }, 2000);
    
    // Carregar dados
    await checkServerStatus();
    await loadAllData();
    
    // Atualizar dados a cada 30 segundos
    setInterval(loadAllData, 30000);
    setInterval(checkServerStatus, 15000);
});

// ============================================
// AUTENTICAÇÃO VIA PORTAL
// ============================================

function verificarAutenticacao() {
    // Verificar se há token na URL
    const urlParams = new URLSearchParams(window.location.search);
    const tokenFromUrl = urlParams.get('sessionToken');

    if (tokenFromUrl) {
        // Salvar token no sessionStorage
        sessionToken = tokenFromUrl;
        sessionStorage.setItem('usuariosSession', tokenFromUrl);
        
        // Limpar URL (remover token)
        window.history.replaceState({}, document.title, window.location.pathname);
        
        console.log('✅ Autenticado via URL');
        return true;
    } else {
        // Tentar recuperar token do sessionStorage
        sessionToken = sessionStorage.getItem('usuariosSession');
        
        if (sessionToken) {
            console.log('✅ Autenticado via sessionStorage');
            return true;
        }
    }

    // Se não tem token, bloquear acesso
    console.log('❌ Não autenticado - redirecionando');
    mostrarTelaAcessoNegado();
    return false;
}

function mostrarTelaAcessoNegado() {
    // Esconder splash screen
    document.getElementById('splashScreen').style.display = 'none';
    
    // Esconder conteúdo principal
    document.querySelector('.app-content').style.display = 'none';
    
    // Mostrar modal de acesso negado
    document.getElementById('modalAccessDenied').style.display = 'flex';
}

function voltarParaPortal() {
    window.location.href = PORTAL_URL;
}

// ============================================
// CONEXÃO COM SERVIDOR
// ============================================

async function checkServerStatus() {
    try {
        const response = await fetch(`${API_URL}/../health`);
        const data = await response.json();
        
        isOnline = data.status === 'healthy';
        updateConnectionStatus(isOnline);
    } catch (error) {
        console.error('Erro ao verificar status do servidor:', error);
        isOnline = false;
        updateConnectionStatus(false);
    }
}

function updateConnectionStatus(online) {
    const statusElement = document.getElementById('connectionStatus');
    if (online) {
        statusElement.classList.remove('offline');
        statusElement.classList.add('online');
        statusElement.innerHTML = '<span class="status-dot"></span> Online';
    } else {
        statusElement.classList.remove('online');
        statusElement.classList.add('offline');
        statusElement.innerHTML = '<span class="status-dot"></span> Offline';
    }
}

// ============================================
// CARREGAR DADOS
// ============================================

async function loadAllData() {
    await Promise.all([
        loadUsers(),
        loadLoginAttempts(),
        loadAuthorizedDevices(),
        loadDashboard()
    ]);
}

async function loadUsers() {
    try {
        const response = await fetch(`${API_URL}/users`, {
            headers: {
                'x-session-token': sessionToken
            }
        });
        const data = await response.json();
        
        if (data.success) {
            users = data.data;
            renderUsers();
            updateFilters();
        } else if (data.error === 'Não autenticado') {
            console.error('❌ Sessão expirada');
            mostrarTelaAcessoNegado();
        }
    } catch (error) {
        console.error('Erro ao carregar usuários:', error);
    }
}

async function loadLoginAttempts() {
    try {
        const response = await fetch(`${API_URL}/login-attempts?limit=100`, {
            headers: {
                'x-session-token': sessionToken
            }
        });
        const data = await response.json();
        
        if (data.success) {
            loginAttempts = data.data;
            renderLoginAttempts();
        }
    } catch (error) {
        console.error('Erro ao carregar tentativas de login:', error);
    }
}

async function loadAuthorizedDevices() {
    try {
        const response = await fetch(`${API_URL}/authorized-devices`, {
            headers: {
                'x-session-token': sessionToken
            }
        });
        const data = await response.json();
        
        if (data.success) {
            authorizedDevices = data.data;
            renderAuthorizedDevices();
        }
    } catch (error) {
        console.error('Erro ao carregar dispositivos:', error);
    }
}

async function loadDashboard() {
    try {
        const response = await fetch(`${API_URL}/dashboard`, {
            headers: {
                'x-session-token': sessionToken
            }
        });
        const data = await response.json();
        
        if (data.success) {
            updateDashboard(data.data);
        }
    } catch (error) {
        console.error('Erro ao carregar dashboard:', error);
    }
}

// ============================================
// RENDERIZAÇÃO
// ============================================

function renderUsers() {
    const container = document.getElementById('usersContainer');
    
    if (users.length === 0) {
        container.innerHTML = `
            <div class="empty-message">
                <p>Nenhum usuário cadastrado</p>
            </div>
        `;
        return;
    }
    
    const html = `
        <table class="user-table">
            <thead>
                <tr>
                    <th>Nome</th>
                    <th>Username</th>
                    <th>Status</th>
                    <th>Tipo</th>
                    <th>Criado em</th>
                    <th>Ações</th>
                </tr>
            </thead>
            <tbody>
                ${users.map(user => `
                    <tr>
                        <td class="user-name">${escapeHtml(user.name)}</td>
                        <td class="user-username">@${escapeHtml(user.username)}</td>
                        <td>
                            <span class="status-badge ${user.is_active ? 'active' : 'inactive'}">
                                ${user.is_active ? 'Ativo' : 'Inativo'}
                            </span>
                        </td>
                        <td>
                            ${user.is_admin ? '<span class="status-badge admin">Admin</span>' : 'Usuário'}
                        </td>
                        <td>${formatDate(user.created_at)}</td>
                        <td>
                            <div class="user-actions">
                                <button onclick="viewUser('${user.id}')" class="btn-action btn-view">Ver</button>
                                <button onclick="editUser('${user.id}')" class="btn-action btn-edit">Editar</button>
                                <button onclick="toggleUserStatus('${user.id}')" class="btn-action btn-toggle">
                                    ${user.is_active ? 'Desativar' : 'Ativar'}
                                </button>
                                <button onclick="deleteUser('${user.id}', '${escapeHtml(user.name)}')" class="btn-action btn-delete">Excluir</button>
                            </div>
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
    
    container.innerHTML = html;
}

function renderLoginAttempts() {
    const container = document.getElementById('attemptsContainer');
    
    if (loginAttempts.length === 0) {
        container.innerHTML = `
            <div class="empty-message">
                <p>Nenhuma tentativa de login registrada</p>
            </div>
        `;
        return;
    }
    
    const html = `
        <table class="attempts-table">
            <thead>
                <tr>
                    <th>Data/Hora</th>
                    <th>Usuário</th>
                    <th>IP</th>
                    <th>Status</th>
                    <th>Motivo</th>
                </tr>
            </thead>
            <tbody>
                ${loginAttempts.map(attempt => `
                    <tr>
                        <td>${formatDateTime(attempt.timestamp)}</td>
                        <td>@${escapeHtml(attempt.username)}</td>
                        <td>${escapeHtml(attempt.ip_address)}</td>
                        <td>
                            <span class="status-badge ${attempt.success ? 'success' : 'failed'}">
                                ${attempt.success ? 'Sucesso' : 'Falhou'}
                            </span>
                        </td>
                        <td>${attempt.failure_reason ? escapeHtml(attempt.failure_reason) : '-'}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
    
    container.innerHTML = html;
}

function renderAuthorizedDevices() {
    const container = document.getElementById('devicesContainer');
    
    if (authorizedDevices.length === 0) {
        container.innerHTML = `
            <div class="empty-message">
                <p>Nenhum dispositivo autorizado</p>
            </div>
        `;
        return;
    }
    
    const html = `
        <table class="devices-table">
            <thead>
                <tr>
                    <th>Data/Hora</th>
                    <th>Usuário</th>
                    <th>IP</th>
                    <th>Dispositivo</th>
                    <th>User Agent</th>
                    <th>Ações</th>
                </tr>
            </thead>
            <tbody>
                ${authorizedDevices.map(device => `
                    <tr>
                        <td>${formatDateTime(device.timestamp)}</td>
                        <td>@${escapeHtml(device.username)}</td>
                        <td>${escapeHtml(device.ip_address)}</td>
                        <td>${escapeHtml(device.device_name)}</td>
                        <td style="max-width: 300px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                            ${escapeHtml(device.user_agent)}
                        </td>
                        <td>
                            <button onclick="removeDevice('${device.id}')" class="btn-action btn-delete">Remover</button>
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
    
    container.innerHTML = html;
}

function updateDashboard(stats) {
    document.getElementById('statTotal').textContent = stats.total_users || 0;
    document.getElementById('statAtivos').textContent = stats.active_users || 0;
    document.getElementById('statInativos').textContent = stats.inactive_users || 0;
    document.getElementById('statAdmins').textContent = stats.admin_users || 0;
}

// ============================================
// FILTROS
// ============================================

function updateFilters() {
    // Filtros já estão no HTML como estáticos
}

function filterUsers() {
    const searchTerm = document.getElementById('search').value.toLowerCase();
    const filterStatus = document.getElementById('filterStatus').value;
    const filterAdmin = document.getElementById('filterAdmin').value;
    
    const filteredUsers = users.filter(user => {
        const matchesSearch = 
            user.name.toLowerCase().includes(searchTerm) ||
            user.username.toLowerCase().includes(searchTerm);
        
        const matchesStatus = 
            filterStatus === '' || 
            user.is_active.toString() === filterStatus;
        
        const matchesAdmin = 
            filterAdmin === '' || 
            user.is_admin.toString() === filterAdmin;
        
        return matchesSearch && matchesStatus && matchesAdmin;
    });
    
    // Renderizar usuários filtrados
    const container = document.getElementById('usersContainer');
    
    if (filteredUsers.length === 0) {
        container.innerHTML = `
            <div class="empty-message">
                <p>Nenhum usuário encontrado com os filtros selecionados</p>
            </div>
        `;
        return;
    }
    
    const html = `
        <table class="user-table">
            <thead>
                <tr>
                    <th>Nome</th>
                    <th>Username</th>
                    <th>Status</th>
                    <th>Tipo</th>
                    <th>Criado em</th>
                    <th>Ações</th>
                </tr>
            </thead>
            <tbody>
                ${filteredUsers.map(user => `
                    <tr>
                        <td class="user-name">${escapeHtml(user.name)}</td>
                        <td class="user-username">@${escapeHtml(user.username)}</td>
                        <td>
                            <span class="status-badge ${user.is_active ? 'active' : 'inactive'}">
                                ${user.is_active ? 'Ativo' : 'Inativo'}
                            </span>
                        </td>
                        <td>
                            ${user.is_admin ? '<span class="status-badge admin">Admin</span>' : 'Usuário'}
                        </td>
                        <td>${formatDate(user.created_at)}</td>
                        <td>
                            <div class="user-actions">
                                <button onclick="viewUser('${user.id}')" class="btn-action btn-view">Ver</button>
                                <button onclick="editUser('${user.id}')" class="btn-action btn-edit">Editar</button>
                                <button onclick="toggleUserStatus('${user.id}')" class="btn-action btn-toggle">
                                    ${user.is_active ? 'Desativar' : 'Ativar'}
                                </button>
                                <button onclick="deleteUser('${user.id}', '${escapeHtml(user.name)}')" class="btn-action btn-delete">Excluir</button>
                            </div>
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
    
    container.innerHTML = html;
}

// ============================================
// ABAS
// ============================================

function switchTab(tabName) {
    // Remover classe active de todas as abas
    document.querySelectorAll('.tab-button').forEach(btn => {
        btn.classList.remove('active');
    });
    
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    
    // Ativar aba selecionada
    event.target.classList.add('active');
    
    if (tabName === 'usuarios') {
        document.getElementById('tabUsuarios').classList.add('active');
    } else if (tabName === 'tentativas') {
        document.getElementById('tabTentativas').classList.add('active');
    } else if (tabName === 'dispositivos') {
        document.getElementById('tabDispositivos').classList.add('active');
    }
}

// ============================================
// CRUD DE USUÁRIOS
// ============================================

function toggleForm() {
    // Fechar outros modais primeiro
    closeViewModal();
    
    editingUserId = null;
    document.getElementById('formTitle').textContent = 'Novo Usuário';
    document.getElementById('userForm').reset();
    document.getElementById('password').required = true;
    document.getElementById('passwordHint').textContent = 'Mínimo 6 caracteres';
    document.getElementById('modalForm').style.display = 'flex';
}

function closeForm() {
    document.getElementById('modalForm').style.display = 'none';
    editingUserId = null;
}

function editUser(id) {
    const user = users.find(u => u.id === id);
    if (!user) return;
    
    editingUserId = id;
    document.getElementById('formTitle').textContent = 'Editar Usuário';
    document.getElementById('name').value = user.name;
    document.getElementById('username').value = user.username;
    document.getElementById('password').value = '';
    document.getElementById('password').required = false;
    document.getElementById('passwordHint').textContent = 'Deixe em branco para manter a senha atual';
    document.getElementById('is_admin').checked = user.is_admin;
    document.getElementById('is_active').checked = user.is_active;
    
    document.getElementById('modalForm').style.display = 'flex';
}

async function handleSubmit(event) {
    event.preventDefault();
    
    const formData = {
        name: document.getElementById('name').value.trim(),
        username: document.getElementById('username').value.trim().toLowerCase(),
        password: document.getElementById('password').value,
        is_admin: document.getElementById('is_admin').checked,
        is_active: document.getElementById('is_active').checked
    };
    
    try {
        let response;
        
        if (editingUserId) {
            // Atualizar usuário existente
            response = await fetch(`${API_URL}/users/${editingUserId}`, {
                method: 'PUT',
                headers: { 
                    'Content-Type': 'application/json',
                    'x-session-token': sessionToken
                },
                body: JSON.stringify(formData)
            });
        } else {
            // Criar novo usuário
            response = await fetch(`${API_URL}/users`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'x-session-token': sessionToken
                },
                body: JSON.stringify(formData)
            });
        }
        
        const result = await response.json();
        
        if (result.success) {
            alert(result.message);
            closeForm();
            await loadAllData();
        } else {
            alert('Erro: ' + result.error);
        }
    } catch (error) {
        console.error('Erro ao salvar usuário:', error);
        alert('Erro ao salvar usuário');
    }
}

async function deleteUser(id, name) {
    if (!confirm(`Tem certeza que deseja excluir o usuário "${name}"?\n\nEsta ação não pode ser desfeita.`)) {
        return;
    }
    
    try {
        const response = await fetch(`${API_URL}/users/${id}`, {
            method: 'DELETE',
            headers: {
                'x-session-token': sessionToken
            }
        });
        
        const result = await response.json();
        
        if (result.success) {
            alert(result.message);
            await loadAllData();
        } else {
            alert('Erro: ' + result.error);
        }
    } catch (error) {
        console.error('Erro ao deletar usuário:', error);
        alert('Erro ao deletar usuário');
    }
}

async function toggleUserStatus(id) {
    try {
        const response = await fetch(`${API_URL}/users/${id}/toggle-status`, {
            method: 'PATCH',
            headers: {
                'x-session-token': sessionToken
            }
        });
        
        const result = await response.json();
        
        if (result.success) {
            alert(result.message);
            await loadAllData();
        } else {
            alert('Erro: ' + result.error);
        }
    } catch (error) {
        console.error('Erro ao alterar status:', error);
        alert('Erro ao alterar status');
    }
}

function viewUser(id) {
    const user = users.find(u => u.id === id);
    if (!user) return;
    
    const html = `
        <div class="user-detail-grid">
            <div class="user-detail-item">
                <strong>Nome Completo</strong>
                <span>${escapeHtml(user.name)}</span>
            </div>
            <div class="user-detail-item">
                <strong>Username</strong>
                <span>@${escapeHtml(user.username)}</span>
            </div>
            <div class="user-detail-item">
                <strong>Status</strong>
                <span class="status-badge ${user.is_active ? 'active' : 'inactive'}">
                    ${user.is_active ? 'Ativo' : 'Inativo'}
                </span>
            </div>
            <div class="user-detail-item">
                <strong>Tipo</strong>
                <span>${user.is_admin ? '<span class="status-badge admin">Administrador</span>' : 'Usuário'}</span>
            </div>
            <div class="user-detail-item">
                <strong>Criado em</strong>
                <span>${formatDateTime(user.created_at)}</span>
            </div>
            <div class="user-detail-item">
                <strong>Atualizado em</strong>
                <span>${formatDateTime(user.updated_at)}</span>
            </div>
        </div>
    `;
    
    document.getElementById('userDetails').innerHTML = html;
    document.getElementById('modalView').style.display = 'flex';
}

function closeViewModal() {
    document.getElementById('modalView').style.display = 'none';
}

// ============================================
// DISPOSITIVOS
// ============================================

async function removeDevice(id) {
    if (!confirm('Tem certeza que deseja remover este dispositivo?')) {
        return;
    }
    
    try {
        const response = await fetch(`${API_URL}/authorized-devices/${id}`, {
            method: 'DELETE',
            headers: {
                'x-session-token': sessionToken
            }
        });
        
        const result = await response.json();
        
        if (result.success) {
            alert(result.message);
            await loadAuthorizedDevices();
        } else {
            alert('Erro: ' + result.error);
        }
    } catch (error) {
        console.error('Erro ao remover dispositivo:', error);
        alert('Erro ao remover dispositivo');
    }
}

// ============================================
// FUNÇÕES AUXILIARES
// ============================================

function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
}

function formatDate(dateString) {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR');
}

function formatDateTime(dateString) {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR') + ' ' + date.toLocaleTimeString('pt-BR');
}

// Fechar modais ao clicar fora
window.onclick = function(event) {
    const modalForm = document.getElementById('modalForm');
    const modalView = document.getElementById('modalView');
    
    if (event.target === modalForm) {
        closeForm();
    }
    
    if (event.target === modalView) {
        closeViewModal();
    }
};
