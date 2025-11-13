# 🎯 Quiz Online

Sistema de quiz online em tempo real onde professores podem criar salas e alunos podem participar respondendo perguntas.

## 🚀 Funcionalidades

- **Criação de Salas**: Professores criam salas com código único
- **QR Code**: Link compartilhável com QR Code para acesso rápido
- **Sala de Espera**: Alunos aguardam na sala até o professor iniciar
- **Quiz em Tempo Real**: Sincronização em tempo real entre professor e alunos
- **Timer**: Contagem regressiva e timer para cada pergunta
- **Feedback Imediato**: Alunos veem se acertaram após cada pergunta
- **Ranking**: Lista final com pontuação e ranking dos alunos

## 📋 Pré-requisitos

- Node.js 16+ instalado
- npm ou yarn

## 🛠️ Instalação

1. Instale as dependências:
```bash
npm install
```

## 🎮 Como Usar

### Iniciar o Servidor

Abra um terminal e execute:
```bash
npm run server
```

O servidor estará rodando em `http://localhost:3001`

### Iniciar o Frontend

Abra outro terminal e execute:
```bash
npm run dev
```

O frontend estará rodando em `http://localhost:3000`

### Como Funciona

1. **Professor**:
   - Acesse `http://localhost:3000`
   - Selecione "Professor"
   - Digite seu nome
   - Clique em "Criar Sala"
   - Adicione perguntas com 4 opções cada
   - Defina a resposta correta e o tempo
   - Clique em "Iniciar Quiz" quando estiver pronto

2. **Aluno**:
   - Acesse `http://localhost:3000`
   - Selecione "Aluno"
   - Digite seu nome e o código da sala
   - Ou escaneie o QR Code fornecido pelo professor
   - Aguarde o professor iniciar o quiz
   - Responda as perguntas antes do tempo acabar
   - Veja seus resultados e o ranking final

## 📱 Acesso Mobile

O sistema é totalmente responsivo. Alunos podem acessar pelo celular através do link ou QR Code.

## 🎨 Tecnologias Utilizadas

- **React** - Framework frontend
- **Vite** - Build tool
- **Socket.io** - Comunicação em tempo real
- **Express** - Servidor backend
- **React Router** - Roteamento
- **QRCode.react** - Geração de QR Code

## 📝 Estrutura do Projeto

```
quizz-online-web/
├── server/
│   └── index.js          # Servidor Socket.io
├── src/
│   ├── pages/
│   │   ├── Home.jsx      # Tela inicial
│   │   ├── TeacherRoom.jsx # Tela do professor
│   │   └── StudentRoom.jsx # Tela do aluno
│   ├── App.jsx           # Componente principal
│   └── main.jsx          # Entry point
├── package.json
└── vite.config.js
```

## 🔧 Scripts Disponíveis

- `npm run dev` - Inicia o servidor de desenvolvimento
- `npm run build` - Cria build de produção
- `npm run server` - Inicia o servidor backend
- `npm run preview` - Preview do build de produção

## 📌 Notas

- O servidor precisa estar rodando para o sistema funcionar
- As salas são temporárias (em memória) e serão perdidas ao reiniciar o servidor
- Para produção, considere usar um banco de dados para persistência

