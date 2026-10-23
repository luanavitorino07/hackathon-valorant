### 0. Papel e objetivo

Você é um engenheiro de dados e front-end sênior. Construa o **ScoutRoom**, uma aplicação web estática que transforma 336 partidas de VALORANT do circuito universitário brasileiro (arquivos JSON) em um relatório de preparação para técnicos e jogadores. O usuário escolhe um time e recebe, em poucos cliques: (A) um dossiê de scouting + um conselheiro de veto de mapas; (B) um playbook de pós-plant; (C) uma auditoria de economia. Toda afirmação mostra o tamanho da amostra, o nível de confiança e as evidências (os rounds que a sustentam). Prazo duro: entrega final na sexta 23/10/2026 às 23h59 (hoje é 20/10). Priorize funcionar de ponta a ponta sobre completude.

### 1. Contexto e regras inegociáveis

1. **Fonte de dados:** exclusivamente os JSON fornecidos pela organização. Proibido scraping, APIs externas ou qualquer dado de partida de terceiros.
2. **Uso:** só análise pós-partida e preparação pré-jogo. Nenhum recurso em tempo real, nenhuma integração com o cliente do jogo ou com a API da Riot.
3. **Privacidade:** nunca mostrar PUUID. Jogadores aparecem por apelido anônimo (ex.: “Jogador K7”) derivado de hash estável com sal. Nicks reais (`gameName#tagLine`) só em arquivo local git-ignorado e atrás de uma flag de build desligada por padrão.
4. **Legal:** sem logos/marcas da Riot; sem as fontes Tungsten/DIN; rodapé com aviso de projeto independente (texto em §10.6).
5. **Honestidade estatística:** nunca mostrar número sem n; nunca afirmar causalidade; toda recomendação é “sugestão com confiança X”.
6. **Sem LLM gerando números.** Textos de insight vêm de templates determinísticos preenchidos com números calculados.
7. Interface em português do Brasil; identificadores de código em inglês.
8. Se algo estiver ambíguo, escolha o padrão mais simples, registre em docs/DECISIONS.md e siga em frente; não pare para perguntar.

### 2. Arquitetura

Duas camadas desacopladas: (1) **pipeline/** em Python lê os JSON recursivamente, gera tabelas, calcula métricas e escreve arquivos JSON de saída; (2) **web/** em Vite + React + TypeScript é um site estático que só lê esses arquivos em web/public/data. Sem backend.

Arquivos de saída: index.json (lista de times com nº de partidas, mapas, data de geração); league.json (taxas da liga por mapa e lado, tabela de economia da liga, parâmetros dos priors); teams/{slug}.json (perfil, playbook e economia do time, com k e n de cada proporção); evidence/{slug}.json (listas de match_id + round_num por métrica, no máximo 60 por métrica). O Veto é calculado no navegador a partir de teams/*.json e league.json.

### 3. Estrutura do repositório

- data/raw/ (JSON originais em subpastas como `Rush Series Esquenta/`, `Univavá/Classificatória 1/`, `Univavá/Fase de Grupos/`, etc.; git-ignorado)
- data/dictionaries/ (agents.json, weapons.json, maps.json: opcionais, GUID → nome)
- data/private/ (aliases.csv; git-ignorado)
- pipeline/ (src/, tests/, pyproject.toml)
- web/ (src/, public/data/; tokens do Tailwind em src/index.css via @theme)
- docs/ (schema_audit.md, methodology.md, DECISIONS.md)
- README.md (como rodar tudo em 3 comandos)

### 4. Fase 0 — Auditoria obrigatória dos dados (fatos já constatados nas amostras + validação nos 336 arquivos)

Gere docs/schema_audit.md validando nos 336 arquivos as descobertas já confirmadas nas amostras iniciais:

- **Estrutura de diretórios:** Os 336 JSON estão distribuídos em subpastas dentro de `Dados .Json/` (`Rush Series Esquenta/` [29], `Rush Series Esquenta 2/` [26], `Rush Series Inclusivo/` [13], e `Univavá/` subdividido em `Classificatória 1/` [55], `Classificatória 2/` [39], `Classificatória 3/` [43], `Classificatória 4/` [62] e `Fase de Grupos/` [69]). O leitor deve usar busca recursiva (`rglob("*.json")`).
- **Campos confirmados no schema:**
  - `matchInfo`: `matchId`, `mapId` (usa codinomes internos da Unreal, ex.: `/Game/Maps/Jam/Jam` para Lotus, `/Game/Maps/Triad/Triad` para Haven, `/Game/Maps/Juliett/Juliett` para Sunset, `/Game/Maps/Ascent/Ascent` para Ascent), `gameVersion` (ex.: `"release-12.10-..."` a `"release-13.05-..."`), `gameLengthMillis`, `gameStartMillis`, `isCompleted`.
  - `players`: 10 jogadores com `puuid`, `gameName`, `tagLine`, `teamId` (`"Blue"` ou `"Red"`), `characterId` (UUID minúsculo) e `stats` (`score`, `roundsPlayed`, `kills`, `deaths`, `assists`, `playtimeMillis`, `abilityCasts` com `grenadeCasts`, `ability1Casts`, `ability2Casts`, `ultimateCasts`).
  - `coaches`: lista no topo do JSON com `puuid` e `teamId` do técnico (não misturar com `players`).
  - `teams`: 2 objetos (`"Blue"` e `"Red"`) com `won`, `roundsPlayed`, `roundsWon`, `numPoints`.
  - `roundResults`: `roundNum` (0-indexado, podendo ir além de 23 em prorrogações, ex.: até 35 em jogo 17x19), `roundResult` (`"Eliminated"`, `"Bomb defused"`, `"Bomb detonated"`, `"Round timer expired"`), `roundResultCode` (`"Elimination"`, `"Defuse"`, `"Detonate"`, ou **string vazia `""`** quando o tempo expira!), `roundCeremony`, `winningTeam`, `winningTeamRole` (`"Attacker"` ou `"Defender"`), `bombPlanter`, `bombDefuser`, `plantRoundTime`, `plantLocation`, `plantSite` (`"A"`, `"B"`, `"C"` ou `""`), `plantPlayerLocations`, `defuseRoundTime`, `defuseLocation`, `defusePlayerLocations`.
  - `playerStats` (por round): `puuid`, `kills`, `damage`, `score`, `economy` (`loadoutValue`, `weapon`, `armor`, `remaining`, `spent`), `ability` (os subcampos `grenadeEffects`, `ability1Effects`, etc. são sempre `null` por round; habilidades só existem agregadas na partida em `players[].stats.abilityCasts`).
- **Formato dos snapshots (`plantPlayerLocations`, `defusePlayerLocations` e `kills[].playerLocations`):** Lista contendo `puuid`, `viewRadians` (em $[0, 2\pi)$) e `location: {x, y}` de **todos os jogadores vivos de ambos os times misturados**, sem `teamId` no objeto. É obrigatório fazer join com `players` para identificar o time/lado de cada jogador vivo.
- **Referencial de `viewRadians` confirmado:** O ângulo `viewRadians` segue exatamente $\text{atan2}(\Delta y, \Delta x) \pmod{2\pi}$ no próprio sistema de coordenadas $(x, y)$ do jogo.
- **Anomalias críticas já identificadas nas amostras (tratar obrigatoriamente):**
  1. **Mortes para a Spike (`damageType == "Bomb"` e `killer == victim`):** Quando um jogador morre para a explosão da Spike, a Riot adiciona um evento em `playerStats[].kills` onde `killer == victim` e `finishingDamage.damageType == "Bomb"` (e `damage: 999`), mas **não** soma isso em `players[].stats.kills`. Se não filtrar esses eventos, a invariância de kills falha.
  2. **Contagem de partidas por time e por jogador:** Gere a distribuição completa nos 336 arquivos e liste quantos times têm $\ge 5$ e $\ge 10$ partidas, além de eventuais partidas incompletas (`isCompleted: false`).

### 5. Pipeline — parsing e tabelas

**5.1 Nome do arquivo.** Padrão: `PREFIXO_ID_DD-MM-AA_TIME1_PLACAR1_x_PLACAR2_TIME2_MAPA.json`.
- **Atenção ao ID:** Na Fase de Grupos, o ID possui letra sufixada indicando o mapa da série (ex.: `001a`, `001b`, `002a`). Portanto, o grupo do ID deve aceitar formato alfanumérico (`\d+[a-zA-Z]?`).
- **Regex recomendada:** Ancore na data (`\d{2}-\d{2}-\d{2}`) e no placar (`\d+_x_\d+`), por exemplo:
  `^(?P<prefix>[A-Z0-9_]+?)_(?P<match_num>\d+[a-zA-Z]?)_(?P<date>\d{2}-\d{2}-\d{2})_(?P<team1>.+?)_(?P<score1>\d+)_x_(?P<score2>\d+)_(?P<team2>.+?)_(?P<map>[a-z]+)\.json$`
- Teste contra todos os 336 nomes e liste os que falharem em um relatório. Normalize os times em slug (minúsculas, sem acentos).

**5.2 Qual time é Blue/Red.** Compare `score1`/`score2` do nome do arquivo com `roundsWon` de `Blue`/`Red` em `teams` para descobrir qual `teamId` inicial (`Blue` ou `Red`) corresponde a `team1` e `team2`. Caso exista alguma partida com placar empatado (`score1 == score2`), desempate cruzando os `puuid` dos jogadores com o elenco conhecido dos times nas demais partidas; se ainda ficar ambíguo, registre como anomalia.

**5.3 Tabelas** (Parquet ou DuckDB):

- `matches`: `match_id`, `file_name`, `source` (torneio/fase extraído da pasta/prefixo), `date`, `map`, `patch` (extraído de `gameVersion`), `team_a`, `team_b`, `score_a`, `score_b`, `winner`, `length_ms`, `is_overtime`.
- `rounds`: `match_id`, `round_num`, `winning_team_id`, `winning_role`, `result` (usar `roundResult`, pois `roundResultCode` vem vazio `""` quando o tempo expira), `ceremony`, `plant_site`, `plant_time_ms`, `defuse_time_ms`, `plant_x`, `plant_y`, `defuse_x`, `defuse_y`, `atk_team`, `def_team`.
- `round_players`: `match_id`, `round_num`, `puuid`, `team_id`, `team_slug`, `role` (`atk`/`def`), `loadout_value`, `spent`, `remaining`, `weapon_guid`, `armor_guid`.
- `kills`: `match_id`, `round_num`, `t_ms` (`timeSinceRoundStartMillis`), `killer`, `killer_team`, `victim`, `victim_team`, `victim_x`, `victim_y`, `damage_type`, `damage_item`, `is_self_or_bomb_kill` (booleano para `killer == victim` ou `damageType == "Bomb"`), `is_team_kill` (`killer_team == victim_team`). **Regra:** Para estatísticas de abates, First Blood/First Death e invariância de kills, filtre apenas `not is_self_or_bomb_kill and not is_team_kill`.
- `plant_snapshot`: `match_id`, `round_num`, `puuid`, `team_id`, `team_slug`, `role` (`atk`/`def`, obtido via join com `round_players`), `x`, `y`, `view_rad`.
- `defuse_snapshot`: `match_id`, `round_num`, `puuid`, `team_id`, `team_slug`, `role`, `x`, `y`, `view_rad` (a partir de `defusePlayerLocations` quando disponível).
- `players`: `match_id`, `puuid`, `team_slug`, `agent_guid`, `kills`, `deaths`, `assists`, `score`, `grenade_casts`, `ability1_casts`, `ability2_casts`, `ultimate_casts`.

**5.4 Atacante/defensor por round.** Não assuma regra fixa de troca de lado (especialmente por conta de prorrogações onde os lados trocam a cada round). Derive de `winningTeam` + `winningTeamRole` (o time vencedor tem `winningTeamRole`; o outro tem o papel oposto) e valide: quem plantou (`bombPlanter`) é atacante; quem defusou (`bombDefuser`) é defensor. Reporte inconsistências.

**5.5 Identidade.** O `team_slug` vem do nome do arquivo; o jogador vai para o time pelo `teamId` (`Blue`/`Red`) + mapeamento do §5.2. Ignore entradas de `coaches` nas métricas de jogadores. Alias anônimo = `"Jogador "` + 2–3 caracteres de `hash(puuid + sal)`.

**5.6 Dicionários.** GUID → nome de agente/arma/escudo/mapa. Construa o dicionário de mapas automaticamente cruzando `matchInfo.mapId` com o sufixo `map` do nome do arquivo, e inclua um dicionário estático local em `data/dictionaries/` para os UUIDs conhecidos de armas (Classic, Ghost, Sheriff, Spectre, Phantom, Vandal, Operator, etc.), escudos (Leve, Regenerativo, Pesado) e agentes. Se um GUID não estiver no dicionário (ex.: armas de habilidade como Headhunter/Tour de Force da Chamber ou Overdrive da Neon), mostre um rótulo curto (ex.: `"Item #856d"` ou `"Habilidade"` quando aplicável) e nunca quebre o pipeline.

### 6. Estatística comum (implemente uma vez, reuse em tudo)

- **Proporções** (taxa de vitória, % de site): estimador beta-binomial com prior empírico. Ajuste Beta(α, β) por método dos momentos usando todos os times para cada métrica; média posterior = (k + α) / (n + α + β); intervalo de credibilidade de 80% pelos quantis da Beta. Exporte k, n, α e β (o front recalcula).
- **Selo de amostra:** n < 5 “insuficiente” (não mostrar recomendação); 5 a 14 “confiança baixa”; 15 ou mais “ok”. Limiares em um único arquivo de configuração.
- **Tempos** (plant etc.): mediana e intervalo interquartil, com n; intervalo bootstrap da mediana (1.000 reamostragens, seed fixa) quando n ≥ 10.
- **Comparar duas taxas:** P(A > B) por aproximação normal das posteriores; rótulo “diferença provável” só se > 90%.
- Se houver qualquer validação de modelo, separar treino e teste por partida, nunca por round.
- Seeds fixas; resultados reprodutíveis.

### 7. Módulo A — Scouting e Veto

**7.1 Perfil do time** (filtros por mapa e por lado):

- Registro: partidas, vitórias, rounds, por mapa.
- Ataque: distribuição dos sites plantados (A/B/C); taxa de plant (% dos rounds de ataque com plant); tempo do plant (mediana e IQR) e classe “rápido/médio/tardio” por tercis da liga naquele mapa; taxa de vitória em rounds de ataque; vitória quando planta (pós-plant).
- Defesa: taxa de vitória em rounds de defesa; por site atacado, % de defesas bem-sucedidas (retakes) quando o adversário plantou ali; % de rounds em que o adversário nem conseguiu plantar.
- Pistol: vitória nos rounds 0 e 12 (ataque e defesa) e o tipo de compra no round seguinte (rounds 1 e 13) depois de ganhar ou perder o pistol.
- Composições: agentes por mapa; composição mais usada por mapa e sua taxa de vitória, com n.
- Jogadores-chave (por alias): % de rounds como primeiro a matar (First Kill) e como primeiro a morrer (First Death, excluindo mortes para bomba/auto-abate); abates e mortes por round; clutches (`roundCeremony == "CeremonyClutch"`). Sempre com n e selo.

**7.2 Cartões de insight** (6 a 8 por time), gerados por regras. Exemplos: “Prefere atacar o site B (68% dos plants; n = 22)”; “Ataque rápido: plant com mediana de 0:34”; “Depois de perder o pistol, compra eco em X% das vezes”. Cada cartão tem manchete (template), 2 a 3 números, selo de amostra e botão “Ver evidências (N rounds)”. Só emitir cartão se n ≥ 5 e (diferença provável contra a liga ou participação ≥ 1,25× o esperado numa distribuição uniforme). Se nenhum disparar, mostrar “Sem tendências claras com os dados atuais”.

**7.3 Veto Advisor** (time A = “nós”, time B = “adversário”, mapas selecionáveis):

- Para cada time T, mapa m e lado s (ataque/defesa): taxa de vitória de rounds com prior hierárquico. `prior_mean(T, m, s) = taxa_liga(m, s) + (taxa_T(s) − taxa_liga(s))`, limitada a `[0,05; 0,95]`; força do prior κ = 12 rounds; `posterior = (k + κ · prior_mean) / (n + κ)`.
- Expectativa de A ao atacar = `média(a_A,m ; 1 − d_B,m)`. Ao defender = `média(d_A,m ; 1 − a_B,m)`. Vantagem do mapa = `média dos dois lados − 0,5` (em pontos percentuais de rounds). Intervalo de 80% por propagação de variância (aproximação normal), sem Monte Carlo no navegador.
- Saída: tabela de mapas com vantagem, intervalo, n efetivo e um chip: “Escolher” (vantagem > 0 e intervalo não cruza 0), “Banir” (vantagem < 0 e intervalo não cruza 0), “Neutro” ou “Dados insuficientes”. Deixe explícito na tela que é uma heurística explicável, não uma previsão de resultado.

### 8. Módulo B — Playbook de pós-plant

Para cada plant (round com `plantSite != ""`), use `plantPlayerLocations` (fazendo join com `players` e o papel do time no round para separar Atacantes e Defensores vivos no instante do plant).

- **Centro do site.** Sem coordenadas oficiais, estime por k-means (k = nº de sites do mapa, ou agrupando diretamente pela média/mediana das `plantLocation` rotuladas por `plantSite` A/B/C naquele mapa) sobre toda a liga.
- **Features dos atacantes vivos:** distância média ao ponto do plant; dispersão (desvio-padrão das distâncias); nº de atacantes “no site” (distância < R, com R = mediana das distâncias dos atacantes da liga naquele mapa/site); alinhamento da mira (fração de atacantes vivos cuja diferença angular circular entre `viewRadians` e $\text{atan2}(y_{\text{plant}} - y_i, x_{\text{plant}} - x_i) \pmod{2\pi}$ está dentro de ±60°, ou seja, $\le \pi/3$ rad).
- **Arquétipos por regras explicáveis**, não clusters opacos: “Compacto no spike” (distância média no tercil baixo da liga), “Aberto” (dispersão no tercil alto), “Fora do site / lurk” (pelo menos 1 atacante vivo a mais de 2R do plant; *dica:* ignore jogadores estacionários no spawn desde o início do round com `spent == 0`, pois são AFKs). Um plant pode ter mais de um rótulo.
- **Defesa no instante do plant:** nº de defensores vivos e distância média ao plant, comparada à mediana da liga → “defesa chega perto / longe no site X”.
- **Resultado:** vitória do ataque (`winningTeamRole == "Attacker"`). Compare arquétipos DENTRO de estratos de vantagem numérica (`atacantes vivos − defensores vivos`: `≤ −1`, `0`, `≥ +1`) para não confundir formação com número de jogadores. Mostre taxa, intervalo e n; marque “exploratório”. Se nenhuma diferença for provável (> 90%), diga isso.
- **Visual (SVG):** fundo = esquema abstrato do site (círculo de raio R no centro) quando não houver arte de mapa; pontos coloridos por lado (ATK vermelho, DEF ciano) com seta curta de mira; filtros por time, mapa, site e resultado; contador “N plants”. Se `data/dictionaries/maps.json` existir com as constantes de conversão, desenhar sobre a imagem do mapa: `x_pixel = y_jogo · xMultiplier + xScalarToAdd` e `y_pixel = x_jogo · yMultiplier + yScalarToAdd` (eixos trocados); valide visualmente que os plants caem sobre os sites.
- **Resumo por time/site:** arquétipo mais usado, taxa de vitória no pós-plant e mediana do tempo do plant.

### 9. Módulo C — Auditoria de economia

**9.1 Tipo de compra** por round e time: média de `loadoutValue` dos 5 jogadores. Rounds 0 e 12 = “pistol” (atenção: rounds de prorrogação `roundNum >= 24` NÃO são pistol, são “full”). Demais rounds regulamentares (1–11 e 13–23): “eco”, “force” (compra parcial) e “full” (compra completa). Ponto de partida validado nas amostras: `eco < 1.600`; `force` de `1.600` a `3.500`; `full ≥ 3.500`. Valide pelo histograma dos 336 jogos, ajuste se necessário e deixe os limiares em arquivo de configuração.

**9.2 Tabela da liga:** taxa de vitória por (`tipo próprio × tipo do adversário × lado`), com shrinkage e n.

**9.3 Perfil do time:** % de force quando perde por 3 ou mais rounds; % de eco após perder o pistol (rounds 1 e 13); taxa de vitória com full contra eco adversário (conversão de anti-eco); “anti-ecos perdidos” (com link para evidências, como os rounds de cerimônia `CeremonyThrifty`); média de créditos remanescentes (`remaining`) em rounds de compra completa.

**9.4 Retorno em 2 rounds.** Para cada decisão (eco/force/full) em situações comparáveis (faixa de diferença de placar, sequência de derrotas 0/1/2/3+, lado), calcule na liga a média de rounds vencidos em `t` e `t+1`. **Regra importante:** restrinja os pares `(t, t+1)` a rounds dentro da mesma metade regulamentar (`0 <= t <= 10` no 1º tempo e `12 <= t <= 22` no 2º tempo), nunca cruzando o intervalo (`11 -> 12`) nem a prorrogação (`>= 23`). Use isso para listar “rounds para revisar” de um time: decisões cujo retorno histórico ficou claramente abaixo da alternativa mais comum e em que o time perdeu. Tom construtivo (“vale revisar”, nunca “erro”) e sempre com n.

**9.5 Linha do tempo de uma partida:** barras de `loadoutValue` médio dos dois times por round, marcador do vencedor, tipo de compra rotulado, quebras no pistol (rounds 0 e 12) e início da prorrogação (round 24+).

### 10. Front-end

**10.1 Tokens (Tailwind v4, em src/index.css com @theme).** Cores: bg #0F1923; surface #1A242E; surface-strong #212D39; brand #FF4655; brand-deep #D62836; brand-active #A81E29; brand-tint rgba(255,70,85,0.15); bone #ECE8E1 (texto); muted #9AA6B1; faint #6C7780 (só decorativo); border rgba(236,232,225,0.15); border-strong rgba(236,232,225,0.30). Semânticas próprias: ATK = brand; DEF = #3DD6C6; positivo #22C55E; alerta #F5A524.

- **Forma:** raio de borda 0. Botão primário: fundo brand, texto #0F1923, padding 14px 32px, skew(-6deg) com o conteúdo des-inclinado; hover brand-deep; pressionado brand-active; foco com anel de 2px em bone. Cards: fundo surface, borda de 1px, canto superior esquerdo com corte (clip-path) opcional. Seções separadas por linha fina com rótulo pequeno em caixa alta (11px, espaçamento aberto).
- **Tipografia:** display Bebas Neue (fallback Oswald, Impact, sans-serif) em caixa alta: h1 56–72px, h2 40px, h3 28px, h4 22px. Corpo Barlow 16px (14px em tabelas), números tabulares. Auto-hospedar via @fontsource.
- **Movimento:** entradas de 150–250 ms com ease-out; respeitar prefers-reduced-motion; nenhuma animação em loop.
- **Layout:** container máx. 1280px, grade de 12 colunas, desktop-first (otimizar para 1920×1080, que é como o vídeo será gravado), legível em 1280 e usável em tablet. Apenas tema escuro na tela; impressão em tema claro.

**10.2 Componentes.** AppShell (cabeçalho com nome do projeto e navegação: Dossiê, Veto, Pós-plant, Economia, Método); TeamSelect (combobox com busca e nº de partidas); StatCard (valor grande + barra de intervalo + SampleBadge); SampleBadge (insuficiente / confiança baixa / ok, sempre com ícone + texto + cor); InsightCard; EvidenceDrawer (painel lateral com tabela de match/round e mini linha do tempo); SideToggle (ATK / DEF / ambos); MapPicker (múltipla seleção); IntervalBar (mediana + intervalo); FormationMap (SVG); EconTimeline (Recharts); PlantTimeHistogram; VetoTable (TanStack Table); EmptyState; Skeleton; Footer com aviso.

**10.3 Páginas (rotas).**

1. **/ (Início):** título em caixa alta (“Prepare-se para o próximo adversário”), TeamSelect, 3 cards explicando os módulos, números do dataset (partidas, rounds, times) e botão “Gerar dossiê”.
2. **/time/:slug (Dossiê):** cabeçalho (nome, registro, torneios; filtros de mapa e lado na URL) e abas: Resumo (cartões de insight), Ataque, Defesa, Economia, Jogadores, Mapas.
3. **/veto?a=&b=&mapas=:** seleção de A e B, VetoTable, legenda curta de como ler.
4. **/posplant?time=&mapa=&site=:** FormationMap + painel de arquétipos (taxa, intervalo, n, estrato) + lista de plants.
5. **/economia?time=:** perfil + “rounds para revisar” + EconTimeline de uma partida selecionável.
6. **/metodo:** metodologia em linguagem simples (o que é shrinkage, intervalo, selo de amostra), fórmulas, limites do dataset, privacidade, conformidade com as regras do hackathon, créditos e aviso legal.
7. **Impressão:** botão “Imprimir dossiê” gera 1 página A4 paisagem do time (resumo + 4 insights + mini veto), via CSS de impressão.

**10.4 Microcopy (PT-BR, direto, sem jargão).** “Amostra pequena”, “confiança baixa”, “vale revisar”. Nunca “erro”, “pior jogador” ou “culpa”. Números no formato pt-BR (vírgula decimal) com Intl.NumberFormat; tempo em mm:ss.

**10.5 Acessibilidade e desempenho.** Contraste mínimo 4,5:1 para texto (cuidado com faint e com branco sobre vermelho; texto pequeno sobre brand usa #0F1923). Foco visível e navegação por teclado no Drawer e nos Selects. Cor nunca é a única informação (ATK/DEF com rótulo e forma: círculo vs. losango). Gráficos com aria-label e alternativa em tabela. Meta de Lighthouse ≥ 90 em desempenho e acessibilidade. JSON por time ≤ 1 MB comprimido, carregado sob demanda. CSS de impressão: fundo branco, texto escuro, sem animações.

**10.6 Rodapé obrigatório.** “Projeto acadêmico independente criado para o Hackathon USP São Carlos. Não é afiliado nem endossado pela Riot Games. VALORANT e Riot Games são marcas de Riot Games, Inc.” + link para /metodo. Se usar qualquer asset da Riot, acrescentar o aviso oficial copiado de riotgames.com/legal.

### 11. Testes e qualidade

- **Python (pytest):**
  - Parser: todos os 336 nomes parseados com sucesso (incluindo IDs com sufixo de letra como `001a` na Fase de Grupos) ou listados.
  - Invariâncias por partida: `len(roundResults) == roundsPlayed`; soma de kills válidas nos rounds (excluindo `killer == victim`, `damageType == "Bomb"` e teamkills) == soma de `players[].stats.kills`; quem planta (`bombPlanter`) pertence ao time atacante no round; quem defusa (`bombDefuser`) pertence ao time defensor; `plantSite` em `{"A", "B", "C", ""}`; tipos de compra cobrem 100% dos rounds.
  - Estatística: shrinkage dentro de `[0,1]` e monótono em `k`; seeds reproduzem.
  - Arquivos “golden” de 3 times para detectar regressões.
- **Front:** tsc sem erros, ESLint, Vitest nos formatadores e no cálculo do Veto, axe sem violações críticas, teste manual em Chrome e Firefox, screenshot de cada página.
- **Dados fictícios são proibidos:** toda tela usa a saída real do pipeline; se faltar dado, mostrar EmptyState.

### 12. Marcos e critérios de aceite

| Marco | Quando | Critério de aceite |
| --- | --- | --- |
| M0 | ter 20/10, noite | schema_audit.md pronto; 336 arquivos parseados sem falha na Fase de Grupos; tabelas carregam no DuckDB com filtro de bomba/auto-abate |
| M1 | qua 21/10, manhã | estatística comum + Módulo A no pipeline; teams/{slug}.json para pelo menos 3 times, com k, n e evidências; testes verdes |
| M2 | qua 21/10, noite | Módulos B e C no pipeline; arquétipos (com join de lado no plant) e tabela de economia gerados; limiares documentados |
| M3 | qui 22/10, manhã | esqueleto do front + tokens + Início + Dossiê (Resumo/Ataque/Defesa); navegar do Início ao dossiê de um time real |
| M4 | qui 22/10, tarde | Veto, Pós-plant, Economia, Método, Drawer de evidências e impressão, todos com dados reais e estados vazios |
| M5 | qui 22/10, noite | polimento, acessibilidade, desempenho, deploy estático, README e cenário de demo (um time real e um adversário real) |
| M6 | sex 23/10 | congelar o código às 12h (só correções críticas); gravar o vídeo; enviar até 18h |

### 13. Proibições

Dados externos, scraping ou APIs de terceiros; logos/marcas da Riot; fontes Tungsten/DIN; PUUID ou nick real na interface pública; números sem n; linguagem causal (“causa”, “garante”); LLM gerando números; mock ou placeholder com dados inventados; depender de API externa para GUID → nome; ampliar o escopo além dos três módulos antes do M5.

### 14. Como trabalhar

- Comece pela Fase 0 e só depois escreva um plano curto (até 20 linhas) em docs/DECISIONS.md.
- Commits pequenos e descritivos; rode os testes antes de cada marco.
- Ao fim de cada marco, liste: o que foi feito, o que ficou de fora, riscos novos e 3 achados reais que sirvam de exemplo no vídeo.
- Ao ajustar um limiar ou regra, registre o valor antigo, o novo e o motivo.
- Prefira o simples e explicável ao sofisticado e opaco.