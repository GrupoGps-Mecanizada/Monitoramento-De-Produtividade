// =============================================================================
// PRODUCTIVITY CORE MODULE - Configurações e Utilitários Base
// =============================================================================

class ProductivityCore {
    constructor() {
        this.version = '2.0.0';
        this.startTime = new Date();
        this.cache = new Map();
        this.debugLog = [];
        
        // Configurações centralizadas
        this.config = {
            autoSyncInterval: 600000, // 10 minutos
            conflictResolution: 'priority', // priority, latest, longest
            gapTolerance: 60, // segundos
            retryAttempts: 3,
            retryDelay: 2000,
            batchSize: 100,
            cacheTimeout: 300000 // 5 minutos
        };

        // Configurações GitHub centralizadas - Banco De Dados com diretórios corretos
        this.githubConfig = {
            csvRepo: {
                owner: 'GrupoGps-Mecanizada',
                repo: 'Banco-De-Dados',
                path: 'Apontamentos/apontamentos-atuais.csv',
                apiUrl: 'https://api.github.com/repos/GrupoGps-Mecanizada/Banco-De-Dados/contents/Apontamentos/apontamentos-atuais.csv',
                enabled: true
            },
            jsonRepo: {
                owner: 'GrupoGps-Mecanizada',
                repo: 'Banco-De-Dados',
                path: 'Timeline/latest-fleet-data.json',
                apiUrl: 'https://api.github.com/repos/GrupoGps-Mecanizada/Banco-De-Dados/contents/Timeline/latest-fleet-data.json',
                enabled: true
            },
            alertsRepo: {
                owner: 'GrupoGps-Mecanizada',
                repo: 'Monitoramento-De-Produtividade',
                path: 'alerts.html',
                apiUrl: 'https://api.github.com/repos/GrupoGps-Mecanizada/Monitoramento-De-Produtividade/contents/alerts.html'
            },
            reportsRepo: {
                owner: 'GrupoGps-Mecanizada', 
                repo: 'Productivity-Reports',
                path: 'reports.html',
                apiUrl: 'https://api.github.com/repos/GrupoGps-Mecanizada/Productivity-Reports/contents/reports.html'
            }
        };

        // Sistema de prioridades para conflitos (maior número = maior prioridade)
        this.statusPriority = {
            'maintenance': 10,           // Manutenção tem prioridade máxima
            'out_of_plant': 9,          // Fora da planta
            'secondary_motor_on': 8,    // Motor secundário ligado
            'on': 7,                    // Motor ligado
            'running': 7,               // Motor rodando (alias para 'on')
            'stopped': 6,               // Parado ligado
            'off': 5,                   // Motor desligado
            'not_appropriated': 4,      // Não apropriado
            'no_data': 3                // Sem dados (menor prioridade)
        };

        // Mapeamento de cores para status
        this.statusColors = {
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

        // Mapeamento de cores para apontamentos
        this.apontColors = {
            'Abastecimento': 'apont-abastecimento',
            'Bloqueio': 'apont-bloqueio',
            'Descarregamento': 'apont-descarregamento',
            'Documentação': 'apont-documentacao',
            'Preparação': 'apont-preparacao',
            'Pequenas manutenções': 'apont-manutencao',
            'Manutenção': 'apont-manutencao',
            'Refeição Motorista': 'apont-refeicao',
            'Aguardando': 'apont-aguardando',
            'Aguardando Área': 'apont-aguardando',
            'Aguardando semáforo/cancela': 'apont-aguardando',
            'Aguardando carreta bascular': 'apont-aguardando',
            'Troca de Equipamento': 'apont-manutencao'
        };

        // Constantes do sistema
        this.constants = {
            MIN_ZOOM: 1000 * 60 * 10, // 10 minutos
            MAX_ZOOM: 1000 * 60 * 60 * 24 * 30, // 30 dias
            MAX_LOG_ENTRIES: 100,
            DEBOUNCE_TEXT_DELAY: 300,
            DEBOUNCE_SELECT_DELAY: 100,
            NOTIFICATION_DURATION: 4000
        };

        this.initializeSystem();
    }

    // =============================================================================
    // INICIALIZAÇÃO E CONFIGURAÇÃO
    // =============================================================================
    initializeSystem() {
        this.addDebugLog('Productivity Core Module inicializado');
        this.loadSavedConfig();
        this.startPerformanceMonitoring();
    }

    loadSavedConfig() {
        try {
            const savedConfig = localStorage.getItem('productivity_config');
            if (savedConfig) {
                const parsed = JSON.parse(savedConfig);
                this.config = { ...this.config, ...parsed };
                this.addDebugLog('Configurações carregadas do localStorage');
            }
        } catch (error) {
            this.addDebugLog(`Erro ao carregar configurações: ${error.message}`, 'warning');
        }
    }

    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
        try {
            localStorage.setItem('productivity_config', JSON.stringify(this.config));
            this.addDebugLog('Configurações atualizadas e salvas');
        } catch (error) {
            this.addDebugLog(`Erro ao salvar configurações: ${error.message}`, 'warning');
        }
    }

    // =============================================================================
    // SISTEMA DE CACHE INTELIGENTE
    // =============================================================================
    setCache(key, data, customTimeout = null) {
        const timeout = customTimeout || this.config.cacheTimeout;
        const entry = {
            data: data,
            timestamp: Date.now(),
            expires: Date.now() + timeout
        };
        this.cache.set(key, entry);
        this.addDebugLog(`Cache definido para: ${key} (expira em ${timeout/1000}s)`);
    }

    getCache(key) {
        const entry = this.cache.get(key);
        if (!entry) return null;

        if (Date.now() > entry.expires) {
            this.cache.delete(key);
            this.addDebugLog(`Cache expirado removido: ${key}`, 'info');
            return null;
        }

        this.addDebugLog(`Cache hit: ${key}`);
        return entry.data;
    }

    clearCache(pattern = null) {
        if (pattern) {
            for (const key of this.cache.keys()) {
                if (key.includes(pattern)) {
                    this.cache.delete(key);
                }
            }
            this.addDebugLog(`Cache limpo para padrão: ${pattern}`);
        } else {
            this.cache.clear();
            this.addDebugLog('Cache completamente limpo');
        }
    }

    getCacheStats() {
        const now = Date.now();
        let valid = 0, expired = 0;
        
        for (const [key, entry] of this.cache.entries()) {
            if (now > entry.expires) {
                expired++;
            } else {
                valid++;
            }
        }

        return { valid, expired, total: this.cache.size };
    }

    // =============================================================================
    // PARSERS CSV/JSON OTIMIZADOS
    // =============================================================================
    parseCSV(csvText) {
        try {
            const lines = csvText.trim().split('\n').filter(line => line.trim());
            if (lines.length < 2) return [];

            const delimiter = lines[0].includes(';') ? ';' : ',';
            const headers = lines[0].split(delimiter).map(h => h.replace(/"/g, '').trim());
            
            const data = [];
            const batchSize = this.config.batchSize;
            
            for (let i = 1; i < lines.length; i += batchSize) {
                const batch = lines.slice(i, i + batchSize);
                
                for (const line of batch) {
                    const trimmed = line.trim();
                    if (!trimmed) continue;
                    
                    const values = this.parseCSVLine(trimmed, delimiter);
                    const row = {};
                    
                    headers.forEach((header, index) => {
                        row[header] = values[index] ? values[index].replace(/"/g, '').trim() : '';
                    });
                    
                    if (row['Data Inicial'] && row['Data Final']) {
                        data.push(row);
                    }
                }
                
                // Yield control periodically for better performance
                if (i % (batchSize * 10) === 0) {
                    await new Promise(resolve => setTimeout(resolve, 0));
                }
            }
            
            this.addDebugLog(`CSV parseado: ${data.length} registros processados`);
            return data;
            
        } catch (error) {
            this.addDebugLog(`Erro ao parsear CSV: ${error.message}`, 'error');
            return [];
        }
    }

    parseCSVLine(line, delimiter) {
        const values = [];
        let current = '';
        let inQuotes = false;
        
        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            
            if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === delimiter && !inQuotes) {
                values.push(current.trim());
                current = '';
            } else {
                current += char;
            }
        }
        values.push(current.trim());
        
        return values;
    }

    parseJSON(jsonText) {
        try {
            const jsonData = JSON.parse(jsonText);
            const records = jsonData.records || jsonData;
            
            if (!Array.isArray(records)) {
                throw new Error('Formato JSON inválido - não é um array');
            }
            
            this.addDebugLog(`JSON parseado: ${records.length} registros`);
            return records;
            
        } catch (error) {
            this.addDebugLog(`Erro ao parsear JSON: ${error.message}`, 'error');
            return [];
        }
    }

    // =============================================================================
    // UTILITÁRIOS DE FORMATAÇÃO E VALIDAÇÃO
    // =============================================================================
    parseDate(dateStr) {
        if (!dateStr) return null;
        
        try {
            // Cache para datas já processadas
            const cacheKey = `date_${dateStr}`;
            const cached = this.getCache(cacheKey);
            if (cached) return cached;
            
            let result = null;
            
            if (dateStr.includes('/')) {
                const [datePart, timePart = '00:00:00'] = dateStr.split(' ');
                const [day, month, year] = datePart.split('/');
                
                if (day && month && year) {
                    result = new Date(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T${timePart}`);
                }
            } else if (dateStr.includes('-')) {
                result = new Date(dateStr.replace(' ', 'T'));
            }
            
            if (result && !isNaN(result.getTime())) {
                this.setCache(cacheKey, result, 3600000); // Cache por 1 hora
                return result;
            }
            
            return null;
        } catch (error) {
            this.addDebugLog(`Erro ao parsear data "${dateStr}": ${error.message}`, 'warning');
            return null;
        }
    }

    formatDateTime(dateStr) {
        try {
            const date = typeof dateStr === 'string' ? this.parseDate(dateStr) : dateStr;
            if (!date) return dateStr;
            
            const day = date.getDate().toString().padStart(2, '0');
            const month = (date.getMonth() + 1).toString().padStart(2, '0');
            const year = date.getFullYear();
            const hours = date.getHours().toString().padStart(2, '0');
            const minutes = date.getMinutes().toString().padStart(2, '0');
            
            return `${day}-${month}-${year} ${hours}:${minutes}`;
        } catch {
            return dateStr;
        }
    }

    formatDuration(hours) {
        const h = Math.floor(hours);
        const m = Math.round((hours - h) * 60);
        if (h === 0) return `${m}min`;
        if (m === 0) return `${h}h`;
        return `${h}h ${m}min`;
    }

    truncateText(text, maxLength) {
        if (!text) return '';
        return text.length > maxLength ? text.substring(0, maxLength - 3) + '...' : text;
    }

    normalizeEquipmentName(name) {
        if (!name) return 'Equipamento Desconhecido';
        
        // Cache para nomes já normalizados
        const cacheKey = `equip_${name}`;
        const cached = this.getCache(cacheKey);
        if (cached) return cached;
        
        let normalizedName = name.toUpperCase().trim();
        normalizedName = normalizedName.replace(/\s+/g, ' ');
        
        normalizedName = normalizedName
            .replace(/\s*-\s*GPS\s*-\s*/g, ' - GPS - ')
            .replace(/\s*-\s*(\d+)\s*HS\s*$/i, ' - $1HS')
            .replace(/\s*-\s*(\d+)\s*H\s*$/i, ' - $1HS')
            .replace(/CAMINHÃO/g, 'CAMINHAO')
            .replace(/VÁCUO/g, 'VACUO')
            .replace(/PRESSÃO/g, 'PRESSAO')
            .trim();
        
        this.setCache(cacheKey, normalizedName, 3600000); // Cache por 1 hora
        return normalizedName;
    }

    getDisplayName(equipName) {
        const cacheKey = `display_${equipName}`;
        const cached = this.getCache(cacheKey);
        if (cached) return cached;
        
        const displayName = equipName
            .replace(/CAMINHAO/g, 'CAMINHÃO')
            .replace(/VACUO/g, 'VÁCUO') 
            .replace(/PRESSAO/g, 'PRESSÃO')
            .replace(/\s+/g, ' ')
            .trim();
        
        this.setCache(cacheKey, displayName, 3600000);
        return displayName;
    }

    // =============================================================================
    // UTILITÁRIOS DE VALIDAÇÃO
    // =============================================================================
    validateCSVData(data) {
        const requiredFields = ['Data Inicial', 'Data Final', 'Vaga', 'Categoria Demora'];
        const errors = [];
        const validRecords = [];
        
        data.forEach((record, index) => {
            const recordErrors = [];
            
            requiredFields.forEach(field => {
                if (!record[field] || record[field].trim() === '') {
                    recordErrors.push(`Campo obrigatório ausente: ${field}`);
                }
            });
            
            // Validar datas
            if (record['Data Inicial'] && record['Data Final']) {
                const startDate = this.parseDate(record['Data Inicial']);
                const endDate = this.parseDate(record['Data Final']);
                
                if (!startDate) recordErrors.push('Data Inicial inválida');
                if (!endDate) recordErrors.push('Data Final inválida');
                if (startDate && endDate && startDate >= endDate) {
                    recordErrors.push('Data Final deve ser posterior à Data Inicial');
                }
            }
            
            if (recordErrors.length > 0) {
                errors.push(`Registro ${index + 1}: ${recordErrors.join(', ')}`);
            } else {
                validRecords.push(record);
            }
        });
        
        if (errors.length > 0) {
            this.addDebugLog(`Validação CSV: ${errors.length} erros encontrados`, 'warning');
        }
        
        return {
            isValid: errors.length === 0,
            errors: errors,
            validRecords: validRecords,
            totalRecords: data.length,
            validCount: validRecords.length
        };
    }

    validateJSONData(data) {
        const requiredFields = ['vacancy_name', 'status', 'start', 'end'];
        const errors = [];
        const validRecords = [];
        
        data.forEach((record, index) => {
            const recordErrors = [];
            
            requiredFields.forEach(field => {
                if (!record[field]) {
                    recordErrors.push(`Campo obrigatório ausente: ${field}`);
                }
            });
            
            // Validar datas
            if (record.start && record.end) {
                const startDate = this.parseDate(record.start);
                const endDate = this.parseDate(record.end);
                
                if (!startDate) recordErrors.push('Data start inválida');
                if (!endDate) recordErrors.push('Data end inválida');
                if (startDate && endDate && startDate >= endDate) {
                    recordErrors.push('Data end deve ser posterior à start');
                }
            }
            
            if (recordErrors.length > 0) {
                errors.push(`Registro ${index + 1}: ${recordErrors.join(', ')}`);
            } else {
                validRecords.push(record);
            }
        });
        
        if (errors.length > 0) {
            this.addDebugLog(`Validação JSON: ${errors.length} erros encontrados`, 'warning');
        }
        
        return {
            isValid: errors.length === 0,
            errors: errors,
            validRecords: validRecords,
            totalRecords: data.length,
            validCount: validRecords.length
        };
    }

    // =============================================================================
    // SISTEMA DE DEBUG E LOG
    // =============================================================================
    addDebugLog(message, type = 'info') {
        const timestamp = new Date().toLocaleTimeString();
        const logEntry = {
            timestamp: timestamp,
            type: type,
            message: message,
            fullMessage: `[${timestamp}] ${type.toUpperCase()}: ${message}`
        };
        
        this.debugLog.push(logEntry);
        
        // Manter apenas os últimos logs
        if (this.debugLog.length > this.constants.MAX_LOG_ENTRIES) {
            this.debugLog.shift();
        }
        
        // Log no console também
        const consoleMethod = type === 'error' ? 'error' : type === 'warning' ? 'warn' : 'log';
        console[consoleMethod](logEntry.fullMessage);
        
        // Dispatch evento para outros módulos
        this.dispatchEvent('debugLog', logEntry);
    }

    getDebugLog(filter = null) {
        if (!filter) return this.debugLog;
        
        return this.debugLog.filter(entry => 
            entry.type === filter || 
            entry.message.toLowerCase().includes(filter.toLowerCase())
        );
    }

    exportDebugLog() {
        const debugData = {
            version: this.version,
            timestamp: new Date().toISOString(),
            config: this.config,
            cacheStats: this.getCacheStats(),
            logs: this.debugLog,
            performance: this.getPerformanceStats()
        };
        
        const dataStr = JSON.stringify(debugData, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `productivity-debug-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        
        URL.revokeObjectURL(url);
        this.addDebugLog('Debug log exportado com sucesso');
    }

    // =============================================================================
    // SISTEMA DE EVENTOS
    // =============================================================================
    dispatchEvent(eventType, data) {
        const event = new CustomEvent(`productivity.${eventType}`, {
            detail: data
        });
        document.dispatchEvent(event);
    }

    addEventListener(eventType, callback) {
        document.addEventListener(`productivity.${eventType}`, callback);
    }

    // =============================================================================
    // MONITORAMENTO DE PERFORMANCE
    // =============================================================================
    startPerformanceMonitoring() {
        this.performanceStats = {
            startTime: Date.now(),
            operations: {},
            memory: {},
            lastCheck: Date.now()
        };
        
        // Monitorar uso de memória periodicamente
        setInterval(() => {
            this.updatePerformanceStats();
        }, 60000); // A cada minuto
    }

    measureOperation(operationName, fn) {
        const startTime = performance.now();
        const result = fn();
        const endTime = performance.now();
        const duration = endTime - startTime;
        
        if (!this.performanceStats.operations[operationName]) {
            this.performanceStats.operations[operationName] = {
                count: 0,
                totalTime: 0,
                avgTime: 0,
                maxTime: 0,
                minTime: Infinity
            };
        }
        
        const stats = this.performanceStats.operations[operationName];
        stats.count++;
        stats.totalTime += duration;
        stats.avgTime = stats.totalTime / stats.count;
        stats.maxTime = Math.max(stats.maxTime, duration);
        stats.minTime = Math.min(stats.minTime, duration);
        
        if (duration > 100) { // Log operações lentas
            this.addDebugLog(`Operação lenta detectada: ${operationName} (${duration.toFixed(2)}ms)`, 'warning');
        }
        
        return result;
    }

    async measureAsyncOperation(operationName, asyncFn) {
        const startTime = performance.now();
        const result = await asyncFn();
        const endTime = performance.now();
        const duration = endTime - startTime;
        
        if (!this.performanceStats.operations[operationName]) {
            this.performanceStats.operations[operationName] = {
                count: 0,
                totalTime: 0,
                avgTime: 0,
                maxTime: 0,
                minTime: Infinity
            };
        }
        
        const stats = this.performanceStats.operations[operationName];
        stats.count++;
        stats.totalTime += duration;
        stats.avgTime = stats.totalTime / stats.count;
        stats.maxTime = Math.max(stats.maxTime, duration);
        stats.minTime = Math.min(stats.minTime, duration);
        
        if (duration > 1000) { // Log operações async lentas
            this.addDebugLog(`Operação async lenta detectada: ${operationName} (${duration.toFixed(2)}ms)`, 'warning');
        }
        
        return result;
    }

    updatePerformanceStats() {
        if (performance.memory) {
            this.performanceStats.memory = {
                used: Math.round(performance.memory.usedJSHeapSize / 1024 / 1024),
                total: Math.round(performance.memory.totalJSHeapSize / 1024 / 1024),
                limit: Math.round(performance.memory.jsHeapSizeLimit / 1024 / 1024),
                timestamp: Date.now()
            };
        }
        
        this.performanceStats.lastCheck = Date.now();
    }

    getPerformanceStats() {
        return {
            uptime: Date.now() - this.performanceStats.startTime,
            operations: this.performanceStats.operations,
            memory: this.performanceStats.memory,
            cache: this.getCacheStats()
        };
    }

    // =============================================================================
    // UTILITÁRIOS DIVERSOS
    // =============================================================================
    generateHash(data) {
        return btoa(JSON.stringify(data)).slice(0, 32);
    }

    debounce(func, delay) {
        let timeoutId;
        return function (...args) {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => func.apply(this, args), delay);
        };
    }

    throttle(func, limit) {
        let inThrottle;
        return function (...args) {
            if (!inThrottle) {
                func.apply(this, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    }

    // =============================================================================
    // CLEANUP E DESTRUCTOR
    // =============================================================================
    destroy() {
        this.clearCache();
        this.debugLog = [];
        this.addDebugLog('Productivity Core Module destruído');
    }
}

// Exportar para uso global
if (typeof window !== 'undefined') {
    window.ProductivityCore = ProductivityCore;
}
