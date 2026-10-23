import { Link } from 'react-router-dom'

export const DISCLAIMER =
  'Projeto acadêmico independente criado para o Hackathon USP São Carlos. Não é afiliado nem endossado pela Riot Games. VALORANT e Riot Games são marcas de Riot Games, Inc.'

export function Footer() {
  return (
    <footer className="mt-16 border-t border-border no-print">
      <div className="mx-auto max-w-[1280px] px-6 py-6 flex flex-wrap items-center justify-between gap-3 text-[13px] text-muted">
        <p className="max-w-3xl">{DISCLAIMER}</p>
        <Link to="/metodo" className="underline underline-offset-4 hover:text-bone">Método, privacidade e limites</Link>
      </div>
    </footer>
  )
}
