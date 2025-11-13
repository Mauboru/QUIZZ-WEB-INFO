# 🚀 Deploy na Hostinger com CloudPanel

## Estratégia Recomendada

### Opção 1: Tudo no mesmo servidor (Recomendado) ✅

**Vantagens:**
- Mais simples de configurar
- Menos custos
- Socket.io funciona perfeitamente

**Como fazer:**

1. **Subir o projeto completo** para o servidor
2. **Servir o frontend** através do próprio servidor Node.js (já configurado)
3. **Rodar o servidor** com PM2
4. **Configurar Nginx** como proxy reverso (opcional, mas recomendado)

---

## Passo a Passo

### 1. Preparar o Projeto

```bash
# No seu computador local
npm run build
```

Isso cria a pasta `dist` com os arquivos estáticos.

### 2. Enviar para o Servidor

Envie toda a pasta do projeto para o servidor via:
- FTP/SFTP
- Git (recomendado)
- CloudPanel File Manager

### 3. Instalar Dependências no Servidor

```bash
# Via SSH ou CloudPanel Terminal
cd /caminho/do/projeto
npm install --production
```

### 4. Configurar PM2

```bash
# Instalar PM2 globalmente (se ainda não tiver)
npm install -g pm2

# Criar arquivo de configuração PM2
```

Crie o arquivo `ecosystem.config.js` na raiz do projeto:

```javascript
module.exports = {
  apps: [{
    name: 'quiz-online',
    script: './server/index.js',
    instances: 1,
    exec_mode: 'fork',
    env: {
      NODE_ENV: 'production',
      PORT: 3001
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G'
  }]
}
```

### 5. Iniciar com PM2

```bash
# Criar pasta de logs
mkdir -p logs

# Iniciar aplicação
pm2 start ecosystem.config.js

# Salvar configuração do PM2
pm2 save

# Configurar para iniciar no boot
pm2 startup
```

### 6. Configurar Nginx (CloudPanel)

No CloudPanel, vá em **Websites** → Seu domínio → **Nginx Config**

Adicione esta configuração:

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name seudominio.com www.seudominio.com;

    # Redirecionar para HTTPS (se tiver SSL)
    # return 301 https://$server_name$request_uri;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # Timeout para WebSocket
        proxy_read_timeout 86400;
    }

    # Se tiver SSL, adicione também:
    # listen 443 ssl http2;
    # ssl_certificate /caminho/do/certificado;
    # ssl_certificate_key /caminho/da/chave;
}
```

### 7. Variáveis de Ambiente (Opcional)

Se precisar configurar variáveis, crie um arquivo `.env` na raiz:

```env
NODE_ENV=production
PORT=3001
ALLOWED_ORIGINS=https://seudominio.com,https://www.seudominio.com
```

---

## Opção 2: Frontend e Backend Separados

Se preferir separar (mais complexo):

### Frontend (Nginx estático)
- Build: `npm run build`
- Servir pasta `dist` via Nginx
- Configurar proxy para `/socket.io` → `http://localhost:3001`

### Backend (PM2)
- Rodar apenas `server/index.js` com PM2
- Porta 3001

**Mas a Opção 1 é mais simples e funciona perfeitamente!**

---

## Comandos Úteis PM2

```bash
# Ver status
pm2 status

# Ver logs
pm2 logs quiz-online

# Reiniciar
pm2 restart quiz-online

# Parar
pm2 stop quiz-online

# Monitorar
pm2 monit
```

---

## Verificação

1. ✅ Servidor rodando: `pm2 status` mostra "online"
2. ✅ Porta aberta: `netstat -tulpn | grep 3001`
3. ✅ Acessar: `http://seudominio.com` ou `https://seudominio.com`
4. ✅ Socket.io funcionando: abra o console do navegador, deve conectar

---

## Troubleshooting

### Porta não acessível
- Verifique firewall da Hostinger
- Confirme que PM2 está rodando: `pm2 status`
- Teste localmente no servidor: `curl http://localhost:3001`

### Socket.io não conecta
- Verifique CORS no `server/index.js`
- Confirme que Nginx está fazendo proxy do WebSocket
- Veja logs: `pm2 logs quiz-online`

### Frontend não carrega
- Verifique se o build foi feito: pasta `dist` existe?
- Confirme que servidor está servindo arquivos estáticos
- Veja logs do Nginx no CloudPanel

---

## Estrutura Final no Servidor

```
/var/www/seu-projeto/
├── dist/              # Frontend buildado
├── server/            # Backend
├── src/               # Código fonte (não necessário em produção)
├── package.json
├── ecosystem.config.js # PM2 config
├── .env               # Variáveis (opcional)
└── logs/              # Logs do PM2
```

---

## Dica Importante

O servidor já está configurado para servir os arquivos estáticos do `dist` automaticamente! Então você só precisa:

1. ✅ Fazer build: `npm run build`
2. ✅ Rodar com PM2: `pm2 start ecosystem.config.js`
3. ✅ Configurar Nginx como proxy

**Pronto!** 🎉

