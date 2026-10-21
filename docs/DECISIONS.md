# Decisões e plano

## Plano curto (escrito após a Fase 0)

1. Pipeline Python (`pipeline/`): `parse` → tabelas Parquet + DuckDB → `stats` comum → módulos A, B, C → JSON em `web/public/data/`.
2. Um único comando `scoutroom all` roda auditoria, tabelas, métricas e exportação; seeds fixas.
3. Estatística comum em `stats.py` (beta-binomial com prior empírico, selo, medianas com bootstrap, P(A>B)).
4. Módulo A: perfil por fatia (todos os mapas + cada mapa), cartões de insight por regras, dados do Veto (k, n por mapa/lado).
5. Módulo B: centros de site pela mediana das `plantLocation`, features dos atacantes vivos, arquétipos por regra, estratos por vantagem numérica.
6. Módulo C: tipo de compra, tabela da liga, perfil do time, retorno em 2 rounds, linha do tempo por partida.
7. Front Vite + React + TS + Tailwind v4: só lê `public/data`; Veto calculado no navegador.
8. Testes: pytest (parser, invariâncias, estatística, golden de 3 times) e Vitest (formatadores, Veto, beta).
9. Ordem: M0 → M1 → M2 (pipeline completo) → M3/M4 (front) → M5 (polimento, README, demo).

## Decisões registradas

| # | Tema | Decisão | Motivo |
| --- | --- | --- | --- |
| D1 | Pasta de dados | `data/raw` é um link simbólico para `dados/` (pasta entregue). Ambos git-ignorados. | Não mover/duplicar 194 MB de dados da organização. |
| D2 | Observadores | Entradas de `players` com `teamId == "Neutral"` (22 arquivos, `isObserver: true`, `stats: null`) são descartadas. | Não são jogadores; quebrariam somas e o join de times. |
| D3 | Kills válidas | `not is_self_or_bomb_kill and not is_team_kill`. Auto-abates incluem quedas (`Fall`) com `killer == victim`. | Única combinação com invariância em 336/336 partidas. |
| D4 | Nomes de time | Slug do nome do arquivo, sem fundir variantes (ex.: `ceub_octopus` ≠ `ceub_octopus_vulgaris`). Nome de exibição = slug em "Title Case" com siglas em maiúsculas. | Padrão mais simples; fundir exigiria julgamento sobre elencos. |
| D5 | Tempo do plant | `plantRoundTime` é contado a partir do início da fase de ação (máx. ≈ 106 s). Exibido em m:ss. | Máximo observado coerente com timer de 100 s + plant final. |
| D6 | Limiares de compra | Mantidos eco < 1.600, force 1.600–3.499, full ≥ 3.500. Histograma: mínimo local em 1.000–1.249, platô de compras parciais 1.250–3.499 e modo de full em 4.500. Mover o corte de eco para 1.250 mudaria só ~3% dos rounds. | Ponto de partida do enunciado é consistente com o histograma. |
| D7 | Prorrogação | Rounds ≥ 24 são "full" (todos recebem créditos fixos); não entram no retorno em 2 rounds. | Enunciado §9.1/§9.4. |
| D8 | Prior empírico | Método dos momentos sobre unidades com n ≥ 5; variância entre unidades = var. observada − ruído binomial médio; força α+β limitada a [2, 200]; se a variância entre unidades ≤ 0, força = 200. | Simples, explicável e estável com poucos times. |
| D9 | Tabela de economia da liga | Taxas da liga usam Beta(k+1, n−k+1) (amostra grande, shrinkage desprezível); células por time usam o prior empírico da mesma célula. | Shrinkage só faz diferença onde n é pequeno. |
| D10 | Clutch | `roundCeremony == "CeremonyClutch"` é atribuído ao único jogador vivo do time vencedor no fim do round; se houver mais de um vivo, ao de mais abates no round. | O JSON não diz quem fez o clutch. |
| D11 | AFK no pós-plant | Para o rótulo "lurk", ignora atacante vivo com `spent == 0`, 0 de dano e 0 abates no round. | Sem linha do tempo de posições não dá para saber se ficou no spawn. |
| D12 | Fundo do mapa | Sem arte da Riot: o fundo do FormationMap é um mapa de densidade calculado com as próprias posições da liga (mortes + snapshots), com eixos trocados como no minimapa (`x_svg = y_jogo`, `y_svg = −x_jogo`). `maps.json` só traz mapId → nome. | Regra de marcas/assets e §8. |
| D13 | Armas de habilidade | GUIDs `856D…`, `95336AE4…`, `39099FB5…` aparecem como "Habilidade"; desconhecidos como "Item #xxxx". | Evitar nome errado sem consultar API. |
| D14 | Alias de jogador | `"Jogador " + 3 caracteres` (alfabeto de 32 símbolos sem ambíguos) de `sha256(sal + puuid)`; colisão resolvida rehashando com contador. Sal em `data/private/salt.txt` (gerado na 1ª execução, git-ignorado). | Estável entre execuções, sem PUUID na saída. |
| D15 | Nicks reais | Só com `scoutroom all --real-names` (desligado por padrão): grava `data/private/aliases.csv` sempre, e só com a flag inclui nicks nos JSON. | Regra de privacidade §1.3. |
