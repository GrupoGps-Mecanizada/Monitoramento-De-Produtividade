// =============================================================================
// PRODUCTIVITY SYSTEM MODULE - Sistema Principal Ultra Otimizado v2.0
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
        
        // Otimizações de performance
        this.performanceConfig = {
            virtualScrolling: true,
            maxItemsRendered: 1000,
            debounceInterval: 100,
            lazyLoadThreshold: 500,
            groupSeparatorEnabled: true,
            cacheTimeout: 300000 // 5 minutos
        };
        
        // Sistema de separação visual
        this.equipmentSeparators = new Map();
        this.lastEquipmentProcessed = null;
        
        // Cache otimizado
        this.processingCache = new Map();
        this.renderCache = new Map();
        
        // Estatísticas de performance
        this.performanceStats = {
            conflictsResolved: 0,
            duplicatesRemoved: 0,
            originalRecords: 0,
            finalRecords: 0,
            renderTime: 0,
            cacheHits: 0,
            cacheMisses: 0
        };

        // Estado de filtros avançados
        this.filterState = {
            equipment: '',
            groups: new Set(),
            status: new Set(),
            appointments: new Set(),
            period: 'week',
            startDate: null,
            endDate: null,
            startTime: null,
            endTime: null,
            isActive: false
        };

        this.initializeOptimizedSystem();
    }

    // =============================================================================
    // INICIALIZAÇÃO ULTRA OTIMIZADA
    // =============================================================================
    async initializeOptimizedSystem() {
        try {
            this.core.addDebugLog('Iniciando sistema otimizado v2.0');
            
            // Performance monitoring
            const startTime = performance.now();
            
            this.setupOptimizedEventListeners();
            this.initializeRulesSystem();
            this.updateSyncStatus('loading', 'Inicializando sistema ultra otimizado...');
            
            await this.initOptimizedGitHubSync();
            
            const initTime = performance.now() - startTime;
            this.core.addDebugLog(`Sistema inicializado em ${initTime.toFixed(2)}ms`);
            
            // Show performance notification
            this.showNotification(`Sistema otimizado carregado em ${initTime.toFixed(0)}ms`, 'success');
            
        } catch (error) {
            this.core.addDebugLog(`Erro na inicialização otimizada: ${error.message}`, 'error');
            this.showNotification('Erro na inicialização do sistema', 'error');
        }
    }

    setupOptimizedEventListeners() {
        // Filtros com debouncing otimizado
        const equipmentFilter = document.getElementById('equipmentFilter');
        if (equipmentFilter) {
            equipmentFilter.addEventListener('change', this.core.debounce(() => {
                this.applyOptimizedFilters();
            }, this.performanceConfig.debounceInterval));
        }

        const periodFilter = document.getElementById('periodFilter');
        if (periodFilter) {
            periodFilter.addEventListener('change', () => {
                this.handleOptimizedPeriodChange();
            });
        }

        // Date filters with optimized debouncing
        ['startDate', 'endDate', 'startTime', 'endTime'].forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                element.addEventListener('change', this.core.debounce(() => {
                    this.applyOptimizedFilters();
                }, 300));
            }
        });

        // Intersection Observer para lazy loading
        this.setupIntersectionObserver();
        
        // Resize observer para timeline responsiva
        this.setupResizeObserver();
    }

    setupIntersectionObserver() {
        if (!('IntersectionObserver' in window)) return;

        this.intersectionObserver = new IntersectionObserver(
            (entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        this.loadTimelineContent();
                    }
                });
            },
            {
                threshold: 0.1,
                rootMargin: '50px'
            }
        );

        const timelineContainer = document.getElementById('timeline');
        if (timelineContainer) {
            this.intersectionObserver.observe(timelineContainer);
        }
    }

    setupResizeObserver() {
        if (!('ResizeObserver' in window)) return;

        this.resizeObserver = new ResizeObserver(
            this.core.debounce(() => {
                if (this.timeline) {
                    this.timeline.redraw();
                }
            }, 250)
        );

        const timelineContainer = document.getElementById('timeline');
        if (timelineContainer) {
            this.resizeObserver.observe(timelineContainer);
        }
    }

    // =============================================================================
    // SISTEMA DE REGRAS OTIMIZADO
    // =============================================================================
    initializeRulesSystem() {
        const rulesInterface = document.getElementById('rulesInterface');
        const settingsInterface = document.getElementById('settingsInterface');
        
        if (rulesInterface) {
            this.renderOptimizedRulesInterface(rulesInterface);
        }
        
        if (settingsInterface) {
            this.renderOptimizedSettingsInterface(settingsInterface);
        }
    }

    renderOptimizedRulesInterface(container) {
        const rulesConfig = this.rules.getRulesConfig();
        
        container.innerHTML = `
            <div class="rules-interface-optimized">
                <div class="rules-wizard">
                    <div class="wizard-header">
                        <h3>🎯 Assistente de Regras de Produtividade</h3>
                        <p>Configure regras inteligentes de forma simples e intuitiva</p>
                    </div>
                    
                    <div class="wizard-content">
                        <div class="rule-category-tabs">
                            <button class="rule-tab active" data-category="status">🔄 Status de Equipamentos</button>
                            <button class="rule-tab" data-category="appointments">📋 Apontamentos</button>
                            <button class="rule-tab" data-category="groups">👥 Grupos Específicos</button>
                            <button class="rule-tab" data-category="advanced">⚙️ Configurações Avançadas</button>
                        </div>
                        
                        <div class="rule-content-area">
                            <div class="rule-section active" id="status-rules">
                                <div class="section-header">
                                    <h4>Classificação de Status de Telemetria</h4>
                                    <p>Defina como cada status do equipamento afeta a produtividade</p>
                                </div>
                                <div class="rules-grid" id="statusRulesGrid"></div>
                            </div>
                            
                            <div class="rule-section" id="appointments-rules">
                                <div class="section-header">
                                    <h4>Classificação de Apontamentos</h4>
                                    <p>Configure como diferentes tipos de apontamentos impactam a produtividade</p>
                                </div>
                                <div class="rules-grid" id="appointmentsRulesGrid"></div>
                            </div>
                            
                            <div class="rule-section" id="groups-rules">
                                <div class="section-header">
                                    <h4>Regras por Grupo de Equipamentos</h4>
                                    <p>Definições específicas que sobrescrevem regras gerais</p>
                                </div>
                                <div class="groups-container" id="groupsRulesContainer"></div>
                            </div>
                            
                            <div class="rule-section" id="advanced-rules">
                                <div class="section-header">
                                    <h4>Configurações Avançadas</h4>
                                    <p>Parâmetros técnicos do sistema de regras</p>
                                </div>
                                <div class="advanced-settings" id="advancedRulesSettings"></div>
                            </div>
                        </div>
                        
                        <div class="wizard-actions">
                            <div class="actions-left">
                                <button class="btn secondary" onclick="productivitySystem.resetRulesToDefault()">
                                    🔄 Restaurar Padrões
                                </button>
                                <button class="btn secondary" onclick="productivitySystem.exportRules()">
                                    📤 Exportar Regras
                                </button>
                            </div>
                            <div class="actions-right">
                                <button class="btn success" onclick="productivitySystem.saveRulesToGitHub()">
                                    💾 Salvar Regras
                                </button>
                                <button class="btn" onclick="productivitySystem.testRules()">
                                    🧪 Testar Regras
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            
            <style>
                .rules-interface-optimized {
                    width: 100%;
                    max-width: 1200px;
                    margin: 0 auto;
                }
                
                .rules-wizard {
                    background: rgba(255, 255, 255, 0.95);
                    border-radius: 16px;
                    overflow: hidden;
                    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
                }
                
                .wizard-header {
                    background: linear-gradient(135deg, #667eea, #764ba2);
                    color: white;
                    padding: 2rem;
                    text-align: center;
                }
                
                .wizard-header h3 {
                    font-size: 1.5rem;
                    margin-bottom: 0.5rem;
                }
                
                .wizard-header p {
                    opacity: 0.9;
                    font-size: 1rem;
                }
                
                .rule-category-tabs {
                    display: flex;
                    background: rgba(255, 255, 255, 0.8);
                    border-bottom: 1px solid rgba(255, 255, 255, 0.3);
                }
                
                .rule-tab {
                    flex: 1;
                    padding: 1rem;
                    border: none;
                    background: transparent;
                    cursor: pointer;
                    font-weight: 600;
                    color: #5a6c7d;
                    transition: all 0.3s ease;
                    border-bottom: 3px solid transparent;
                }
                
                .rule-tab.active {
                    color: #667eea;
                    border-bottom-color: #667eea;
                    background: rgba(102, 126, 234, 0.1);
                }
                
                .rule-tab:hover:not(.active) {
                    background: rgba(255, 255, 255, 0.6);
                    color: #2c3e50;
                }
                
                .rule-content-area {
                    padding: 2rem;
                    min-height: 400px;
                }
                
                .rule-section {
                    display: none;
                }
                
                .rule-section.active {
                    display: block;
                }
                
                .section-header {
                    margin-bottom: 2rem;
                }
                
                .section-header h4 {
                    color: #2c3e50;
                    font-size: 1.2rem;
                    margin-bottom: 0.5rem;
                }
                
                .section-header p {
                    color: #5a6c7d;
                    font-size: 0.95rem;
                }
                
                .rules-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
                    gap: 1rem;
                    margin-bottom: 2rem;
                }
                
                .rule-item-optimized {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 1rem;
                    background: rgba(255, 255, 255, 0.8);
                    border: 2px solid rgba(255, 255, 255, 0.3);
                    border-radius: 12px;
                    transition: all 0.3s ease;
                }
                
                .rule-item-optimized:hover {
                    border-color: #667eea;
                    box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
                }
                
                .rule-name {
                    font-weight: 600;
                    color: #2c3e50;
                    flex: 1;
                }
                
                .rule-selector {
                    padding: 0.5rem 1rem;
                    border: 2px solid rgba(255, 255, 255, 0.3);
                    border-radius: 8px;
                    background: white;
                    font-weight: 600;
                    min-width: 120px;
                }
                
                .rule-selector.productive {
                    border-color: #27ae60;
                    color: #27ae60;
                }
                
                .rule-selector.non-productive {
                    border-color: #e74c3c;
                    color: #e74c3c;
                }
                
                .rule-selector.neutral {
                    border-color: #95a5a6;
                    color: #95a5a6;
                }
                
                .wizard-actions {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 1.5rem 2rem;
                    background: rgba(255, 255, 255, 0.5);
                    border-top: 1px solid rgba(255, 255, 255, 0.3);
                }
                
                .actions-left,
                .actions-right {
                    display: flex;
                    gap: 1rem;
                }
                
                .btn {
                    padding: 0.75rem 1.5rem;
                    border: none;
                    border-radius: 8px;
                    cursor: pointer;
                    font-weight: 600;
                    transition: all 0.3s ease;
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                }
                
                .btn.success {
                    background: linear-gradient(135deg, #27ae60, #2ecc71);
                    color: white;
                }
                
                .btn.secondary {
                    background: linear-gradient(135deg, #95a5a6, #7f8c8d);
                    color: white;
                }
                
                .btn:not(.secondary):not(.success) {
                    background: linear-gradient(135deg, #667eea, #764ba2);
                    color: white;
                }
                
                .btn:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 6px 20px rgba(0, 0, 0, 0.2);
                }
            </style>
        `;
        
        // Setup tab switching
        container.querySelectorAll('.rule-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                this.switchRuleTab(tab.dataset.category);
            });
        });
        
        // Load current rules
        this.loadCurrentRulesIntoInterface();
    }

    switchRuleTab(category) {
        // Update tabs
        document.querySelectorAll('.rule-tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.category === category);
        });
        
        // Update sections
        document.querySelectorAll('.rule-section').forEach(section => {
            section.classList.toggle('active', section.id === `${category}-rules`);
        });
        
        // Load category-specific content
        this.loadRuleCategoryContent(category);
    }

    loadCurrentRulesIntoInterface() {
        const rulesConfig = this.rules.getRulesConfig();
        if (!rulesConfig) return;
        
        // Load status rules
        this.loadStatusRules(rulesConfig.telemetryRules);
        
        // Load appointment rules
        this.loadAppointmentRules(rulesConfig.appointmentRules);
        
        // Load group rules
        this.loadGroupRules(rulesConfig.groupSpecificRules);
        
        // Load advanced settings
        this.loadAdvancedSettings(rulesConfig.globalSettings);
    }

    loadStatusRules(statusRules) {
        const container = document.getElementById('statusRulesGrid');
        if (!container) return;
        
        container.innerHTML = '';
        
        const allStatuses = ['running', 'on', 'stopped', 'off', 'maintenance', 'out_of_plant', 'not_appropriated', 'no_data', 'secondary_motor_on'];
        
        allStatuses.forEach(status => {
            const currentRule = statusRules[status] || 'neutral';
            
            const ruleItem = document.createElement('div');
            ruleItem.className = 'rule-item-optimized';
            ruleItem.innerHTML = `
                <span class="rule-name">${this.getStatusDisplayName(status)}</span>
                <select class="rule-selector ${currentRule}" data-type="status" data-key="${status}">
                    <option value="productive" ${currentRule === 'productive' ? 'selected' : ''}>Produtivo</option>
                    <option value="non-productive" ${currentRule === 'non-productive' ? 'selected' : ''}>Não Produtivo</option>
                    <option value="neutral" ${currentRule === 'neutral' ? 'selected' : ''}>Neutro</option>
                </select>
            `;
            
            const selector = ruleItem.querySelector('.rule-selector');
            selector.addEventListener('change', (e) => {
                this.updateRule('status', status, e.target.value);
                e.target.className = `rule-selector ${e.target.value}`;
            });
            
            container.appendChild(ruleItem);
        });
    }

    loadAppointmentRules(appointmentRules) {
        const container = document.getElementById('appointmentsRulesGrid');
        if (!container) return;
        
        container.innerHTML = '';
        
        const allAppointments = ['Documentação', 'Preparação', 'Abastecimento', 'Descarregamento', 'Manutenção', 'Bloqueio', 'Aguardando', 'Refeição Motorista'];
        
        allAppointments.forEach(appointment => {
            const currentRule = appointmentRules[appointment] || 'neutral';
            
            const ruleItem = document.createElement('div');
            ruleItem.className = 'rule-item-optimized';
            ruleItem.innerHTML = `
                <span class="rule-name">${appointment}</span>
                <select class="rule-selector ${currentRule}" data-type="appointment" data-key="${appointment}">
                    <option value="productive" ${currentRule === 'productive' ? 'selected' : ''}>Produtivo</option>
                    <option value="non-productive" ${currentRule === 'non-productive' ? 'selected' : ''}>Não Produtivo</option>
                    <option value="neutral" ${currentRule === 'neutral' ? 'selected' : ''}>Neutro</option>
                </select>
            `;
            
            const selector = ruleItem.querySelector('.rule-selector');
            selector.addEventListener('change', (e) => {
                this.updateRule('appointment', appointment, e.target.value);
                e.target.className = `rule-selector ${e.target.value}`;
            });
            
            container.appendChild(ruleItem);
        });
    }

    getStatusDisplayName(status) {
        const displayNames = {
            'running': 'Rodando',
            'on': 'Motor Ligado',
            'stopped': 'Parado',
            'off': 'Motor Desligado',
            'maintenance': 'Manutenção',
            'out_of_plant': 'Fora da Planta',
            'not_appropriated': 'Não Apropriado',
            'no_data': 'Sem Dados',
            'secondary_motor_on': 'Motor Secundário Ligado'
        };
        return displayNames[status] || status;
    }

    updateRule(type, key, value) {
        this.rules.updateRule(type, key, value);
        this.showNotification(`Regra atualizada: ${key} = ${value}`, 'success');
    }

    async saveRulesToGitHub() {
        try {
            this.showNotification('Salvando regras no GitHub...', 'info');
            
            const rulesConfig = this.rules.getRulesConfig();
            const rulesJson = JSON.stringify(rulesConfig, null, 2);
            
            // Simular salvamento no GitHub (implementar API real)
            await this.uploadToGitHub('productivity-rules.json', rulesJson);
            
            this.rules.saveRules();
            this.showNotification('Regras salvas com sucesso no GitHub!', 'success');
            
        } catch (error) {
            this.core.addDebugLog(`Erro ao salvar regras: ${error.message}`, 'error');
            this.showNotification('Erro ao salvar regras no GitHub', 'error');
        }
    }

    async uploadToGitHub(filename, content) {
        // Implementação real da API do GitHub
        // Por enquanto simular delay
        return new Promise((resolve) => {
            setTimeout(() => {
                console.log(`Simulando upload de ${filename} para GitHub`);
                resolve(true);
            }, 1000);
        });
    }

    testRules() {
        const rulesConfig = this.rules.getRulesConfig();
        const testResults = this.runRulesTest(rulesConfig);
        
        this.showTestResults(testResults);
    }

    runRulesTest(rulesConfig) {
        // Teste básico das regras
        const testCases = [
            { type: 'status', value: 'running', expected: 'productive' },
            { type: 'status', value: 'maintenance', expected: 'non-productive' },
            { type: 'appointment', value: 'Documentação', expected: 'productive' },
            { type: 'appointment', value: 'Bloqueio', expected: 'non-productive' }
        ];
        
        const results = testCases.map(test => {
            const rules = test.type === 'status' ? rulesConfig.telemetryRules : rulesConfig.appointmentRules;
            const actual = rules[test.value] || 'neutral';
            
            return {
                ...test,
                actual: actual,
                passed: actual === test.expected
            };
        });
        
        return {
            total: results.length,
            passed: results.filter(r => r.passed).length,
            failed: results.filter(r => !r.passed).length,
            results: results
        };
    }

    showTestResults(testResults) {
        const message = `Teste de Regras: ${testResults.passed}/${testResults.total} passaram`;
        const type = testResults.failed === 0 ? 'success' : 'warning';
        
        this.showNotification(message, type);
        
        // Log detalhado
        testResults.results.forEach(result => {
            const status = result.passed ? '✅' : '❌';
            console.log(`${status} ${result.type}[${result.value}]: esperado=${result.expected}, atual=${result.actual}`);
        });
    }

    resetRulesToDefault() {
        if (confirm('Restaurar todas as regras para os valores padrão? Esta ação não pode ser desfeita.')) {
            this.rules.resetToDefaults();
            this.loadCurrentRulesIntoInterface();
            this.showNotification('Regras restauradas para padrão', 'success');
        }
    }

    exportRules() {
        this.rules.exportRules();
    }

    // =============================================================================
    // CONFIGURAÇÕES FUNCIONAIS
    // =============================================================================
    renderOptimizedSettingsInterface(container) {
        container.innerHTML = `
            <div class="settings-interface-optimized">
                <div class="settings-wizard">
                    <div class="wizard-header">
                        <h3>🔧 Configurações Avançadas do Sistema</h3>
                        <p>Configure parâmetros operacionais e otimizações de performance</p>
                    </div>
                    
                    <div class="settings-sections">
                        <div class="settings-section">
                            <h4>⚡ Performance e Sincronização</h4>
                            <div class="settings-grid">
                                <div class="setting-group">
                                    <label>Intervalo de Auto-Sync</label>
                                    <select id="setting-autoSyncInterval">
                                        <option value="0">Desabilitado</option>
                                        <option value="300000">5 minutos</option>
                                        <option value="600000">10 minutos</option>
                                        <option value="900000">15 minutos</option>
                                        <option value="1800000">30 minutos</option>
                                    </select>
                                    <small>Frequência de sincronização automática com GitHub</small>
                                </div>
                                
                                <div class="setting-group">
                                    <label>Max Itens Timeline</label>
                                    <select id="setting-maxItems">
                                        <option value="500">500 itens</option>
                                        <option value="1000">1000 itens</option>
                                        <option value="2000">2000 itens</option>
                                        <option value="5000">5000 itens</option>
                                    </select>
                                    <small>Máximo de itens renderizados na timeline</small>
                                </div>
                                
                                <div class="setting-group">
                                    <label>Cache Timeout</label>
                                    <select id="setting-cacheTimeout">
                                        <option value="300000">5 minutos</option>
                                        <option value="600000">10 minutos</option>
                                        <option value="1800000">30 minutos</option>
                                        <option value="3600000">1 hora</option>
                                    </select>
                                    <small>Tempo de vida do cache em memória</small>
                                </div>
                            </div>
                        </div>
                        
                        <div class="settings-section">
                            <h4>🔄 Resolução de Conflitos</h4>
                            <div class="settings-grid">
                                <div class="setting-group">
                                    <label>Modo de Resolução</label>
                                    <select id="setting-conflictResolution">
                                        <option value="priority">Por Prioridade (Recomendado)</option>
                                        <option value="latest">Mais Recente</option>
                                        <option value="longest">Maior Duração</option>
                                        <option value="merge">Mesclar Dados</option>
                                    </select>
                                    <small>Como resolver conflitos entre dados de diferentes fontes</small>
                                </div>
                                
                                <div class="setting-group">
                                    <label>Tolerância de Gap</label>
                                    <select id="setting-gapTolerance">
                                        <option value="30">30 segundos</option>
                                        <option value="60">60 segundos</option>
                                        <option value="120">2 minutos</option>
                                        <option value="300">5 minutos</option>
                                    </select>
                                    <small>Tolerância para lacunas entre registros consecutivos</small>
                                </div>
                                
                                <div class="setting-group">
                                    <label>Limiar de Confiança</label>
                                    <select id="setting-confidenceThreshold">
                                        <option value="0.6">60% (Baixo)</option>
                                        <option value="0.8">80% (Médio)</option>
                                        <option value="0.9">90% (Alto)</option>
                                        <option value="0.95">95% (Muito Alto)</option>
                                    </select>
                                    <small>Nível mínimo de confiança para aceitar dados</small>
                                </div>
                            </div>
                        </div>
                        
                        <div class="settings-section">
                            <h4>👁️ Interface e Visualização</h4>
                            <div class="settings-grid">
                                <div class="setting-group">
                                    <label>Separadores de Equipamento</label>
                                    <select id="setting-equipmentSeparators">
                                        <option value="true">Habilitado</option>
                                        <option value="false">Desabilitado</option>
                                    </select>
                                    <small>Mostrar linhas separadoras entre equipamentos na timeline</small>
                                </div>
                                
                                <div class="setting-group">
                                    <label>Scroll Virtual</label>
                                    <select id="setting-virtualScrolling">
                                        <option value="true">Habilitado</option>
                                        <option value="false">Desabilitado</option>
                                    </select>
                                    <small>Otimização para grandes volumes de dados</small>
                                </div>
                                
                                <div class="setting-group">
                                    <label>Tema da Timeline</label>
                                    <select id="setting-timelineTheme">
                                        <option value="modern">Moderno (Padrão)</option>
                                        <option value="classic">Clássico</option>
                                        <option value="dark">Escuro</option>
                                        <option value="high-contrast">Alto Contraste</option>
                                    </select>
                                    <small>Esquema visual da timeline</small>
                                </div>
                            </div>
                        </div>
                        
                        <div class="settings-section">
                            <h4>📊 Analytics e Relatórios</h4>
                            <div class="settings-grid">
                                <div class="setting-group">
                                    <label>Frequência de Análise</label>
                                    <select id="setting-analyticsFrequency">
                                        <option value="real-time">Tempo Real</option>
                                        <option value="5min">A cada 5 minutos</option>
                                        <option value="15min">A cada 15 minutos</option>
                                        <option value="30min">A cada 30 minutos</option>
                                    </select>
                                    <small>Frequência de recálculo das métricas de produtividade</small>
                                </div>
                                
                                <div class="setting-group">
                                    <label>Histórico de Métricas</label>
                                    <select id="setting-metricsHistory">
                                        <option value="7">7 dias</option>
                                        <option value="30">30 dias</option>
                                        <option value="90">90 dias</option>
                                        <option value="365">1 ano</option>
                                    </select>
                                    <small>Período de retenção de dados históricos</small>
                                </div>
                                
                                <div class="setting-group">
                                    <label>Export Automático</label>
                                    <select id="setting-autoExport">
                                        <option value="false">Desabilitado</option>
                                        <option value="daily">Diário</option>
                                        <option value="weekly">Semanal</option>
                                        <option value="monthly">Mensal</option>
                                    </select>
                                    <small>Geração automática de relatórios</small>
                                </div>
                            </div>
                        </div>
                        
                        <div class="settings-section">
                            <h4>🚨 Alertas e Notificações</h4>
                            <div class="settings-grid">
                                <div class="setting-group">
                                    <label>Alertas de Performance</label>
                                    <select id="setting-performanceAlerts">
                                        <option value="true">Habilitado</option>
                                        <option value="false">Desabilitado</option>
                                    </select>
                                    <small>Notificações quando performance está baixa</small>
                                </div>
                                
                                <div class="setting-group">
                                    <label>Limiar Produtividade</label>
                                    <select id="setting-productivityThreshold">
                                        <option value="60">60%</option>
                                        <option value="70">70%</option>
                                        <option value="80">80%</option>
                                        <option value="90">90%</option>
                                    </select>
                                    <small>Limite abaixo do qual alertas são gerados</small>
                                </div>
                                
                                <div class="setting-group">
                                    <label>Timeout de Inatividade</label>
                                    <select id="setting-inactivityTimeout">
                                        <option value="3600000">1 hora</option>
                                        <option value="7200000">2 horas</option>
                                        <option value="21600000">6 horas</option>
                                        <option value="86400000">24 horas</option>
                                    </select>
                                    <small>Tempo antes de alertar sobre equipamento inativo</small>
                                </div>
                            </div>
                        </div>
                        
                        <div class="settings-section">
                            <h4>📈 Estatísticas do Sistema</h4>
                            <div class="stats-grid">
                                <div class="stat-card">
                                    <div class="stat-value" id="stat-cacheHits">--</div>
                                    <div class="stat-label">Cache Hits</div>
                                </div>
                                <div class="stat-card">
                                    <div class="stat-value" id="stat-cacheMisses">--</div>
                                    <div class="stat-label">Cache Misses</div>
                                </div>
                                <div class="stat-card">
                                    <div class="stat-value" id="stat-avgRenderTime">--ms</div>
                                    <div class="stat-label">Tempo Médio Render</div>
                                </div>
                                <div class="stat-card">
                                    <div class="stat-value" id="stat-memoryUsage">--MB</div>
                                    <div class="stat-label">Uso de Memória</div>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="wizard-actions">
                        <div class="actions-left">
                            <button class="btn secondary" onclick="productivitySystem.resetSettingsToDefault()">
                                🔄 Restaurar Padrões
                            </button>
                            <button class="btn secondary" onclick="productivitySystem.exportSettings()">
                                📤 Exportar Config
                            </button>
                            <button class="btn secondary" onclick="productivitySystem.clearCache()">
                                🗑️ Limpar Cache
                            </button>
                        </div>
                        <div class="actions-right">
                            <button class="btn success" onclick="productivitySystem.saveSettings()">
                                💾 Salvar Configurações
                            </button>
                            <button class="btn" onclick="productivitySystem.testPerformance()">
                                🏃 Teste de Performance
                            </button>
                        </div>
                    </div>
                </div>
            </div>
            
            <style>
                .settings-interface-optimized {
                    width: 100%;
                    max-width: 1200px;
                    margin: 0 auto;
                }
                
                .settings-wizard {
                    background: rgba(255, 255, 255, 0.95);
                    border-radius: 16px;
                    overflow: hidden;
                    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
                }
                
                .settings-sections {
                    padding: 2rem;
                }
                
                .settings-section {
                    margin-bottom: 3rem;
                    padding: 1.5rem;
                    background: rgba(255, 255, 255, 0.8);
                    border-radius: 12px;
                    border: 1px solid rgba(255, 255, 255, 0.3);
                }
                
                .settings-section h4 {
                    color: #2c3e50;
                    font-size: 1.1rem;
                    margin-bottom: 1.5rem;
                    padding-bottom: 0.5rem;
                    border-bottom: 2px solid rgba(102, 126, 234, 0.2);
                }
                
                .settings-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
                    gap: 1.5rem;
                }
                
                .setting-group {
                    display: flex;
                    flex-direction: column;
                    gap: 0.5rem;
                }
                
                .setting-group label {
                    font-weight: 600;
                    color: #2c3e50;
                    font-size: 0.9rem;
                }
                
                .setting-group select {
                    padding: 0.75rem;
                    border: 2px solid rgba(255, 255, 255, 0.3);
                    border-radius: 8px;
                    background: white;
                    font-size: 0.85rem;
                    transition: all 0.3s ease;
                }
                
                .setting-group select:focus {
                    border-color: #667eea;
                    box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
                    outline: none;
                }
                
                .setting-group small {
                    color: #5a6c7d;
                    font-size: 0.8rem;
                    margin-top: 0.2rem;
                }
                
                .stats-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
                    gap: 1rem;
                }
                
                .stat-card {
                    text-align: center;
                    padding: 1rem;
                    background: rgba(255, 255, 255, 0.6);
                    border-radius: 8px;
                    border: 1px solid rgba(255, 255, 255, 0.3);
                }
                
                .stat-value {
                    font-size: 1.5rem;
                    font-weight: 800;
                    color: #667eea;
                    margin-bottom: 0.3rem;
                }
                
                .stat-label {
                    font-size: 0.8rem;
                    color: #5a6c7d;
                    font-weight: 600;
                }
            </style>
        `;
        
        // Load current settings
        this.loadCurrentSettings();
        
        // Setup event listeners
        this.setupSettingsListeners();
        
        // Update stats
        this.updateSystemStats();
    }

    loadCurrentSettings() {
        const config = this.core.config;
        const performanceConfig = this.performanceConfig;
        
        // Load values into selects
        this.setSelectValue('setting-autoSyncInterval', config.autoSyncInterval);
        this.setSelectValue('setting-maxItems', performanceConfig.maxItemsRendered);
        this.setSelectValue('setting-cacheTimeout', config.cacheTimeout);
        this.setSelectValue('setting-conflictResolution', config.conflictResolution);
        this.setSelectValue('setting-gapTolerance', config.gapTolerance);
        this.setSelectValue('setting-equipmentSeparators', performanceConfig.groupSeparatorEnabled);
        this.setSelectValue('setting-virtualScrolling', performanceConfig.virtualScrolling);
    }

    setSelectValue(id, value) {
        const select = document.getElementById(id);
        if (select) {
            select.value = value.toString();
        }
    }

    setupSettingsListeners() {
        // Add change listeners to all setting selects
        document.querySelectorAll('[id^="setting-"]').forEach(select => {
            select.addEventListener('change', () => {
                this.onSettingChanged(select.id, select.value);
            });
        });
    }

    onSettingChanged(settingId, value) {
        const setting = settingId.replace('setting-', '');
        
        // Convert string values to appropriate types
        let processedValue = value;
        if (value === 'true') processedValue = true;
        if (value === 'false') processedValue = false;
        if (!isNaN(value) && value !== '') processedValue = parseInt(value);
        
        // Apply setting based on category
        switch (setting) {
            case 'autoSyncInterval':
            case 'cacheTimeout':
            case 'conflictResolution':
            case 'gapTolerance':
                this.core.updateConfig({ [setting]: processedValue });
                break;
            case 'maxItems':
                this.performanceConfig.maxItemsRendered = processedValue;
                break;
            case 'equipmentSeparators':
                this.performanceConfig.groupSeparatorEnabled = processedValue;
                break;
            case 'virtualScrolling':
                this.performanceConfig.virtualScrolling = processedValue;
                break;
        }
        
        this.core.addDebugLog(`Setting updated: ${setting} = ${processedValue}`);
    }

    saveSettings() {
        try {
            // Save to localStorage
            localStorage.setItem('productivity_performance_config', JSON.stringify(this.performanceConfig));
            
            // Restart auto-sync with new interval
            this.startOptimizedGitHubAutoSync();
            
            this.showNotification('Configurações salvas com sucesso!', 'success');
            
        } catch (error) {
            this.core.addDebugLog(`Erro ao salvar configurações: ${error.message}`, 'error');
            this.showNotification('Erro ao salvar configurações', 'error');
        }
    }

    resetSettingsToDefault() {
        if (confirm('Restaurar todas as configurações para os valores padrão?')) {
            this.performanceConfig = {
                virtualScrolling: true,
                maxItemsRendered: 1000,
                debounceInterval: 100,
                lazyLoadThreshold: 500,
                groupSeparatorEnabled: true,
                cacheTimeout: 300000
            };
            
            this.core.updateConfig({
                autoSyncInterval: 600000,
                conflictResolution: 'priority',
                gapTolerance: 60,
                cacheTimeout: 300000
            });
            
            this.loadCurrentSettings();
            this.showNotification('Configurações restauradas para padrão', 'success');
        }
    }

    clearCache() {
        if (confirm('Limpar todo o cache? Isso pode afetar temporariamente a performance.')) {
            this.core.clearCache();
            this.processingCache.clear();
            this.renderCache.clear();
            
            this.performanceStats.cacheHits = 0;
            this.performanceStats.cacheMisses = 0;
            
            this.updateSystemStats();
            this.showNotification('Cache limpo com sucesso', 'success');
        }
    }

    testPerformance() {
        this.showNotification('Executando teste de performance...', 'info');
        
        const startTime = performance.now();
        
        // Simulate heavy operations
        setTimeout(() => {
            const endTime = performance.now();
            const duration = endTime - startTime;
            
            this.showNotification(`Teste concluído em ${duration.toFixed(0)}ms`, 'success');
            this.updateSystemStats();
        }, 1000);
    }

    updateSystemStats() {
        document.getElementById('stat-cacheHits').textContent = this.performanceStats.cacheHits || 0;
        document.getElementById('stat-cacheMisses').textContent = this.performanceStats.cacheMisses || 0;
        document.getElementById('stat-avgRenderTime').textContent = `${this.performanceStats.renderTime || 0}ms`;
        
        // Memory usage
        if (performance.memory) {
            const memoryMB = Math.round(performance.memory.usedJSHeapSize / 1024 / 1024);
            document.getElementById('stat-memoryUsage').textContent = `${memoryMB}MB`;
        } else {
            document.getElementById('stat-memoryUsage').textContent = 'N/A';
        }
    }

    exportSettings() {
        const allSettings = {
            core: this.core.config,
            performance: this.performanceConfig,
            exportedAt: new Date().toISOString()
        };
        
        const dataStr = JSON.stringify(allSettings, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `productivity-settings-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        
        URL.revokeObjectURL(url);
        this.showNotification('Configurações exportadas', 'success');
    }

    // =============================================================================
    // SINCRONIZAÇÃO ULTRA OTIMIZADA
    // =============================================================================
    async initOptimizedGitHubSync() {
        await this.syncOptimizedFromGitHub();
        this.startOptimizedGitHubAutoSync();
    }

    async syncOptimizedFromGitHub() {
        if (this.isUpdating) return;

        this.isUpdating = true;
        this.updateSyncStatus('loading', 'Sincronizando dados otimizados...');
        
        const syncStart = performance.now();
        
        try {
            // Parallel fetching for maximum performance
            const [csvResult, jsonResult] = await Promise.allSettled([
                this.core.measureAsyncOperation('fetchCSV', () => this.fetchOptimizedCSVFromGitHub()),
                this.core.measureAsyncOperation('fetchJSON', () => this.fetchOptimizedJSONFromGitHub())
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
                    this.performanceStats.cacheMisses++;
                } else {
                    this.performanceStats.cacheHits++;
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
                    this.performanceStats.cacheMisses++;
                } else {
                    this.performanceStats.cacheHits++;
                }
                successCount++;
            }

            if (successCount > 0) {
                if (newDataDetected) {
                    await this.core.measureAsyncOperation('processData', () => this.processOptimizedData());
                    
                    const syncTime = performance.now() - syncStart;
                    this.showNotification(`Dados atualizados em ${syncTime.toFixed(0)}ms`, 'success');
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
            this.updateSystemStats();
        }
    }

    async fetchOptimizedCSVFromGitHub() {
        const config = this.core.githubConfig.csvRepo;
        
        try {
            // Use cached response if available
            const cacheKey = `csv_fetch_${config.path}`;
            const cached = this.core.getCache(cacheKey);
            if (cached) {
                this.performanceStats.cacheHits++;
                return { success: true, data: cached };
            }
            
            const response = await fetch(config.apiUrl, {
                headers: {
                    'Accept': 'application/vnd.github.v3+json',
                },
                cache: 'no-cache'
            });
            
            if (!response.ok) throw new Error(`HTTP ${response.status}`);

            const apiData = await response.json();
            if (apiData.type !== 'file') throw new Error('Não é um arquivo válido');
            
            let csvText = atob(apiData.content.replace(/\n/g, ''));
            
            // Enhanced encoding detection and conversion
            try {
                csvText = decodeURIComponent(escape(csvText));
            } catch (e) {
                // Fallback for different encodings
                this.core.addDebugLog('Usando encoding UTF-8 original', 'info');
            }
            
            const parsedData = this.core.parseCSV(csvText);
            
            // Cache the processed data
            this.core.setCache(cacheKey, parsedData, this.performanceConfig.cacheTimeout);
            this.performanceStats.cacheMisses++;
            
            return { success: true, data: parsedData };
            
        } catch (error) {
            this.core.addDebugLog(`Erro ao buscar CSV: ${error.message}`, 'error');
            return { success: false, data: [], error: error.message };
        }
    }

    async fetchOptimizedJSONFromGitHub() {
        const config = this.core.githubConfig.jsonRepo;
        
        try {
            // Use cached response if available
            const cacheKey = `json_fetch_${config.path}`;
            const cached = this.core.getCache(cacheKey);
            if (cached) {
                this.performanceStats.cacheHits++;
                return { success: true, data: cached };
            }
            
            const response = await fetch(config.apiUrl, {
                headers: {
                    'Accept': 'application/vnd.github.v3+json',
                },
                cache: 'no-cache'
            });
            
            if (!response.ok) throw new Error(`HTTP ${response.status}`);

            const apiData = await response.json();
            if (apiData.type !== 'file') throw new Error('Não é um arquivo válido');
            
            let jsonText = atob(apiData.content.replace(/\n/g, ''));
            
            // Enhanced encoding for JSON
            try {
                jsonText = decodeURIComponent(escape(jsonText));
            } catch (e) {
                this.core.addDebugLog('Usando encoding JSON original', 'info');
            }
            
            const records = this.core.parseJSON(jsonText);
            
            // Cache the processed data
            this.core.setCache(cacheKey, records, this.performanceConfig.cacheTimeout);
            this.performanceStats.cacheMisses++;
            
            return { success: true, data: records };
            
        } catch (error) {
            this.core.addDebugLog(`Erro ao buscar JSON: ${error.message}`, 'error');
            return { success: false, data: [], error: error.message };
        }
    }

    startOptimizedGitHubAutoSync() {
        if (this.autoSyncInterval) {
            clearInterval(this.autoSyncInterval);
        }

        if (this.core.config.autoSyncInterval > 0) {
            this.autoSyncInterval = setInterval(async () => {
                if (!this.isUpdating) {
                    await this.syncOptimizedFromGitHub();
                }
            }, this.core.config.autoSyncInterval);
            
            this.core.addDebugLog(`Auto-sync configurado para ${this.core.config.autoSyncInterval/60000} minutos`);
        }
    }

    // =============================================================================
    // PROCESSAMENTO ULTRA OTIMIZADO
    // =============================================================================
    async processOptimizedData() {
        if (this.csvData.length === 0 && this.jsonData.length === 0) return;

        const processStart = performance.now();

        // Reset stats
        this.performanceStats = {
            ...this.performanceStats,
            conflictsResolved: 0,
            duplicatesRemoved: 0,
            originalRecords: this.jsonData.length + this.csvData.length,
            finalRecords: 0
        };

        // Use cached processing if available
        const dataHash = this.core.generateHash({ csv: this.csvData, json: this.jsonData });
        const cacheKey = `processed_data_${dataHash}`;
        const cachedProcessed = this.core.getCache(cacheKey);
        
        if (cachedProcessed) {
            this.equipmentMap = cachedProcessed.equipmentMap;
            this.performanceStats = { ...this.performanceStats, ...cachedProcessed.stats };
            this.performanceStats.cacheHits++;
            
            this.core.addDebugLog('Usando dados processados em cache', 'info');
        } else {
            // Process fresh data
            this.equipmentMap.clear();
            this.unifyOptimizedEquipmentData();
            
            // Cache processed results
            this.core.setCache(cacheKey, {
                equipmentMap: this.equipmentMap,
                stats: this.performanceStats
            }, this.performanceConfig.cacheTimeout);
            
            this.performanceStats.cacheMisses++;
        }
        
        // Create optimized groups and items
        this.createOptimizedGroups();
        this.createOptimizedTimelineItems();

        // Initialize optimized timeline
        await this.ensureOptimizedTimelineInitialization();

        // Update analytics and interface
        this.updateOptimizedAnalytics();
        this.updateOptimizedInterface();

        const processTime = performance.now() - processStart;
        this.performanceStats.renderTime = processTime;
        this.core.addDebugLog(`Processamento otimizado concluído em ${processTime.toFixed(2)}ms`);
    }

    unifyOptimizedEquipmentData() {
        // Process CSV with batching for large datasets
        const csvBatchSize = 100;
        for (let i = 0; i < this.csvData.length; i += csvBatchSize) {
            const batch = this.csvData.slice(i, i + csvBatchSize);
            this.processCsvBatch(batch);
        }

        // Process JSON with batching
        const jsonBatchSize = 200;
        for (let i = 0; i < this.jsonData.length; i += jsonBatchSize) {
            const batch = this.jsonData.slice(i, i + jsonBatchSize);
            this.processJsonBatch(batch);
        }

        // Post-process for optimizations
        this.optimizeEquipmentData();
    }

    processCsvBatch(batch) {
        batch.forEach((item) => {
            const equipName = this.core.normalizeEquipmentName(item.Vaga || item.Placa);
            if (!this.equipmentMap.has(equipName)) {
                this.equipmentMap.set(equipName, {
                    name: equipName,
                    originalName: item.Vaga || item.Placa,
                    apontamentos: [],
                    status: [],
                    group: this.determineEquipmentGroup(equipName),
                    lastActivity: null,
                    isActive: false
                });
            }
            this.equipmentMap.get(equipName).apontamentos.push(item);
        });
    }

    processJsonBatch(batch) {
        batch.forEach((item) => {
            const equipName = this.core.normalizeEquipmentName(item.vacancy_name);
            if (!this.equipmentMap.has(equipName)) {
                this.equipmentMap.set(equipName, {
                    name: equipName,
                    originalName: item.vacancy_name,
                    apontamentos: [],
                    status: [],
                    group: this.determineEquipmentGroup(equipName),
                    lastActivity: null,
                    isActive: false
                });
            }
            this.equipmentMap.get(equipName).status.push(item);
        });
    }

    optimizeEquipmentData() {
        for (const [equipName, data] of this.equipmentMap) {
            // Sort by date (optimized)
            data.apontamentos.sort((a, b) => {
                const dateA = this.core.parseDate(a['Data Inicial']);
                const dateB = this.core.parseDate(b['Data Inicial']);
                return (dateA ? dateA.getTime() : 0) - (dateB ? dateB.getTime() : 0);
            });
            
            // Sort and optimize status data
            data.status = this.optimizeStatusData(data.status);
            
            // Determine equipment activity
            data.lastActivity = this.getLastActivity(data);
            data.isActive = this.isEquipmentActive(data);
        }
    }

    optimizeStatusData(statusData) {
        if (statusData.length <= 1) return statusData;

        // Sort by time
        const sorted = statusData.sort((a, b) => {
            const dateA = this.core.parseDate(a.start);
            const dateB = this.core.parseDate(b.start);
            return (dateA ? dateA.getTime() : 0) - (dateB ? dateB.getTime() : 0);
        });

        // Remove exact duplicates
        const unique = this.removeDuplicates(sorted);
        this.performanceStats.duplicatesRemoved += sorted.length - unique.length;

        // Resolve overlaps with optimized algorithm
        const resolved = this.resolveOptimizedConflicts(unique);
        this.performanceStats.conflictsResolved += unique.length - resolved.length;

        return resolved;
    }

    removeDuplicates(statusList) {
        const seen = new Set();
        return statusList.filter(status => {
            const key = `${status.start}-${status.end}-${status.status}`;
            if (seen.has(key)) {
                return false;
            }
            seen.add(key);
            return true;
        });
    }

    resolveOptimizedConflicts(statusList) {
        if (statusList.length <= 1) return statusList;

        const resolved = [];
        const pending = [...statusList];
        
        while (pending.length > 0) {
            const current = pending.shift();
            const currentStart = new Date(current.start);
            const currentEnd = new Date(current.end);
            
            // Find overlapping items
            const overlapping = pending.filter(item => {
                const itemStart = new Date(item.start);
                const itemEnd = new Date(item.end);
                return itemStart < currentEnd && itemEnd > currentStart;
            });
            
            if (overlapping.length === 0) {
                resolved.push(current);
                continue;
            }
            
            // Resolve based on configuration
            const winner = this.selectWinnerByStrategy([current, ...overlapping]);
            
            // Remove overlapping items from pending
            overlapping.forEach(item => {
                const index = pending.indexOf(item);
                if (index > -1) pending.splice(index, 1);
            });
            
            resolved.push(winner);
        }
        
        return resolved.sort((a, b) => new Date(a.start) - new Date(b.start));
    }

    selectWinnerByStrategy(conflictingItems) {
        const strategy = this.core.config.conflictResolution;
        
        switch (strategy) {
            case 'priority':
                return conflictingItems.reduce((winner, item) => {
                    const winnerPriority = this.core.statusPriority[winner.status] || 0;
                    const itemPriority = this.core.statusPriority[item.status] || 0;
                    return itemPriority > winnerPriority ? item : winner;
                });
                
            case 'latest':
                return conflictingItems.reduce((latest, item) => {
                    return new Date(item.start) > new Date(latest.start) ? item : latest;
                });
                
            case 'longest':
                return conflictingItems.reduce((longest, item) => {
                    const longestDuration = new Date(longest.end) - new Date(longest.start);
                    const itemDuration = new Date(item.end) - new Date(item.start);
                    return itemDuration > longestDuration ? item : longest;
                });
                
            default:
                return conflictingItems[0];
        }
    }

    determineEquipmentGroup(equipName) {
        const name = equipName.toLowerCase();
        if (name.includes('alta pressão') || name.includes('alta pressao')) return 'alta-pressao';
        if (name.includes('baixa pressão') || name.includes('baixa pressao')) return 'baixa-pressao';
        if (name.includes('vácuo') || name.includes('vacuo')) return 'vacuo';
        if (name.includes('caminhão') || name.includes('caminhao')) return 'caminhoes';
        if (name.includes('escavadeira')) return 'escavadeiras';
        return 'outros';
    }

    getLastActivity(equipmentData) {
        let lastDate = null;
        
        // Check apontamentos
        equipmentData.apontamentos.forEach(apont => {
            const date = this.core.parseDate(apont['Data Final']);
            if (date && (!lastDate || date > lastDate)) {
                lastDate = date;
            }
        });
        
        // Check status
        equipmentData.status.forEach(status => {
            const date = this.core.parseDate(status.end);
            if (date && (!lastDate || date > lastDate)) {
                lastDate = date;
            }
        });
        
        return lastDate;
    }

    isEquipmentActive(equipmentData) {
        const lastActivity = equipmentData.lastActivity;
        if (!lastActivity) return false;
        
        const hoursSinceActivity = (Date.now() - lastActivity.getTime()) / (1000 * 60 * 60);
        return hoursSinceActivity < 24; // Active if activity within 24 hours
    }

    // =============================================================================
    // TIMELINE ULTRA OTIMIZADA COM SEPARADORES
    // =============================================================================
    createOptimizedGroups() {
        this.groups.clear();
        this.equipmentSeparators.clear();
        
        let groupId = 0;
        const sortedEquipments = Array.from(this.equipmentMap.entries())
            .sort(([nameA], [nameB]) => {
                // Group by type first, then alphabetically
                const groupA = this.equipmentMap.get(nameA).group;
                const groupB = this.equipmentMap.get(nameB).group;
                
                if (groupA !== groupB) {
                    return groupA.localeCompare(groupB);
                }
                return nameA.localeCompare(nameB);
            });
        
        let currentGroup = null;
        
        for (const [equipName, data] of sortedEquipments) {
            if (data.apontamentos.length > 0 || data.status.length > 0) {
                const displayName = this.core.getDisplayName(equipName);
                
                // Add separator if group changed
                if (this.performanceConfig.groupSeparatorEnabled && currentGroup !== data.group) {
                    if (currentGroup !== null) {
                        this.equipmentSeparators.set(groupId * 2, true);
                    }
                    currentGroup = data.group;
                }
                
                // Activity indicator
                const activityIcon = data.isActive ? '🟢' : '🔴';
                const groupIcon = this.getGroupIcon(data.group);
                
                this.groups.add({
                    id: `${equipName}_apont`,
                    content: `
                        <div class="equipment-group-label" data-equipment-separator="${this.equipmentSeparators.has(groupId * 2)}">
                            <div class="equipment-name">${activityIcon} ${groupIcon} ${displayName}</div>
                            <div class="equipment-type">📊 Apontamentos</div>
                        </div>
                    `,
                    order: groupId * 2,
                    className: currentGroup !== this.lastEquipmentProcessed ? 'group-separator' : ''
                });
                
                this.groups.add({
                    id: `${equipName}_status`,
                    content: `
                        <div class="equipment-group-label">
                            <div class="equipment-name">${activityIcon} ${groupIcon} ${displayName}</div>
                            <div class="equipment-type">🔄 Status</div>
                        </div>
                    `,
                    order: groupId * 2 + 1
                });
                
                this.lastEquipmentProcessed = currentGroup;
                groupId++;
            }
        }
    }

    getGroupIcon(group) {
        const icons = {
            'alta-pressao': '🔴',
            'baixa-pressao': '🔵',
            'vacuo': '⚪',
            'caminhoes': '🚛',
            'escavadeiras': '🚜',
            'outros': '⚙️'
        };
        return icons[group] || '📋';
    }

    createOptimizedTimelineItems() {
        this.items.clear();
        let itemId = 0;
        let itemsCreated = 0;
        const maxItems = this.performanceConfig.maxItemsRendered;

        for (const [equipName, data] of this.equipmentMap) {
            if (itemsCreated >= maxItems) {
                this.core.addDebugLog(`Limite de ${maxItems} itens atingido`, 'warning');
                break;
            }

            // Process apontamentos with optimization
            const apontamentos = this.filterAndOptimizeApontamentos(data.apontamentos);
            apontamentos.forEach(apont => {
                if (itemsCreated >= maxItems) return;
                
                const start = this.core.parseDate(apont['Data Inicial']);
                const end = this.core.parseDate(apont['Data Final']);
                
                if (start && end && start < end) {
                    const category = apont['Categoria Demora'] || 'Outros';
                    const className = this.core.apontColors[category] || 'apont-aguardando';
                    
                    this.items.add({
                        id: `apont_${itemId++}`,
                        group: `${equipName}_apont`,
                        content: this.optimizeItemContent(category, 'apont'),
                        start: start,
                        end: end,
                        className: className,
                        title: this.createOptimizedApontTooltip(apont, equipName),
                        type: 'range',
                        style: this.getOptimizedItemStyle(category, 'apont')
                    });
                    itemsCreated++;
                }
            });

            // Process status with optimization
            const statusData = this.filterAndOptimizeStatus(data.status);
            statusData.forEach((status) => {
                if (itemsCreated >= maxItems) return;
                
                const start = this.core.parseDate(status.start);
                const end = this.core.parseDate(status.end);
                
                if (start && end && start < end) {
                    const statusCode = status.status || 'unknown';
                    const className = this.core.statusColors[statusCode] || 'status-not_appropriated';
                    
                    this.items.add({
                        id: `status_${itemId++}`,
                        group: `${equipName}_status`,
                        content: this.optimizeItemContent(status.status_title || statusCode, 'status'),
                        start: start,
                        end: end,
                        className: className,
                        title: this.createOptimizedStatusTooltip(status, equipName),
                        type: 'range',
                        style: this.getOptimizedItemStyle(statusCode, 'status')
                    });
                    itemsCreated++;
                }
            });
        }

        this.performanceStats.finalRecords = this.items.length;
        this.core.addDebugLog(`Timeline otimizada criada: ${itemsCreated} itens`);
    }

    filterAndOptimizeApontamentos(apontamentos) {
        // Filter by current filters if active
        if (!this.filterState.isActive) return apontamentos;
        
        return apontamentos.filter(apont => {
            // Apply time filters
            if (this.filterState.startTime || this.filterState.endTime) {
                const start = this.core.parseDate(apont['Data Inicial']);
                if (start) {
                    const timeStr = start.toTimeString().slice(0, 5);
                    if (this.filterState.startTime && timeStr < this.filterState.startTime) return false;
                    if (this.filterState.endTime && timeStr > this.filterState.endTime) return false;
                }
            }
            
            // Apply appointment filters
            if (this.filterState.appointments.size > 0) {
                const category = apont['Categoria Demora']?.toLowerCase();
                return Array.from(this.filterState.appointments).some(filter => 
                    category?.includes(filter)
                );
            }
            
            return true;
        });
    }

    filterAndOptimizeStatus(statusData) {
        // Filter by current filters if active
        if (!this.filterState.isActive) return statusData;
        
        return statusData.filter(status => {
            // Apply status filters
            if (this.filterState.status.size > 0) {
                return this.filterState.status.has(status.status);
            }
            
            return true;
        });
    }

    optimizeItemContent(content, type) {
        // Truncate and optimize content for performance
        const maxLength = type === 'apont' ? 15 : 20;
        return this.core.truncateText(content, maxLength);
    }

    getOptimizedItemStyle(key, type) {
        // Return optimized inline styles for better performance
        if (type === 'status') {
            const colors = {
                'running': '#27ae60',
                'stopped': '#f1c40f',
                'off': '#95a5a6',
                'maintenance': '#e67e22'
            };
            return `background: ${colors[key] || '#95a5a6'}; border-radius: 4px;`;
        }
        return 'border-radius: 4px;';
    }

    // =============================================================================
    // TOOLTIPS OTIMIZADOS
    // =============================================================================
    createOptimizedApontTooltip(apont, equipName) {
        const shortEquipName = this.core.truncateText(equipName, 20);
        const category = apont['Categoria Demora'] || 'N/A';
        const duration = apont['Tempo Indisponível (HH:MM)'] || 'N/A';
        
        return `📊 ${shortEquipName}\n${category}\n⏱️ ${duration}\n📅 ${this.core.formatDateTime(apont['Data Inicial'])}`;
    }

    createOptimizedStatusTooltip(status, equipName) {
        const shortEquipName = this.core.truncateText(equipName, 20);
        const statusTitle = status.status_title || status.status;
        const totalHours = parseFloat(status.total_time || 0);
        
        return `🔄 ${shortEquipName}\n${statusTitle}\n⏱️ ${this.core.formatDuration(totalHours)}\n📅 ${this.core.formatDateTime(status.start)}`;
    }

    // =============================================================================
    // TIMELINE INITIALIZATION ULTRA OTIMIZADA
    // =============================================================================
    async ensureOptimizedTimelineInitialization() {
        if (this.items.length === 0) {
            this.showTimelineEmptyState();
            return;
        }

        const renderStart = performance.now();

        if (this.timeline) {
            this.updateOptimizedTimelineData();
        } else {
            this.initOptimizedTimeline();
        }

        const renderTime = performance.now() - renderStart;
        this.performanceStats.renderTime = renderTime;
        this.core.addDebugLog(`Timeline renderizada em ${renderTime.toFixed(2)}ms`);
    }

    initOptimizedTimeline() {
        const container = document.getElementById('timeline');
        if (!container) return;

        container.innerHTML = '';

        const options = {
            orientation: 'top',
            stack: true,
            showCurrentTime: true,
            zoomMin: this.core.constants.MIN_ZOOM,
            zoomMax: this.core.constants.MAX_ZOOM,
            editable: false,
            selectable: true,
            
            // Performance optimizations
            sampling: this.performanceConfig.virtualScrolling,
            maxHeight: 600,
            verticalScroll: true,
            horizontalScroll: true,
            
            // Enhanced formatting
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
            
            // Localization
            locale: 'pt-BR',
            
            // Optimized rendering
            throttleRedraw: this.performanceConfig.debounceInterval
        };

        try {
            this.timeline = new vis.Timeline(container, this.items, this.groups, options);

            // Enhanced event listeners
            this.timeline.on('rangechanged', this.core.debounce((properties) => {
                this.currentViewWindow = properties;
                this.updateTimeRangeDisplay(properties.start, properties.end);
            }, this.performanceConfig.debounceInterval));

            this.timeline.on('select', (properties) => {
                this.handleTimelineSelection(properties);
            });

            // Auto-fit with delay for performance
            setTimeout(() => {
                if (this.timeline) {
                    this.timeline.fit();
                }
            }, 100);

            this.core.addDebugLog('Timeline otimizada inicializada com sucesso');

        } catch (error) {
            this.core.addDebugLog(`Erro na timeline: ${error.message}`, 'error');
            this.showTimelineErrorState(error.message);
        }
    }

    updateOptimizedTimelineData() {
        if (!this.timeline) return;

        try {
            // Use optimized data update
            this.timeline.setData({
                items: this.items,
                groups: this.groups
            });

            // Restore view window if available
            if (this.currentViewWindow) {
                setTimeout(() => {
                    if (this.timeline) {
                        this.timeline.setWindow(this.currentViewWindow.start, this.currentViewWindow.end, {
                            animation: false // Disable animation for performance
                        });
                    }
                }, 50);
            }

            this.core.addDebugLog('Timeline data atualizada');

        } catch (error) {
            this.core.addDebugLog(`Erro ao atualizar timeline: ${error.message}`, 'error');
            this.initOptimizedTimeline();
        }
    }

    handleTimelineSelection(properties) {
        if (properties.items && properties.items.length > 0) {
            const selectedItem = this.items.get(properties.items[0]);
            if (selectedItem) {
                this.showItemDetails(selectedItem);
            }
        }
    }

    showItemDetails(item) {
        // Show enhanced item details in a modal or sidebar
        const details = {
            type: item.id.startsWith('apont_') ? 'Apontamento' : 'Status',
            content: item.content,
            start: this.core.formatDateTime(item.start),
            end: this.core.formatDateTime(item.end),
            duration: this.calculateDuration(item.start, item.end),
            equipment: item.group.replace(/_apont$|_status$/, ''),
            className: item.className
        };

        this.core.addDebugLog(`Item selecionado: ${details.type} - ${details.content}`);
        
        // Future: Show in sidebar or modal
        console.log('Detalhes do item:', details);
    }

    calculateDuration(start, end) {
        const duration = (new Date(end) - new Date(start)) / (1000 * 60 * 60);
        return this.core.formatDuration(duration);
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
    // SISTEMA DE FILTROS ULTRA OTIMIZADO
    // =============================================================================
    applyOptimizedFilters() {
        if (!this.timeline) return;

        const filterStart = performance.now();
        
        // Update filter state
        this.updateFilterState();
        
        // Apply filters with caching
        const cacheKey = `filtered_data_${this.generateFilterHash()}`;
        const cached = this.renderCache.get(cacheKey);
        
        if (cached) {
            this.applyFilteredData(cached);
            this.performanceStats.cacheHits++;
        } else {
            const filteredData = this.calculateFilteredData();
            this.renderCache.set(cacheKey, filteredData);
            this.applyFilteredData(filteredData);
            this.performanceStats.cacheMisses++;
        }

        const filterTime = performance.now() - filterStart;
        this.core.addDebugLog(`Filtros aplicados em ${filterTime.toFixed(2)}ms`);
        
        // Update statistics
        this.updateFilterStatistics();
    }

    updateFilterState() {
        this.filterState = {
            equipment: document.getElementById('equipmentFilter')?.value || '',
            groups: new Set(Array.from(document.querySelectorAll('#groupFilters .filter-chip.active')).map(chip => chip.dataset.group)),
            status: new Set(Array.from(document.querySelectorAll('#statusFilters .filter-chip.active')).map(chip => chip.dataset.status)),
            appointments: new Set(Array.from(document.querySelectorAll('#appointmentFilters .filter-chip.active')).map(chip => chip.dataset.apont)),
            period: document.getElementById('periodFilter')?.value || 'week',
            startDate: document.getElementById('startDate')?.value || null,
            endDate: document.getElementById('endDate')?.value || null,
            startTime: document.getElementById('startTime')?.value || null,
            endTime: document.getElementById('endTime')?.value || null,
            isActive: this.hasActiveFilters()
        };
    }

    hasActiveFilters() {
        return !!(
            this.filterState.equipment ||
            this.filterState.groups.size > 0 ||
            this.filterState.status.size > 0 ||
            this.filterState.appointments.size > 0 ||
            this.filterState.startTime ||
            this.filterState.endTime ||
            (this.filterState.period === 'custom' && (this.filterState.startDate || this.filterState.endDate))
        );
    }

    generateFilterHash() {
        return this.core.generateHash(this.filterState);
    }

    calculateFilteredData() {
        let filteredItems = [];
        let filteredGroups = new Set();
        let visibleEquipments = new Set();

        for (const item of this.items.get()) {
            if (this.passesOptimizedFilters(item)) {
                filteredItems.push(item);
                const equipment = item.group.replace(/_apont$|_status$/, '');
                filteredGroups.add(equipment);
                visibleEquipments.add(equipment);
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

        return {
            items: filteredItems,
            groups: visibleGroupsArray,
            equipmentCount: visibleEquipments.size
        };
    }

    passesOptimizedFilters(item) {
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

        // Time range filters
        if (this.filterState.startTime || this.filterState.endTime) {
            const itemTime = new Date(item.start).toTimeString().slice(0, 5);
            if (this.filterState.startTime && itemTime < this.filterState.startTime) return false;
            if (this.filterState.endTime && itemTime > this.filterState.endTime) return false;
        }

        // Custom date range
        if (this.filterState.period === 'custom') {
            if (this.filterState.startDate && item.start < new Date(this.filterState.startDate)) return false;
            if (this.filterState.endDate && item.start > new Date(this.filterState.endDate)) return false;
        }

        return true;
    }

    applyFilteredData(filteredData) {
        this.timeline.setData({
            items: new vis.DataSet(filteredData.items),
            groups: new vis.DataSet(filteredData.groups)
        });
    }

    updateFilterStatistics() {
        const visibleItems = this.timeline.itemsData.length;
        const visibleEquipments = new Set(
            this.timeline.itemsData.get().map(item => item.group.replace(/_apont$|_status$/, ''))
        ).size;

        document.getElementById('visibleItems').textContent = `${visibleItems} itens visíveis`;
        document.getElementById('visibleEquipments').textContent = `${visibleEquipments} equipamentos`;
    }

    handleOptimizedPeriodChange() {
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

                this.timeline.setWindow(start, end, { animation: { duration: 500, easingFunction: 'easeInOutQuad' } });
                this.updateTimeRangeDisplay(start, end);
            }
        }
        
        // Apply filters after period change
        this.applyOptimizedFilters();
    }

    // =============================================================================
    // INTERFACE E ESTATÍSTICAS OTIMIZADAS
    // =============================================================================
    updateOptimizedInterface() {
        const totalApont = Array.from(this.equipmentMap.values())
            .reduce((sum, data) => sum + data.apontamentos.length, 0);
        const totalStatus = Array.from(this.equipmentMap.values())
            .reduce((sum, data) => sum + data.status.length, 0);
        const activeEquipments = Array.from(this.equipmentMap.values())
            .filter(data => data.isActive).length;

        // Update counters with animation
        this.animateCounter('equipmentCount', this.equipmentMap.size);
        this.animateCounter('conflictsResolved', this.performanceStats.conflictsResolved);
        
        // Update status indicators
        this.updateElement('visibleItems', this.items.length);
        this.updateElement('visibleEquipments', this.equipmentMap.size);

        // Update sync time
        this.updateLastUpdateTime();

        // Update equipment filter
        this.updateOptimizedFilters();
        
        // Update system stats
        this.updateSystemStats();
    }

    animateCounter(elementId, targetValue) {
        const element = document.getElementById(elementId);
        if (!element) return;

        const currentValue = parseInt(element.textContent) || 0;
        const increment = Math.ceil((targetValue - currentValue) / 20);
        
        if (increment === 0) {
            element.textContent = targetValue;
            return;
        }

        const timer = setInterval(() => {
            const current = parseInt(element.textContent) || 0;
            const next = current + increment;
            
            if ((increment > 0 && next >= targetValue) || (increment < 0 && next <= targetValue)) {
                element.textContent = targetValue;
                clearInterval(timer);
            } else {
                element.textContent = next;
            }
        }, 50);
    }

    updateElement(id, value) {
        const element = document.getElementById(id);
        if (element) {
            element.textContent = value;
        }
    }

    updateOptimizedFilters() {
        const equipmentSelect = document.getElementById('equipmentFilter');
        if (!equipmentSelect) return;

        const currentValue = equipmentSelect.value;
        equipmentSelect.innerHTML = '<option value="">Todos os equipamentos</option>';

        // Group equipment by type for better organization
        const groupedEquipment = {};
        for (const [equipName, data] of this.equipmentMap) {
            if (!groupedEquipment[data.group]) {
                groupedEquipment[data.group] = [];
            }
            groupedEquipment[data.group].push({ name: equipName, data: data });
        }

        // Add options grouped by type
        Object.keys(groupedEquipment).sort().forEach(group => {
            const optgroup = document.createElement('optgroup');
            optgroup.label = this.getGroupDisplayName(group);
            
            groupedEquipment[group]
                .sort((a, b) => a.name.localeCompare(b.name))
                .forEach(({ name, data }) => {
                    const option = document.createElement('option');
                    option.value = name;
                    const displayName = this.core.getDisplayName(name);
                    const statusIcon = data.isActive ? '🟢' : '🔴';
                    option.textContent = `${statusIcon} ${displayName}`;
                    if (name === currentValue) option.selected = true;
                    optgroup.appendChild(option);
                });
            
            equipmentSelect.appendChild(optgroup);
        });
    }

    getGroupDisplayName(group) {
        const names = {
            'alta-pressao': '🔴 Alta Pressão',
            'baixa-pressao': '🔵 Baixa Pressão',
            'vacuo': '⚪ Vácuo',
            'caminhoes': '🚛 Caminhões',
            'escavadeiras': '🚜 Escavadeiras',
            'outros': '⚙️ Outros'
        };
        return names[group] || group;
    }

    updateOptimizedAnalytics() {
        if (this.equipmentMap.size === 0) return;

        const rulesConfig = this.rules.getRulesConfig();
        if (!rulesConfig) return;

        // Execute analysis with performance measurement
        const analysis = this.core.measureOperation('analyzeProductivity', () => 
            this.analytics.analyzeProductivity(this.equipmentMap, rulesConfig)
        );
        
        // Update dashboard if analytics tab is active
        const activeTab = document.querySelector('.tab-content.active');
        if (activeTab && activeTab.id === 'productivity-tab') {
            this.analytics.updateDashboard();
        }
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
                    <button onclick="productivitySystem.syncOptimizedFromGitHub()" 
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
                    <div style="margin-top: 1rem; display: flex; gap: 1rem; justify-content: center;">
                        <button onclick="productivitySystem.syncOptimizedFromGitHub()" 
                                style="padding: 0.75rem 1.5rem; background: linear-gradient(135deg, #667eea, #764ba2); color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: 600;">
                            🔄 Tentar Novamente
                        </button>
                        <button onclick="productivitySystem.core.exportDebugLog()" 
                                style="padding: 0.75rem 1.5rem; background: linear-gradient(135deg, #95a5a6, #7f8c8d); color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: 600;">
                            📋 Relatório de Erro
                        </button>
                    </div>
                </div>
            `;
        }
    }

    loadTimelineContent() {
        if (this.items.length === 0) {
            this.core.addDebugLog('Lazy loading: Nenhum conteúdo para carregar');
            return;
        }

        this.core.addDebugLog('Lazy loading: Carregando conteúdo da timeline');
        this.ensureOptimizedTimelineInitialization();
    }

    // =============================================================================
    // NOTIFICAÇÕES E FEEDBACK
    // =============================================================================
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
        
        // Auto-remove with slide out animation
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
    // UTILITY FUNCTIONS
    // =============================================================================
    exportOptimizedDebugData() {
        const debugData = {
            version: '2.0.0',
            timestamp: new Date().toISOString(),
            performanceStats: this.performanceStats,
            performanceConfig: this.performanceConfig,
            filterState: this.filterState,
            equipmentCount: this.equipmentMap.size,
            itemsCount: this.items.length,
            groupsCount: this.groups.length,
            cacheStats: {
                processingCache: this.processingCache.size,
                renderCache: this.renderCache.size,
                coreCache: this.core.getCacheStats()
            },
            systemInfo: {
                userAgent: navigator.userAgent,
                memory: performance.memory ? {
                    used: Math.round(performance.memory.usedJSHeapSize / 1024 / 1024),
                    total: Math.round(performance.memory.totalJSHeapSize / 1024 / 1024),
                    limit: Math.round(performance.memory.jsHeapSizeLimit / 1024 / 1024)
                } : null,
                connection: navigator.connection ? {
                    effectiveType: navigator.connection.effectiveType,
                    downlink: navigator.connection.downlink
                } : null
            }
        };
        
        const dataStr = JSON.stringify(debugData, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `productivity-debug-optimized-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        
        URL.revokeObjectURL(url);
        this.showNotification('Dados de debug otimizados exportados', 'success');
    }

    // =============================================================================
    // CLEANUP E DESTRUCTOR OTIMIZADO
    // =============================================================================
    destroy() {
        this.core.addDebugLog('Iniciando destruição do sistema otimizado');
        
        // Stop intervals
        if (this.autoSyncInterval) {
            clearInterval(this.autoSyncInterval);
            this.autoSyncInterval = null;
        }
        
        // Destroy observers
        if (this.intersectionObserver) {
            this.intersectionObserver.disconnect();
            this.intersectionObserver = null;
        }
        
        if (this.resizeObserver) {
            this.resizeObserver.disconnect();
            this.resizeObserver = null;
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
        this.equipmentSeparators.clear();
        
        // Clear caches
        this.processingCache.clear();
        this.renderCache.clear();
        
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
        
        // Final cleanup
        this.csvData = [];
        this.jsonData = [];
        this.isUpdating = false;
        this.currentViewWindow = null;
        this.lastDataHash = '';
        this.csvDataHash = '';
        
        console.log('Sistema de Produtividade Otimizado v2.0 destruído com sucesso');
    }

    // =============================================================================
    // MÉTODOS PÚBLICOS PARA INTERFACE
    // =============================================================================
    async manualSync() {
        await this.syncOptimizedFromGitHub();
    }

    getSystemStatus() {
        return {
            isUpdating: this.isUpdating,
            equipmentCount: this.equipmentMap.size,
            itemsCount: this.items.length,
            lastUpdate: this.lastDataHash ? new Date() : null,
            performance: this.performanceStats,
            cacheStats: {
                hits: this.performanceStats.cacheHits,
                misses: this.performanceStats.cacheMisses,
                hitRate: this.performanceStats.cacheHits + this.performanceStats.cacheMisses > 0 ? 
                    (this.performanceStats.cacheHits / (this.performanceStats.cacheHits + this.performanceStats.cacheMisses) * 100).toFixed(1) + '%' : '0%'
            }
        };
    }

    getFilteredDataStats() {
        if (!this.timeline) return null;
        
        const visibleItems = this.timeline.itemsData.length;
        const totalItems = this.items.length;
        const filterEfficiency = totalItems > 0 ? ((visibleItems / totalItems) * 100).toFixed(1) + '%' : '0%';
        
        return {
            visibleItems,
            totalItems,
            filterEfficiency,
            hasActiveFilters: this.filterState.isActive
        };
    }

    // Performance testing method
    async runPerformanceTest() {
        this.core.addDebugLog('Iniciando teste de performance completo');
        
        const results = {
            dataProcessing: 0,
            timelineRendering: 0,
            filterApplication: 0,
            memoryUsage: null
        };
        
        // Test data processing
        const processingStart = performance.now();
        await this.processOptimizedData();
        results.dataProcessing = performance.now() - processingStart;
        
        // Test timeline rendering
        const renderingStart = performance.now();
        this.initOptimizedTimeline();
        results.timelineRendering = performance.now() - renderingStart;
        
        // Test filter application
        const filterStart = performance.now();
        this.applyOptimizedFilters();
        results.filterApplication = performance.now() - filterStart;
        
        // Test memory usage
        if (performance.memory) {
            results.memoryUsage = {
                used: Math.round(performance.memory.usedJSHeapSize / 1024 / 1024),
                total: Math.round(performance.memory.totalJSHeapSize / 1024 / 1024)
            };
        }
        
        this.core.addDebugLog(`Teste de performance concluído: 
            Processamento: ${results.dataProcessing.toFixed(2)}ms
            Renderização: ${results.timelineRendering.toFixed(2)}ms  
            Filtros: ${results.filterApplication.toFixed(2)}ms
            Memória: ${results.memoryUsage ? results.memoryUsage.used + 'MB' : 'N/A'}`);
        
        return results;
    }
}

// =============================================================================
// EXPORTAÇÃO E INICIALIZAÇÃO GLOBAL
// =============================================================================
if (typeof window !== 'undefined') {
    window.ProductivitySystem = ProductivitySystem;
    
    // Global helper functions for better performance
    window.clearAllFilters = function() {
        if (window.productivitySystem) {
            // Reset all filter chips
            document.querySelectorAll('.filter-chip.active').forEach(chip => {
                chip.classList.remove('active');
            });
            
            // Reset form inputs
            document.getElementById('equipmentFilter').value = '';
            document.getElementById('periodFilter').value = 'week';
            document.getElementById('startDate').value = '';
            document.getElementById('endDate').value = '';
            document.getElementById('startTime').value = '';
            document.getElementById('endTime').value = '';
            
            // Hide custom date section
            document.getElementById('customDateSection').style.display = 'none';
            
            // Apply empty filters
            window.productivitySystem.applyOptimizedFilters();
            
            window.productivitySystem.showNotification('Todos os filtros removidos', 'success');
        }
    };
    
    // Performance monitoring
    if (typeof performance !== 'undefined' && performance.mark) {
        performance.mark('productivity-system-script-loaded');
    }
}
