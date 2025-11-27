// ============================================
// CONFIGURAÇÃO
// ============================================

const PORTAL_URL = 'https://ir-comercio-portal-zcan.onrender.com';
const API_URL = '/api';

let users = [];
let isOnline = false;
let editingUserId = null;
let sessionToken = null;

// ============================================
// INICIALIZAÇÃO
// ============================================

document.addEventListener('DOMContentLoaded', async () => {
    console.log('Sistema de Gerenciamento de Usuários iniciado');
    
    // Verificar autenticação
    if (!verificarAutenticacao()) {
        return;
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
// AUTENTICAÇÃO
// ============================================

function verificarAutenticacao() {
    // Verificar token na URL
    const urlParams = new URLSearchParams(window.location.search);
    const tokenFromUrl = urlParams.get('sessionToken');

    if (tokenFromUrl) {
        sessionToken = tokenFromUrl;
        sessionStorage.setItem('usuariosSession', tokenFromUrl);
        window.history.replaceState({}, document.title, window.location.pathname);
        console.log('✅ Autenticado via URL');
        return true;
    }

    // Verificar sessionStorage
    sessionToken = sessionStorage.getItem('usuariosSession');
    
    if (sessionToken) {
        console.log('✅ Autenticado via sessionStorage');
        return true;
    }

    // Sem token = bloquear
    console.log('❌ Não autenticado');
    mostrarTelaAcessoNegado();
    return false;
}

function mostrarTelaAcessoNegado() {
    document.getElementById('splashScreen').style.display = 'none';
    document.querySelector('.app-content').style.display = 'none';
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
        const response = await fetch(`${API_URL}/users`, {
            headers: { 'x-session-token': sessionToken }
        });
        
        if (response.ok) {
            isOnline = true;
            document.getElementById('connectionStatus').className = 'connection-status online';
        } else {
            throw new Error('Servidor offline');
        }
    } catch (error) {
        isOnline = false;
        document.getElementById('connectionStatus').className = 'connection-status offline';
    }
}

// ============================================
// CARREGAMENTO DE DADOS
// ============================================

async function loadAllData() {
    await loadUsers();
    await loadDashboard();
}

async function loadUsers() {
    try {
        const response = await fetch(`${API_URL}/users`, {
            headers: { 'x-session-token': sessionToken }
        });
        const data = await response.json();
        
        if (data.success) {
            users = data.data;
            renderUsers();
        } else if (data.error === 'Não autenticado') {
            mostrarTelaAcessoNegado();
        }
    } catch (error) {
        console.error('Erro ao carregar usuários:', error);
    }
}

async function loadDashboard() {
    try {
        const response = await fetch(`${API_URL}/dashboard`, {
            headers: { 'x-session-token': sessionToken }
        });
        const data = await response.json();
        
        if (data.success) {
            updateDashboard(data.data);
        }
    } catch (error) {
        console.error('Erro ao carregar dashboard:', error);
    }
}

function updateDashboard(stats) {
    document.getElementById('statTotal').textContent = stats.total_users || 0;
    document.getElementById('statAtivos').textContent = stats.active_users || 0;
    document.getElementById('statInativos').textContent = stats.inactive_users || 0;
    document.getElementById('statAdmins').textContent = stats.admin_users || 0;
}

// ============================================
// RENDERIZAÇÃO DE USUÁRIOS
// ============================================

function renderUsers() {
    const container = document.getElementById('usersContainer');
    
    if (users.length === 0) {
        container.innerHTML = '<div class="empty-message">Nenhum usuário cadastrado</div>';
        return;
    }
    
    const html = `
        <table class="users-table">
            <thead>
                <tr>
                    <th>Nome</th>
                    <th>Usuário</th>
                    <th>Status</th>
                    <th>Tipo</th>
                    <th>Criado em</th>
                    <th>Ações</th>
                </tr>
            </thead>
            <tbody>
                ${users.map(user => `
                    <tr>
                        <td>${escapeHtml(user.name)}</td>
                        <td>${escapeHtml(user.username)}</td>
                        <td><span class="badge ${user.is_active ? 'ativo' : 'inativo'}">${user.is_active ? 'Ativo' : 'Inativo'}</span></td>
                        <td><span class="badge ${user.is_admin ? 'admin' : ''}">${user.is_admin ? 'Admin' : 'Usuário'}</span></td>
                        <td>${formatDate(user.created_at)}</td>
                        <td>
                            <div class="user-actions">
                                <button class="btn-view" onclick="viewUser('${user.id}')">Ver</button>
                                <button class="btn-edit" onclick="editUser('${user.id}')">Editar</button>
                                <button class="btn-toggle" onclick="toggleUserStatus('${user.id}')">${user.is_active ? 'Desativar' : 'Ativar'}</button>
                                <button class="btn-delete" onclick="deleteUser('${user.id}', '${escapeHtml(user.name)}')">Excluir</button>
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
// FILTROS
// ============================================

function filterUsers() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    const filterStatus = document.getElementById('filterStatus').value;
    const filterAdmin = document.getElementById('filterAdmin').value;
    
    const filtered = users.filter(user => {
        const matchSearch = user.name.toLowerCase().includes(searchTerm) || 
                          user.username.toLowerCase().includes(searchTerm);
        
        const matchStatus = filterStatus === 'all' || 
                          (filterStatus === 'active' && user.is_active) ||
                          (filterStatus === 'inactive' && !user.is_active);
        
        const matchAdmin = filterAdmin === 'all' ||
                         (filterAdmin === 'admin' && user.is_admin) ||
                         (filterAdmin === 'user' && !user.is_admin);
        
        return matchSearch && matchStatus && matchAdmin;
    });
    
    // Renderizar com usuários filtrados
    const container = document.getElementById('usersContainer');
    
    if (filtered.length === 0) {
        container.innerHTML = '<div class="empty-message">Nenhum usuário encontrado</div>';
        return;
    }
    
    const html = `
        <table class="users-table">
            <thead>
                <tr>
                    <th>Nome</th>
                    <th>Usuário</th>
                    <th>Status</th>
                    <th>Tipo</th>
                    <th>Criado em</th>
                    <th>Ações</th>
                </tr>
            </thead>
            <tbody>
                ${filtered.map(user => `
                    <tr>
                        <td>${escapeHtml(user.name)}</td>
                        <td>${escapeHtml(user.username)}</td>
                        <td><span class="badge ${user.is_active ? 'ativo' : 'inativo'}">${user.is_active ? 'Ativo' : 'Inativo'}</span></td>
                        <td><span class="badge ${user.is_admin ? 'admin' : ''}">${user.is_admin ? 'Admin' : 'Usuário'}</span></td>
                        <td>${formatDate(user.created_at)}</td>
                        <td>
                            <div class="user-actions">
                                <button class="btn-view" onclick="viewUser('${user.id}')">Ver</button>
                                <button class="btn-edit" onclick="editUser('${user.id}')">Editar</button>
                                <button class="btn-toggle" onclick="toggleUserStatus('${user.id}')">${user.is_active ? 'Desativar' : 'Ativar'}</button>
                                <button class="btn-delete" onclick="deleteUser('${user.id}', '${escapeHtml(user.name)}')">Excluir</button>
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
// CRUD DE USUÁRIOS
// ============================================

function toggleForm() {
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
            response = await fetch(`${API_URL}/users/${editingUserId}`, {
                method: 'PUT',
                headers: { 
                    'Content-Type': 'application/json',
                    'x-session-token': sessionToken
                },
                body: JSON.stringify(formData)
            });
        } else {
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

async function deleteUser(id, name) {
    if (!confirm(`Tem certeza que deseja excluir o usuário "${name}"?\n\nEsta ação não pode ser desfeita.`)) {
        return;
    }
    
    try {
        const response = await fetch(`${API_URL}/users/${id}`, {
            method: 'DELETE',
            headers: { 'x-session-token': sessionToken }
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
            headers: { 'x-session-token': sessionToken }
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
        <div class="user-details">
            <div class="detail-item">
                <label>Nome Completo</label>
                <div class="value">${escapeHtml(user.name)}</div>
            </div>
            <div class="detail-item">
                <label>Nome de Usuário</label>
                <div class="value">${escapeHtml(user.username)}</div>
            </div>
            <div class="detail-item">
                <label>Status</label>
                <div class="value"><span class="badge ${user.is_active ? 'ativo' : 'inativo'}">${user.is_active ? 'Ativo' : 'Inativo'}</span></div>
            </div>
            <div class="detail-item">
                <label>Tipo</label>
                <div class="value"><span class="badge ${user.is_admin ? 'admin' : ''}">${user.is_admin ? 'Administrador' : 'Usuário'}</span></div>
            </div>
            <div class="detail-item">
                <label>Criado em</label>
                <div class="value">${formatDate(user.created_at)}</div>
            </div>
            <div class="detail-item">
                <label>Atualizado em</label>
                <div class="value">${formatDate(user.updated_at)}</div>
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
// FUNÇÕES AUXILIARES
// ============================================

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatDate(dateString) {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR');
}
