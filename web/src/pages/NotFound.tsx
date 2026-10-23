import { Link } from 'react-router-dom'
import { EmptyState } from '../components/EmptyState'

export default function NotFound() {
  return (
    <EmptyState title="Página não encontrada">
      <Link to="/" className="underline">Voltar ao início</Link>
    </EmptyState>
  )
}
