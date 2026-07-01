// ==========================================================================
// ARQUIVO DE CONFIGURAÇÃO (Google Sheets API & Apps Script Integrations)
// ==========================================================================
const CONFIG = {
    // [!] ID DA SUA PLANILHA ADICIONADO DIRETAMENTE:
    SPREADSHEET_ID: "1BjFbcmuS1YISnuYLrDo0I9TJ5iNDENT8zeaonSmDU4Y", 
    
    // [!] SUA GOOGLE API KEY ADICIONADA DIRETAMENTE:
    API_KEY: "AIzaSyD5Sb0MtuaVXtePVScvsPH3n8glWKZpePE", 
    
    // Intervalo de colunas que corresponde aos dados fornecidos (A a Q para cobrir as 17 colunas)
    RANGE: "A:Q",

    // [!] URL DO SEU APP GOOGLE APPS SCRIPT (MÉTODO A - RECOMENDADO):
    APPS_SCRIPT_URL: "",

    // [!] SEU TOKEN DE ACESSO OAUTH2 DO GOOGLE (MÉTODO B - EXPIRA RÁPIDO):
    OAUTH_ACCESS_TOKEN: ""
};

// Cache de dados local para buscas e edições instantâneas
let cachedRows = [];
let colHeaders = [];

// Cache global para instâncias de gráficos do Chart.js
let chartInstances = {};

// Instância global de Modal do Bootstrap
let editModalInstance = null;

/**
 * Inicialização e Gestão de Estado da Interface
 */
document.addEventListener("DOMContentLoaded", () => {
    initSidebarNavigation();
    initSetupForm();
    initFilterEvents();
    initEditFormEvents();

    // Tenta carregar automaticamente ao abrir a página se as chaves estiverem presentes
    if (CONFIG.SPREADSHEET_ID && CONFIG.API_KEY) {
        // Preenche os campos do form de config para facilitar visualização posterior
        document.getElementById("ui-sheet-id").value = CONFIG.SPREADSHEET_ID;
        document.getElementById("ui-api-key").value = CONFIG.API_KEY;
        document.getElementById("ui-script-url").value = CONFIG.APPS_SCRIPT_URL;
        document.getElementById("ui-oauth-token").value = CONFIG.OAUTH_ACCESS_TOKEN;
        
        carregarDadosDoSheets(CONFIG.SPREADSHEET_ID, CONFIG.API_KEY, CONFIG.RANGE);
    } else {
        // Se não configurado, exibe o banner de ajuda e abre o formulário
        document.getElementById("initial-setup-alert").style.display = "block";
        document.getElementById("setup-panel").style.display = "block";
    }
});

/**
 * Controla o comportamento de alternar a visibilidade da Sidebar e Menus
 */
function initSidebarNavigation() {
    const menuToggle = document.getElementById("menu-toggle");
    const wrapper = document.getElementById("wrapper");
    const btnShowSetup = document.getElementById("btn-show-setup");
    const menuConfig = document.getElementById("menu-config");
    const menuDashboard = document.getElementById("menu-dashboard");

    if (menuToggle && wrapper) {
        menuToggle.addEventListener("click", (e) => {
            e.preventDefault();
            wrapper.classList.toggle("toggled");
        });
    }

    // Ouvinte para o botão de Configuração Inicial
    if (btnShowSetup) {
        btnShowSetup.addEventListener("click", () => {
            toggleViewToConfig();
        });
    }

    // Comportamentos dos links do menu
    menuConfig.addEventListener("click", (e) => {
        e.preventDefault();
        menuConfig.classList.add("active");
        menuDashboard.classList.remove("active");
        document.getElementById("setup-panel").style.display = "block";
        document.getElementById("initial-setup-alert").style.display = "none";
    });

    menuDashboard.addEventListener("click", (e) => {
        e.preventDefault();
        menuDashboard.classList.add("active");
        menuConfig.classList.remove("active");
        document.getElementById("setup-panel").style.display = "none";
        if (!CONFIG.SPREADSHEET_ID && !CONFIG.API_KEY && cachedRows.length === 0) {
            document.getElementById("initial-setup-alert").style.display = "block";
        }
    });
}

function toggleViewToConfig() {
    document.getElementById("menu-config").classList.add("active");
    document.getElementById("menu-dashboard").classList.remove("active");
    document.getElementById("setup-panel").style.display = "block";
    document.getElementById("initial-setup-alert").style.display = "none";
}

/**
 * Configura e ouve a submissão do formulário de credenciais na UI
 */
function initSetupForm() {
    const form = document.getElementById("sheets-config-form");

    form.addEventListener("submit", (e) => {
        e.preventDefault();
        const sheetId = document.getElementById("ui-sheet-id").value.trim();
        const apiKey = document.getElementById("ui-api-key").value.trim();
        
        // Grava as definições de escrita adicionadas na tela
        CONFIG.APPS_SCRIPT_URL = document.getElementById("ui-script-url").value.trim();
        CONFIG.OAUTH_ACCESS_TOKEN = document.getElementById("ui-oauth-token").value.trim();

        if (sheetId && apiKey) {
            // Esconde banners informativos
            document.getElementById("initial-setup-alert").style.display = "none";
            document.getElementById("error-alert").style.display = "none";
            
            // Executa a requisição
            carregarDadosDoSheets(sheetId, apiKey, CONFIG.RANGE);
        }
    });
}

/**
 * Configura os ouvintes de eventos para o Painel de Filtros Avançados
 */
function initFilterEvents() {
    const searchInput = document.getElementById("search-input");
    const filterCargo = document.getElementById("filter-cargo");
    const filterVertical = document.getElementById("filter-vertical");
    const filterUf = document.getElementById("filter-uf");
    const filterSexo = document.getElementById("filter-sexo");
    const filterPotencial = document.getElementById("filter-potencial");
    const btnClearFilters = document.getElementById("btn-clear-filters");

    // Evento para caixa de texto
    searchInput.addEventListener("input", aplicarFiltros);

    // Eventos para caixas de seleção (Dropdowns)
    filterCargo.addEventListener("change", aplicarFiltros);
    filterVertical.addEventListener("change", aplicarFiltros);
    filterUf.addEventListener("change", aplicarFiltros);
    filterSexo.addEventListener("change", aplicarFiltros);
    filterPotencial.addEventListener("change", aplicarFiltros);

    // Evento para limpar filtros
    btnClearFilters.addEventListener("click", () => {
        searchInput.value = "";
        filterCargo.value = "";
        filterVertical.value = "";
        filterUf.value = "";
        filterSexo.value = "";
        filterPotencial.value = "";
        aplicarFiltros();
    });
}

/**
 * Configura as ações de delegação de clique para o formulário e botões de edição
 */
function initEditFormEvents() {
    const btnSave = document.getElementById("btn-save-edit");
    const dataTable = document.getElementById("sheets-data-table");

    // Delegar cliques nos botões de edição gerados dinamicamente na tabela
    dataTable.addEventListener("click", (e) => {
        const editButton = e.target.closest(".btn-edit-colab");
        if (editButton) {
            const localId = parseInt(editButton.getAttribute("data-id"));
            abrirModalEdicao(localId);
        }
    });

    // Ouvinte para salvar alterações do modal
    if (btnSave) {
        btnSave.addEventListener("click", salvarAlteracoesEdicao);
    }
}

/**
 * MÓDULO DE INTEGRAÇÃO - Faz a requisição assíncrona à Google Sheets API v4
 */
async function carregarDadosDoSheets(sheetId, apiKey, range) {
    const spinner = document.getElementById("loading-spinner");
    const tableCard = document.getElementById("table-card");
    const errorAlert = document.getElementById("error-alert");
    const cardsContainer = document.getElementById("dashboard-cards");
    const chartsContainer = document.getElementById("dashboard-charts");
    const filterCard = document.getElementById("filter-card");

    // Exibe indicador de carregamento
    spinner.style.display = "block";
    tableCard.style.display = "none";
    cardsContainer.style.display = "none";
    chartsContainer.style.display = "none";
    filterCard.style.display = "none";
    errorAlert.style.display = "none";

    const endpoint = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${range}?key=${apiKey}`;

    try {
        const response = await fetch(endpoint);
        
        if (!response.ok) {
            const errResponse = await response.json();
            throw new Error(errResponse.error?.message || "Erro na comunicação com a API.");
        }

        const data = await response.json();
        
        if (!data.values || data.values.length === 0) {
            throw new Error("Nenhum dado encontrado na planilha informada.");
        }

        // Processa e armazena os registros em cache local
        colHeaders = data.values[0]; // Primeira linha = Cabeçalhos
        cachedRows = processarLinhasDaPlanilha(data.values);

        // Popula os filtros dropdown de forma dinâmica com base nos dados obtidos
        popularFiltrosDinamicos(cachedRows);

        // Renderiza os dados coletados
        renderizarCabecalhos(colHeaders);
        renderizarDados(cachedRows);

        // Ajusta a visibilidade
        spinner.style.display = "none";
        tableCard.style.display = "block";
        filterCard.style.display = "block";
        document.getElementById("setup-panel").style.display = "none"; // Minimiza formulário após sucesso
        
    } catch (error) {
        spinner.style.display = "none";
        errorAlert.style.display = "block";
        document.getElementById("error-message").innerText = `Falha na integração: ${error.message}`;
        console.error("Erro no processamento da API Google Sheets:", error);
    }
}

/**
 * Processa a matriz crua retornada pela API alinhando cabeçalhos e valores
 * Atribui um identificador sequencial local (__local_id) a cada linha
 */
function processarLinhasDaPlanilha(values) {
    const headers = values[0];
    const dataRows = values.slice(1);

    return dataRows.map((row, idx) => {
        const obj = { __local_id: idx };
        headers.forEach((header, index) => {
            obj[header] = row[index] !== undefined ? row[index] : "";
        });
        return obj;
    });
}

/**
 * Identifica valores singulares nas colunas e preenche as listas de seleção dinamicamente
 */
function popularFiltrosDinamicos(rows) {
    const cargos = new Set();
    const verticais = new Set();
    const ufs = new Set();
    const sexos = new Set();
    const potenciais = new Set();

    rows.forEach(row => {
        if (row["CARGO"] && row["CARGO"].trim() !== "") cargos.add(row["CARGO"].trim());
        if (row["VERTICAL"] && row["VERTICAL"].trim() !== "") verticais.add(row["VERTICAL"].trim());
        if (row["UF"] && row["UF"].trim() !== "") ufs.add(row["UF"].trim());
        if (row["SEXO"] && row["SEXO"].trim() !== "") sexos.add(row["SEXO"].trim());
        if (row["POTENCIAL"] && row["POTENCIAL"].trim() !== "") potenciais.add(row["POTENCIAL"].trim());
    });

    // Auxiliar para popular select ordenado alfabeticamente
    const popularSelect = (selectId, setValues) => {
        const selectElement = document.getElementById(selectId);
        // Preserva apenas a primeira opção ("Todos")
        selectElement.innerHTML = selectElement.options[0].outerHTML;
        
        Array.from(setValues).sort().forEach(value => {
            const opt = document.createElement("option");
            opt.value = value;
            opt.innerText = value;
            selectElement.appendChild(opt);
        });
    };

    popularSelect("filter-cargo", cargos);
    popularSelect("filter-vertical", verticais);
    popularSelect("filter-uf", ufs);
    popularSelect("filter-sexo", sexos);
    popularSelect("filter-potencial", potenciais);
}

/**
 * Abre o Modal do Bootstrap carregando as informações do colaborador selecionado
 */
function abrirModalEdicao(localId) {
    const row = cachedRows.find(r => r.__local_id === localId);
    if (!row) return;

    // Injeta dados nos inputs do formulário
    document.getElementById("edit-row-id").value = localId;
    document.getElementById("edit-nome").value = row["NOME"] || "Colaborador sem Nome";
    document.getElementById("modal-status-alert").style.display = "none";
    
    // Atribui o valor do potencial ao Select e lida com correspondências flexíveis de grafia
    const selectPotencial = document.getElementById("edit-potencial");
    selectPotencial.value = row["POTENCIAL"] || "";
    if (selectPotencial.selectedIndex === -1 && row["POTENCIAL"]) {
        const valClean = String(row["POTENCIAL"]).trim().toLowerCase();
        for (let i = 0; i < selectPotencial.options.length; i++) {
            if (selectPotencial.options[i].value.toLowerCase().trim() === valClean) {
                selectPotencial.selectedIndex = i;
                break;
            }
        }
    }

    // Atribui o valor da criticidade ao Select e lida com correspondências flexíveis de grafia
    const selectCriticidade = document.getElementById("edit-criticidade");
    selectCriticidade.value = row["CRITICIDADE DO COLABORADOR"] || "";
    if (selectCriticidade.selectedIndex === -1 && row["CRITICIDADE DO COLABORADOR"]) {
        const valClean = String(row["CRITICIDADE DO COLABORADOR"]).trim().toLowerCase();
        for (let i = 0; i < selectCriticidade.options.length; i++) {
            if (selectCriticidade.options[i].value.toLowerCase().trim() === valClean) {
                selectCriticidade.selectedIndex = i;
                break;
            }
        }
    }

    document.getElementById("edit-mudanca-cargo").value = row["ÚLTIMA MUDANÇA CARGO"] || "";

    // Instancia ou recupera o modal Bootstrap e o exibe
    if (!editModalInstance) {
        editModalInstance = new bootstrap.Modal(document.getElementById('editCollaboratorModal'));
    }
    editModalInstance.show();
}

/**
 * Salva as modificações no cache local, executa escrita real e redesenha o painel
 */
async function salvarAlteracoesEdicao() {
    const localId = parseInt(document.getElementById("edit-row-id").value);
    const idx = cachedRows.findIndex(r => r.__local_id === localId);
    
    if (idx === -1) return;

    // Coleta novos valores dos campos
    const novoPotencial = document.getElementById("edit-potencial").value.trim();
    const novaCriticidade = document.getElementById("edit-criticidade").value.trim();
    const novaMudancaCargo = document.getElementById("edit-mudanca-cargo").value.trim();

    // Ativa loaders na interface do modal
    const btnSave = document.getElementById("btn-save-edit");
    const btnCancel = document.getElementById("btn-cancel-edit");
    const btnText = document.getElementById("btn-save-text");
    const spinner = document.getElementById("btn-save-spinner");
    const alertBox = document.getElementById("modal-status-alert");

    btnSave.disabled = true;
    btnCancel.disabled = true;
    btnText.style.display = "none";
    spinner.style.display = "inline-block";
    alertBox.style.display = "none";

    // Calcula a linha correspondente na planilha do Google Sheets (1-based, com cabeçalho = localId + 2)
    const targetSpreadsheetRow = localId + 2;

    let writeSuccess = true;
    let writeMethodUsed = "Nenhum (Simulado em Memória)";
    let errorMsg = "";

    try {
        // --- MÉTODO A: Google Apps Script Web App ---
        if (CONFIG.APPS_SCRIPT_URL) {
            writeMethodUsed = "Apps Script (Implantado na Planilha)";
            
            const payload = {
                row: targetSpreadsheetRow,
                potencial: novoPotencial,
                criticidade: novaCriticidade,
                mudancaCargo: novaMudancaCargo
            };

            // ENVIADO COMO "text/plain" PARA BYPASSAR O CORS PREFLIGHT DO NAVEGADOR
            const response = await fetch(CONFIG.APPS_SCRIPT_URL, {
                method: "POST",
                mode: "no-cors", 
                headers: { "Content-Type": "text/plain" },
                body: JSON.stringify(payload)
            });
            
            // Com mode: "no-cors", consideramos sucesso caso a rede não dispare uma exceção imediata.

        // --- MÉTODO B: Google Sheets REST API v4 direta ---
        } else if (CONFIG.OAUTH_ACCESS_TOKEN) {
            writeMethodUsed = "Google Sheets REST API v4";

            // Funções auxiliares para PUT individual por célula para não sobrescrever colunas adjacentes (como Coluna M)
            const updateCell = async (colLetter, value) => {
                const sheetsEndpoint = `https://sheets.googleapis.com/v4/spreadsheets/${CONFIG.SPREADSHEET_ID}/values/${colLetter}${targetSpreadsheetRow}?valueInputOption=USER_ENTERED`;
                
                const res = await fetch(sheetsEndpoint, {
                    method: "PUT",
                    headers: {
                        "Authorization": `Bearer ${CONFIG.OAUTH_ACCESS_TOKEN}`,
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({ values: [[value]] })
                });

                if (!res.ok) {
                    const errBody = await res.json();
                    throw new Error(errBody.error?.message || `Erro ao escrever na célula ${colLetter}${targetSpreadsheetRow}`);
                }
            };

            // Executa as chamadas individuais em paralelo
            await Promise.all([
                updateCell("L", novaMudancaCargo), // Última Mudança de Cargo
                updateCell("N", novoPotencial),    // Potencial
                updateCell("O", novaCriticidade)    // Criticidade
            ]);
        } else {
            writeMethodUsed = "Memória Local";
        }
    } catch (err) {
        writeSuccess = false;
        errorMsg = err.message || "Erro desconhecido na gravação do Google Sheets.";
    }

    // Desativa loaders
    btnSave.disabled = false;
    btnCancel.disabled = false;
    btnText.style.display = "inline-block";
    spinner.style.display = "none";

    if (!writeSuccess) {
        // Se falhar na escrita real, mostra o erro no modal e mantém ele aberto
        alertBox.style.display = "block";
        alertBox.innerHTML = `<i class="bi bi-x-circle-fill me-2"></i><strong>Erro de gravação:</strong> ${errorMsg}`;
        return;
    }

    // Grava alterações no cache de memória local
    cachedRows[idx]["POTENCIAL"] = novoPotencial;
    cachedRows[idx]["CRITICIDADE DO COLABORADOR"] = novaCriticidade;
    cachedRows[idx]["ÚLTIMA MUDANÇA CARGO"] = novaMudancaCargo;

    // Oculta modal
    if (editModalInstance) {
        editModalInstance.hide();
    }

    // Configura o banner de confirmação de escrita na tela
    const localEditAlert = document.getElementById("local-edit-alert");
    const alertText = document.getElementById("edit-alert-text");

    localEditAlert.style.display = "block";
    if (writeMethodUsed === "Memória Local") {
        localEditAlert.className = "alert alert-warning shadow-sm border-start border-warning border-4 p-3 mb-4";
        alertText.innerHTML = `<strong>Modo Simulação:</strong> Alterações guardadas apenas nesta sessão local. Configure o <strong>Método A ou B</strong> para sincronização automática com o Google Sheets.`;
    } else {
        localEditAlert.className = "alert alert-success shadow-sm border-start border-success border-4 p-3 mb-4";
        alertText.innerHTML = `<i class="bi bi-cloud-check-fill me-2 text-success"></i><strong>Sincronização Concluída!</strong> Dados guardados com sucesso diretamente no Google Sheets via <strong>${writeMethodUsed}</strong>.`;
    }

    // Recalcula e sincroniza todas as visualizações dinamicamente
    popularFiltrosDinamicos(cachedRows);
    aplicarFiltros();
}

/**
 * Filtra dinamicamente as linhas em memória local cruzando critérios múltiplos
 */
function aplicarFiltros() {
    const searchVal = document.getElementById("search-input").value.toLowerCase().trim();
    const cargoVal = document.getElementById("filter-cargo").value;
    const verticalVal = document.getElementById("filter-vertical").value;
    const ufVal = document.getElementById("filter-uf").value;
    const sexoVal = document.getElementById("filter-sexo").value;
    const potencialVal = document.getElementById("filter-potencial").value;

    // Filtro passo a passo
    const filtered = cachedRows.filter(row => {
        // 1. Filtro por Busca Geral
        if (searchVal !== "") {
            const matchesSearch = Object.values(row).some(val => 
                String(val).toLowerCase().includes(searchVal)
            );
            if (!matchesSearch) return false;
        }

        // 2. Filtro por Cargo
        if (cargoVal !== "" && row["CARGO"] !== cargoVal) {
            return false;
        }

        // 3. Filtro por Vertical
        if (verticalVal !== "" && row["VERTICAL"] !== verticalVal) {
            return false;
        }

        // 4. Filtro por UF
        if (ufVal !== "" && row["UF"] !== ufVal) {
            return false;
        }

        // 5. Filtro por Sexo
        if (sexoVal !== "" && row["SEXO"] !== sexoVal) {
            return false;
        }

        // 6. Filtro por Potencial
        if (potencialVal !== "" && row["POTENCIAL"] !== potencialVal) {
            return false;
        }

        return true;
    });

    // Update de forma síncrona a tabela, os KPIs e os gráficos
    renderizarDados(filtered);
}

/**
 * Renderiza dinamicamente as colunas com base nos cabeçalhos reais da planilha
 */
function renderizarCabecalhos(headers) {
    const container = document.getElementById("table-headers");
    container.innerHTML = "";

    headers.forEach(header => {
        const th = document.createElement("th");
        th.setAttribute("scope", "col");
        th.innerText = header;
        container.appendChild(th);
    });

    // Adiciona cabeçalho fixo para a coluna de Ações
    const thActions = document.createElement("th");
    thActions.setAttribute("scope", "col");
    thActions.innerText = "Ações";
    container.appendChild(thActions);
}

/**
 * Renderiza as linhas processadas aplicando estilização premium baseada nos valores
 */
function renderizarDados(rows) {
    const container = document.getElementById("table-rows");
    const rowCountBadge = document.getElementById("row-count");
    
    container.innerHTML = "";
    rowCountBadge.innerText = `${rows.length} Colaborador(es)`;

    // Atualiza os cartões de KPI e gráficos de forma síncrona para refletir o recorte corrente
    atualizarKPIs(rows);
    atualizarGraficos(rows);

    if (rows.length === 0) {
        container.innerHTML = `
            <tr>
                <td colspan="${colHeaders.length + 1}" class="text-center py-5 text-secondary">
                    <i class="bi bi-search fs-2 d-block mb-2 text-muted"></i>
                    Nenhum colaborador corresponde aos filtros ativos.
                </td>
            </tr>
        `;
        return;
    }

    rows.forEach((row) => {
        const tr = document.createElement("tr");

        colHeaders.forEach((header) => {
            const td = document.createElement("td");
            const valor = row[header];

            // Formatação condicional moderna para colunas lógicas
            if (header === "VALE À PENA INVESTIR?") {
                const vUpper = String(valor).toUpperCase();
                if (vUpper === "SIM" || vUpper === "S") {
                    td.innerHTML = `<span class="badge badge-sim rounded-pill px-2.5 py-1.5"><i class="bi bi-check-circle-fill me-1"></i>Sim</span>`;
                } else if (vUpper === "NÃO" || vUpper === "NAO" || vUpper === "N") {
                    td.innerHTML = `<span class="badge badge-nao rounded-pill px-2.5 py-1.5"><i class="bi bi-x-circle-fill me-1"></i>Não</span>`;
                } else {
                    td.innerText = valor;
                }
            } else if (header === "EMAIL" && valor.includes("@")) {
                td.innerHTML = `<a href="mailto:${valor}" class="text-decoration-none text-primary"><i class="bi bi-envelope me-1"></i>${valor}</a>`;
            } else if (header === "LOCALIDADE" && valor) {
                td.innerHTML = `<i class="bi bi-geo-alt text-muted me-1"></i>${valor}`;
            } else if (header === "POTENCIAL") {
                // Renderização visual idêntica à imagem carregada para a coluna POTENCIAL
                const valClean = String(valor).trim();
                let badgeClass = "";
                
                if (valClean === "Top Talent") {
                    badgeClass = "bg-top-talent";
                } else if (valClean === "Tech Expert") {
                    badgeClass = "bg-tech-expert";
                } else if (valClean === "Strong Contribuitor" || valClean === "Strong Contributor") {
                    badgeClass = "bg-strong-contributor";
                } else if (valClean === "Underperformance") {
                    badgeClass = "bg-underperformance";
                } else if (valClean === "Explore to fit") {
                    badgeClass = "bg-explore-to-fit";
                }
                
                if (badgeClass !== "") {
                    td.innerHTML = `<span class="badge badge-custom-pill ${badgeClass}">${valor}</span>`;
                } else {
                    td.innerHTML = `<strong class="text-dark">${valor}</strong>`;
                }
            } else if (header === "CRITICIDADE DO COLABORADOR") {
                // Renderização visual idêntica à imagem carregada para a coluna CRITICIDADE
                const valClean = String(valor).trim();
                let badgeClass = "";
                
                if (valClean === "Alto Risco") {
                    badgeClass = "bg-alto-risco";
                } else if (valClean === "Médio Risco" || valClean === "Medio Risco") {
                    badgeClass = "bg-medio-risco";
                } else if (valClean === "Baixo Risco") {
                    badgeClass = "bg-baixo-risco";
                }
                
                if (badgeClass !== "") {
                    td.innerHTML = `<span class="badge badge-custom-pill ${badgeClass}">${valor}</span>`;
                } else {
                    td.innerHTML = `<strong class="text-dark">${valor}</strong>`;
                }
            } else {
                td.innerText = valor;
            }

            tr.appendChild(td);
        });

        // Cria célula de Ação com o botão "Editar"
        const tdActions = document.createElement("td");
        tdActions.innerHTML = `
            <button class="btn btn-sm btn-outline-primary btn-edit-colab py-1 px-2 d-flex align-items-center gap-1" data-id="${row.__local_id}" title="Editar informações do colaborador">
                <i class="bi bi-pencil"></i><span class="d-none d-sm-inline">Editar</span>
            </button>
        `;
        tr.appendChild(tdActions);

        container.appendChild(tr);
    });
}

/**
 * Calcula e atualiza os valores dos cartões de KPI com base nas linhas exibidas
 */
function atualizarKPIs(rows) {
    const kpiColaboradores = document.getElementById("kpi-colaboradores");
    const kpiCargos = document.getElementById("kpi-cargos");
    const kpiVerticais = document.getElementById("kpi-verticais");
    const kpiLocalidades = document.getElementById("kpi-localidades");
    const kpiTempoMedio = document.getElementById("kpi-tempo-medio");
    const cardsContainer = document.getElementById("dashboard-cards");

    if (rows.length === 0) {
        kpiColaboradores.innerText = "0";
        kpiCargos.innerText = "0";
        kpiVerticais.innerText = "0";
        kpiLocalidades.innerText = "0";
        kpiTempoMedio.innerText = "0.0 anos";
        cardsContainer.style.display = "flex";
        return;
    }

    // Sets para recolher valores únicos
    const cargosSet = new Set();
    const verticaisSet = new Set();
    const localidadesSet = new Set();
    
    let somaTempo = 0;
    let validosTempo = 0;

    rows.forEach(row => {
        // Totalizar cargos distintos
        if (row["CARGO"] && row["CARGO"].trim() !== "") {
            cargosSet.add(row["CARGO"].trim().toLowerCase());
        }
        // Totalizar verticais distintas
        if (row["VERTICAL"] && row["VERTICAL"].trim() !== "") {
            verticaisSet.add(row["VERTICAL"].trim().toLowerCase());
        }
        // Totalizar localidades distintas
        if (row["LOCALIDADE"] && row["LOCALIDADE"].trim() !== "") {
            localidadesSet.add(row["LOCALIDADE"].trim().toLowerCase());
        }

        // Processamento de tempo de empresa (Tempo de Betha Anos)
        const tempoStr = row["TEMPO DE BETHA (ANOS)"];
        if (tempoStr !== undefined && tempoStr !== null && tempoStr !== "") {
            // Trata expressões textuais ou numéricas (Ex: "26 anos e 1 meses" -> extrai 26.0)
            const match = String(tempoStr).match(/^([0-9]+[.,]?[0-9]*)/);
            if (match) {
                const tempoLimpo = match[1].replace(",", ".").trim();
                const tempoFloat = parseFloat(tempoLimpo);
                if (!isNaN(tempoFloat)) {
                    somaTempo += tempoFloat;
                    validosTempo++;
                }
            }
        }
    });

    // Cálculos Finais
    const totalColaboradores = rows.length;
    const totalCargos = cargosSet.size;
    const totalVerticais = verticaisSet.size;
    const totalLocalidades = localidadesSet.size;
    const mediaTempo = validosTempo > 0 ? (somaTempo / validosTempo).toFixed(1) : "0.0";

    // Injeta dados nos cartões da UI
    kpiColaboradores.innerText = totalColaboradores;
    kpiCargos.innerText = totalCargos;
    kpiVerticais.innerText = totalVerticais;
    kpiLocalidades.innerText = totalLocalidades;
    kpiTempoMedio.innerText = `${mediaTempo} anos`;

    // Mostra o container dos cartões de KPI
    cardsContainer.style.display = "flex";
}

/**
 * AGREGADOR & RENDERIZADOR DE GRÁFICOS (Chart.js)
 * Reconstrói ou cria os gráficos com base nos dados filtrados correntes.
 */
function atualizarGraficos(rows) {
    const chartsContainer = document.getElementById("dashboard-charts");

    // Destruir todas as instâncias existentes para prevenir duplicações e bugs visuais no hover
    Object.keys(chartInstances).forEach(key => {
        if (chartInstances[key]) {
            chartInstances[key].destroy();
        }
    });
    chartInstances = {};

    if (rows.length === 0) {
        chartsContainer.style.display = "none";
        return;
    }

    // --- Funções Auxiliares de Agregação de Frequência ---
    const obterContagemAgrupada = (key) => {
        const contagem = {};
        rows.forEach(row => {
            let valor = row[key] ? row[key].trim() : "";
            if (valor === "") valor = "Não Especificado";
            contagem[valor] = (contagem[valor] || 0) + 1;
        });
        return contagem;
    };

    // 1. Gráfico: Colaboradores por Cargo (Top 8, Ordenado)
    const cargoCounts = obterContagemAgrupada("CARGO");
    const sortedCargos = Object.entries(cargoCounts).sort((a, b) => b[1] - a[1]).slice(0, 8);
    const cargoLabels = sortedCargos.map(item => item[0]);
    const cargoData = sortedCargos.map(item => item[1]);

    chartInstances.cargo = new Chart(document.getElementById("chart-cargo"), {
        type: "bar",
        data: {
            labels: cargoLabels,
            datasets: [{
                label: "Colaboradores",
                data: cargoData,
                backgroundColor: "#3b82f6",
                borderRadius: 6,
                borderSkipped: false,
                barThickness: 18
            }]
        },
        options: {
            indexAxis: "y",
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                x: {
                    beginAtZero: true,
                    ticks: { stepSize: 1, color: "#64748b" },
                    grid: { color: "#f1f5f9" }
                },
                y: {
                    ticks: { color: "#64748b" },
                    grid: { display: false }
                }
            }
        }
    });

    // 2. Gráfico: Colaboradores por Vertical (Doughnut)
    const verticalCounts = obterContagemAgrupada("VERTICAL");
    const verticalLabels = Object.keys(verticalCounts);
    const verticalData = Object.values(verticalCounts);

    chartInstances.vertical = new Chart(document.getElementById("chart-vertical"), {
        type: "doughnut",
        data: {
            labels: verticalLabels,
            datasets: [{
                data: verticalData,
                backgroundColor: ["#3b82f6", "#10b981", "#f59e0b", "#8b5cf6", "#ec4899", "#38bdf8", "#64748b"],
                borderWidth: 2,
                borderColor: "#ffffff"
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: "bottom",
                            labels: { boxWidth: 12, padding: 15, color: "#64748b", font: { size: 11 } }
                        }
                    }
                }
            });

            // 3. Gráfico: Colaboradores por UF (Barras Verticais)
            const ufCounts = obterContagemAgrupada("UF");
            const ufLabels = Object.keys(ufCounts);
            const ufData = Object.values(ufCounts);

            chartInstances.uf = new Chart(document.getElementById("chart-uf"), {
                type: "bar",
                data: {
                    labels: ufLabels,
                    datasets: [{
                        label: "Colaboradores",
                        data: ufData,
                        backgroundColor: "#f59e0b",
                        borderRadius: 6,
                        barThickness: 24
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { display: false }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            ticks: { stepSize: 1, color: "#64748b" },
                            grid: { color: "#f1f5f9" }
                        },
                        x: {
                            ticks: { color: "#64748b" },
                            grid: { display: false }
                        }
                    }
                }
            });

            // 4. Gráfico: Distribuição por Sexo (Pizza)
            const sexoCounts = obterContagemAgrupada("SEXO");
            const sexoLabels = Object.keys(sexoCounts);
            const sexoData = Object.values(sexoCounts);

            chartInstances.sexo = new Chart(document.getElementById("chart-sexo"), {
                type: "pie",
                data: {
                    labels: sexoLabels,
                    datasets: [{
                        data: sexoData,
                        backgroundColor: ["#fb7185", "#38bdf8", "#34d399", "#a78bfa"],
                        borderWidth: 1,
                        borderColor: "#ffffff"
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: "bottom",
                            labels: { boxWidth: 12, padding: 15, color: "#64748b" }
                        }
                    }
                }
            });

            // 5. Gráfico: Potencial dos Colaboradores (Área Polar)
            const potencialCounts = obterContagemAgrupada("POTENCIAL");
            const potencialLabels = Object.keys(potencialCounts);
            const potencialData = Object.values(potencialCounts);

            chartInstances.potencial = new Chart(document.getElementById("chart-potencial"), {
                type: "polarArea",
                data: {
                    labels: potencialLabels,
                    datasets: [{
                        data: potencialData,
                        backgroundColor: [
                            "rgba(0, 18, 225, 0.75)",     /* Top Talent */
                            "rgba(3, 136, 195, 0.75)",     /* Tech Expert */
                            "rgba(118, 224, 42, 0.75)",    /* Strong Contribuitor */
                            "rgba(161, 1, 1, 0.75)",       /* Underperformance */
                            "rgba(255, 234, 0, 0.75)"      /* Explore to fit */
                        ],
                        borderWidth: 1,
                        borderColor: "#ffffff"
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        r: {
                            ticks: { display: false },
                            grid: { color: "#f1f5f9" }
                        }
                    },
                    plugins: {
                        legend: {
                            position: "bottom",
                            labels: { boxWidth: 12, padding: 15, color: "#64748b" }
                        }
                    }
                }
            });

            // Exibir a seção de gráficos com transição suave
            chartsContainer.style.display = "flex";
        }
</script>
