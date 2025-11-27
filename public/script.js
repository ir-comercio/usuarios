// ============================================
// GERENCIAMENTO DE USUÁRIOS - FRONTEND
// ============================================

// Configuração da API
const API_BASE_URL = window.location.origin;

// Estado da aplicação
let allUsers = [];
let currentFilter = {
    search: '',
    status: 'all',
    type: 'all'
};

// ============================================
// INICIALIZAÇÃO
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 Gerenciamento de Usuários Iniciado');
    console.log('📡 Servidor ONLINE');
    
    // Verificar sessão
    checkSession();
    
    // Carregar usuários
    loadUsers();
    
    // Event listeners
    setupEventListeners();
});

// ============================================
// VERIFICAÇÃO DE SESSÃO
// ============================================

async function checkSession() {
    const sessionToken = localStorage.getItem('sessionToken');
    
    if (!sessionToken) {
        console.warn('⚠️ Nenhuma sessão encontrada');
        return;
    }
    
    console.log('✅ Token de sessão encontrado');
}

// ============================================
// EVENT LISTENERS
// ============================================

function setupEventListeners() {
    // Botão novo usuário
    const newUserBtn = document.getElementById('newUserBtn');
    if (newUserBtn) {
        newUserBtn.addEventListener('click', showNewUserModal);
    }
    
    // Filtros
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            currentFilter.search = e.target.value;
            filterUsers();
        });
    }
    
    const statusFilter = document.getElementById('statusFilter');
    if (statusFilter) {
        statusFilter.addEventListener('change', (e) => {
            currentFilter.status = e.target.value;
            filterUsers();
        });
    }
    
    const typeFilter = document.getElementById('typeFilter');
    if (typeFilter) {
        typeFilter.addEventListener('change', (e) => {
            currentFilter.type = e.target.value;
            filterUsers();
        });
    }
    
    // Modal
    const modal = document.getElementById('userModal');
    const closeBtn = document.querySelector('.close-modal');
    const cancelBtn = document.getElementById('cancelBtn');
    
    if (closeBtn) {
        closeBtn.addEventListener('click', closeModal);
    }
    
    if (cancelBtn) {
        cancelBtn.addEventListener('click', closeModal);
    }
    
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeModal();
            }
        });
    }
    
    // Formulário
    const userForm = document.getElementById('userForm');
    if (userForm) {
        userForm.addEventListener('submit', handleFormSubmit);
    }
}

// ============================================
// CARREGAR USUÁRIOS
// ============================================

async function loadUsers() {
    try {
        console.log('📥 Carregando usuários...');
        
        const sessionToken = localStorage.getItem('sessionToken');
        
        const response = await fetch(`${API_BASE_URL}/api/users`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'X-Session-Token': sessionToken || ''
            }
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const result = await response.json();
        
        if (result.success) {
            allUsers = result.data;
            console.log(`✅ ${allUsers.length} usuários carregados`);
            updateStatistics();
            renderUsers(allUsers);
        } else {
            throw new Error(result.error || 'Erro ao carregar usuários');
        }
        
    } catch (error) {
        console.error('❌ Erro ao carregar usuários:', error);
        showNotification('Erro ao carregar usuários: ' + error.message, 'error');
    }
}

// ============================================
// RENDERIZAR USUÁRIOS
// ============================================

function renderUsers(users) {
    const container = document.getElementById('usersContainer');
    
    if (!container) {
        console.error('❌ Container de usuários não encontrado');
        return;
    }
    
    if (users.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 3rem; color: #666;">
                <p style="font-size: 1.2rem; margin-bottom: 0.5rem;">📋 Nenhum usuário encontrado</p>
                <p style="font-size: 0.9rem;">Clique em "Novo Usuário" para adicionar</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = users.map(user => `
        <div class="user-card">
            <div class="user-header">
                <div class="user-avatar">
                    ${user.name.charAt(0).toUpperCase()}
                </div>
                <div class="user-info">
                    <h3>${user.name}</h3>
                    <p>@${user.username}</p>
                </div>
                <div class="user-badges">
                    ${user.is_admin ? '<span class="badge badge-admin">Admin</span>' : '<span class="badge badge-user">Usuário</span>'}
                    ${user.is_active ? '<span class="badge badge-active">Ativo</span>' : '<span class="badge badge-inactive">Inativo</span>'}
                </div>
            </div>
            
            <div class="user-meta">
                <div class="meta-item">
                    <span class="meta-label">ID:</span>
                    <span class="meta-value">${user.id}</span>
                </div>
                <div class="meta-item">
                    <span class="meta-label">Criado em:</span>
                    <span class="meta-value">${formatDate(user.created_at)}</span>
                </div>
            </div>
            
            <div class="user-actions">
                <button onclick="editUser('${user.id}')" class="btn-action btn-edit">
                    ✏️ Editar
                </button>
                <button onclick="toggleUserStatus('${user.id}', ${user.is_active})" class="btn-action ${user.is_active ? 'btn-deactivate' : 'btn-activate'}">
                    ${user.is_active ? '🚫 Desativar' : '✅ Ativar'}
                </button>
                <button onclick="deleteUser('${user.id}', '${user.username}')" class="btn-action btn-delete">
                    🗑️ Remover
                </button>
            </div>
        </div>
    `).join('');
}

// ============================================
// ATUALIZAR ESTATÍSTICAS
// ============================================

function updateStatistics() {
    document.getElementById('totalUsers').textContent = allUsers.length;
    document.getElementById('activeUsers').textContent = allUsers.filter(u => u.is_active).length;
    document.getElementById('inactiveUsers').textContent = allUsers.filter(u => !u.is_active).length;
    document.getElementById('adminUsers').textContent = allUsers.filter(u => u.is_admin).length;
}

// ============================================
// FILTRAR USUÁRIOS
// ============================================

function filterUsers() {
    let filtered = [...allUsers];
    
    // Filtro de busca
    if (currentFilter.search) {
        const search = currentFilter.search.toLowerCase();
        filtered = filtered.filter(user => 
            user.name.toLowerCase().includes(search) ||
            user.username.toLowerCase().includes(search)
        );
    }
    
    // Filtro de status
    if (currentFilter.status !== 'all') {
        const isActive = currentFilter.status === 'active';
        filtered = filtered.filter(user => user.is_active === isActive);
    }
    
    // Filtro de tipo
    if (currentFilter.type !== 'all') {
        const isAdmin = currentFilter.type === 'admin';
        filtered = filtered.filter(user => user.is_admin === isAdmin);
    }
    
    renderUsers(filtered);
}

// ============================================
// MODAL
// ============================================

function showNewUserModal() {
    document.getElementById('modalTitle').textContent = 'Novo Usuário';
    document.getElementById('userId').value = '';
    document.getElementById('userForm').reset();
    document.getElementById('userModal').style.display = 'flex';
}

async function editUser(userId) {
    try {
        const sessionToken = localStorage.getItem('sessionToken');
        
        const response = await fetch(`${API_BASE_URL}/api/users/${userId}`, {
            headers: {
                'X-Session-Token': sessionToken || ''
            }
        });
        
        if (!response.ok) {
            throw new Error('Erro ao carregar usuário');
        }
        
        const result = await response.json();
        const user = result.data;
        
        document.getElementById('modalTitle').textContent = 'Editar Usuário';
        document.getElementById('userId').value = user.id;
        document.getElementById('username').value = user.username;
        document.getElementById('name').value = user.name;
        document.getElementById('password').value = '';
        document.getElementById('isAdmin').checked = user.is_admin;
        document.getElementById('isActive').checked = user.is_active;
        
        document.getElementById('userModal').style.display = 'flex';
        
    } catch (error) {
        console.error('❌ Erro ao carregar usuário:', error);
        showNotification('Erro ao carregar usuário', 'error');
    }
}

function closeModal() {
    document.getElementById('userModal').style.display = 'none';
    document.getElementById('userForm').reset();
}

// ============================================
// SALVAR USUÁRIO
// ============================================

async function handleFormSubmit(e) {
    e.preventDefault();
    
    const userId = document.getElementById('userId').value;
    const formData = {
        username: document.getElementById('username').value,
        password: document.getElementById('password').value,
        name: document.getElementById('name').value,
        is_admin: document.getElementById('isAdmin').checked,
        is_active: document.getElementById('isActive').checked
    };
    
    try {
        const sessionToken = localStorage.getItem('sessionToken');
        
        let url, method;
        if (userId) {
            url = `${API_BASE_URL}/api/users/${userId}`;
            method = 'PUT';
            // Se senha estiver vazia, não enviar
            if (!formData.password) {
                delete formData.password;
            }
        } else {
            url = `${API_BASE_URL}/api/users`;
            method = 'POST';
        }
        
        const response = await fetch(url, {
            method,
            headers: {
                'Content-Type': 'application/json',
                'X-Session-Token': sessionToken || ''
            },
            body: JSON.stringify(formData)
        });
        
        const result = await response.json();
        
        if (result.success) {
            showNotification(result.message || 'Operação realizada com sucesso!', 'success');
            closeModal();
            loadUsers();
        } else {
            throw new Error(result.error || 'Erro ao salvar usuário');
        }
        
    } catch (error) {
        console.error('❌ Erro ao salvar usuário:', error);
        showNotification('Erro: ' + error.message, 'error');
    }
}

// ============================================
// ALTERNAR STATUS
// ============================================

async function toggleUserStatus(userId, currentStatus) {
    const action = currentStatus ? 'desativar' : 'ativar';
    
    if (!confirm(`Tem certeza que deseja ${action} este usuário?`)) {
        return;
    }
    
    try {
        const sessionToken = localStorage.getItem('sessionToken');
        
        const response = await fetch(`${API_BASE_URL}/api/users/${userId}/toggle-status`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'X-Session-Token': sessionToken || ''
            }
        });
        
        const result = await response.json();
        
        if (result.success) {
            showNotification(result.message, 'success');
            loadUsers();
        } else {
            throw new Error(result.error || 'Erro ao alterar status');
        }
        
    } catch (error) {
        console.error('❌ Erro ao alterar status:', error);
        showNotification('Erro: ' + error.message, 'error');
    }
}

// ============================================
// DELETAR USUÁRIO
// ============================================

async function deleteUser(userId, username) {
    if (!confirm(`Tem certeza que deseja REMOVER o usuário "${username}"?\n\nEsta ação não pode ser desfeita!`)) {
        return;
    }
    
    try {
        const sessionToken = localStorage.getItem('sessionToken');
        
        const response = await fetch(`${API_BASE_URL}/api/users/${userId}`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
                'X-Session-Token': sessionToken || ''
            }
        });
        
        const result = await response.json();
        
        if (result.success) {
            showNotification(result.message, 'success');
            loadUsers();
        } else {
            throw new Error(result.error || 'Erro ao remover usuário');
        }
        
    } catch (error) {
        console.error('❌ Erro ao remover usuário:', error);
        showNotification('Erro: ' + error.message, 'error');
    }
}

// ============================================
// UTILITÁRIOS
// ============================================

function formatDate(dateString) {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR') + ' ' + date.toLocaleTimeString('pt-BR');
}

function showNotification(message, type = 'info') {
    // Criar elemento de notificação
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    
    // Adicionar ao body
    document.body.appendChild(notification);
    
    // Remover após 3 segundos
    setTimeout(() => {
        notification.style.opacity = '0';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// ============================================
// EXPOR FUNÇÕES GLOBALMENTE
// ============================================

window.editUser = editUser;
window.toggleUserStatus = toggleUserStatus;
window.deleteUser = deleteUser;
