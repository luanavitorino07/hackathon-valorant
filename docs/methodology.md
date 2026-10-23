# Metodologia

Resumo técnico do que o pipeline calcula. A versão em linguagem simples está na página **/metodo** do site. Todos os limiares ficam em `pipeline/src/scoutroom/config.py` e são exportados em `league.json → params`.

## 1. Dados e identidade

- Leitura recursiva de `data/raw/**/*.json` (336 arquivos). Nome do arquivo → prefixo, ID (`\d+[a-zA-Z]?`), data, times, placar e mapa.
- `teamId` Blue/Red → time: placar do nome do arquivo comparado com `teams[].roundsWon` (sem empates no dataset; desempate por elenco implementado).
- Lado por round: `winningTeam` + `winningTeamRole`; o outro time tem o papel oposto. Validado: todo plantador é atacante e todo defusador é defensor (0 inconsistências).
- Observadores (`teamId: "Neutral"`) e `coaches` ficam fora das métricas.
- Kills válidas: `not is_self_or_bomb_kill and not is_team_kill` (invariância com `players[].stats.kills` em 336/336 partidas).

## 2. Estatística comum (`stats.py`)

| Peça | Definição |
| --- | --- |
| Proporção | Beta-binomial com prior empírico: média posterior (k + α)/(n + α + β); intervalo de 80% pelos quantis 10% e 90% da Beta(k + α, n − k + β). |
| Prior | Método dos momentos sobre as unidades (times ou jogadores) com n ≥ 5: m = Σk/Σn; var. entre unidades = var(k/n) − média(m(1−m)/n); α + β = m(1−m)/var_entre − 1, limitado a [2, 200]. Um prior por métrica (e por mapa). |
| Selo | n < 5 insuficiente (sem recomendação); 5–14 confiança baixa; ≥ 15 ok. |
| Tempos | Mediana e IQR; com n ≥ 10, IC 80% da mediana por bootstrap (1.000 reamostragens, seed 20261023). |
| Duas taxas | P(A > B) = Φ((μA − μB)/√(σ²A + σ²B)) com as variâncias das posteriores Beta; "diferença provável" se P > 0,9 ou < 0,1. Liga: Beta(K + 1, N − K + 1). |

Não há modelo treinado; portanto não há separação treino/teste (se houver no futuro, separar por partida).

## 3. Módulo A — Scouting e Veto

- Fatias: todos os mapas + cada mapa. Métricas: vitória no ataque/defesa, taxa de plant, vitória pós-plant, % de sites (por mapa), retake por site, % de rounds de defesa sem plant adversário, pistols (R1/R13, por lado), compra no round seguinte ao pistol (R2/R14) após vencer/perder.
- Ritmo do plant: percentil de cada plant na distribuição da liga do mesmo mapa; classe pela mediana dos percentis (< 1/3 rápido, > 2/3 tardio).
- Jogadores: FK = matador do primeiro abate válido do round; FD = vítima dele; prior ajustado entre jogadores. Clutch atribuído ao único vivo do time vencedor (D10).
- Cartões: candidatos por regra; emitidos só com n ≥ 5 e (P vs. liga > 0,9 ou participação ≥ 1,25× uniforme). Ordenação: selo ok antes de baixo, depois força da evidência; no máx. 2 por tipo e 8 no total.
- Veto (no navegador, `web/src/lib/veto.ts`): `prior = taxa_liga(m,s) + (taxa_T(s) − taxa_liga(s))` limitado a [0,05; 0,95]; `post = (k + 12·prior)/(n + 12)`; var ≈ post(1−post)/(n + 13). Vantagem = média(E_atk, E_def) − 0,5, intervalo 80% por propagação de variância. "Média da liga" como adversário usa as taxas da liga sem variância.

## 4. Módulo B — Pós-plant

- Snapshot `plantPlayerLocations` (todos os vivos, sem time) + join com o time de cada puuid + lado do round.
- Centro do site = mediana das `plantLocation` da liga por mapa/site. R = mediana das distâncias atacante→spike (mapa/site).
- Features: distância média, desvio-padrão das distâncias, nº no site (< R), alinhamento de mira (±60° da direção do spike; só atacantes a ≥ 150 u), defensores vivos e distância média.
- Rótulos: compacto (dist. média ≤ tercil 1/3 da liga), aberto (dispersão ≥ tercil 2/3, 2+ atacantes), lurk (1+ atacante > 2R, sem AFK provável).
- Resultado: vitória do ataque, comparando com/sem rótulo dentro de estratos de vantagem (≤ −1, 0, ≥ +1), prior uniforme, marcado como exploratório.

## 5. Módulo C — Economia

- Compra por time e round = média de `loadoutValue` dos 5: eco < 1.600, force 1.600–3.499, full ≥ 3.500; R1/R13 pistol; prorrogação full (histograma no `schema_audit.md`).
- Liga: vitória por compra própria × compra adversária × lado.
- Time: force estando 3+ atrás, eco após perder o pistol, conversão de anti-eco (full × eco), anti-ecos perdidos (com cerimônia Thrifty), créditos restantes em full.
- Retorno em 2 rounds: para t em 1–10 e 13–22 (nunca cruzando o intervalo nem a prorrogação), média de vitórias em t e t+1 por (decisão, faixa de placar, sequência de derrotas 0/1/2/3+, lado). "Rounds para revisar": o time perdeu t; a alternativa mais comum no contexto tem P(retorno maior) > 0,9, diferença ≥ 0,2 round, n ≥ 15 nos dois; e o "banco" do time (loadout + restante) permitia a alternativa.

## 6. Achados para o vídeo (dados reais, exploratórios)

1. **Liga**: o ataque vence 51,8% dos rounds e 71% dos rounds com spike plantada; com 1+ atacante a mais no plant, 91% (n = 2.477).
2. **Formação**: plants "compactos no spike" convertem menos que os demais em todos os estratos (em desvantagem: 20% × 37%; números iguais: 55% × 65%; vantagem: 89% × 92%), diferença provável (P > 96%) — associação, não causa.
3. **UFMT Turuna**: planta em 81% dos rounds de ataque (liga 70%, n = 326) e vence 61% deles (liga 52%); contra Azure Bears Golden, o Veto sugere banir Ascent, Haven, Lotus e Abyss.
4. **Economia**: eco contra full vence 12% no ataque e 15% na defesa; force contra full, 29% e 26% (n = 769 e 941).
