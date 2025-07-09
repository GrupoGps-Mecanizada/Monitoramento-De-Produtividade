// =============================================================================
// PRODUCTIVITY SYSTEM MODULE - Sistema Principal Corrigido e Simplificado v2.1
// =============================================================================

class ProductivitySystem {
    constructor() {
        // Inicializar módulos
        this.core = new ProductivityCore();
        this.analytics = new ProductivityAnalytics(this.core);
        this.rules = new ProductivityRules(this.core);
        
        // Estado do sistema otimizado
        this.timeline = null;
        this.items = new vis.DataSet();
        this.groups = new vis.DataSet();
        this.csvData = [];
        this.jsonData = [];
        this.equipmentMap = new Map();
        this.isUpdating = false;
        this.autoSyncInterval = null;
        this.currentViewWindow = null;
        this.lastDataHash = '';
        
        // Configuração de filtros baseada nos dados reais
        this.filterConfig = {
            groups: [
                { key: 'alta-pressao', name: 'Alta Pressão', icon: '🔴' },
                { key: 'baixa-pressao', name: 'Baixa Pressão', icon: '🔵' },
                { key: 'auto-vacuo', name: 'Auto Vácuo', icon: '🟣' },
                { key: 'hiper-vacuo', name: 'Hiper Vácuo', icon: '⚫' },
                { key: 'caminhoes', name: 'Caminhões', icon: '🚛' }
            ],
            status: [
                { key: 'running', name: 'Operando', color: '#27ae60' },
                { key: 'stopped', name: 'Parado', color: '#f39c12' },
                { key: 'off', name: 'Desligado', color: '#95a5a6' },
                { key: 'maintenance', name: 'Manutenção', color: '#e67e22' },
                { key: 'on', name: 'Ligado', color: '#3498db' }
            ],
            appointments: [
                { key: 'documentacao', name: 'Documentação', color: '#27ae60' },
                { key: 'preparacao', name: 'Preparação', color: '#9b59b6' },
                { key: 'manutencao', name: 'Manutenção', color: '#e67e22' },
                { key: 'bloqueio', name: 'Bloqueio', color: '#e74c3c' },
                { key: 'aguardando', name: 'Aguardando', color: '#3498db' },
                { key: 'refeicao', name: 'Refeição', color: '#27ae60' }
            ]
        };
        
        // Navegação por equipamento
        this.currentEquipmentIndex = 0;
        this.equipmentList = [];
        
        // Otimizações de performance simplificadas
        this.performanceConfig = {
            maxItemsRendered: 2000,
            debounceInterval: 200,
            cacheTimeout: 300000
        };
        
        // Estado de filtros simplificado
        this.filterState = {
            equipment: '',
            groups: new Set(),
            status: new Set(),
            appointments: new Set(),
            period: 'week',
            isActive: false
        };

        this.initializeSystem();
    }

    // =============================================================================
    // INICIALIZAÇÃO SIMPLIFICADA
    // =============================================================================
    async initializeSystem() {
        try {
            this.core.addDebugLog('Iniciando sistema de produtividade v2.1');
            
            this.setupEventListeners();
            this.initializeRulesInterface(); // CORRIGIDO: função própria
            this.initializeSettingsInterface(); // CORRIGIDO: função própria
            this.updateSyncStatus('loading', 'Carregando dados...');
            
            await this.initGitHubSync();
            
            this.core.addDebugLog('Sistema inicializado com sucesso');
            
        } catch (error) {
            this.core.addDebugLog(`Erro na inicialização: ${error.message}`, 'error');
            this.showNotification('Erro na inicialização do sistema', 'error');
        }
    }

    setupEventListeners() {
        // Filtros com debouncing
        const equipmentFilter = document.getElementById('equipmentFilter');
        if (equipmentFilter) {
            equipmentFilter.addEventListener('change', this.core.debounce(() => {
                this.applyFilters();
            }, this.performanceConfig.debounceInterval));
        }

        const periodFilter = document.getElementById('periodFilter');
        if (periodFilter) {
            periodFilter.addEventListener('change', () => {
                this.handlePeriodChange();
            });
        }

        // Filtros de chip
        this.setupFilterChips();
        
        // Navegação por equipamento
        this.setupEquipmentNavigation();
    }

    setupFilterChips() {
        // Setup group filter chips
        document.querySelectorAll('#groupFilters .filter-chip').forEach(chip => {
            chip.addEventListener('click', () => {
                this.toggleFilterChip(chip, this.filterState.groups);
                this.applyFilters();
            });
        });

        // Setup status filter chips
        document.querySelectorAll('#statusFilters .filter-chip').forEach(chip => {
            chip.addEventListener('click', () => {
                this.toggleFilterChip(chip, this.filterState.status);
                this.applyFilters();
            });
        });

        // Setup appointment filter chips
        document.querySelectorAll('#appointmentFilters .filter-chip').forEach(chip => {
            chip.addEventListener('click', () => {
                this.toggleFilterChip(chip, this.filterState.appointments);
                this.applyFilters();
            });
        });
    }

    setupEquipmentNavigation() {
        // Adicionar botões de navegação na interface
        const timelineHeader = document.querySelector('.timeline-header');
        if (timelineHeader) {
            const navButtons = document.createElement('div');
            navButtons.className = 'equipment-navigation';
            navButtons.innerHTML = `
                <button id="prevEquipment" class="nav-btn" title="Equipamento Anterior">
                    ⬅️ Anterior
                </button>
                <span id="currentEquipmentInfo" class="equipment-info">
                    -- / --
                </span>
                <button id="nextEquipment" class="nav-btn" title="Próximo Equipamento">
                    Próximo ➡️
                </button>
                <button id="resetView" class="nav-btn" title="Ver Todos">
                    🏠 Todos
                </button>
            `;
            timelineHeader.appendChild(navButtons);

            // Event listeners para navegação
            document.getElementById('prevEquipment')?.addEventListener('click', () => {
                this.navigateToEquipment(-1);
            });

            document.getElementById('nextEquipment')?.addEventListener('click', () => {
                this.navigateToEquipment(1);
            });

            document.getElementById('resetView')?.addEventListener('click', () => {
                this.resetEquipmentView();
            });
        }
    }

    toggleFilterChip(chip, filterSet) {
        const value = chip.dataset.group || chip.dataset.status || chip.dataset.apont;
        
        if (filterSet.has(value)) {
            filterSet.delete(value);
            chip.classList.remove('active');
        } else {
            filterSet.add(value);
            chip.classList.add('active');
        }
        
        this.updateFilterState();
    }

    updateFilterState() {
        this.filterState.isActive = !!(
            this.filterState.equipment ||
            this.filterState.groups.size > 0 ||
            this.filterState.status.size > 0 ||
            this.filterState.appointments.size > 0
        );
    }

    // =============================================================================
    // INTERFACE DE REGRAS SIMPLIFICADA - CORRIGIDO
    // =============================================================================
    initializeRulesInterface() {
        const rulesInterface = document.getElementById('rulesInterface');
        if (rulesInterface) {
            this.renderRulesInterface(rulesInterface);
        }
    }

    renderRulesInterface(container) {
        const rulesConfig = this.rules.getRulesConfig();
        
        container.innerHTML = `
            <div class="rules-interface">
                <div class="rules-header">
                    <h3>⚙️ Regras de Produtividade</h3>
                    <p>Configure como diferentes atividades afetam a produtividade</p>
                </div>
                
                <div class="rules-tabs">
                    <button class="rule-tab active" data-tab="status">Status de Equipamentos</button>
                    <button class="rule-tab" data-tab="appointments">Apontamentos</button>
                    <button class="rule-tab" data-tab="settings">Configurações</button>
                </div>
                
                <div class="rules-content">
                    <div class="tab-panel active" id="status-panel">
                        <h4>Classificação de Status</h4>
                        <div class="rules-grid" id="statusRulesGrid">
                            <!-- Será preenchido dinamicamente -->
                        </div>
                    </div>
                    
                    <div class="tab-panel" id="appointments-panel">
                        <h4>Classificação de Apontamentos</h4>
                        <div class="rules-grid" id="appointmentRulesGrid">
                            <!-- Será preenchido dinamicamente -->
                        </div>
                    </div>
                    
                    <div class="tab-panel" id="settings-panel">
                        <h4>Configurações Gerais</h4>
                        <div class="settings-grid">
                            <div class="setting-item">
                                <label>Resolução de Conflitos:</label>
                                <select id="conflictResolution">
                                    <option value="priority">Por Prioridade</option>
                                    <option value="latest">Mais Recente</option>
                                    <option value="longest">Maior Duração</option>
                                </select>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div class="rules-actions">
                    <button class="btn secondary" onclick="productivitySystem.resetRules()">
                        Restaurar Padrões
                    </button>
                    <button class="btn primary" onclick="productivitySystem.saveRules()">
                        Salvar Regras
                    </button>
                </div>
            </div>
            
            <style>
                .rules-interface {
                    background: rgba(255, 255, 255, 0.95);
                    border-radius: 12px;
                    padding: 1.5rem;
                    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
                }
                
                .rules-header {
                    text-align: center;
                    margin-bottom: 2rem;
                }
                
                .rules-header h3 {
                    color: #2c3e50;
                    margin-bottom: 0.5rem;
                }
                
                .rules-tabs {
                    display: flex;
                    border-bottom: 2px solid #ecf0f1;
                    margin-bottom: 1.5rem;
                }
                
                .rule-tab {
                    flex: 1;
                    padding: 1rem;
                    border: none;
                    background: transparent;
                    cursor: pointer;
                    font-weight: 600;
                    color: #7f8c8d;
                    transition: all 0.3s ease;
                }
                
                .rule-tab.active {
                    color: #667eea;
                    border-bottom: 2px solid #667eea;
                }
                
                .tab-panel {
                    display: none;
                }
                
                .tab-panel.active {
                    display: block;
                }
                
                .rules-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
                    gap: 1rem;
                    margin-bottom: 1.5rem;
                }
                
                .rule-item {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 1rem;
                    background: rgba(255, 255, 255, 0.8);
                    border: 2px solid #ecf0f1;
                    border-radius: 8px;
                    transition: all 0.3s ease;
                }
                
                .rule-item:hover {
                    border-color: #667eea;
                }
                
                .rule-name {
                    font-weight: 600;
                    color: #2c3e50;
                }
                
                .rule-select {
                    padding: 0.5rem;
                    border: 1px solid #bdc3c7;
                    border-radius: 4px;
                    background: white;
                }
                
                .rules-actions {
                    display: flex;
                    justify-content: center;
                    gap: 1rem;
                    margin-top: 2rem;
                }
                
                .btn {
                    padding: 0.75rem 1.5rem;
                    border: none;
                    border-radius: 6px;
                    cursor: pointer;
                    font-weight: 600;
                    transition: all 0.3s ease;
                }
                
                .btn.primary {
                    background: linear-gradient(135deg, #667eea, #764ba2);
                    color: white;
                }
                
                .btn.secondary {
                    background: #95a5a6;
                    color: white;
                }
                
                .btn:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
                }
            </style>
        `;
        
        // Setup tab switching
        container.querySelectorAll('.rule-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                this.switchRuleTab(tab.dataset.tab);
            });
        });
        
        // Load current rules
        this.loadRulesData();
    }

    switchRuleTab(tabName) {
        // Update tabs
        document.querySelectorAll('.rule-tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.tab === tabName);
        });
        
        // Update panels
        document.querySelectorAll('.tab-panel').forEach(panel => {
            panel.classList.toggle('active', panel.id === `${tabName}-panel`);
        });
    }

    loadRulesData() {
        const rulesConfig = this.rules.getRulesConfig();
        if (!rulesConfig) return;
        
        this.loadStatusRules(rulesConfig.telemetryRules || {});
        this.loadAppointmentRules(rulesConfig.appointmentRules || {});
    }

    loadStatusRules(statusRules) {
        const container = document.getElementById('statusRulesGrid');
        if (!container) return;
        
        container.innerHTML = '';
        
        this.filterConfig.status.forEach(status => {
            const currentRule = statusRules[status.key] || 'neutral';
            
            const ruleItem = document.createElement('div');
            ruleItem.className = 'rule-item';
            ruleItem.innerHTML = `
                <span class="rule-name">${status.name}</span>
                <select class="rule-select" data-type="status" data-key="${status.key}">
                    <option value="productive" ${currentRule === 'productive' ? 'selected' : ''}>Produtivo</option>
                    <option value="non-productive" ${currentRule === 'non-productive' ? 'selected' : ''}>Não Produtivo</option>
                    <option value="neutral" ${currentRule === 'neutral' ? 'selected' : ''}>Neutro</option>
                </select>
            `;
            
            const select = ruleItem.querySelector('.rule-select');
            select.addEventListener('change', (e) => {
                this.updateRule('status', status.key, e.target.value);
            });
            
            container.appendChild(ruleItem);
        });
    }

    loadAppointmentRules(appointmentRules) {
        const container = document.getElementById('appointmentRulesGrid');
        if (!container) return;
        
        container.innerHTML = '';
        
        this.filterConfig.appointments.forEach(appointment => {
            const currentRule = appointmentRules[appointment.key] || 'neutral';
            
            const ruleItem = document.createElement('div');
            ruleItem.className = 'rule-item';
            ruleItem.innerHTML = `
                <span class="rule-name">${appointment.name}</span>
                <select class="rule-select" data-type="appointment" data-key="${appointment.key}">
                    <option value="productive" ${currentRule === 'productive' ? 'selected' : ''}>Produtivo</option>
                    <option value="non-productive" ${currentRule === 'non-productive' ? 'selected' : ''}>Não Produtivo</option>
                    <option value="neutral" ${currentRule === 'neutral' ? 'selected' : ''}>Neutro</option>
                </select>
            `;
            
            const select = ruleItem.querySelector('.rule-select');
            select.addEventListener('change', (e) => {
                this.updateRule('appointment', appointment.key, e.target.value);
            });
            
            container.appendChild(ruleItem);
        });
    }

    updateRule(type, key, value) {
        this.rules.updateRule(type, key, value);
        this.showNotification(`Regra atualizada: ${key} = ${value}`, 'success');
    }

    saveRules() {
        this.rules.saveRules();
        this.showNotification('Regras salvas com sucesso!', 'success');
    }

    resetRules() {
        if (confirm('Restaurar todas as regras para os valores padrão?')) {
            this.rules.resetToDefaults();
            this.loadRulesData();
            this.showNotification('Regras restauradas para padrão', 'success');
        }
    }

    // =============================================================================
    // INTERFACE DE CONFIGURAÇÕES SIMPLIFICADA - CORRIGIDO
    // =============================================================================
    initializeSettingsInterface() {
        const settingsInterface = document.getElementById('settingsInterface');
        if (settingsInterface) {
            this.renderSettingsInterface(settingsInterface);
        }
    }

    renderSettingsInterface(container) {
        container.innerHTML = `
            <div class="settings-interface">
                <div class="settings-header">
                    <h3>🔧 Configurações do Sistema</h3>
                    <p>Ajuste parâmetros operacionais do sistema</p>
                </div>
                
                <div class="settings-grid">
                    <div class="setting-section">
                        <h4>🔄 Sincronização</h4>
                        <div class="setting-item">
                            <label>Intervalo de Auto-Sync:</label>
                            <select id="autoSyncInterval">
                                <option value="0">Desabilitado</option>
                                <option value="300000">5 minutos</option>
                                <option value="600000" selected>10 minutos</option>
                                <option value="1800000">30 minutos</option>
                            </select>
                        </div>
                        
                        <div class="setting-item">
                            <label>Resolução de Conflitos:</label>
                            <select id="conflictResolution">
                                <option value="priority" selected>Por Prioridade</option>
                                <option value="latest">Mais Recente</option>
                                <option value="longest">Maior Duração</option>
                            </select>
                        </div>
                    </div>
                    
                    <div class="setting-section">
                        <h4>📊 Performance</h4>
                        <div class="setting-item">
                            <label>Máximo de Itens na Timeline:</label>
                            <select id="maxItems">
                                <option value="1000">1000 itens</option>
                                <option value="2000" selected>2000 itens</option>
                                <option value="5000">5000 itens</option>
                            </select>
                        </div>
                        
                        <div class="setting-item">
                            <label>Cache Timeout:</label>
                            <select id="cacheTimeout">
                                <option value="300000" selected>5 minutos</option>
                                <option value="600000">10 minutos</option>
                                <option value="1800000">30 minutos</option>
                            </select>
                        </div>
                    </div>
                    
                    <div class="setting-section">
                        <h4>📈 Estatísticas</h4>
                        <div class="stats-display">
                            <div class="stat-item">
                                <span class="stat-label">Equipamentos:</span>
                                <span class="stat-value" id="equipmentCount">--</span>
                            </div>
                            <div class="stat-item">
                                <span class="stat-label">Itens Timeline:</span>
                                <span class="stat-value" id="timelineItems">--</span>
                            </div>
                            <div class="stat-item">
                                <span class="stat-label">Cache Hits:</span>
                                <span class="stat-value" id="cacheHits">--</span>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div class="settings-actions">
                    <button class="btn secondary" onclick="productivitySystem.resetSettings()">
                        Restaurar Padrões
                    </button>
                    <button class="btn secondary" onclick="productivitySystem.clearCache()">
                        Limpar Cache
                    </button>
                    <button class="btn primary" onclick="productivitySystem.saveSettings()">
                        Salvar Configurações
                    </button>
                </div>
            </div>
            
            <style>
                .settings-interface {
                    background: rgba(255, 255, 255, 0.95);
                    border-radius: 12px;
                    padding: 1.5rem;
                    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
                }
                
                .settings-header {
                    text-align: center;
                    margin-bottom: 2rem;
                }
                
                .settings-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
                    gap: 2rem;
                    margin-bottom: 2rem;
                }
                
                .setting-section {
                    background: rgba(255, 255, 255, 0.8);
                    padding: 1.5rem;
                    border-radius: 8px;
                    border: 2px solid #ecf0f1;
                }
                
                .setting-section h4 {
                    color: #2c3e50;
                    margin-bottom: 1rem;
                    padding-bottom: 0.5rem;
                    border-bottom: 1px solid #ecf0f1;
                }
                
                .setting-item {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 1rem;
                    gap: 1rem;
                }
                
                .setting-item label {
                    font-weight: 600;
                    color: #2c3e50;
                    flex: 1;
                }
                
                .setting-item select {
                    padding: 0.5rem;
                    border: 1px solid #bdc3c7;
                    border-radius: 4px;
                    background: white;
                    min-width: 150px;
                }
                
                .stats-display {
                    display: flex;
                    flex-direction: column;
                    gap: 0.5rem;
                }
                
                .stat-item {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 0.5rem;
                    background: rgba(255, 255, 255, 0.6);
                    border-radius: 4px;
                }
                
                .stat-label {
                    font-weight: 600;
                    color: #5a6c7d;
                }
                
                .stat-value {
                    font-weight: 800;
                    color: #667eea;
                }
                
                .settings-actions {
                    display: flex;
                    justify-content: center;
                    gap: 1rem;
                }
            </style>
        `;
        
        // Setup event listeners
        this.setupSettingsListeners();
        
        // Update stats
        this.updateSettingsStats();
    }

    setupSettingsListeners() {
        document.getElementById('autoSyncInterval')?.addEventListener('change', (e) => {
            this.core.updateConfig({ autoSyncInterval: parseInt(e.target.value) });
            this.startGitHubAutoSync();
        });

        document.getElementById('conflictResolution')?.addEventListener('change', (e) => {
            this.core.updateConfig({ conflictResolution: e.target.value });
        });

        document.getElementById('maxItems')?.addEventListener('change', (e) => {
            this.performanceConfig.maxItemsRendered = parseInt(e.target.value);
        });

        document.getElementById('cacheTimeout')?.addEventListener('change', (e) => {
            this.performanceConfig.cacheTimeout = parseInt(e.target.value);
        });
    }

    updateSettingsStats() {
        document.getElementById('equipmentCount').textContent = this.equipmentMap.size;
        document.getElementById('timelineItems').textContent = this.items.length;
        
        const cacheStats = this.core.getCacheStats();
        document.getElementById('cacheHits').textContent = cacheStats.valid || 0;
    }

    saveSettings() {
        localStorage.setItem('productivity_performance_config', JSON.stringify(this.performanceConfig));
        this.showNotification('Configurações salvas!', 'success');
    }

    resetSettings() {
        if (confirm('Restaurar configurações padrão?')) {
            this.performanceConfig = {
                maxItemsRendered: 2000,
                debounceInterval: 200,
                cacheTimeout: 300000
            };
            this.core.updateConfig({
                autoSyncInterval: 600000,
                conflictResolution: 'priority'
            });
            this.showNotification('Configurações restauradas', 'success');
        }
    }

    clearCache() {
        this.core.clearCache();
        this.showNotification('Cache limpo', 'success');
        this.updateSettingsStats();
    }

    // =============================================================================
    // SINCRONIZAÇÃO COM GITHUB SIMPLIFICADA
    // =============================================================================
    async initGitHubSync() {
        await this.syncFromGitHub();
        this.startGitHubAutoSync();
    }

    async syncFromGitHub() {
        if (this.isUpdating) return;

        this.isUpdating = true;
        this.updateSyncStatus('loading', 'Sincronizando dados...');
        
        try {
            // Fetch both files in parallel
            const [csvResult, jsonResult] = await Promise.allSettled([
                this.fetchCSVFromGitHub(),
                this.fetchJSONFromGitHub()
            ]);

            let successCount = 0;
            let newDataDetected = false;

            // Process CSV results
            if (csvResult.status === 'fulfilled' && csvResult.value.success) {
                const newCsvData = csvResult.value.data;
                const csvHash = this.core.generateHash(newCsvData);
                
                if (csvHash !== this.csvDataHash) {
                    this.csvData = newCsvData;
                    this.csvDataHash = csvHash;
                    newDataDetected = true;
                }
                successCount++;
            }

            // Process JSON results
            if (jsonResult.status === 'fulfilled' && jsonResult.value.success) {
                const newJsonData = jsonResult.value.data;
                const jsonHash = this.core.generateHash(newJsonData);
                
                if (jsonHash !== this.lastDataHash) {
                    this.jsonData = newJsonData;
                    this.lastDataHash = jsonHash;
                    newDataDetected = true;
                }
                successCount++;
            }

            if (successCount > 0) {
                if (newDataDetected) {
                    await this.processData();
                    this.showNotification('Dados atualizados com sucesso!', 'success');
                }
                this.updateSyncStatus('success', 'Dados sincronizados');
            } else {
                this.updateSyncStatus('error', 'Falha na sincronização');
                this.showNotification('Erro na sincronização', 'error');
            }

        } catch (error) {
            this.updateSyncStatus('error', 'Erro na sincronização');
            this.showNotification(`Erro: ${error.message}`, 'error');
        } finally {
            this.isUpdating = false;
            this.updateLastUpdateTime();
        }
    }

    async fetchCSVFromGitHub() {
        const config = this.core.githubConfig.csvRepo;
        
        try {
            const response = await fetch(config.apiUrl);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);

            const apiData = await response.json();
            if (apiData.type !== 'file') throw new Error('Não é um arquivo válido');
            
            let csvText = atob(apiData.content.replace(/\n/g, ''));
            
            // Try to handle encoding
            try {
                csvText = decodeURIComponent(escape(csvText));
            } catch (e) {
                this.core.addDebugLog('Usando encoding original', 'info');
            }
            
            const parsedData = this.core.parseCSV(csvText);
            return { success: true, data: parsedData };
            
        } catch (error) {
            this.core.addDebugLog(`Erro ao buscar CSV: ${error.message}`, 'error');
            return { success: false, data: [], error: error.message };
        }
    }

    async fetchJSONFromGitHub() {
        const config = this.core.githubConfig.jsonRepo;
        
        try {
            const response = await fetch(config.apiUrl);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);

            const apiData = await response.json();
            if (apiData.type !== 'file') throw new Error('Não é um arquivo válido');
            
            let jsonText = atob(apiData.content.replace(/\n/g, ''));
            
            try {
                jsonText = decodeURIComponent(escape(jsonText));
            } catch (e) {
                this.core.addDebugLog('Usando encoding JSON original', 'info');
            }
            
            const records = this.core.parseJSON(jsonText);
            return { success: true, data: records };
            
        } catch (error) {
            this.core.addDebugLog(`Erro ao buscar JSON: ${error.message}`, 'error');
            return { success: false, data: [], error: error.message };
        }
    }

    startGitHubAutoSync() {
        if (this.autoSyncInterval) {
            clearInterval(this.autoSyncInterval);
        }

        const interval = this.core.config.autoSyncInterval;
        if (interval > 0) {
            this.autoSyncInterval = setInterval(async () => {
                if (!this.isUpdating) {
                    await this.syncFromGitHub();
                }
            }, interval);
            
            this.core.addDebugLog(`Auto-sync configurado para ${interval/60000} minutos`);
        }
    }

    // =============================================================================
    // PROCESSAMENTO DE DADOS SIMPLIFICADO
    // =============================================================================
    async processData() {
        if (this.csvData.length === 0 && this.jsonData.length === 0) return;

        this.core.addDebugLog('Processando dados...');

        // Reset equipment map
        this.equipmentMap.clear();

        // Process CSV data (apontamentos)
        this.csvData.forEach(item => {
            const equipName = this.core.normalizeEquipmentName(item.Vaga || item.Placa);
            if (!this.equipmentMap.has(equipName)) {
                this.equipmentMap.set(equipName, {
                    name: equipName,
                    originalName: item.Vaga || item.Placa,
                    apontamentos: [],
                    status: [],
                    group: this.determineEquipmentGroup(equipName)
                });
            }
            this.equipmentMap.get(equipName).apontamentos.push(item);
        });

        // Process JSON data (status)
        this.jsonData.forEach(item => {
            const equipName = this.core.normalizeEquipmentName(item.vacancy_name);
            if (!this.equipmentMap.has(equipName)) {
                this.equipmentMap.set(equipName, {
                    name: equipName,
                    originalName: item.vacancy_name,
                    apontamentos: [],
                    status: [],
                    group: this.determineEquipmentGroup(equipName)
                });
            }
            this.equipmentMap.get(equipName).status.push(item);
        });

        // Update equipment list for navigation
        this.equipmentList = Array.from(this.equipmentMap.keys()).sort();

        // Create timeline
        this.createGroups();
        this.createTimelineItems();
        await this.ensureTimelineInitialization();

        // Update interface
        this.updateInterface();
        this.updateSettingsStats();

        this.core.addDebugLog(`Processamento concluído: ${this.equipmentMap.size} equipamentos`);
    }

    determineEquipmentGroup(equipName) {
        const name = equipName.toLowerCase();
        if (name.includes('alta') && name.includes('pressao')) return 'alta-pressao';
        if (name.includes('baixa') && name.includes('pressao')) return 'baixa-pressao';
        if (name.includes('auto') && name.includes('vacuo')) return 'auto-vacuo';
        if (name.includes('hiper') && name.includes('vacuo')) return 'hiper-vacuo';
        if (name.includes('caminhao') || name.includes('caminhão')) return 'caminhoes';
        return 'outros';
    }

    // =============================================================================
    // CRIAÇÃO DA TIMELINE SIMPLIFICADA
    // =============================================================================
    createGroups() {
        this.groups.clear();
        
        let groupId = 0;
        const sortedEquipments = Array.from(this.equipmentMap.entries())
            .sort(([nameA, dataA], [nameB, dataB]) => {
                // Group by type first, then alphabetically
                if (dataA.group !== dataB.group) {
                    return dataA.group.localeCompare(dataB.group);
                }
                return nameA.localeCompare(nameB);
            });
        
        for (const [equipName, data] of sortedEquipments) {
            if (data.apontamentos.length > 0 || data.status.length > 0) {
                const displayName = this.core.getDisplayName(equipName);
                const groupIcon = this.getGroupIcon(data.group);
                
                // Apontamentos group
                this.groups.add({
                    id: `${equipName}_apont`,
                    content: `
                        <div class="equipment-label">
                            <div class="equipment-name">${groupIcon} ${displayName}</div>
                            <div class="equipment-type">📊 Apontamentos</div>
                        </div>
                    `,
                    order: groupId * 2,
                    className: 'group-apontamentos'
                });
                
                // Status group
                this.groups.add({
                    id: `${equipName}_status`,
                    content: `
                        <div class="equipment-label">
                            <div class="equipment-name">${groupIcon} ${displayName}</div>
                            <div class="equipment-type">🔄 Status</div>
                        </div>
                    `,
                    order: groupId * 2 + 1,
                    className: 'group-status'
                });
                
                groupId++;
            }
        }
    }

    getGroupIcon(group) {
        const icons = {
            'alta-pressao': '🔴',
            'baixa-pressao': '🔵', 
            'auto-vacuo': '🟣',
            'hiper-vacuo': '⚫',
            'caminhoes': '🚛',
            'outros': '⚙️'
        };
        return icons[group] || '📋';
    }

    createTimelineItems() {
        this.items.clear();
        let itemId = 0;

        for (const [equipName, data] of this.equipmentMap) {
            // Process apontamentos
            data.apontamentos.forEach(apont => {
                const start = this.core.parseDate(apont['Data Inicial']);
                const end = this.core.parseDate(apont['Data Final']);
                
                if (start && end && start < end) {
                    const category = apont['Categoria Demora'] || 'Outros';
                    const className = this.getApontamentClass(category);
                    
                    this.items.add({
                        id: `apont_${itemId++}`,
                        group: `${equipName}_apont`,
                        content: this.truncateContent(category),
                        start: start,
                        end: end,
                        className: className,
                        title: this.createApontTooltip(apont, equipName),
                        type: 'range'
                    });
                }
            });

            // Process status
            data.status.forEach(status => {
                const start = this.core.parseDate(status.start);
                const end = this.core.parseDate(status.end);
                
                if (start && end && start < end) {
                    const statusCode = status.status || 'unknown';
                    const className = this.getStatusClass(statusCode);
                    
                    this.items.add({
                        id: `status_${itemId++}`,
                        group: `${equipName}_status`,
                        content: this.truncateContent(status.status_title || statusCode),
                        start: start,
                        end: end,
                        className: className,
                        title: this.createStatusTooltip(status, equipName),
                        type: 'range'
                    });
                }
            });
        }

        this.core.addDebugLog(`Timeline criada: ${this.items.length} itens`);
    }

    getApontamentClass(category) {
        const categoryLower = category.toLowerCase();
        if (categoryLower.includes('documentacao')) return 'apont-documentacao';
        if (categoryLower.includes('preparacao')) return 'apont-preparacao';
        if (categoryLower.includes('manutencao')) return 'apont-manutencao';
        if (categoryLower.includes('bloqueio')) return 'apont-bloqueio';
        if (categoryLower.includes('aguardando')) return 'apont-aguardando';
        if (categoryLower.includes('refeicao')) return 'apont-refeicao';
        return 'apont-outros';
    }

    getStatusClass(status) {
        const statusMapping = {
            'running': 'status-running',
            'on': 'status-on',
            'stopped': 'status-stopped',
            'off': 'status-off',
            'maintenance': 'status-maintenance',
            'out_of_plant': 'status-out_of_plant',
            'not_appropriated': 'status-not_appropriated',
            'no_data': 'status-no_data',
            'secondary_motor_on': 'status-secondary_motor_on'
        };
        return statusMapping[status] || 'status-not_appropriated';
    }

    truncateContent(content) {
        if (!content) return '';
        return content.length > 15 ? content.substring(0, 12) + '...' : content;
    }

    createApontTooltip(apont, equipName) {
        const category = apont['Categoria Demora'] || 'N/A';
        const duration = apont['Tempo Indisponível (HH:MM)'] || 'N/A';
        return `📊 ${equipName}\n${category}\n⏱️ ${duration}\n📅 ${this.core.formatDateTime(apont['Data Inicial'])}`;
    }

    createStatusTooltip(status, equipName) {
        const statusTitle = status.status_title || status.status;
        const totalHours = parseFloat(status.total_time || 0);
        return `🔄 ${equipName}\n${statusTitle}\n⏱️ ${this.core.formatDuration(totalHours)}\n📅 ${this.core.formatDateTime(status.start)}`;
    }

    // =============================================================================
    // INICIALIZAÇÃO DA TIMELINE
    // =============================================================================
    async ensureTimelineInitialization() {
        if (this.items.length === 0) {
            this.showTimelineEmptyState();
            return;
        }

        if (this.timeline) {
            this.updateTimelineData();
        } else {
            this.initTimeline();
        }
    }

    initTimeline() {
        const container = document.getElementById('timeline');
        if (!container) return;

        container.innerHTML = '';

        const options = {
            orientation: 'top',
            stack: true,
            showCurrentTime: true,
            zoomMin: 1000 * 60 * 10, // 10 minutes
            zoomMax: 1000 * 60 * 60 * 24 * 30, // 30 days
            editable: false,
            selectable: true,
            maxHeight: 600,
            verticalScroll: true,
            horizontalScroll: true,
            
            format: {
                minorLabels: {
                    minute: 'HH:mm',
                    hour: 'HH:mm',
                    day: 'DD/MM',
                    month: 'MMM',
                    year: 'YYYY'
                },
                majorLabels: {
                    minute: 'ddd DD/MM',
                    hour: 'ddd DD/MM',
                    day: 'MMMM YYYY',
                    month: 'YYYY',
                    year: ''
                }
            },
            
            locale: 'pt-BR'
        };

        try {
            this.timeline = new vis.Timeline(container, this.items, this.groups, options);

            // Event listeners
            this.timeline.on('rangechanged', this.core.debounce((properties) => {
                this.currentViewWindow = properties;
                this.updateTimeRangeDisplay(properties.start, properties.end);
            }, this.performanceConfig.debounceInterval));

            this.timeline.on('select', (properties) => {
                this.handleTimelineSelection(properties);
            });

            // Auto-fit with delay
            setTimeout(() => {
                if (this.timeline) {
                    this.timeline.fit();
                }
            }, 100);

            this.core.addDebugLog('Timeline inicializada com sucesso');

        } catch (error) {
            this.core.addDebugLog(`Erro na timeline: ${error.message}`, 'error');
            this.showTimelineErrorState(error.message);
        }
    }

    updateTimelineData() {
        if (!this.timeline) return;

        try {
            this.timeline.setData({
                items: this.items,
                groups: this.groups
            });

            if (this.currentViewWindow) {
                setTimeout(() => {
                    if (this.timeline) {
                        this.timeline.setWindow(this.currentViewWindow.start, this.currentViewWindow.end, {
                            animation: false
                        });
                    }
                }, 50);
            }

            this.core.addDebugLog('Timeline data atualizada');

        } catch (error) {
            this.core.addDebugLog(`Erro ao atualizar timeline: ${error.message}`, 'error');
            this.initTimeline();
        }
    }

    handleTimelineSelection(properties) {
        if (properties.items && properties.items.length > 0) {
            const selectedItem = this.items.get(properties.items[0]);
            if (selectedItem) {
                this.core.addDebugLog(`Item selecionado: ${selectedItem.content}`);
            }
        }
    }

    updateTimeRangeDisplay(start, end) {
        const timeRange = document.getElementById('timeRange');
        if (timeRange && start && end) {
            const startStr = start.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
            const endStr = end.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
            timeRange.textContent = `Período: ${startStr} - ${endStr}`;
        }
    }

    // =============================================================================
    // NAVEGAÇÃO POR EQUIPAMENTO - NOVA FUNCIONALIDADE
    // =============================================================================
    navigateToEquipment(direction) {
        if (this.equipmentList.length === 0) return;

        this.currentEquipmentIndex += direction;
        
        if (this.currentEquipmentIndex < 0) {
            this.currentEquipmentIndex = this.equipmentList.length - 1;
        } else if (this.currentEquipmentIndex >= this.equipmentList.length) {
            this.currentEquipmentIndex = 0;
        }

        const equipment = this.equipmentList[this.currentEquipmentIndex];
        this.focusOnEquipment(equipment);
    }

    focusOnEquipment(equipmentName) {
        if (!this.timeline) return;

        // Filter timeline to show only this equipment
        const equipmentItems = this.items.get().filter(item => 
            item.group.startsWith(equipmentName)
        );

        const equipmentGroups = this.groups.get().filter(group => 
            group.id.startsWith(equipmentName)
        );

        if (equipmentItems.length > 0) {
            // Update timeline with filtered data
            this.timeline.setData({
                items: new vis.DataSet(equipmentItems),
                groups: new vis.DataSet(equipmentGroups)
            });

            // Fit to equipment data
            setTimeout(() => {
                if (this.timeline) {
                    this.timeline.fit();
                }
            }, 100);

            // Update navigation info
            this.updateNavigationInfo(equipmentName);
            
            this.showNotification(`Focando em: ${this.core.getDisplayName(equipmentName)}`, 'info');
        }
    }

    resetEquipmentView() {
        if (!this.timeline) return;

        // Reset to show all equipment
        this.timeline.setData({
            items: this.items,
            groups: this.groups
        });

        setTimeout(() => {
            if (this.timeline) {
                this.timeline.fit();
            }
        }, 100);

        this.currentEquipmentIndex = 0;
        this.updateNavigationInfo();
        this.showNotification('Visualizando todos os equipamentos', 'info');
    }

    updateNavigationInfo(currentEquipment = null) {
        const infoElement = document.getElementById('currentEquipmentInfo');
        if (infoElement) {
            if (currentEquipment) {
                const displayName = this.core.getDisplayName(currentEquipment);
                infoElement.textContent = `${this.currentEquipmentIndex + 1} / ${this.equipmentList.length} - ${displayName}`;
            } else {
                infoElement.textContent = `Todos (${this.equipmentList.length} equipamentos)`;
            }
        }
    }

    // =============================================================================
    // SISTEMA DE FILTROS SIMPLIFICADO
    // =============================================================================
    applyFilters() {
        if (!this.timeline) return;

        this.updateFilterState();

        let filteredItems = [];
        let filteredGroups = new Set();

        for (const item of this.items.get()) {
            if (this.passesFilters(item)) {
                filteredItems.push(item);
                const equipment = item.group.replace(/_apont$|_status$/, '');
                filteredGroups.add(equipment);
            }
        }

        // Filter groups
        const visibleGroupsArray = [];
        for (const group of this.groups.get()) {
            const equipment = group.id.replace(/_apont$|_status$/, '');
            if (!this.filterState.equipment || filteredGroups.has(equipment)) {
                visibleGroupsArray.push(group);
            }
        }

        this.timeline.setData({
            items: new vis.DataSet(filteredItems),
            groups: new vis.DataSet(visibleGroupsArray)
        });

        // Update statistics
        this.updateFilterStatistics(filteredItems.length, filteredGroups.size);
    }

    passesFilters(item) {
        // Equipment filter
        if (this.filterState.equipment) {
            const itemEquipment = item.group.replace(/_apont$|_status$/, '');
            if (itemEquipment !== this.filterState.equipment) return false;
        }

        // Group filters
        if (this.filterState.groups.size > 0) {
            const equipmentGroup = this.determineEquipmentGroup(item.group);
            if (!this.filterState.groups.has(equipmentGroup)) return false;
        }

        // Status filters
        if (this.filterState.status.size > 0 && item.className && item.className.includes('status-')) {
            const hasMatchingStatus = Array.from(this.filterState.status).some(status => 
                item.className.includes(`status-${status}`)
            );
            if (!hasMatchingStatus) return false;
        }

        // Appointment filters
        if (this.filterState.appointments.size > 0 && item.className && item.className.includes('apont-')) {
            const hasMatchingAppoint = Array.from(this.filterState.appointments).some(apont => 
                item.className.includes(`apont-${apont}`)
            );
            if (!hasMatchingAppoint) return false;
        }

        return true;
    }

    updateFilterStatistics(itemsCount, equipmentsCount) {
        document.getElementById('visibleItems').textContent = `${itemsCount} itens visíveis`;
        document.getElementById('visibleEquipments').textContent = `${equipmentsCount} equipamentos`;
    }

    handlePeriodChange() {
        const period = document.getElementById('periodFilter')?.value || 'week';
        const customDateSection = document.getElementById('customDateSection');
        
        if (period === 'custom') {
            if (customDateSection) customDateSection.style.display = 'block';
        } else {
            if (customDateSection) customDateSection.style.display = 'none';
            
            if (this.timeline) {
                const now = new Date();
                let start, end;

                switch (period) {
                    case 'today':
                        start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                        end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
                        break;
                    case 'yesterday':
                        end = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                        start = new Date(end.getTime() - 24 * 60 * 60 * 1000);
                        break;
                    case 'week':
                        end = now;
                        start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                        break;
                    case 'month':
                        end = now;
                        start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
                        break;
                    default:
                        this.timeline.fit();
                        return;
                }

                this.timeline.setWindow(start, end, { animation: { duration: 500 } });
                this.updateTimeRangeDisplay(start, end);
            }
        }
        
        this.applyFilters();
    }

    // =============================================================================
    // INTERFACE E NOTIFICAÇÕES
    // =============================================================================
    updateInterface() {
        // Update equipment filter dropdown
        this.updateEquipmentFilter();
        
        // Update counters
        document.getElementById('visibleItems').textContent = this.items.length;
        document.getElementById('visibleEquipments').textContent = this.equipmentMap.size;

        // Update last update time
        this.updateLastUpdateTime();
    }

    updateEquipmentFilter() {
        const equipmentSelect = document.getElementById('equipmentFilter');
        if (!equipmentSelect) return;

        const currentValue = equipmentSelect.value;
        equipmentSelect.innerHTML = '<option value="">Todos os equipamentos</option>';

        // Group equipment by type
        const groupedEquipment = {};
        for (const [equipName, data] of this.equipmentMap) {
            if (!groupedEquipment[data.group]) {
                groupedEquipment[data.group] = [];
            }
            groupedEquipment[data.group].push(equipName);
        }

        // Add options grouped by type
        Object.keys(groupedEquipment).sort().forEach(group => {
            const optgroup = document.createElement('optgroup');
            optgroup.label = this.getGroupDisplayName(group);
            
            groupedEquipment[group].sort().forEach(equipName => {
                const option = document.createElement('option');
                option.value = equipName;
                option.textContent = this.core.getDisplayName(equipName);
                if (equipName === currentValue) option.selected = true;
                optgroup.appendChild(option);
            });
            
            equipmentSelect.appendChild(optgroup);
        });
    }

    getGroupDisplayName(group) {
        const names = {
            'alta-pressao': '🔴 Alta Pressão',
            'baixa-pressao': '🔵 Baixa Pressão',
            'auto-vacuo': '🟣 Auto Vácuo',
            'hiper-vacuo': '⚫ Hiper Vácuo',
            'caminhoes': '🚛 Caminhões',
            'outros': '⚙️ Outros'
        };
        return names[group] || group;
    }

    updateSyncStatus(status, message) {
        const dot = document.getElementById('syncDot');
        const statusText = document.getElementById('syncStatus');
        
        if (dot) {
            dot.className = `sync-dot ${status}`;
        }
        if (statusText) {
            statusText.textContent = message;
        }
    }

    updateLastUpdateTime() {
        const element = document.getElementById('lastUpdateTime');
        if (element) {
            element.textContent = new Date().toLocaleTimeString('pt-BR', {
                hour: '2-digit',
                minute: '2-digit'
            });
        }
    }

    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.innerHTML = `
            <div style="display: flex; align-items: center; gap: 0.5rem;">
                <span>${this.getNotificationIcon(type)}</span>
                <span>${message}</span>
            </div>
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.style.animation = 'slideOutRight 0.3s ease-in';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.remove();
                }
            }, 300);
        }, 4000);
    }

    getNotificationIcon(type) {
        const icons = {
            success: '✅',
            error: '❌',
            warning: '⚠️',
            info: 'ℹ️'
        };
        return icons[type] || 'ℹ️';
    }

    // =============================================================================
    // ESTADOS DA TIMELINE
    // =============================================================================
    showTimelineEmptyState() {
        const container = document.getElementById('timeline');
        if (container) {
            container.innerHTML = `
                <div class="loading-state">
                    <div style="font-size: 3rem; margin-bottom: 1rem;">📊</div>
                    <div style="font-size: 1.1rem; font-weight: 600;">Nenhum dado disponível</div>
                    <div style="font-size: 0.9rem; margin-top: 0.5rem; color: #7f8c8d;">
                        Aguardando sincronização de dados do GitHub...
                    </div>
                    <button onclick="productivitySystem.syncFromGitHub()" 
                            style="margin-top: 1rem; padding: 0.75rem 1.5rem; background: linear-gradient(135deg, #667eea, #764ba2); color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: 600;">
                        🔄 Tentar Novamente
                    </button>
                </div>
            `;
        }
    }

    showTimelineErrorState(error) {
        const container = document.getElementById('timeline');
        if (container) {
            container.innerHTML = `
                <div class="loading-state">
                    <div style="font-size: 3rem; margin-bottom: 1rem; color: #e74c3c;">⚠️</div>
                    <div style="color: #e74c3c; font-weight: 600;">Erro ao carregar timeline</div>
                    <div style="font-size: 0.9rem; margin-top: 0.5rem; color: #7f8c8d; max-width: 400px; text-align: center;">
                        ${error}
                    </div>
                    <button onclick="productivitySystem.syncFromGitHub()" 
                            style="margin-top: 1rem; padding: 0.75rem 1.5rem; background: linear-gradient(135deg, #667eea, #764ba2); color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: 600;">
                        🔄 Tentar Novamente
                    </button>
                </div>
            `;
        }
    }

    // =============================================================================
    // MÉTODOS PÚBLICOS
    // =============================================================================
    async manualSync() {
        await this.syncFromGitHub();
    }

    getSystemStatus() {
        return {
            isUpdating: this.isUpdating,
            equipmentCount: this.equipmentMap.size,
            itemsCount: this.items.length,
            lastUpdate: this.lastDataHash ? new Date() : null
        };
    }

    // =============================================================================
    // CLEANUP E DESTRUCTOR
    // =============================================================================
    destroy() {
        this.core.addDebugLog('Destruindo sistema de produtividade');
        
        // Stop intervals
        if (this.autoSyncInterval) {
            clearInterval(this.autoSyncInterval);
            this.autoSyncInterval = null;
        }
        
        // Destroy timeline
        if (this.timeline) {
            try {
                this.timeline.destroy();
            } catch (error) {
                this.core.addDebugLog(`Erro ao destruir timeline: ${error.message}`, 'warning');
            }
            this.timeline = null;
        }
        
        // Clear data structures
        this.items.clear();
        this.groups.clear();
        this.equipmentMap.clear();
        
        // Destroy modules
        if (this.analytics) {
            this.analytics.destroy();
            this.analytics = null;
        }
        
        if (this.rules) {
            this.rules.destroy();
            this.rules = null;
        }
        
        if (this.core) {
            this.core.destroy();
            this.core = null;
        }
        
        console.log('Sistema de Produtividade destruído com sucesso');
    }
}

// =============================================================================
// EXPORTAÇÃO E FUNÇÕES GLOBAIS
// =============================================================================
if (typeof window !== 'undefined') {
    window.ProductivitySystem = ProductivitySystem;
    
    // Global helper function for clearing filters
    window.clearAllFilters = function() {
        if (window.productivitySystem) {
            // Reset all filter chips
            document.querySelectorAll('.filter-chip.active').forEach(chip => {
                chip.classList.remove('active');
            });
            
            // Reset form inputs
            document.getElementById('equipmentFilter').value = '';
            document.getElementById('periodFilter').value = 'week';
            
            // Reset filter state
            window.productivitySystem.filterState = {
                equipment: '',
                groups: new Set(),
                status: new Set(),
                appointments: new Set(),
                period: 'week',
                isActive: false
            };
            
            // Apply empty filters
            window.productivitySystem.applyFilters();
            
            window.productivitySystem.showNotification('Todos os filtros removidos', 'success');
        }
    };
}
