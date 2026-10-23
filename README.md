# ScoutRoom

Relatório de preparação pré-jogo para técnicos e jogadores do circuito universitário brasileiro de VALORANT, construído **somente** com os 336 JSON de partidas fornecidos pela organização.

Escolha um time e receba:

- **A. Dossiê + Veto**: como o time ataca e defende, pistols, composições, jogadores-chave (por apelido anônimo), 6–8 cartões de insight gerados por regras e um conselheiro de veto mapa a mapa.
- **B. Pós-plant**: posições de todos os vivos no instante do plant, formações (compacta, aberta, lurk) e conversão por estrato de vantagem numérica.
- **C. Economia**: tipo de compra, anti-ecos, force estando atrás, retorno histórico em 2 rounds e "rounds para revisar".

Todo número mostra **n**, **selo de confiança** e as **evidências** (rounds que o sustentam).

## Como rodar (3 comandos)

Pré-requisitos: Python ≥ 3.11 (ou [uv](https://docs.astral.sh/uv/)), Node ≥ 20. Coloque os JSON em `dados/` (ou `data/raw/`; `data/raw` é um link para `dados/`).

```bash
make setup   # cria pipeline/.venv e instala dependências do pipeline e do site
make data    # auditoria + tabelas (Parquet/DuckDB) + métricas -> web/public/data
make dev     # abre o site em http://localhost:5173
```

Sem `make`:

```bash
cd pipeline && python3 -m venv .venv && .venv/bin/pip install -e '.[dev]' && cd ../web && npm install && cd ..
pipeline/.venv/bin/python -m scoutroom all
cd web && npm run dev
```

Outros alvos: `make test` (pytest + tsc + ESLint + Vitest), `make build` (site estático em `web/dist`, com `404.html` para hospedagem estática), `make check` (screenshots 1920×1080 + axe, com o `make dev` rodando).

## Estrutura

```
data/raw/            JSON originais (git-ignorado; link para dados/)
data/dictionaries/   agents.json, weapons.json (estáticos) e maps.json (gerado)
data/private/        salt.txt e aliases.csv (git-ignorado; nicks reais só aqui)
data/tables/         Parquet gerados; data/scoutroom.duckdb (view valid_kills)
pipeline/            Python: parse -> tabelas -> estatística -> módulos A/B/C -> export
web/                 Vite + React + TypeScript + Tailwind v4 (só lê web/public/data)
docs/                schema_audit.md, methodology.md, DECISIONS.md, screenshots/
```

Arquivos gerados em `web/public/data/`: `index.json` (times, dataset, pool atual), `league.json` (taxas da liga por mapa/lado, tabela de economia, retornos, priors, parâmetros), `teams/{slug}.json` (perfil, playbook e economia com k e n), `evidence/{slug}.json` (match + round por métrica, até 60), `maps/{mapa}.json` (densidade de posições e centros de BOMB). O Veto é calculado no navegador.

## Regras respeitadas

- Dados exclusivamente dos JSON da organização; nada de scraping, APIs ou dados de terceiros. Sem tempo real.
- Nenhum PUUID ou nick real no site (apelidos `Jogador XYZ` por hash com sal). `scoutroom all --real-names` inclui nicks para uso interno — **não publique essa build**.
- Sem logos, arte ou fontes da Riot (Bebas Neue + Barlow auto-hospedadas). Mapas desenhados a partir da densidade de posições da própria liga.
- Sem números sem n; sem linguagem causal; sem LLM gerando números — textos vêm de templates determinísticos.

## Cenário de demo

Time **UFMT Turuna** (36 partidas) × adversário **Azure Bears Golden** (32 partidas):

1. Início → escolher UFMT Turuna → "Gerar dossiê": cartões como "Planta a spike com frequência" (81% vs. 70% da liga, n = 326) e "Vence mais rounds de ataque que a média da liga" (61% vs. 52%).
2. Ver evidências de um cartão → painel lateral com os rounds e a linha do tempo da partida.
3. Veto → B = Azure Bears Golden: Ascent, Haven, Lotus e Abyss aparecem como "Banir" (intervalo de 80% abaixo de zero); Sunset fica "Dados insuficientes" (B não tem rounds lá).
4. Pós-plant → Ascent, BOMB A: formações no instante do plant e a tabela da liga por estrato.
5. Economia → rounds para revisar e linha do tempo de uma partida.
6. "Imprimir dossiê" → 1 página A4 paisagem.

## Testes e qualidade

- `pytest`: parser dos 336 nomes (incluindo `001a`), invariâncias por partida (rounds, kills válidas, plantador/defusador, BOMBs, tipos de compra), estatística (shrinkage em [0,1], monótono em k, seeds), golden de 3 times, ausência de PUUID na saída.
- `vitest`: formatadores pt-BR, Beta no navegador (contra valores do SciPy) e cálculo do Veto.
- `tsc` sem erros, ESLint limpo, axe sem violações críticas, Lighthouse desktop 99–100 em desempenho/acessibilidade/boas práticas, verificado em Chrome e Firefox (screenshots em `docs/screenshots/`).

---

Projeto acadêmico independente criado para o Hackathon USP São Carlos. Não é afiliado nem endossado pela Riot Games. VALORANT e Riot Games são marcas de Riot Games, Inc.
