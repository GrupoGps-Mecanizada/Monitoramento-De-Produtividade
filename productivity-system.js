// =============================================================================
// PRODUCTIVITY SYSTEM MODULE - Sistema Principal Simplificado e Otimizado
// =============================================================================

class ProductivitySystem {
    constructor() {
        // Inicializar módulos
        this.core = new ProductivityCore();
        this.analytics = new ProductivityAnalytics(this.core);
        this.rules = new ProductivityRules(this.core);
        
        // Estado do sistema
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
        
        // Estatísticas simplificadas
        this.processingStats = {
            conflictsResolved: 0,
            duplicatesRemoved: 0,
            originalRecords: 0,
            finalRecords: 0
        };

        // Estado de filtros
        this.filterState = {
            equipment: '',
            period: 'week',
            startDate: null,
            endDate: null
        };

        this.initializeSystem();
    }

    // =============================================================================
    // INICIALIZAÇÃO SIMPLIFICADA
    // =============================================================================
    async initializeSystem() {
        try {
            this.setupEventListeners();
            this.rules.renderRulesInterface();
            this.updateSyncStatus('loading', 'Inicializando sistema...');
            await this.initGitHubSync();
            this.core.addDebugLog('Sistema inicializado com sucesso');
        } catch (error) {
            this.core.addDebugLog(`Erro na inicialização: ${error.message}`, 'error');
            this.showNotification('Erro na inicialização do sistema', 'error');
        }
    }

    setupEventListeners() {
        // Filtros básicos
        document.getElementById('equipmentFilter')?.addEventListener('change', () => {
            setTimeout(() => this.applyFilters(), 100);
        });

        document.getElementById('periodFilter')?.addEventListener('change', () => {
            this.handlePeriodChange();
        });

        document.getElementById('startDate')?.addEventListener('change', () => {
            setTimeout(() => this.applyFilters(), 300);
        });

        document.getElementById('endDate')?.addEventListener('change', () => {
            setTimeout(() => this.applyFilters(), 300);
        });
    }

    // =============================================================================
    // SINCRONIZAÇÃO SIMPLIFICADA
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
            const [csvResult, jsonResult] = await Promise.allSettled([
                this.fetchCSVFromGitHub(),
                this.fetchJSONFromGitHub()
            ]);

            let successCount = 0;
            let newDataDetected = false;

            if (csvResult.status === 'fulfilled' && csvResult.value.success) {
                const newCsvData = csvResult.value.data;
                if (JSON.stringify(newCsvData) !== JSON.stringify(this.csvData)) {
                    this.csvData = newCsvData;
                    newDataDetected = true;
                }
                successCount++;
            }

            if (jsonResult.status === 'fulfilled' && jsonResult.value.success) {
                const newJsonData = jsonResult.value.data;
                const newDataHash = this.core.generateHash(newJsonData);
                
                if (newDataHash !== this.lastDataHash) {
                    this.jsonData = newJsonData;
                    this.lastDataHash = newDataHash;
                    newDataDetected = true;
                }
                successCount++;
            }

            if (successCount > 0) {
                if (newDataDetected) {
                    await this.processData();
                    this.showNotification('Dados atualizados com sucesso', 'success');
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
            try {
                csvText = decodeURIComponent(escape(csvText));
            } catch (e) {
                // Manter texto original se falhar decodificação
            }
            
            const parsedData = this.core.parseCSV(csvText);
            return { success: true, data: parsedData };
            
        } catch (error) {
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
                // Manter texto original se falhar decodificação
            }
            
            const records = this.core.parseJSON(jsonText);
            return { success: true, data: records };
            
        } catch (error) {
            return { success: false, data: [], error: error.message };
        }
    }

    startGitHubAutoSync() {
        if (this.autoSyncInterval) {
            clearInterval(this.autoSyncInterval);
        }

        if (this.core.config.autoSyncInterval > 0) {
            this.autoSyncInterval = setInterval(async () => {
                if (!this.isUpdating) {
                    await this.syncFromGitHub();
                }
            }, this.core.config.autoSyncInterval);
        }
    }

    // =============================================================================
    // PROCESSAMENTO SIMPLIFICADO
    // =============================================================================
    async processData() {
        if (this.csvData.length === 0 && this.jsonData.length === 0) return;

        // Reset stats
        this.processingStats = {
            conflictsResolved: 0,
            duplicatesRemoved: 0,
            originalRecords: this.jsonData.length + this.csvData.length,
            finalRecords: 0
        };

        // Limpar dados anteriores
        this.equipmentMap.clear();
        
        // Processar dados
        this.unifyEquipmentData();
        this.createGroups();
        this.createTimelineItems();

        // Inicializar timeline
        await this.ensureTimelineInitialization();

        // Atualizar analytics
        this.updateAnalytics();
        
        // Atualizar interface
        this.updateInterface();
    }

    unifyEquipmentData() {
        // Processar CSV
        this.csvData.forEach((item) => {
            const equipName = this.core.normalizeEquipmentName(item.Vaga || item.Placa);
            if (!this.equipmentMap.has(equipName)) {
                this.equipmentMap.set(equipName, {
                    name: equipName,
                    originalName: item.Vaga || item.Placa,
                    apontamentos: [],
                    status: []
                });
            }
            this.equipmentMap.get(equipName).apontamentos.push(item);
        });

        // Processar JSON
        this.jsonData.forEach((item) => {
            const equipName = this.core.normalizeEquipmentName(item.vacancy_name);
            if (!this.equipmentMap.has(equipName)) {
                this.equipmentMap.set(equipName, {
                    name: equipName,
                    originalName: item.vacancy_name,
                    apontamentos: [],
                    status: []
                });
            }
            this.equipmentMap.get(equipName).status.push(item);
        });

        // Ordenar dados por data
        for (const [equipName, data] of this.equipmentMap) {
            data.apontamentos.sort((a, b) => {
                const dateA = this.core.parseDate(a['Data Inicial']);
                const dateB = this.core.parseDate(b['Data Inicial']);
                return (dateA || 0) - (dateB || 0);
            });
            
            data.status.sort((a, b) => {
                const dateA = this.core.parseDate(a.start);
                const dateB = this.core.parseDate(b.start);
                return (dateA || 0) - (dateB || 0);
            });
        }
    }

    createGroups() {
        this.groups.clear();
        
        let groupId = 0;
        const sortedEquipments = Array.from(this.equipmentMap.entries())
            .sort(([nameA], [nameB]) => nameA.localeCompare(nameB));
        
        for (const [equipName, data] of sortedEquipments) {
            if (data.apontamentos.length > 0 || data.status.length > 0) {
                const displayName = this.core.getDisplayName(equipName);
                
                this.groups.add({
                    id: `${equipName}_apont`,
                    content: `<div style="font-weight: 600; color: #2c3e50; font-size: 13px;">${displayName}</div><div style="font-size: 11px; color: #7f8c8d;">📊 Apontamentos</div>`,
                    order: groupId * 2
                });
                
                this.groups.add({
                    id: `${equipName}_status`,
                    content: `<div style="font-weight: 600; color: #2c3e50; font-size: 13px;">${displayName}</div><div style="font-size: 11px; color: #7f8c8d;">🔄 Status</div>`,
                    order: groupId * 2 + 1
                });
                
                groupId++;
            }
        }
    }

    createTimelineItems() {
        this.items.clear();
        let itemId = 0;

        for (const [equipName, data] of this.equipmentMap) {
            // Processar apontamentos
            data.apontamentos.forEach(apont => {
                const start = this.core.parseDate(apont['Data Inicial']);
                const end = this.core.parseDate(apont['Data Final']);
                
                if (start && end && start < end) {
                    const category = apont['Categoria Demora'] || 'Outros';
                    const className = this.core.apontColors[category] || 'apont-aguardando';
                    
                    this.items.add({
                        id: `apont_${itemId++}`,
                        group: `${equipName}_apont`,
                        content: this.core.truncateText(category, 20),
                        start: start,
                        end: end,
                        className: className,
                        title: this.createApontTooltip(apont, equipName),
                        type: 'range'
                    });
                }
            });

            // Processar status com resolução básica
            if (data.status.length > 0) {
                const resolvedStatus = this.resolveBasicConflicts(data.status);
                
                resolvedStatus.forEach((status) => {
                    const start = this.core.parseDate(status.start);
                    const end = this.core.parseDate(status.end);
                    
                    if (start && end && start < end) {
                        const statusCode = status.status || 'unknown';
                        const className = this.core.statusColors[statusCode] || 'status-not_appropriated';
                        
                        this.items.add({
                            id: `status_${itemId++}`,
                            group: `${equipName}_status`,
                            content: this.core.truncateText(status.status_title || statusCode, 25),
                            start: start,
                            end: end,
                            className: className,
                            title: this.createStatusTooltip(status, equipName),
                            type: 'range'
                        });
                    }
                });
            }
        }

        this.processingStats.finalRecords = this.items.length;
    }

    // RESOLUÇÃO BÁSICA DE CONFLITOS (SIMPLIFICADA)
    resolveBasicConflicts(statusList) {
        if (!statusList || statusList.length <= 1) return statusList;

        // 1. Remover duplicatas exatas
        const uniqueStatus = this.removeDuplicates(statusList);
        this.processingStats.duplicatesRemoved += statusList.length - uniqueStatus.length;
        
        // 2. Ordenar por tempo
        const sortedStatus = uniqueStatus.sort((a, b) => 
            new Date(a.start) - new Date(b.start)
        );

        // 3. Resolver sobreposições simples
        const resolved = [];
        let current = null;

        for (const status of sortedStatus) {
            if (!current) {
                current = { ...status };
                continue;
            }

            const currentEnd = new Date(current.end);
            const statusStart = new Date(status.start);

            // Verificar sobreposição
            if (statusStart < currentEnd) {
                this.processingStats.conflictsResolved++;
                
                // Usar prioridade simples
                const priority1 = this.core.statusPriority[current.status] || 0;
                const priority2 = this.core.statusPriority[status.status] || 0;
                
                if (priority2 > priority1) {
                    current = { ...status };
                } else {
                    // Manter atual mas estender fim se necessário
                    if (new Date(status.end) > currentEnd) {
                        current.end = status.end;
                    }
                }
            } else {
                resolved.push(current);
                current = { ...status };
            }
        }

        if (current) {
            resolved.push(current);
        }

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

    // =============================================================================
    // TIMELINE E INTERFACE
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
            zoomMin: 1000 * 60 * 10, // 10 minutos
            zoomMax: 1000 * 60 * 60 * 24 * 30, // 30 dias
            editable: false,
            selectable: true,
            format: {
                minorLabels: {
                    minute: 'HH:mm',
                    hour: 'HH:mm',
                    day: 'DD/MM',
                    month: 'MMM'
                },
                majorLabels: {
                    minute: 'ddd DD/MM',
                    hour: 'ddd DD/MM',
                    day: 'MMMM YYYY',
                    month: 'YYYY'
                }
            },
            height: '100%',
            maxHeight: 600,
            verticalScroll: true,
            horizontalScroll: true
        };

        try {
            this.timeline = new vis.Timeline(container, this.items, this.groups, options);

            this.timeline.on('rangechanged', (properties) => {
                this.currentViewWindow = properties;
            });

            setTimeout(() => {
                if (this.timeline) {
                    this.timeline.fit();
                }
            }, 200);

        } catch (error) {
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
                    this.timeline.setWindow(this.currentViewWindow.start, this.currentViewWindow.end);
                }, 100);
            }
        } catch (error) {
            this.initTimeline();
        }
    }

    showTimelineEmptyState() {
        const container = document.getElementById('timeline');
        if (container) {
            container.innerHTML = `
                <div class="loading-state">
                    <div style="font-size: 2rem; margin-bottom: 1rem;">📊</div>
                    <div>Nenhum dado disponível</div>
                    <div style="font-size: 0.9rem; margin-top: 0.5rem; color: #7f8c8d;">
                        Aguardando sincronização de dados...
                    </div>
                </div>
            `;
        }
    }

    showTimelineErrorState(error) {
        const container = document.getElementById('timeline');
        if (container) {
            container.innerHTML = `
                <div class="loading-state">
                    <div style="font-size: 2rem; margin-bottom: 1rem; color: #e74c3c;">⚠️</div>
                    <div style="color: #e74c3c;">Erro ao carregar timeline</div>
                    <div style="font-size: 0.9rem; margin-top: 0.5rem; color: #7f8c8d;">
                        ${error}
                    </div>
                </div>
            `;
        }
    }

    // =============================================================================
    // TOOLTIPS SIMPLIFICADOS
    // =============================================================================
    createApontTooltip(apont, equipName) {
        const shortEquipName = this.core.truncateText(equipName, 25);
        const category = apont['Categoria Demora'] || 'N/A';
        const shortCategory = this.core.truncateText(category, 30);

        return `
            <div style="font-size: 12px; line-height: 1.3; max-width: 280px;">
                <div style="font-weight: 700; margin-bottom: 6px; color: #fff; font-size: 11px;">📊 Apontamento Manual</div>
                <div style="margin-bottom: 3px; font-size: 11px;"><strong>Equipamento:</strong><br>${shortEquipName}</div>
                <div style="margin-bottom: 3px; font-size: 11px;"><strong>Categoria:</strong> ${shortCategory}</div>
                <div style="margin-bottom: 3px; font-size: 11px;"><strong>Início:</strong><br>${this.core.formatDateTime(apont['Data Inicial'])}</div>
                <div style="margin-bottom: 3px; font-size: 11px;"><strong>Fim:</strong><br>${this.core.formatDateTime(apont['Data Final'])}</div>
                <div style="font-size: 11px;"><strong>Duração:</strong> ${apont['Tempo Indisponível (HH:MM)'] || 'N/A'}</div>
            </div>
        `;
    }

    createStatusTooltip(status, equipName) {
        const totalHours = parseFloat(status.total_time || 0);
        const shortEquipName = this.core.truncateText(equipName, 25);
        const statusTitle = status.status_title || status.status;
        const shortStatusTitle = this.core.truncateText(statusTitle, 30);
        
        return `
            <div style="font-size: 12px; line-height: 1.3; max-width: 280px;">
                <div style="font-weight: 700; margin-bottom: 6px; color: #fff; font-size: 11px;">🔄 Status Automático</div>
                <div style="margin-bottom: 3px; font-size: 11px;"><strong>Equipamento:</strong><br>${shortEquipName}</div>
                <div style="margin-bottom: 3px; font-size: 11px;"><strong>Status:</strong> ${shortStatusTitle}</div>
                <div style="margin-bottom: 3px; font-size: 11px;"><strong>Início:</strong><br>${this.core.formatDateTime(status.start)}</div>
                <div style="margin-bottom: 3px; font-size: 11px;"><strong>Fim:</strong><br>${this.core.formatDateTime(status.end)}</div>
                <div style="font-size: 11px;"><strong>Duração:</strong> ${this.core.formatDuration(totalHours)}</div>
            </div>
        `;
    }

    // =============================================================================
    // FILTROS E INTERFACE
    // =============================================================================
    applyFilters() {
        if (!this.timeline) return;

        const equipmentFilter = document.getElementById('equipmentFilter')?.value || '';
        const period = document.getElementById('periodFilter')?.value || 'all';
        
        let filteredItems = [];
        let filteredGroups = new Set();
        
        for (const item of this.items.get()) {
            let include = true;
            
            // Filtro por equipamento
            if (equipmentFilter) {
                const itemEquipment = item.group.replace(/_apont$|_status$/, '');
                if (itemEquipment !== equipmentFilter) {
                    include = false;
                }
            }
            
            // Filtro por período personalizado
            if (period === 'custom') {
                const startDate = document.getElementById('startDate')?.value;
                const endDate = document.getElementById('endDate')?.value;
                
                if (startDate && item.start < new Date(startDate)) include = false;
                if (endDate && item.start > new Date(endDate)) include = false;
            }
            
            if (include) {
                filteredItems.push(item);
                const equipment = item.group.replace(/_apont$|_status$/, '');
                filteredGroups.add(equipment);
            }
        }
        
        // Filtrar grupos
        const visibleGroups = [];
        for (const group of this.groups.get()) {
            const equipment = group.id.replace(/_apont$|_status$/, '');
            if (!equipmentFilter || filteredGroups.has(equipment)) {
                visibleGroups.push(group);
            }
        }
        
        // Atualizar timeline
        this.timeline.setData({
            items: new vis.DataSet(filteredItems),
            groups: new vis.DataSet(visibleGroups)
        });
        
        // Atualizar estatísticas
        const visibleItemsElement = document.getElementById('visibleItems');
        if (visibleItemsElement) {
            visibleItemsElement.textContent = `${filteredItems.length} itens visíveis`;
        }
    }

    handlePeriodChange() {
        const period = document.getElementById('periodFilter')?.value;
        const customGroup = document.getElementById('customDateGroup');
        const customGroup2 = document.getElementById('customDateGroup2');
        
        if (period === 'custom') {
            if (customGroup) customGroup.style.display = 'block';
            if (customGroup2) customGroup2.style.display = 'block';
            return;
        } else {
            if (customGroup) customGroup.style.display = 'none';
            if (customGroup2) customGroup2.style.display = 'none';
        }

        if (!this.timeline) return;

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

        this.timeline.setWindow(start, end);
    }

    updateInterface() {
        const totalApont = Array.from(this.equipmentMap.values())
            .reduce((sum, data) => sum + data.apontamentos.length, 0);
        const totalStatus = Array.from(this.equipmentMap.values())
            .reduce((sum, data) => sum + data.status.length, 0);

        // Atualizar contadores
        this.updateElement('apontCount', totalApont);
        this.updateElement('statusCount', totalStatus);
        this.updateElement('equipmentCount', this.equipmentMap.size);
        this.updateElement('conflictsResolved', this.processingStats.conflictsResolved);
        this.updateElement('duplicatesRemoved', this.processingStats.duplicatesRemoved);

        // Atualizar horário no header
        this.updateLastUpdateTime();

        // Atualizar filtros
        this.updateFilters();
    }

    updateElement(id, value) {
        const element = document.getElementById(id);
        if (element) {
            element.textContent = value;
        }
    }

    updateFilters() {
        const equipmentSelect = document.getElementById('equipmentFilter');
        if (!equipmentSelect) return;

        const currentValue = equipmentSelect.value;
        equipmentSelect.innerHTML = '<option value="">Todos os equipamentos</option>';

        Array.from(this.equipmentMap.keys()).sort().forEach(equipName => {
            const option = document.createElement('option');
            option.value = equipName;
            option.textContent = this.core.getDisplayName(equipName);
            if (equipName === currentValue) option.selected = true;
            equipmentSelect.appendChild(option);
        });
    }

    updateSyncStatus(status, message) {
        const dot = document.getElementById('syncDot');
        const statusText = document.getElementById('syncStatus');
        
        if (dot) dot.className = `sync-dot ${status}`;
        if (statusText) statusText.textContent = message;
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

    updateAnalytics() {
        if (this.equipmentMap.size === 0) return;

        const rulesConfig = this.rules.getRulesConfig();
        if (!rulesConfig) return;

        // Executar análise
        const analysis = this.analytics.analyzeProductivity(this.equipmentMap, rulesConfig);
        
        // Atualizar dashboard se a aba estiver ativa
        const activeTab = document.querySelector('.tab-content.active');
        if (activeTab && activeTab.id === 'productivity-tab') {
            this.analytics.updateDashboard();
        }
    }

    // =============================================================================
    // NOTIFICAÇÕES E UTILITÁRIOS
    // =============================================================================
    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.style.animation = 'slideOutRight 0.3s ease-in';
            setTimeout(() => notification.remove(), 300);
        }, 4000);
    }

    exportDebugData() {
        const debugData = {
            processingStats: this.processingStats,
            equipmentCount: this.equipmentMap.size,
            itemsCount: this.items.length,
            groupsCount: this.groups.length,
            filterState: this.filterState,
            timestamp: new Date().toISOString()
        };
        
        const dataStr = JSON.stringify(debugData, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `productivity-debug-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        
        URL.revokeObjectURL(url);
        this.showNotification('Dados de debug exportados', 'success');
    }

    // =============================================================================
    // LIMPEZA
    // =============================================================================
    destroy() {
        if (this.autoSyncInterval) {
            clearInterval(this.autoSyncInterval);
        }
        
        if (this.timeline) {
            this.timeline.destroy();
            this.timeline = null;
        }
        
        this.items.clear();
        this.groups.clear();
        this.equipmentMap.clear();
        
        if (this.analytics) this.analytics.destroy();
        if (this.rules) this.rules.destroy();
        if (this.core) this.core.destroy();
    }
}

// Exportar para uso global
if (typeof window !== 'undefined') {
    window.ProductivitySystem = ProductivitySystem;
}
