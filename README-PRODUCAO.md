# 🚀 Guia de Deploy para Produção

## Configuração para Servidor

### 1. Variáveis de Ambiente

Crie um arquivo `.env` na raiz do projeto:

```env
# URL do servidor Socket.io (deixe vazio para usar a mesma origem)
VITE_SOCKET_URL=

# Origens permitidas no servidor (separadas por vírgula)
ALLOWED_ORIGINS=https://seudominio.com,https://www.seudominio.com

# Ambiente
NODE_ENV=production
```

### 2. Build do Frontend

```bash
npm run build
```

Isso criará uma pasta `dist` com os arquivos estáticos.

### 3. Configuração do Servidor

O servidor Socket.io precisa estar rodando. Você pode:

**Opção A: Mesmo servidor (recomendado)**
- Servir os arquivos estáticos do `dist` com Express
- Socket.io na mesma porta

**Opção B: Servidores separados**
- Frontend em um servidor (Nginx, Vercel, Netlify)
- Backend Socket.io em outro servidor (Node.js)

### 4. Exemplo de Servidor Completo

```javascript
// server/index.js (atualizado)
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import cors from 'cors';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const httpServer = createServer(app);

// Servir arquivos estáticos do build
app.use(express.static(join(__dirname, '../dist')));

// Configuração Socket.io (já implementada)
// ...

// Rota catch-all para SPA
app.get('*', (req, res) => {
  res.sendFile(join(__dirname, '../dist/index.html'));
});

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
```

### 5. Deploy em Serviços Cloud

**Vercel/Netlify (Frontend) + Railway/Render (Backend)**
- Frontend: Deploy do `dist`
- Backend: Deploy do servidor Node.js
- Configure `VITE_SOCKET_URL` com a URL do backend

**Servidor próprio**
- Use PM2 para manter o servidor rodando
- Configure Nginx como proxy reverso
- Use SSL/HTTPS

## Funcionalidades de Reconexão

O sistema agora suporta:

✅ **Reconexão automática** ao recarregar a página
✅ **Persistência de estado** usando sessionStorage
✅ **Sincronização com servidor** ao reconectar
✅ **Funciona em produção** com URLs dinâmicas

### Como funciona:

1. **Professor/Aluno recarrega a página**
2. Sistema verifica se há estado salvo
3. Reconecta ao Socket.io
4. Solicita estado atual do servidor
5. Restaura a tela no mesmo ponto

## Notas Importantes

- ⚠️ Estado salvo por **1 hora** (sessionStorage)
- ⚠️ Salas são **temporárias** (perdidas ao reiniciar servidor)
- 💡 Para produção real, considere usar **banco de dados** para persistência
- 💡 Use **Redis** para salas em múltiplos servidores

