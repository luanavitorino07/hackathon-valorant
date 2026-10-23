import { lazy, Suspense, useEffect } from 'react'
import { BrowserRouter, Route, Routes, useLocation } from 'react-router-dom'
import { AppShell } from './components/AppShell'
import { EvidenceProvider } from './components/EvidenceDrawer'
import { Skeleton } from './components/Skeleton'
import { Home } from './pages/Home'

const Dossier = lazy(() => import('./pages/Dossier'))
const Veto = lazy(() => import('./pages/Veto'))
const PostPlant = lazy(() => import('./pages/PostPlant'))
const Economy = lazy(() => import('./pages/Economy'))
const Method = lazy(() => import('./pages/Method'))
const NotFound = lazy(() => import('./pages/NotFound'))

const TITLES: [string, string][] = [
  ['/time/', 'Dossiê'], ['/veto', 'Veto'], ['/posplant', 'Pós-plant'], ['/economia', 'Economia'], ['/metodo', 'Método'],
]

function ScrollAndTitle() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo(0, 0)
    const t = TITLES.find(([p]) => pathname.startsWith(p))
    document.title = t ? `${t[1]} · ScoutRoom` : 'ScoutRoom · preparação para o próximo adversário'
  }, [pathname])
  return null
}

export function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, '')}>
      <EvidenceProvider>
        <ScrollAndTitle />
        <AppShell>
          <Suspense fallback={<Skeleton lines={4} />}>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/time/:slug" element={<Dossier />} />
              <Route path="/veto" element={<Veto />} />
              <Route path="/posplant" element={<PostPlant />} />
              <Route path="/economia" element={<Economy />} />
              <Route path="/metodo" element={<Method />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </AppShell>
      </EvidenceProvider>
    </BrowserRouter>
  )
}
