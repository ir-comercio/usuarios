// ============================================
// SERVIDOR - GERENCIAMENTO DE USUÁRIOS
// Sistema completo integrado com Supabase
// ============================================

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcryptjs');
const { createClient } = require('@supabase/supabase-js');

const app = express();

// ============================================
// CONFIGURAÇÃO DO SUPABASE
// ============================================

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRole = process.env.SUPABASE_SERVICE_ROLE;

if (!supabaseUrl || !supabaseServiceRole) {
    console.error('❌ ERRO: Variáveis de ambiente SUPABASE_URL e SUPABASE_SERVICE_ROLE são obrigatórias');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceRole, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});

// ============================================
// CONFIGURAÇÃO
// ============================================

const PORTAL_URL = process.env.PORTAL_URL || 'https://ir-comercio-portal-zcan.onrender.com';

// ============================================
// MIDDLEWARES
// ============================================

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Log de requisições
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
    next();
});

// Middleware de autenticação para rotas da API
async function requireAuth(req, res, next) {
    // Permitir acesso público a health check e arquivos estáticos
    if (req.path === '/health' || req.path === '/' || req.path.startsWith('/api') === false) {
        return next();
    }
    
    // Verificar se há sessionToken nos headers
    const sessionToken = req.headers['x-session-token'] || req.query.sessionToken;
    
    if (!sessionToken) {
        console.log('❌ Acesso negado: sem sessionToken');
        return res.status(401).json({
            success: false,
            error: 'Não autenticado',
            message: 'Token de sessão não fornecido'
        });
    }
    
    // Validar token com o portal (opcional - implementar se necessário)
    // Por enquanto, apenas verificar se o token existe
    console.log('✅ Token de sessão presente:', sessionToken.substring(0, 10) + '...');
    
    next();
}

// Aplicar middleware nas rotas da API
app.use('/api', requireAuth);

// Servir arquivos estáticos (HTML, CSS, JS) - SEM autenticação
app.use(express.static(path.join(__dirname, 'public')));

// ============================================
// FUNÇÕES AUXILIARES
// ============================================

// Hash de senha
async function hashPassword(password) {
    const salt = await bcrypt.genSalt(10);
    return bcrypt.hash(password, salt);
}

// Verificar senha
async function verifyPassword(password, hash) {
    return bcrypt.compare(password, hash);
}

// Registrar tentativa de login
async function logLoginAttempt(username, ipAddress, deviceToken, success, failureReason = null) {
    try {
        const { error } = await supabase
            .from('login_attempts')
            .insert({
                username,
                ip_address: ipAddress,
                device_token: deviceToken,
                success,
                failure_reason: failureReason
            });
        
        if (error) console.error('Erro ao registrar tentativa de login:', error);
    } catch (err) {
        console.error('Erro ao registrar tentativa de login:', err);
    }
}

// ============================================
// ROTAS DA API - USUÁRIOS
// ============================================

// GET /api/users - Listar todos os usuários
app.get('/api/users', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('users')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Erro ao buscar usuários:', error);
            return res.status(500).json({
                success: false,
                error: 'Erro ao buscar usuários',
                message: error.message
            });
        }

        // Remover senhas da resposta
        const usersWithoutPasswords = data.map(user => {
            const { password, ...userWithoutPassword } = user;
            return userWithoutPassword;
        });

        res.json({
            success: true,
            data: usersWithoutPasswords,
            total: usersWithoutPasswords.length
        });
    } catch (error) {
        console.error('Erro ao buscar usuários:', error);
        res.status(500).json({
            success: false,
            error: 'Erro interno do servidor',
            message: error.message
        });
    }
});

// GET /api/users/:id - Buscar usuário específico
app.get('/api/users/:id', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('users')
            .select('*')
            .eq('id', req.params.id)
            .single();

        if (error) {
            return res.status(404).json({
                success: false,
                error: 'Usuário não encontrado'
            });
        }

        const { password, ...userWithoutPassword } = data;

        res.json({
            success: true,
            data: userWithoutPassword
        });
    } catch (error) {
        console.error('Erro ao buscar usuário:', error);
        res.status(500).json({
            success: false,
            error: 'Erro interno do servidor',
            message: error.message
        });
    }
});

// POST /api/users - Criar novo usuário
app.post('/api/users', async (req, res) => {
    try {
        const { username, password, name, is_admin } = req.body;

        // Validações
        if (!username || !password || !name) {
            return res.status(400).json({
                success: false,
                error: 'Campos obrigatórios faltando',
                required: ['username', 'password', 'name']
            });
        }

        // Verificar se username já existe
        const { data: existingUser } = await supabase
            .from('users')
            .select('username')
            .eq('username', username)
            .single();

        if (existingUser) {
            return res.status(409).json({
                success: false,
                error: 'Nome de usuário já existe'
            });
        }

        // Hash da senha
        const hashedPassword = await hashPassword(password);

        // Criar usuário
        const { data, error } = await supabase
            .from('users')
            .insert({
                username: username.toLowerCase(),
                password: hashedPassword,
                name,
                is_admin: is_admin || false,
                is_active: true
            })
            .select()
            .single();

        if (error) {
            console.error('Erro ao criar usuário:', error);
            return res.status(500).json({
                success: false,
                error: 'Erro ao criar usuário',
                message: error.message
            });
        }

        const { password: _, ...userWithoutPassword } = data;

        res.status(201).json({
            success: true,
            message: 'Usuário criado com sucesso',
            data: userWithoutPassword
        });
    } catch (error) {
        console.error('Erro ao criar usuário:', error);
        res.status(500).json({
            success: false,
            error: 'Erro interno do servidor',
            message: error.message
        });
    }
});

// PUT /api/users/:id - Atualizar usuário
app.put('/api/users/:id', async (req, res) => {
    try {
        const { username, password, name, is_admin, is_active } = req.body;
        
        const updateData = {
            username: username?.toLowerCase(),
            name,
            is_admin,
            is_active
        };

        // Se senha foi fornecida, fazer hash
        if (password && password.trim() !== '') {
            updateData.password = await hashPassword(password);
        }

        const { data, error } = await supabase
            .from('users')
            .update(updateData)
            .eq('id', req.params.id)
            .select()
            .single();

        if (error) {
            console.error('Erro ao atualizar usuário:', error);
            return res.status(500).json({
                success: false,
                error: 'Erro ao atualizar usuário',
                message: error.message
            });
        }

        const { password: _, ...userWithoutPassword } = data;

        res.json({
            success: true,
            message: 'Usuário atualizado com sucesso',
            data: userWithoutPassword
        });
    } catch (error) {
        console.error('Erro ao atualizar usuário:', error);
        res.status(500).json({
            success: false,
            error: 'Erro interno do servidor',
            message: error.message
        });
    }
});

// DELETE /api/users/:id - Deletar usuário
app.delete('/api/users/:id', async (req, res) => {
    try {
        const { error } = await supabase
            .from('users')
            .delete()
            .eq('id', req.params.id);

        if (error) {
            console.error('Erro ao deletar usuário:', error);
            return res.status(500).json({
                success: false,
                error: 'Erro ao deletar usuário',
                message: error.message
            });
        }

        res.json({
            success: true,
            message: 'Usuário removido com sucesso'
        });
    } catch (error) {
        console.error('Erro ao deletar usuário:', error);
        res.status(500).json({
            success: false,
            error: 'Erro interno do servidor',
            message: error.message
        });
    }
});

// PATCH /api/users/:id/toggle-status - Ativar/Desativar usuário
app.patch('/api/users/:id/toggle-status', async (req, res) => {
    try {
        // Buscar usuário atual
        const { data: currentUser } = await supabase
            .from('users')
            .select('is_active')
            .eq('id', req.params.id)
            .single();

        if (!currentUser) {
            return res.status(404).json({
                success: false,
                error: 'Usuário não encontrado'
            });
        }

        // Inverter status
        const { data, error } = await supabase
            .from('users')
            .update({ is_active: !currentUser.is_active })
            .eq('id', req.params.id)
            .select()
            .single();

        if (error) {
            console.error('Erro ao alterar status:', error);
            return res.status(500).json({
                success: false,
                error: 'Erro ao alterar status',
                message: error.message
            });
        }

        const { password: _, ...userWithoutPassword } = data;

        res.json({
            success: true,
            message: `Usuário ${data.is_active ? 'ativado' : 'desativado'} com sucesso`,
            data: userWithoutPassword
        });
    } catch (error) {
        console.error('Erro ao alterar status:', error);
        res.status(500).json({
            success: false,
            error: 'Erro interno do servidor',
            message: error.message
        });
    }
});

// ============================================
// ROTAS DA API - LOGIN ATTEMPTS
// ============================================

// GET /api/login-attempts - Listar tentativas de login
app.get('/api/login-attempts', async (req, res) => {
    try {
        const { username, limit = 100 } = req.query;

        let query = supabase
            .from('login_attempts')
            .select('*')
            .order('timestamp', { ascending: false })
            .limit(parseInt(limit));

        if (username) {
            query = query.eq('username', username);
        }

        const { data, error } = await query;

        if (error) {
            console.error('Erro ao buscar tentativas de login:', error);
            return res.status(500).json({
                success: false,
                error: 'Erro ao buscar tentativas de login',
                message: error.message
            });
        }

        res.json({
            success: true,
            data,
            total: data.length
        });
    } catch (error) {
        console.error('Erro ao buscar tentativas de login:', error);
        res.status(500).json({
            success: false,
            error: 'Erro interno do servidor',
            message: error.message
        });
    }
});

// ============================================
// ROTAS DA API - DISPOSITIVOS AUTORIZADOS
// ============================================

// GET /api/authorized-devices - Listar dispositivos autorizados
app.get('/api/authorized-devices', async (req, res) => {
    try {
        const { username } = req.query;

        let query = supabase
            .from('authorized_devices')
            .select('*')
            .order('timestamp', { ascending: false });

        if (username) {
            query = query.eq('username', username);
        }

        const { data, error } = await query;

        if (error) {
            console.error('Erro ao buscar dispositivos:', error);
            return res.status(500).json({
                success: false,
                error: 'Erro ao buscar dispositivos',
                message: error.message
            });
        }

        res.json({
            success: true,
            data,
            total: data.length
        });
    } catch (error) {
        console.error('Erro ao buscar dispositivos:', error);
        res.status(500).json({
            success: false,
            error: 'Erro interno do servidor',
            message: error.message
        });
    }
});

// DELETE /api/authorized-devices/:id - Remover dispositivo
app.delete('/api/authorized-devices/:id', async (req, res) => {
    try {
        const { error } = await supabase
            .from('authorized_devices')
            .delete()
            .eq('id', req.params.id);

        if (error) {
            console.error('Erro ao remover dispositivo:', error);
            return res.status(500).json({
                success: false,
                error: 'Erro ao remover dispositivo',
                message: error.message
            });
        }

        res.json({
            success: true,
            message: 'Dispositivo removido com sucesso'
        });
    } catch (error) {
        console.error('Erro ao remover dispositivo:', error);
        res.status(500).json({
            success: false,
            error: 'Erro interno do servidor',
            message: error.message
        });
    }
});

// ============================================
// ROTAS DA API - ALERTAS DE SEGURANÇA
// ============================================

// POST /api/alerts - Criar novo alerta
app.post('/api/alerts', requireSupabase, async (req, res) => {
    try {
        const { alert_type, severity, ip_address, username, attempted_system, message, details } = req.body;

        if (!alert_type || !message) {
            return res.status(400).json({
                success: false,
                error: 'Campos obrigatórios: alert_type, message'
            });
        }

        const { data, error } = await supabase
            .from('security_alerts')
            .insert({
                alert_type,
                severity: severity || 'medium',
                ip_address,
                username,
                attempted_system,
                message,
                details: details || {},
                is_read: false
            })
            .select()
            .single();

        if (error) {
            console.error('❌ Erro ao criar alerta:', error);
            return res.status(500).json({
                success: false,
                error: 'Erro ao criar alerta',
                message: error.message
            });
        }

        console.log('🚨 ALERTA CRIADO:', alert_type, '-', message);

        res.status(201).json({
            success: true,
            message: 'Alerta criado com sucesso',
            data
        });
    } catch (error) {
        console.error('❌ Erro ao criar alerta:', error);
        res.status(500).json({
            success: false,
            error: 'Erro interno',
            message: error.message
        });
    }
});

// GET /api/alerts - Listar alertas
app.get('/api/alerts', requireSupabase, async (req, res) => {
    try {
        const { unread, limit = 50 } = req.query;

        let query = supabase
            .from('security_alerts')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(parseInt(limit));

        if (unread === 'true') {
            query = query.eq('is_read', false);
        }

        const { data, error } = await query;

        if (error) {
            console.error('❌ Erro ao buscar alertas:', error);
            return res.status(500).json({
                success: false,
                error: 'Erro ao buscar alertas',
                message: error.message
            });
        }

        res.json({
            success: true,
            data,
            total: data.length
        });
    } catch (error) {
        console.error('❌ Erro:', error);
        res.status(500).json({
            success: false,
            error: 'Erro interno',
            message: error.message
        });
    }
});

// PATCH /api/alerts/:id/mark-read - Marcar alerta como lido
app.patch('/api/alerts/:id/mark-read', requireSupabase, async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('security_alerts')
            .update({ 
                is_read: true,
                read_at: new Date().toISOString()
            })
            .eq('id', req.params.id)
            .select()
            .single();

        if (error) {
            console.error('❌ Erro ao marcar alerta:', error);
            return res.status(500).json({
                success: false,
                error: 'Erro ao marcar alerta',
                message: error.message
            });
        }

        res.json({
            success: true,
            message: 'Alerta marcado como lido',
            data
        });
    } catch (error) {
        console.error('❌ Erro:', error);
        res.status(500).json({
            success: false,
            error: 'Erro interno',
            message: error.message
        });
    }
});

// DELETE /api/alerts/:id - Deletar alerta
app.delete('/api/alerts/:id', requireSupabase, async (req, res) => {
    try {
        const { error } = await supabase
            .from('security_alerts')
            .delete()
            .eq('id', req.params.id);

        if (error) {
            console.error('❌ Erro ao deletar alerta:', error);
            return res.status(500).json({
                success: false,
                error: 'Erro ao deletar alerta',
                message: error.message
            });
        }

        res.json({
            success: true,
            message: 'Alerta removido com sucesso'
        });
    } catch (error) {
        console.error('❌ Erro:', error);
        res.status(500).json({
            success: false,
            error: 'Erro interno',
            message: error.message
        });
    }
});

// ============================================
// ROTAS DA API - DASHBOARD
// ============================================

// GET /api/dashboard - Estatísticas
app.get('/api/dashboard', async (req, res) => {
    try {
        // Buscar usuários
        const { data: users } = await supabase
            .from('users')
            .select('is_active, is_admin');

        // Buscar tentativas de login das últimas 24h
        const oneDayAgo = new Date();
        oneDayAgo.setHours(oneDayAgo.getHours() - 24);

        const { data: recentAttempts } = await supabase
            .from('login_attempts')
            .select('success')
            .gte('timestamp', oneDayAgo.toISOString());

        const stats = {
            total_users: users?.length || 0,
            active_users: users?.filter(u => u.is_active).length || 0,
            inactive_users: users?.filter(u => !u.is_active).length || 0,
            admin_users: users?.filter(u => u.is_admin).length || 0,
            login_attempts_24h: recentAttempts?.length || 0,
            successful_logins_24h: recentAttempts?.filter(a => a.success).length || 0,
            failed_logins_24h: recentAttempts?.filter(a => !a.success).length || 0
        };

        res.json({
            success: true,
            data: stats
        });
    } catch (error) {
        console.error('Erro ao gerar dashboard:', error);
        res.status(500).json({
            success: false,
            error: 'Erro ao gerar dashboard',
            message: error.message
        });
    }
});

// ============================================
// HEALTH CHECK
// ============================================

app.get('/health', async (req, res) => {
    try {
        // Testar conexão com Supabase
        const { error } = await supabase
            .from('users')
            .select('count')
            .limit(1);

        res.json({
            status: error ? 'unhealthy' : 'healthy',
            uptime: process.uptime(),
            timestamp: new Date().toISOString(),
            supabase: error ? 'disconnected' : 'connected'
        });
    } catch (error) {
        res.status(500).json({
            status: 'unhealthy',
            error: error.message
        });
    }
});

// ============================================
// SERVIR FRONTEND
// ============================================

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ============================================
// INICIAR SERVIDOR
// ============================================

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log('');
    console.log('===============================================');
    console.log('👥 GERENCIAMENTO DE USUÁRIOS - INICIADO');
    console.log('===============================================');
    console.log(`✅ Servidor rodando na porta: ${PORT}`);
    console.log(`🌐 URL: http://localhost:${PORT}`);
    console.log(`🗄️  Supabase: ${supabaseUrl}`);
    console.log('');
    console.log('📋 Endpoints disponíveis:');
    console.log('   GET    /                           - Frontend');
    console.log('   GET    /health                     - Status do servidor');
    console.log('   GET    /api/users                  - Listar usuários');
    console.log('   GET    /api/users/:id              - Buscar usuário');
    console.log('   POST   /api/users                  - Criar usuário');
    console.log('   PUT    /api/users/:id              - Atualizar usuário');
    console.log('   DELETE /api/users/:id              - Deletar usuário');
    console.log('   PATCH  /api/users/:id/toggle-status - Ativar/Desativar');
    console.log('   GET    /api/login-attempts         - Tentativas de login');
    console.log('   GET    /api/authorized-devices     - Dispositivos autorizados');
    console.log('   DELETE /api/authorized-devices/:id - Remover dispositivo');
    console.log('   GET    /api/dashboard              - Estatísticas');
    console.log('===============================================');
    console.log('');
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Unhandled Rejection:', reason);
});

process.on('uncaughtException', (error) => {
    console.error('❌ Uncaught Exception:', error);
    process.exit(1);
});

module.exports = app;
