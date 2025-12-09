// Configuração da URL do Socket.io
// Em desenvolvimento: localhost:3001
// Em produção: usa a mesma origem ou variável de ambiente
export const getSocketUrl = () => {
  // Se estiver em produção e tiver variável de ambiente, usa ela
  if (import.meta.env.VITE_SOCKET_URL) {
    return import.meta.env.VITE_SOCKET_URL
  }
  
  // Se estiver em produção (sem localhost), usa a mesma origem
  if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
    return window.location.origin
  }
  
  // Desenvolvimento: localhost:3001
  return 'http://localhost:3001'
}

// Função auxiliar para construir URL da API
export const getApiUrl = (endpoint) => {
  const socketUrl = getSocketUrl()
  // Remover /socket.io se existir, e garantir que não tenha barra dupla
  let baseUrl = socketUrl.replace('/socket.io', '').replace(/\/$/, '')
  // Remover barra inicial do endpoint se existir
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`
  return `${baseUrl}${cleanEndpoint}`
}

