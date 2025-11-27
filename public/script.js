// CONFIGURAÇÃO
const PORTAL_URL = 'https://ir-comercio-portal-zcan.onrender.com';
const API_URL = '/api';

let users = [];
let isOnline = false;
let lastDataHash = '';
let sessionToken = null;

// LOG APENAS NO INÍCIO
console.log('🚀 Gerenciamento de Usuários iniciado');

document.addEventListener('DOMContentLoaded', () => {
    verificarAutenticacao();
});

function verificarAutenticacao() {
    const urlParams = new URLSearchParams(window.location.search);
    const tokenFromUrl = urlParams.get('sessionToken');

    if (tokenFromUrl) {
        sessionToken = tokenFromUrl;
        sessionStorage.setItem('usuariosSession', tokenFromUrl);
        window.history.replaceState({}, document.title, window.location.pathname);
    } else {
        sessionToken = sessionStorage.getItem('usuariosSession');
    }

    if (!sessionToken) {
        mostrarTelaAcessoNegado();
        return;
    }

    inicializarApp();
}

function mostrarTelaAcessoNegado(mensagem = 'NÃO AUTORIZADO') {
    document.body.innerHTML = `
        <div style="
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            height: 100vh;
            background: var(--bg-primary);
            color: var(--text-primary);
            text-align: center;
            padding: 2rem;
        ">
            
            <h1 style="font-size: 2.2rem; margin-bottom: 1rem;">
                ${mensagem}
            </h1>

            <p style="color: var(--text-secondary); margin-bottom: 2rem;">
                Somente usuários autenticados podem acessar esta área.
            </p>

            <a href="${PORTAL_URL}" style="
                display: inline-block;
                background: var(--btn-register);
                color: white;
                padding: 14px 32px;
                border-radius: 8px;
                text-decoration: none;
                font-weight: 600;
            ">Ir para o Portal</a>
        </div>
    `;
}

function inicializarApp() {
    checkServerStatus();
    setInterval(checkServerStatus, 15000);
    startPolling();
}

window.toggleForm = function() {
    showFormModal(null);
};

async function checkServerStatus() {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        const response = await fetch(`${API_URL}/users`, {
            method: 'HEAD',
            headers: { 'X-Session-Token': sessionToken },
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);

        if (response.status === 401) {
            sessionStorage.removeItem('usuariosSession');
            mostrarTelaAcessoNegado('Sua sessão expirou');
            return false;
        }

        const wasOffline = !isOnline;
        isOnline = response.ok;
        
        if (wasOffline && isOnline) {
            console.log('✅ Servidor ONLINE');
            await loadUsers();
        } else if (!wasOffline && !isOnline) {
            console.log('❌ Servidor OFFLINE');
        }
        
        updateConnectionStatus();
        return isOnline;
    } catch (error) {
        if (isOnline) {
            console.log('❌ Erro de conexão:', error.message);
        }
        isOnline = false;
        updateConnectionStatus();
        return false;
    }
}

function updateConnectionStatus() {
    const statusElement = document.getElementById('connectionStatus');
    if (statusElement) {
        statusElement.className = isOnline ? 'connection-status online' : 'connection-status offline';
    }
}

async function loadUsers() {
    if (!isOnline) return;

    try {
        const response = await fetch(`${API_URL}/users`, {
            headers: { 'X-Session-Token': sessionToken }
        });

        if (response.status === 401) {
            sessionStorage.removeItem('usuariosSession');
            mostrarTelaAcessoNegado('Sua sessão expirou');
            return;
        }

        if (!response.ok) return;

        const data = await response.json();
        
        if (data.success) {
            const newHash = JSON.stringify(data.data.map(u => u.id));

            if (newHash !== lastDataHash) {
                users = data.data;
                lastDataHash = newHash;
                console.log(`📊 ${users.length} usuários carregados`);
                renderUsers();
                updateDashboard();
            }
        }
    } catch (error) {
        // Silencioso
    }
}

function startPolling() {
    loadUsers();
    setInterval(() => {
        if (isOnline) loadUsers();
    }, 10000);
}

function updateDashboard() {
    const total = users.length;
    const ativos = users.filter(u => u.is_active).length;
    const inativos = total - ativos;
    const admins = users.filter(u => u.is_admin).length;
    
    document.getElementById('statTotal').textContent = total;
    document.getElementById('statAtivos').textContent = ativos;
    document.getElementById('statInativos').textContent = inativos;
    document.getElementById('statAdmins').textContent = admins;
}

function filterUsers() {
    const searchTerm = document.getElementById('search').value.toLowerCase();
    const filterStatus = document.getElementById('filterStatus').value;
    const filterAdmin = document.getElementById('filterAdmin').value;
    
    let filtered = users;

    if (filterStatus !== 'all') {
        filtered = filtered.filter(u => {
            if (filterStatus === 'active') return u.is_active;
            if (filterStatus === 'inactive') return !u.is_active;
            return true;
        });
    }

    if (filterAdmin !== 'all') {
        filtered = filtered.filter(u => {
            if (filterAdmin === 'admin') return u.is_admin;
            if (filterAdmin === 'user') return !u.is_admin;
            return true;
        });
    }

    if (searchTerm) {
        filtered = filtered.filter(u => 
            u.name.toLowerCase().includes(searchTerm) ||
            u.username.toLowerCase().includes(searchTerm)
        );
    }

    filtered.sort((a, b) => a.name.localeCompare(b.name));
    renderUsers(filtered);
}

function getTimeAgo(timestamp) {
    if (!timestamp) return 'Sem data';
    const now = new Date();
    const past = new Date(timestamp);
    const diffInSeconds = Math.floor((now - past) / 1000);
    if (diffInSeconds < 60) return `${diffInSeconds}s`;
    const diffInMinutes = Math.floor(diffInSeconds / 60);
    if (diffInMinutes < 60) return `${diffInMinutes}min`;
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours}h`;
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 7) return `${diffInDays}d`;
    return past.toLocaleDateString('pt-BR');
}

function renderUsers(usersToRender = users) {
    const container = document.getElementById('usersContainer');
    
    if (!usersToRender || usersToRender.length === 0) {
        container.innerHTML = '<div style="text-align: center; padding: 2rem; color: var(--text-secondary);">Nenhum usuário encontrado</div>';
        return;
    }

    const table = `
        <div style="overflow-x: auto;">
            <table>
                <thead>
                    <tr>
                        <th>Nome</th>
                        <th>Usuário</th>
                        <th>Status</th>
                        <th>Tipo</th>
                        <th>Criado</th>
                        <th style="text-align: center;">Ações</th>
                    </tr>
                </thead>
                <tbody>
                    ${usersToRender.map(u => `
                        <tr>
                            <td><strong>${u.name}</strong></td>
                            <td>${u.username}</td>
                            <td><span class="badge ${u.is_active ? 'ativo' : 'inativo'}">${u.is_active ? 'Ativo' : 'Inativo'}</span></td>
                            <td><span class="badge ${u.is_admin ? 'admin' : ''}">${u.is_admin ? 'Admin' : 'Usuário'}</span></td>
                            <td style="color: var(--text-secondary); font-size: 0.85rem;">${getTimeAgo(u.created_at)}</td>
                            <td class="actions-cell" style="text-align: center;">
                                <button onclick="window.viewUser('${u.id}')" class="action-btn view">Ver</button>
                                <button onclick="window.editUser('${u.id}')" class="action-btn edit">Editar</button>
                                <button onclick="window.toggleStatus('${u.id}')" class="action-btn">${u.is_active ? 'Desativar' : 'Ativar'}</button>
                                <button onclick="window.deleteUser('${u.id}')" class="action-btn delete">Excluir</button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
    
    container.innerHTML = table;
}

function showFormModal(editingId = null) {
    const isEditing = editingId !== null;
    const user = isEditing ? users.find(u => u.id === editingId) : null;

    const modalHTML = `
        <div class="modal-overlay" id="formModal">
            <div class="modal-content large">
                <div class="modal-header">
                    <h3 class="modal-title">${isEditing ? 'Editar Usuário' : 'Novo Usuário'}</h3>
                </div>
                <div class="modal-form-content">
                    <form id="modalUserForm">
                        <input type="hidden" id="modalEditId" value="${editingId || ''}">
                        <div class="form-grid">
                            <div class="form-group">
                                <label for="modalName">Nome Completo *</label>
                                <input type="text" id="modalName" value="${user?.name || ''}" required>
                            </div>
                            <div class="form-group">
                                <label for="modalUsername">Nome de Usuário *</label>
                                <input type="text" id="modalUsername" value="${user?.username || ''}" required pattern="[a-z0-9_]+">
                            </div>
                            <div class="form-group">
                                <label for="modalPassword">Senha ${isEditing ? '' : '*'}</label>
                                <input type="password" id="modalPassword" minlength="6" ${isEditing ? '' : 'required'}>
                                <small>${isEditing ? 'Deixe em branco para manter a senha atual' : 'Mínimo 6 caracteres'}</small>
                            </div>
                            <div class="form-group">
                                <label>
                                    <input type="checkbox" id="modalIsAdmin" ${user?.is_admin ? 'checked' : ''}>
                                    Administrador
                                </label>
                            </div>
                            <div class="form-group">
                                <label>
                                    <input type="checkbox" id="modalIsActive" ${user?.is_active !== false ? 'checked' : ''}>
                                    Ativo
                                </label>
                            </div>
                        </div>
                        <div class="modal-actions">
                            <button type="button" class="secondary" id="modalCancelFormBtn">Cancelar</button>
                            <button type="submit" class="save">${isEditing ? 'Atualizar' : 'Salvar'}</button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
    const modal = document.getElementById('formModal');
    const form = document.getElementById('modalUserForm');
    const cancelBtn = document.getElementById('modalCancelFormBtn');

    const closeModal = () => {
        modal.style.animation = 'fadeOut 0.2s ease forwards';
        setTimeout(() => modal.remove(), 200);
    };

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const formData = {
            name: document.getElementById('modalName').value.trim(),
            username: document.getElementById('modalUsername').value.trim().toLowerCase(),
            password: document.getElementById('modalPassword').value,
            is_admin: document.getElementById('modalIsAdmin').checked,
            is_active: document.getElementById('modalIsActive').checked
        };

        const editId = document.getElementById('modalEditId').value;
        
        // Verificar username duplicado
        const usernameDuplicado = users.find(u => u.username.toLowerCase() === formData.username.toLowerCase() && u.id !== editId);
        if (usernameDuplicado) {
            showMessage(`Usuário "${formData.username}" já existe`, 'error');
            return;
        }

        const tempId = editId || 'temp_' + Date.now();
        const optimisticData = { ...formData, id: tempId, created_at: new Date().toISOString() };

        if (editId) {
            const index = users.findIndex(u => u.id === editId);
            if (index !== -1) users[index] = optimisticData;
            showMessage('Atualizado!', 'success');
        } else {
            users.push(optimisticData);
            showMessage('Criado!', 'success');
        }

        renderUsers();
        updateDashboard();
        closeModal();
        syncWithServer(formData, editId, tempId);
    });

    cancelBtn.addEventListener('click', () => {
        showMessage(isEditing ? 'Atualização cancelada' : 'Registro cancelado', 'error');
        closeModal();
    });
    
    setTimeout(() => document.getElementById('modalName').focus(), 100);
}

async function syncWithServer(formData, editId = null, tempId = null) {
    if (!isOnline) return;

    try {
        const url = editId ? `${API_URL}/users/${editId}` : `${API_URL}/users`;
        const method = editId ? 'PUT' : 'POST';

        const response = await fetch(url, { 
            method, 
            headers: { 
                'Content-Type': 'application/json',
                'X-Session-Token': sessionToken
            }, 
            body: JSON.stringify(formData) 
        });

        if (response.status === 401) {
            sessionStorage.removeItem('usuariosSession');
            mostrarTelaAcessoNegado('Sua sessão expirou');
            return;
        }
        
        if (!response.ok) throw new Error(`Erro ${response.status}`);
        
        const result = await response.json();
        const savedData = result.data || result;

        if (editId) {
            const index = users.findIndex(u => u.id === editId);
            if (index !== -1) users[index] = savedData;
        } else {
            const tempIndex = users.findIndex(u => u.id === tempId);
            if (tempIndex !== -1) users[tempIndex] = savedData;
        }

        lastDataHash = JSON.stringify(users.map(u => u.id));
        renderUsers();
        updateDashboard();
    } catch (error) {
        if (!editId) {
            users = users.filter(u => u.id !== tempId);
            renderUsers();
            updateDashboard();
        }
        showMessage('Erro ao salvar', 'error');
    }
}

window.viewUser = function(id) {
    const user = users.find(u => u.id === id);
    if (!user) return;
    
    const modalHTML = `
        <div class="modal-overlay" id="viewModal">
            <div class="modal-content">
                <div class="modal-header">
                    <h3 class="modal-title">Detalhes do Usuário</h3>
                </div>
                <div style="display: grid; gap: 1rem; margin-bottom: 1.5rem;">
                    <div>
                        <strong style="color: var(--text-secondary);">Nome:</strong><br>
                        ${user.name}
                    </div>
                    <div>
                        <strong style="color: var(--text-secondary);">Usuário:</strong><br>
                        ${user.username}
                    </div>
                    <div>
                        <strong style="color: var(--text-secondary);">Status:</strong><br>
                        <span class="badge ${user.is_active ? 'ativo' : 'inativo'}">${user.is_active ? 'Ativo' : 'Inativo'}</span>
                    </div>
                    <div>
                        <strong style="color: var(--text-secondary);">Tipo:</strong><br>
                        <span class="badge ${user.is_admin ? 'admin' : ''}">${user.is_admin ? 'Administrador' : 'Usuário'}</span>
                    </div>
                    <div>
                        <strong style="color: var(--text-secondary);">Criado:</strong><br>
                        ${new Date(user.created_at).toLocaleString('pt-BR')}
                    </div>
                </div>
                <div class="modal-actions">
                    <button onclick="document.getElementById('viewModal').remove()">Fechar</button>
                </div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
};

window.editUser = function(id) {
    showFormModal(id);
};

window.toggleStatus = async function(id) {
    const user = users.find(u => u.id === id);
    if (!user) return;
    
    const action = user.is_active ? 'desativar' : 'ativar';
    const confirmed = await showConfirm(`Tem certeza que deseja ${action} este usuário?`, {
        title: 'Alterar Status',
        confirmText: 'Confirmar',
        type: 'warning'
    });

    if (!confirmed) return;

    const index = users.findIndex(u => u.id === id);
    if (index !== -1) {
        users[index].is_active = !users[index].is_active;
        renderUsers();
        updateDashboard();
        showMessage(user.is_active ? 'Usuário ativado!' : 'Usuário desativado!', 'success');

        if (isOnline) {
            try {
                const response = await fetch(`${API_URL}/users/${id}/toggle-status`, { 
                    method: 'PATCH',
                    headers: { 'X-Session-Token': sessionToken }
                });

                if (!response.ok) throw new Error('Erro ao alterar status');
                
                const result = await response.json();
                if (result.data) {
                    users[index] = result.data;
                    renderUsers();
                    updateDashboard();
                }
            } catch (error) {
                users[index].is_active = !users[index].is_active;
                renderUsers();
                updateDashboard();
                showMessage('Erro ao alterar status', 'error');
            }
        }
    }
};

window.deleteUser = async function(id) {
    const confirmed = await showConfirm('Tem certeza que deseja excluir este usuário?', {
        title: 'Excluir Usuário',
        confirmText: 'Excluir',
        type: 'warning'
    });

    if (!confirmed) return;

    const deletedUser = users.find(u => u.id === id);
    users = users.filter(u => u.id !== id);
    renderUsers();
    updateDashboard();
    showMessage('Excluído!', 'error');

    if (isOnline) {
        try {
            const response = await fetch(`${API_URL}/users/${id}`, { 
                method: 'DELETE',
                headers: { 'X-Session-Token': sessionToken }
            });

            if (response.status === 401) {
                sessionStorage.removeItem('usuariosSession');
                mostrarTelaAcessoNegado('Sua sessão expirou');
                return;
            }

            if (!response.ok) throw new Error('Erro ao deletar');
        } catch (error) {
            if (deletedUser) {
                users.push(deletedUser);
                renderUsers();
                updateDashboard();
                showMessage('Erro ao excluir', 'error');
            }
        }
    }
};

function showConfirm(message, options = {}) {
    return new Promise((resolve) => {
        const { title = 'Confirmação', confirmText = 'Confirmar', cancelText = 'Cancelar', type = 'warning' } = options;

        const modalHTML = `
            <div class="modal-overlay" id="confirmModal">
                <div class="modal-content">
                    <div class="modal-header">
                        <h3 class="modal-title">${title}</h3>
                    </div>
                    <p class="modal-message">${message}</p>
                    <div class="modal-actions">
                        <button class="secondary" id="modalCancelBtn">${cancelText}</button>
                        <button class="${type === 'warning' ? 'danger' : 'success'}" id="modalConfirmBtn">${confirmText}</button>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHTML);
        const modal = document.getElementById('confirmModal');
        const confirmBtn = document.getElementById('modalConfirmBtn');
        const cancelBtn = document.getElementById('modalCancelBtn');

        const closeModal = (result) => {
            modal.style.animation = 'fadeOut 0.2s ease forwards';
            setTimeout(() => { modal.remove(); resolve(result); }, 200);
        };

        confirmBtn.addEventListener('click', () => closeModal(true));
        cancelBtn.addEventListener('click', () => closeModal(false));

        if (!document.querySelector('#modalAnimations')) {
            const style = document.createElement('style');
            style.id = 'modalAnimations';
            style.textContent = `@keyframes fadeOut { to { opacity: 0; } }`;
            document.head.appendChild(style);
        }
    });
}

function showMessage(message, type) {
    const oldMessages = document.querySelectorAll('.floating-message');
    oldMessages.forEach(msg => msg.remove());
    
    const messageDiv = document.createElement('div');
    messageDiv.className = `floating-message ${type}`;
    messageDiv.textContent = message;
    
    document.body.appendChild(messageDiv);
    
    setTimeout(() => {
        messageDiv.style.animation = 'slideOut 0.3s ease forwards';
        setTimeout(() => messageDiv.remove(), 300);
    }, 3000);
}
