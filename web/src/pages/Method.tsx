import type { ReactNode } from 'react'
import { useIndex, useLeague } from '../lib/data'
import { credits, date, num, pct } from '../lib/format'
import { DISCLAIMER } from '../components/Footer'
import { Skeleton } from '../components/Skeleton'
import { SampleBadge } from '../components/SampleBadge'

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="card p-6">
      <h2 className="mb-3 text-[28px]">{title}</h2>
      <div className="flex flex-col gap-3 text-muted leading-relaxed [&_strong]:text-bone [&_code]:text-bone">{children}</div>
    </section>
  )
}

function Formula({ children }: { children: ReactNode }) {
  return <div className="bg-bg border border-border px-4 py-3 font-mono text-[14px] text-bone overflow-x-auto">{children}</div>
}

export default function Method() {
  const idx = useIndex()
  const league = useLeague()
  if (!idx.data || !league.data) return <Skeleton lines={6} />
  const P = league.data.params
  const d = idx.data.dataset
  return (
    <div>
      <header className="pb-6 border-b border-border mb-8">
        <div className="eyebrow">Transparência</div>
        <h1 className="mt-2">Método</h1>
        <p className="mt-3 max-w-3xl text-muted">Como cada número é calculado, o que ele não diz e como os dados foram tratados. Gerado em {date(league.data.generated_at.slice(0, 10))}.</p>
      </header>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Block title="De onde vêm os dados">
          <p>
            Exclusivamente dos <strong>{num(d.matches)} arquivos JSON</strong> fornecidos pela organização ({date(d.first_date)} a {date(d.last_date)}):
            {' '}{num(d.rounds)} rounds, {num(d.teams)} times, {num(d.players)} jogadores. Nenhum scraping, nenhuma API externa, nenhum dado em tempo real.
            O site é estático e só lê arquivos gerados pelo pipeline em Python.
          </p>
          <p>
            Uso exclusivo para análise pós-partida e preparação pré-jogo. Sem integração com o cliente do jogo nem com a API da Riot.
          </p>
        </Block>
        <Block title="Selo de amostra">
          <p>Todo número vem com o tamanho da amostra (n) e um selo:</p>
          <ul className="flex flex-col gap-2">
            <li className="flex items-center gap-3"><SampleBadge badge="insufficient" /> n &lt; {P.sample.insufficient_below}: mostramos o número, mas nunca uma recomendação.</li>
            <li className="flex items-center gap-3"><SampleBadge badge="low" /> {P.sample.insufficient_below} ≤ n &lt; {P.sample.ok_from}: leia como indício.</li>
            <li className="flex items-center gap-3"><SampleBadge badge="ok" /> n ≥ {P.sample.ok_from}.</li>
          </ul>
        </Block>
        <Block title="Shrinkage (puxar para a média)">
          <p>
            Com 3 de 4 rounds vencidos, a taxa observada é 75%, mas ninguém acredita que o time vença 75% dos rounds. Por isso cada proporção parte de um
            “esperado” da liga e só se afasta dele conforme a amostra cresce.
          </p>
          <Formula>estimativa = (k + α) / (n + α + β)</Formula>
          <p>
            k = sucessos, n = tentativas. α e β vêm de uma distribuição Beta ajustada pelo <strong>método dos momentos</strong> com todos os times da liga
            (só times com n ≥ {P.prior_fit.min_n_per_unit}), separando a variação real entre times do ruído de amostras pequenas. A força α + β fica entre {P.prior_fit.min_strength} e {P.prior_fit.max_strength}.
          </p>
        </Block>
        <Block title="Intervalo de 80%">
          <p>
            A barra horizontal mostra o intervalo de credibilidade de {pct(P.cred_level)}: a faixa em que a taxa “verdadeira” está com 80% de probabilidade, dados o prior e os rounds
            observados (quantis da Beta posterior). O traço tracejado é a média da liga.
          </p>
          <p>
            Tempos (ex.: plant) usam mediana e intervalo interquartil; com n ≥ {P.bootstrap.min_n}, a mediana ganha um intervalo bootstrap ({num(P.bootstrap.resamples)} reamostragens, semente fixa {P.bootstrap.seed}).
          </p>
        </Block>
        <Block title="Comparações e cartões de insight">
          <Formula>P(A &gt; B) ≈ Φ((média_A − média_B) / √(var_A + var_B))</Formula>
          <p>
            “Diferença provável” só quando P &gt; {pct(P.prob_threshold)} (ou &lt; {pct(1 - P.prob_threshold)}). Os cartões vêm de regras fixas com textos-modelo preenchidos pelos números
            calculados — <strong>nenhum modelo de linguagem gera números ou frases</strong>. Um cartão só aparece com n ≥ {P.insight.min_n} e diferença provável contra a liga,
            ou participação ≥ {num(P.insight.share_ratio, 2)}× o esperado numa distribuição uniforme (ex.: 3 BOMBs → 33%).
          </p>
          <p>Nada aqui afirma causa: “prefere”, “costuma” e “sugestão” descrevem padrões nos dados.</p>
        </Block>
        <Block title="Veto">
          <Formula>prior(T, m, s) = taxa_liga(m, s) + (taxa_T(s) − taxa_liga(s)), limitado a [{num(P.veto.clamp[0], 2)}; {num(P.veto.clamp[1], 2)}]</Formula>
          <Formula>taxa(T, m, s) = (k + κ · prior) / (n + κ), κ = {P.veto.kappa} rounds</Formula>
          <p>
            A atacando = média(ataque de A; 1 − defesa de B). Vantagem = média dos dois lados − 50%. Intervalo de 80% por propagação de variância (aproximação normal).
            “Escolher”/“Banir” só quando o intervalo não cruza o zero. É uma heurística explicável, não uma previsão.
          </p>
        </Block>
        <Block title="Pós-plant">
          <p>
            No instante do plant, o JSON traz a posição e a mira de todos os vivos, sem dizer o time; fazemos o join com a lista de jogadores e com o lado do round.
            O centro de cada BOMB é a mediana das posições de plant da liga. R = distância mediana dos atacantes vivos ao spike, por mapa e BOMB.
          </p>
          <ul className="list-disc pl-5 flex flex-col gap-1">
            <li><strong>Compacto no spike</strong>: distância média dos atacantes no terço mais baixo da liga.</li>
            <li><strong>Aberto</strong>: dispersão das distâncias no terço mais alto (2+ atacantes).</li>
            <li><strong>Fora do BOMB / lurk</strong>: 1+ atacante a mais de {num(P.postplant.lurk_factor)}R, ignorando quem não gastou créditos nem causou dano no round (provável AFK).</li>
            <li><strong>Mira alinhada</strong>: fração dos atacantes (a mais de {num(P.postplant.aim_min_dist)} unidades do spike) olhando a ±{P.postplant.aim_tolerance_deg}° da direção do spike.</li>
          </ul>
          <p>As comparações são feitas dentro de estratos de vantagem numérica (≤ −1, 0, ≥ +1) e marcadas como exploratórias.</p>
        </Block>
        <Block title="Economia">
          <p>
            Compra = média do valor de equipamento dos 5 jogadores no round: eco &lt; {credits(P.buy.eco_max)}, force até {credits(P.buy.full_min - 1)}, full ≥ {credits(P.buy.full_min)}
            (validado no histograma das {num(d.matches)} partidas). Rounds 1 e 13 são pistol; prorrogação conta como full.
          </p>
          <p>
            Retorno em 2 rounds: média de rounds vencidos em t e t+1, sempre dentro da mesma metade (nunca cruzando o intervalo nem a prorrogação), por faixa de placar,
            sequência de derrotas e lado. “Rounds para revisar” é um convite para olhar o VOD, nunca um julgamento.
          </p>
        </Block>
        <Block title="Privacidade">
          <p>
            Nenhum identificador de conta (PUUID) aparece no site. Jogadores aparecem por apelido anônimo e estável (“Jogador K7X”), derivado de um hash com sal guardado
            localmente. Nicks reais ficam apenas em um arquivo local fora do controle de versão e só entram na build com uma opção explícita, desligada por padrão.
          </p>
        </Block>
        <Block title="Limites do dataset">
          <ul className="list-disc pl-5 flex flex-col gap-1">
            <li>{idx.data.teams.filter((t) => t.matches < 5).length} dos {d.teams} times têm menos de 5 partidas; vários números ficam perto da média da liga por isso.</li>
            <li>Partidas de vários patches e fases; elencos mudam entre torneios. Variantes de nome de time são tratadas como times distintos.</li>
            <li>Sem linha do tempo de posições: só sabemos onde cada um estava no plant, no defuse e em cada abate.</li>
            <li>Habilidades só existem agregadas por partida (sem efeito por round).</li>
            <li>Mapas sem arte oficial: o fundo é a densidade de posições registradas na liga.</li>
          </ul>
        </Block>
        <Block title="Regras do hackathon, créditos e aviso legal">
          <p>Sem logos, marcas ou fontes oficiais da Riot; fontes Bebas Neue e Barlow (licença aberta, auto-hospedadas). Sem dados externos, sem dados fictícios: se falta dado, a tela diz isso.</p>
          <p>Construído com Python (pandas, DuckDB, SciPy), React, Vite, Tailwind CSS, Recharts e TanStack Table.</p>
          <p className="text-bone">{DISCLAIMER}</p>
        </Block>
      </div>
    </div>
  )
}
