import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFile, writeFile, mkdir, stat } from 'fs/promises';
import { existsSync } from 'fs';

const app = express();
const httpServer = createServer(app);

// Configuração de CORS para produção e desenvolvimento
const allowedOrigins = process.env.ALLOWED_ORIGINS 
  ? process.env.ALLOWED_ORIGINS.split(',')
  : ['http://localhost:3000', 'http://localhost:5173'];

const io = new Server(httpServer, {
  cors: {
    origin: (origin, callback) => {
      // Permite requisições sem origem (mobile apps, Postman, etc) ou origens permitidas
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        // Em produção, aceita qualquer origem (ou configure específicas)
        if (process.env.NODE_ENV === 'production') {
          callback(null, true);
        } else {
          callback(new Error('Not allowed by CORS'));
        }
      }
    },
    methods: ["GET", "POST"],
    credentials: true
  },
  // Configurações adicionais para produção
  transports: ['polling', 'websocket'],
  allowEIO3: true,
  // Para funcionar atrás de proxy reverso
  pingTimeout: 60000,
  pingInterval: 25000
});

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else if (process.env.NODE_ENV === 'production') {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));
app.use(express.json());

// Middleware de logging para TODAS as requisições
app.use((req, res, next) => {
  console.log(`📥 ${req.method} ${req.url} - Origin: ${req.headers.origin || 'N/A'}`);
  console.log(`   Headers:`, JSON.stringify(req.headers, null, 2));
  next();
});

// Endpoint de teste para verificar se o servidor está acessível
app.get('/api/test', (req, res) => {
  console.log('✅ Endpoint de teste acessado');
  res.json({ status: 'ok', message: 'Servidor está funcionando', timestamp: new Date().toISOString() });
});

// ========== ENDPOINTS PARA MODO ASSÍNCRONO ==========

// Carregar dados assíncronos ao iniciar
async function loadAsyncData() {
  try {
    // Carregar quizzes
    if (existsSync(asyncQuizzesFile)) {
      const quizzesData = JSON.parse(await readFile(asyncQuizzesFile, 'utf-8'));
      for (const [id, quiz] of Object.entries(quizzesData)) {
        asyncQuizzes.set(id, quiz);
      }
      console.log(`📚 Carregados ${asyncQuizzes.size} quiz(zes) assíncrono(s)`);
    }

    // Carregar usuários
    if (existsSync(asyncUsersFile)) {
      const usersData = JSON.parse(await readFile(asyncUsersFile, 'utf-8'));
      for (const [id, user] of Object.entries(usersData)) {
        asyncUsers.set(id, user);
      }
      console.log(`👥 Carregados ${asyncUsers.size} usuário(s) cadastrado(s)`);
    }

    // Carregar progresso
    if (existsSync(asyncProgressFile)) {
      const progressData = JSON.parse(await readFile(asyncProgressFile, 'utf-8'));
      for (const [studentId, progress] of Object.entries(progressData)) {
        asyncProgress.set(studentId, new Map(Object.entries(progress)));
      }
      console.log(`📊 Carregado progresso de ${asyncProgress.size} aluno(s)`);
    }
  } catch (err) {
    console.error('❌ Erro ao carregar dados assíncronos:', err);
  }
}

// Salvar dados assíncronos
async function saveAsyncData() {
  try {
    // Salvar quizzes
    const quizzesData = {};
    for (const [id, quiz] of asyncQuizzes.entries()) {
      quizzesData[id] = quiz;
    }
    await writeFile(asyncQuizzesFile, JSON.stringify(quizzesData, null, 2), { mode: 0o664 });

    // Salvar usuários
    const usersData = {};
    for (const [id, user] of asyncUsers.entries()) {
      usersData[id] = user;
    }
    await writeFile(asyncUsersFile, JSON.stringify(usersData, null, 2), { mode: 0o664 });

    // Salvar progresso
    const progressData = {};
    for (const [studentId, progress] of asyncProgress.entries()) {
      progressData[studentId] = Object.fromEntries(progress);
    }
    await writeFile(asyncProgressFile, JSON.stringify(progressData, null, 2), { mode: 0o664 });
  } catch (err) {
    console.error('❌ Erro ao salvar dados assíncronos:', err);
  }
}

// Registrar usuário (unificado)
app.post('/api/async/register-user', async (req, res) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.json({ success: false, message: 'Nome é obrigatório' });
    }

    // Verificar se já existe usuário com esse nome
    for (const [id, user] of asyncUsers.entries()) {
      if (user.name.toLowerCase() === name.trim().toLowerCase()) {
        return res.json({ success: false, message: 'Usuário já cadastrado com este nome' });
      }
    }

    const userId = `user_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const user = {
      id: userId,
      name: name.trim(),
      createdAt: new Date().toISOString()
    };

    asyncUsers.set(userId, user);
    await saveAsyncData();

    res.json({ success: true, userId, user });
  } catch (err) {
    console.error('Erro ao registrar usuário:', err);
    res.json({ success: false, message: 'Erro ao registrar usuário' });
  }
});

// Login de usuário (unificado)
app.post('/api/async/login-user', async (req, res) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.json({ success: false, message: 'Nome é obrigatório' });
    }

    // Buscar usuário pelo nome
    for (const [id, user] of asyncUsers.entries()) {
      if (user.name.toLowerCase() === name.trim().toLowerCase()) {
        return res.json({ success: true, userId: id, user });
      }
    }

    res.json({ success: false, message: 'Usuário não encontrado' });
  } catch (err) {
    console.error('Erro ao fazer login:', err);
    res.json({ success: false, message: 'Erro ao fazer login' });
  }
});

// Listar quizzes
app.get('/api/async/quizzes', (req, res) => {
  try {
    const quizzes = Array.from(asyncQuizzes.values());
    res.json({ success: true, quizzes });
  } catch (err) {
    console.error('Erro ao listar quizzes:', err);
    res.json({ success: false, quizzes: [] });
  }
});

// Criar quiz
app.post('/api/async/create-quiz', async (req, res) => {
  try {
    const { title, description, questions, hasTimeLimit, creatorName, creatorId } = req.body;

    if (!title || !title.trim()) {
      return res.json({ success: false, message: 'Título é obrigatório' });
    }

    if (!questions || !Array.isArray(questions) || questions.length === 0) {
      return res.json({ success: false, message: 'Adicione pelo menos uma pergunta' });
    }

    const quizId = `quiz_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const quiz = {
      id: quizId,
      title: title.trim(),
      description: description?.trim() || '',
      hasTimeLimit: hasTimeLimit !== undefined ? hasTimeLimit : true,
      questions: questions.map((q, index) => ({
        id: `q_${index}`,
        text: q.text,
        options: q.options,
        correctAnswer: q.correctAnswer,
        time: q.time || 30
      })),
      creatorName: creatorName || 'Usuário',
      creatorId: creatorId || null,
      isActive: true,
      createdAt: new Date().toISOString()
    };

    asyncQuizzes.set(quizId, quiz);
    await saveAsyncData();

    res.json({ success: true, quiz });
  } catch (err) {
    console.error('Erro ao criar quiz:', err);
    res.json({ success: false, message: 'Erro ao criar quiz' });
  }
});

// Obter quiz específico
app.get('/api/async/quiz/:quizId', (req, res) => {
  try {
    const { quizId } = req.params;
    const quiz = asyncQuizzes.get(quizId);
    
    if (!quiz) {
      return res.json({ success: false, message: 'Quiz não encontrado' });
    }

    res.json({ success: true, quiz });
  } catch (err) {
    console.error('Erro ao obter quiz:', err);
    res.json({ success: false, message: 'Erro ao obter quiz' });
  }
});

// Ativar/Desativar quiz
app.post('/api/async/toggle-quiz', async (req, res) => {
  try {
    const { quizId, isActive } = req.body;
    const quiz = asyncQuizzes.get(quizId);

    if (!quiz) {
      return res.json({ success: false, message: 'Quiz não encontrado' });
    }

    quiz.isActive = isActive;
    asyncQuizzes.set(quizId, quiz);
    await saveAsyncData();

    res.json({ success: true });
  } catch (err) {
    console.error('Erro ao alterar status do quiz:', err);
    res.json({ success: false, message: 'Erro ao alterar status' });
  }
});

// Deletar quiz
app.post('/api/async/delete-quiz', async (req, res) => {
  try {
    const { quizId, creatorId } = req.body;
    
    if (!quizId || !creatorId) {
      return res.json({ success: false, message: 'Dados incompletos' });
    }

    const quiz = asyncQuizzes.get(quizId);
    if (!quiz) {
      return res.json({ success: false, message: 'Quiz não encontrado' });
    }

    // Verificar se o usuário é o criador
    if (quiz.creatorId !== creatorId) {
      return res.json({ success: false, message: 'Acesso negado. Apenas o criador pode deletar o quiz.' });
    }
    
    asyncQuizzes.delete(quizId);
    await saveAsyncData();
    res.json({ success: true, message: 'Quiz deletado com sucesso' });
  } catch (err) {
    console.error('Erro ao deletar quiz:', err);
    res.json({ success: false, message: 'Erro ao deletar quiz' });
  }
});

// Obter progresso do usuário
app.get('/api/async/user-progress', (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId) {
      return res.json({ success: false, message: 'userId é obrigatório' });
    }

    const progress = asyncProgress.get(userId);
    const progressObj = progress ? Object.fromEntries(progress) : {};

    res.json({ success: true, progress: progressObj });
  } catch (err) {
    console.error('Erro ao obter progresso:', err);
    res.json({ success: false, progress: {} });
  }
});

// Submeter quiz
app.post('/api/async/submit-quiz', async (req, res) => {
  try {
    const { quizId, userId, answers, score, totalQuestions } = req.body;

    if (!quizId || !userId) {
      return res.json({ success: false, message: 'Dados incompletos' });
    }

    // Verificar se já completou
    if (!asyncProgress.has(userId)) {
      asyncProgress.set(userId, new Map());
    }

    const userProgress = asyncProgress.get(userId);
    if (userProgress.has(quizId)) {
      return res.json({ success: false, message: 'Você já completou este quiz' });
    }

    // Salvar progresso
    userProgress.set(quizId, {
      completed: true,
      score: score || 0,
      totalQuestions: totalQuestions || 0,
      submittedAt: new Date().toISOString(),
      answers: answers || []
    });

    await saveAsyncData();

    res.json({ success: true });
  } catch (err) {
    console.error('Erro ao submeter quiz:', err);
    res.json({ success: false, message: 'Erro ao submeter quiz' });
  }
});

// Obter estatísticas dos quizzes
app.get('/api/async/quiz-stats', (req, res) => {
  try {
    const stats = {};

    for (const [quizId, quiz] of asyncQuizzes.entries()) {
      let totalStudents = 0;
      let completedStudents = 0;

      for (const [studentId, progress] of asyncProgress.entries()) {
        if (progress.has(quizId)) {
          totalStudents++;
          if (progress.get(quizId).completed) {
            completedStudents++;
          }
        }
      }

      stats[quizId] = {
        totalStudents,
        completedStudents
      };
    }

    res.json({ success: true, stats });
  } catch (err) {
    console.error('Erro ao obter estatísticas:', err);
    res.json({ success: false, stats: {} });
  }
});

// Obter resultados de um quiz (apenas para o criador)
app.get('/api/async/quiz-results/:quizId', async (req, res) => {
  try {
    const { quizId } = req.params;
    const { creatorId } = req.query;
    
    console.log(`📊 Requisição de resultados - Quiz: ${quizId}, Criador: ${creatorId}`);

    if (!creatorId) {
      console.log('❌ creatorId não fornecido');
      return res.json({ success: false, message: 'creatorId é obrigatório' });
    }

    const quiz = asyncQuizzes.get(quizId);
    if (!quiz) {
      console.log(`❌ Quiz ${quizId} não encontrado`);
      return res.json({ success: false, message: 'Quiz não encontrado' });
    }

    // Verificar se o usuário é o criador
    if (quiz.creatorId !== creatorId) {
      console.log(`❌ Acesso negado - Quiz criador: ${quiz.creatorId}, Requisitante: ${creatorId}`);
      return res.json({ success: false, message: 'Acesso negado. Apenas o criador pode ver os resultados.' });
    }

    // Buscar todos os resultados dos alunos para este quiz
    const results = [];
    for (const [studentId, progress] of asyncProgress.entries()) {
      if (progress.has(quizId)) {
        const quizProgress = progress.get(quizId);
        if (quizProgress.completed) {
          const student = asyncUsers.get(studentId);
          results.push({
            studentId,
            studentName: student?.name || 'Desconhecido',
            score: quizProgress.score || 0,
            totalQuestions: quizProgress.totalQuestions || 0,
            submittedAt: quizProgress.submittedAt,
            answers: quizProgress.answers || []
          });
        }
      }
    }

    // Ordenar por score (maior primeiro)
    results.sort((a, b) => b.score - a.score);

    console.log(`✅ Retornando ${results.length} resultado(s) para o quiz ${quizId}`);
    res.json({ success: true, results });
  } catch (err) {
    console.error('❌ Erro ao obter resultados do quiz:', err);
    res.json({ success: false, message: 'Erro ao obter resultados' });
  }
});

// Cancelar/remover resultado de um aluno
app.post('/api/async/cancel-student-result', async (req, res) => {
  try {
    const { quizId, studentId, creatorId } = req.body;

    if (!quizId || !studentId || !creatorId) {
      return res.json({ success: false, message: 'Dados incompletos' });
    }

    const quiz = asyncQuizzes.get(quizId);
    if (!quiz) {
      return res.json({ success: false, message: 'Quiz não encontrado' });
    }

    // Verificar se o usuário é o criador
    if (quiz.creatorId !== creatorId) {
      return res.json({ success: false, message: 'Acesso negado. Apenas o criador pode cancelar resultados.' });
    }

    // Remover o resultado do aluno
    if (asyncProgress.has(studentId)) {
      const studentProgress = asyncProgress.get(studentId);
      if (studentProgress.has(quizId)) {
        studentProgress.delete(quizId);
        await saveAsyncData();
        res.json({ success: true, message: 'Resultado cancelado com sucesso' });
      } else {
        res.json({ success: false, message: 'Resultado não encontrado' });
      }
    } else {
      res.json({ success: false, message: 'Aluno não encontrado' });
    }
  } catch (err) {
    console.error('Erro ao cancelar resultado:', err);
    res.json({ success: false, message: 'Erro ao cancelar resultado' });
  }
});

// Editar quiz
app.post('/api/async/edit-quiz', async (req, res) => {
  try {
    const { quizId, title, description, questions, creatorId } = req.body;

    if (!quizId || !creatorId) {
      return res.json({ success: false, message: 'Dados incompletos' });
    }

    const quiz = asyncQuizzes.get(quizId);
    if (!quiz) {
      return res.json({ success: false, message: 'Quiz não encontrado' });
    }

    // Verificar se o usuário é o criador
    if (quiz.creatorId !== creatorId) {
      return res.json({ success: false, message: 'Acesso negado. Apenas o criador pode editar o quiz.' });
    }

    // Atualizar quiz
    if (title !== undefined) quiz.title = title.trim();
    if (description !== undefined) quiz.description = description?.trim() || '';
    if (questions !== undefined && Array.isArray(questions) && questions.length > 0) {
      quiz.questions = questions.map((q, index) => ({
        id: `q_${index}`,
        text: q.text,
        options: q.options,
        correctAnswer: q.correctAnswer,
        time: q.time || 30
      }));
    }

    asyncQuizzes.set(quizId, quiz);
    await saveAsyncData();

    res.json({ success: true, quiz });
  } catch (err) {
    console.error('Erro ao editar quiz:', err);
    res.json({ success: false, message: 'Erro ao editar quiz' });
  }
});

// Servir arquivos estáticos do frontend será configurado no final, após Socket.io

// Armazenamento em memória (em produção, use um banco de dados)
const rooms = new Map();
const users = new Map();

// Armazenamento para modo assíncrono
const asyncQuizzes = new Map(); // quizId -> quiz
const asyncUsers = new Map(); // userId -> { id, name, createdAt }
const asyncProgress = new Map(); // userId -> { quizId -> { completed, score, totalQuestions, submittedAt } }

// Configuração de persistência
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const dataDir = join(__dirname, 'data');
const roomsFile = join(dataDir, 'rooms.json');
const asyncQuizzesFile = join(dataDir, 'async-quizzes.json');
const asyncUsersFile = join(dataDir, 'async-users.json');
const asyncProgressFile = join(dataDir, 'async-progress.json');

// Função para converter Map de answers para objeto serializável
function serializeRoom(room) {
  return {
    id: room.id,
    teacherId: room.teacherId,
    teacherName: room.teacherName,
    students: room.students,
    status: room.status,
    currentQuestion: room.currentQuestion,
    questionIndex: room.questionIndex,
    questions: room.questions,
    answers: Array.from(room.answers.entries()),
    startTime: room.startTime,
    finalRanking: room.finalRanking || null,
    rankingDate: room.rankingDate || null
  };
}

// Função para deserializar room
function deserializeRoom(data) {
  return {
    id: data.id,
    teacherId: data.teacherId,
    teacherName: data.teacherName,
    students: data.students || [],
    status: data.status || 'waiting',
    currentQuestion: data.currentQuestion || null,
    questionIndex: data.questionIndex || 0,
    questions: data.questions || [],
    answers: new Map(data.answers || []),
    timer: null,
    startTime: data.startTime || null,
    finalRanking: data.finalRanking || null,
    rankingDate: data.rankingDate || null
  };
}

// Salvar salas em arquivo
async function saveRooms() {
  try {
    console.log('saveRooms() chamado - Total de salas:', rooms.size);
    
    // Criar diretório se não existir com permissões explícitas
    if (!existsSync(dataDir)) {
      await mkdir(dataDir, { recursive: true, mode: 0o775 });
      console.log(`📁 Diretório criado: ${dataDir}`);
    } else {
      // Verificar permissões do diretório existente
      try {
        const dirStats = await stat(dataDir);
        console.log(`📁 Diretório existe: ${dataDir} (modo: ${dirStats.mode.toString(8)})`);
      } catch (e) {
        console.warn(`⚠️ Não foi possível verificar permissões do diretório: ${e.message}`);
      }
    }

    const roomsData = {};
    for (const [roomId, room] of rooms.entries()) {
      roomsData[roomId] = serializeRoom(room);
      console.log(`  - Sala ${roomId}: ${room.questions?.length || 0} pergunta(s), ${room.students?.length || 0} aluno(s)`);
    }

    const jsonData = JSON.stringify(roomsData, null, 2);
    
    // Tentar escrever o arquivo
    console.log(`💾 Tentando escrever arquivo: ${roomsFile}`);
    await writeFile(roomsFile, jsonData, { mode: 0o664, flag: 'w' });
    
    // Aguardar um pouco para garantir que o sistema de arquivos processou
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Verificar se o arquivo foi criado
    await new Promise(resolve => setTimeout(resolve, 200)); // Aguardar mais tempo
    
    if (existsSync(roomsFile)) {
      const stats = await stat(roomsFile);
      console.log(`✅ Salas salvas com sucesso em: ${roomsFile}`);
      console.log(`   Tamanho do arquivo: ${stats.size} bytes`);
      console.log(`   Permissões: ${stats.mode.toString(8)}`);
      console.log(`   ${Object.keys(roomsData).length} sala(s) salva(s)`);
      
      // Verificar conteúdo do arquivo
      try {
        const fileContent = await readFile(roomsFile, 'utf-8');
        const parsed = JSON.parse(fileContent);
        console.log(`   ✅ Arquivo válido com ${Object.keys(parsed).length} sala(s)`);
      } catch (verifyError) {
        console.error(`   ⚠️ Arquivo criado mas inválido: ${verifyError.message}`);
      }
    } else {
      console.error('❌ ERRO: Arquivo não foi criado após writeFile!');
      console.error(`   Caminho completo: ${roomsFile}`);
      console.error(`   Diretório existe: ${existsSync(dataDir)}`);
      console.error(`   Tentando criar arquivo vazio para testar permissões...`);
      try {
        await writeFile(roomsFile + '.test', 'test', { mode: 0o664 });
        await new Promise(resolve => setTimeout(resolve, 100));
        if (existsSync(roomsFile + '.test')) {
          console.error(`   ✅ Arquivo de teste criado com sucesso! Permissões OK.`);
          // Deletar arquivo de teste
          const { unlink } = await import('fs/promises');
          await unlink(roomsFile + '.test');
          // Tentar criar o arquivo real novamente
          console.error(`   Tentando criar arquivo real novamente...`);
          await writeFile(roomsFile, jsonData, { mode: 0o664, flag: 'w' });
          await new Promise(resolve => setTimeout(resolve, 200));
          if (existsSync(roomsFile)) {
            console.error(`   ✅ Arquivo criado na segunda tentativa!`);
          }
        }
      } catch (testError) {
        console.error(`   ❌ Erro ao criar arquivo de teste: ${testError.message}`);
        console.error(`   Código: ${testError.code}`);
        console.error(`   Possível problema de permissões no diretório: ${dataDir}`);
      }
    }
  } catch (error) {
    console.error('❌ Erro ao salvar salas:', error);
    console.error('   Caminho tentado:', roomsFile);
    console.error('   Diretório:', dataDir);
    console.error('   Erro:', error.message);
    console.error('   Código:', error.code);
    console.error('   Stack:', error.stack);
  }
}

// Carregar salas do arquivo
async function loadRooms() {
  try {
    console.log(`📂 Tentando carregar salas de: ${roomsFile}`);
    console.log(`📂 Diretório: ${dataDir}`);
    console.log(`📂 Diretório existe: ${existsSync(dataDir)}`);
    
    // Garantir que o diretório existe
    if (!existsSync(dataDir)) {
      console.log(`📁 Criando diretório: ${dataDir}`);
      await mkdir(dataDir, { recursive: true, mode: 0o775 });
      console.log(`✅ Diretório criado: ${dataDir}`);
    } else {
      // Verificar permissões do diretório
      try {
        const dirStats = await stat(dataDir);
        console.log(`📁 Diretório existe com permissões: ${dirStats.mode.toString(8)}`);
      } catch (e) {
        console.warn(`⚠️ Não foi possível verificar permissões: ${e.message}`);
      }
    }
    
    if (!existsSync(roomsFile)) {
      console.log(`📄 Arquivo de salas não encontrado em: ${roomsFile}`);
      console.log('📄 Iniciando com salas vazias');
      // Tentar criar arquivo vazio para verificar permissões
      try {
        await writeFile(roomsFile, '{}', { mode: 0o664 });
        console.log(`✅ Arquivo vazio criado para verificar permissões`);
        // Ler de volta para confirmar
        if (existsSync(roomsFile)) {
          const testStats = await stat(roomsFile);
          console.log(`✅ Permissões do arquivo: ${testStats.mode.toString(8)}`);
        }
      } catch (permError) {
        console.error(`❌ ERRO DE PERMISSÃO: Não foi possível criar arquivo!`);
        console.error(`   Erro: ${permError.message}`);
        console.error(`   Código: ${permError.code}`);
        console.error(`   Verifique as permissões do diretório: ${dataDir}`);
        console.error(`   Execute: chmod 775 ${dataDir} && chown -R $(whoami) ${dataDir}`);
      }
      return;
    }

    // Ler e validar arquivo
    let data;
    try {
      data = await readFile(roomsFile, 'utf-8');
      
      // Verificar se arquivo está vazio ou inválido
      if (!data || data.trim() === '' || data.trim() === '{}') {
        console.log(`📄 Arquivo existe mas está vazio, iniciando com salas vazias`);
        // Garantir que o arquivo tem conteúdo válido
        await writeFile(roomsFile, '{}', { mode: 0o664 });
        return;
      }
    } catch (readError) {
      console.error(`❌ Erro ao ler arquivo: ${readError.message}`);
      console.error(`   Tentando recriar arquivo...`);
      await writeFile(roomsFile, '{}', { mode: 0o664 });
      return;
    }

    // Tentar fazer parse do JSON
    let roomsData;
    try {
      roomsData = JSON.parse(data);
    } catch (parseError) {
      console.error(`❌ Erro ao fazer parse do JSON: ${parseError.message}`);
      console.error(`   Arquivo pode estar corrompido. Recriando...`);
      // Fazer backup do arquivo corrompido
      const { rename } = await import('fs/promises');
      try {
        await rename(roomsFile, roomsFile + '.backup.' + Date.now());
        console.log(`   Backup do arquivo corrompido criado`);
      } catch (backupError) {
        console.warn(`   Não foi possível criar backup: ${backupError.message}`);
      }
      // Criar novo arquivo vazio
      await writeFile(roomsFile, '{}', { mode: 0o664 });
      return;
    }

    console.log(`Carregando ${Object.keys(roomsData).length} sala(s) do arquivo...`);
    
    for (const [roomId, roomData] of Object.entries(roomsData)) {
      // Carregar todas as salas, mas apenas restaurar estado se estiver waiting ou finished
      // Salas em andamento serão resetadas para waiting
      if (roomData.status === 'waiting' || roomData.status === 'finished') {
        const deserializedRoom = deserializeRoom(roomData);
        // Se estiver finished, resetar para waiting para permitir novo quiz
        if (deserializedRoom.status === 'finished') {
          deserializedRoom.status = 'waiting';
          deserializedRoom.questionIndex = 0;
          deserializedRoom.currentQuestion = null;
        }
        rooms.set(roomId, deserializedRoom);
        console.log(`Sala ${roomId} carregada: ${deserializedRoom.questions.length} pergunta(s), ${deserializedRoom.students.length} aluno(s)`);
      } else {
        // Sala em andamento - resetar para waiting
        const deserializedRoom = deserializeRoom(roomData);
        deserializedRoom.status = 'waiting';
        deserializedRoom.questionIndex = 0;
        deserializedRoom.currentQuestion = null;
        rooms.set(roomId, deserializedRoom);
        console.log(`Sala ${roomId} resetada para waiting (estava em ${roomData.status})`);
      }
    }

    console.log(`${rooms.size} sala(s) carregada(s) do arquivo`);
  } catch (error) {
    console.error('Erro ao carregar salas:', error);
  }
}

// Carregar salas ao iniciar
loadRooms();
loadAsyncData();

// Tratar erros de conexão antes do handshake
io.engine.on('connection_error', (err) => {
  console.error('❌ Erro de conexão Socket.IO:', err);
  console.error('   Detalhes:', err.req?.url, err.code, err.message);
  console.error('   Context:', err.context);
  console.error('   Stack:', err.stack);
});

// Log quando alguém tenta conectar
io.engine.on('connection', (socket) => {
  console.log('🔌 Tentativa de conexão recebida');
});

// Tratar erros não capturados
process.on('uncaughtException', (error) => {
  console.error('❌ Erro não capturado:', error);
  console.error('   Stack:', error.stack);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Promise rejeitada não tratada:', reason);
  console.error('   Promise:', promise);
});

io.on('connection', (socket) => {
  console.log('✅ Usuário conectado:', socket.id);
  console.log('   Transport:', socket.conn.transport.name);
  console.log('   Headers:', socket.handshake.headers);
  
  // Tratar erros de socket
  socket.on('error', (error) => {
    console.error('❌ Erro no socket:', socket.id, error);
    console.error('   Stack:', error.stack);
  });
  
  socket.on('disconnect', (reason) => {
    console.log('👋 Usuário desconectado:', socket.id, 'Razão:', reason);
  });

  // Criar sala (professor)
  socket.on('create-room', ({ roomId, teacherName, reconnect = false }) => {
    try {
      console.log(`📥 Recebido create-room: sala=${roomId}, professor=${teacherName}, reconnect=${reconnect}`);
      
      if (!roomId || !teacherName) {
        console.error('❌ Dados inválidos: roomId ou teacherName faltando');
        socket.emit('error', { message: 'Dados inválidos' });
        return;
      }
      
      const existingRoom = rooms.get(roomId);
      
      if (existingRoom) {
      // Sala existe: reconexão - atualizar teacherId mas manter estado da sala
      existingRoom.teacherId = socket.id;
      existingRoom.teacherName = teacherName; // Atualizar nome também
      users.set(socket.id, { roomId, isTeacher: true });
      socket.join(roomId);
      
      // Enviar estado atual da sala
      socket.emit('room-reconnected', {
        roomId,
        students: existingRoom.students || [],
        questions: existingRoom.questions || [],
        status: existingRoom.status,
        currentQuestion: existingRoom.currentQuestion,
        questionIndex: existingRoom.questionIndex,
        questionNumber: existingRoom.questionIndex + 1,
        finalRanking: existingRoom.finalRanking || null,
        rankingDate: existingRoom.rankingDate || null
      });
      
      console.log(`👨‍🏫 Professor reconectado: ${roomId} por ${teacherName}, ${existingRoom.students.length} aluno(s) na sala`);
      console.log(`   Perguntas na sala: ${existingRoom.questions?.length || 0}`);
      saveRooms(); // Salvar após reconexão
    } else {
      // Nova sala
      rooms.set(roomId, {
        id: roomId,
        teacherId: socket.id,
        teacherName,
        students: [],
        status: 'waiting', // waiting, countdown, question, results
        currentQuestion: null,
        questionIndex: 0,
        questions: [],
        answers: new Map(),
        timer: null,
        startTime: null
      });
      
      users.set(socket.id, { roomId, isTeacher: true });
      socket.join(roomId);
      socket.emit('room-created', { roomId });
      console.log(`🏫 Sala criada: ${roomId} por ${teacherName}`);
      saveRooms(); // Salvar após criar sala
    }
    } catch (error) {
      console.error('❌ Erro ao processar create-room:', error);
      console.error('   Stack:', error.stack);
      try {
        socket.emit('error', { message: 'Erro ao criar sala: ' + error.message });
      } catch (emitError) {
        console.error('   Erro ao emitir erro:', emitError);
      }
    }
  });

  // Solicitar estado atual da sala (para reconexão)
  socket.on('request-room-state', ({ roomId, isTeacher }) => {
    const room = rooms.get(roomId);
    if (!room) {
      socket.emit('room-not-found');
      return;
    }

    if (isTeacher) {
      socket.emit('room-state', {
        students: room.students,
        questions: room.questions,
        status: room.status,
        currentQuestion: room.currentQuestion,
        questionIndex: room.questionIndex,
        questionNumber: room.questionIndex + 1
      });
    } else {
      socket.emit('room-state', {
        status: room.status,
        currentQuestion: room.currentQuestion,
        questionIndex: room.questionIndex,
        questionNumber: room.questionIndex + 1
      });
    }
  });

  // Entrar na sala (aluno)
  socket.on('join-room', ({ roomId, studentName, reconnect = false, oldSocketId = null }) => {
    console.log(`Tentativa de entrada: ${studentName} na sala ${roomId}, reconectar: ${reconnect}`);
    const room = rooms.get(roomId);
    
    if (!room) {
      console.log(`Sala ${roomId} não encontrada. Salas disponíveis:`, Array.from(rooms.keys()));
      socket.emit('room-error', { message: 'Sala não encontrada. Verifique o código da sala.' });
      return;
    }
    
    console.log(`Sala ${roomId} encontrada. Status: ${room.status}, Alunos: ${room.students.length}`);

    // Se for reconexão, encontrar o aluno existente
    if (reconnect && oldSocketId) {
      const existingStudent = room.students.find(s => s.id === oldSocketId);
      if (existingStudent) {
        existingStudent.id = socket.id; // Atualizar ID do socket
        users.set(socket.id, { roomId, isTeacher: false });
        socket.join(roomId);
        
        // Enviar estado atual
        socket.emit('joined-room', { roomId, studentName, reconnected: true });
        socket.emit('room-state', {
          status: room.status,
          currentQuestion: room.currentQuestion,
          questionIndex: room.questionIndex,
          questionNumber: room.questionIndex + 1,
          students: room.students
        });
        
        console.log(`${studentName} reconectado na sala ${roomId}`);
        return;
      }
    }

    // Se o quiz já iniciou e não é reconexão, não permite entrar
    if (room.status !== 'waiting' && !reconnect) {
      socket.emit('room-error', { message: 'Quiz já iniciado' });
      return;
    }

    // Novo aluno
    const student = {
      id: socket.id,
      name: studentName,
      score: 0,
      answers: []
    };

    room.students.push(student);
    users.set(socket.id, { roomId, isTeacher: false });
    
    socket.join(roomId);
    
    // Emitir joined-room primeiro
    socket.emit('joined-room', { roomId, studentName, reconnected: false });
    
    // Notificar professor sobre novo aluno
    if (room.teacherId) {
      io.to(room.teacherId).emit('student-joined', {
        students: room.students
      });
      console.log(`Notificando professor ${room.teacherId} sobre novo aluno`);
    } else {
      console.warn(`Sala ${roomId} não tem teacherId definido`);
    }
    
    // Atualizar lista de alunos para todos na sala
    io.to(roomId).emit('students-updated', {
      students: room.students
    });
    
    console.log(`${studentName} entrou na sala ${roomId}. Total de alunos: ${room.students.length}`);
    saveRooms(); // Salvar após aluno entrar
  });

  // Salvar perguntas antes de iniciar quiz
  socket.on('save-questions', ({ roomId, questions }) => {
    console.log(`📝 ===== RECEBIDO save-questions =====`);
    console.log(`📝 Sala: ${roomId}`);
    console.log(`📝 Perguntas: ${questions?.length || 0}`);
    console.log(`📝 Socket ID: ${socket.id}`);
    
    const room = rooms.get(roomId);
    
    if (!room) {
      console.error(`❌ Sala ${roomId} não encontrada ao tentar salvar perguntas`);
      console.error(`   Salas disponíveis:`, Array.from(rooms.keys()));
      return;
    }
    
    console.log(`📝 Sala encontrada. Teacher ID: ${room.teacherId}, Socket ID: ${socket.id}`);
    
    if (room.teacherId !== socket.id) {
      console.error(`❌ Tentativa de salvar perguntas por não-professor.`);
      console.error(`   Teacher ID: ${room.teacherId}`);
      console.error(`   Socket ID: ${socket.id}`);
      return;
    }

    // Salvar perguntas mesmo antes de iniciar o quiz
    room.questions = questions || [];
    console.log(`💾 Salvando ${questions.length} pergunta(s) na sala ${roomId}...`);
    saveRooms(); // Salvar perguntas no servidor
    console.log(`✅ ${questions.length} pergunta(s) salva(s) na sala ${roomId}`);
  });

  // Professor inicia o quiz
  socket.on('start-quiz', ({ roomId, questions }) => {
    const room = rooms.get(roomId);
    
    if (!room || room.teacherId !== socket.id) {
      return;
    }

    // Usar perguntas salvas ou as enviadas
    if (questions && questions.length > 0) {
      room.questions = questions;
    }

    room.status = 'countdown';
    room.questionIndex = 0;
    room.answers.clear();

    saveRooms(); // Salvar após iniciar quiz

    // Iniciar contagem regressiva
    io.to(roomId).emit('quiz-starting', { countdown: 5 });
    
    let countdown = 5;
    const countdownInterval = setInterval(() => {
      countdown--;
      if (countdown > 0) {
        io.to(roomId).emit('countdown-update', { countdown });
      } else {
        clearInterval(countdownInterval);
        startNextQuestion(room);
      }
    }, 1000);
  });

  // Função para iniciar próxima pergunta
  function startNextQuestion(room) {
    if (room.questionIndex >= room.questions.length) {
      // Quiz terminou
      endQuiz(room);
      return;
    }

    room.status = 'question';
    room.currentQuestion = room.questions[room.questionIndex];
    room.startTime = Date.now();
    room.timer = setTimeout(() => {
      endQuestion(room);
    }, room.currentQuestion.time * 1000);

    io.to(room.id).emit('question-started', {
      question: room.currentQuestion,
      questionNumber: room.questionIndex + 1,
      totalQuestions: room.questions.length,
      time: room.currentQuestion.time
    });
  }

  // Aluno envia resposta
  socket.on('submit-answer', ({ roomId, answerIndex }) => {
    const room = rooms.get(roomId);
    
    if (!room || room.status !== 'question') {
      return;
    }

    if (!room.answers.has(socket.id)) {
      room.answers.set(socket.id, []);
    }

    const userAnswers = room.answers.get(socket.id);
    const existingAnswer = userAnswers.find(a => a.questionIndex === room.questionIndex);
    
    if (existingAnswer) {
      existingAnswer.answerIndex = answerIndex;
    } else {
      userAnswers.push({
        questionIndex: room.questionIndex,
        answerIndex: answerIndex
      });
    }

    // Notificar professor sobre resposta recebida
    const studentName = room.students.find(s => s.id === socket.id)?.name || 'Desconhecido';
    io.to(room.teacherId).emit('answer-received', {
      studentId: socket.id,
      studentName: studentName
    });

    // Verificar se todos os alunos já responderam
    const totalStudents = room.students.length;
    let answeredCount = 0;
    
    room.students.forEach(student => {
      const studentAnswers = room.answers.get(student.id) || [];
      const hasAnswered = studentAnswers.some(a => a.questionIndex === room.questionIndex);
      if (hasAnswered) {
        answeredCount++;
      }
    });

    console.log(`📊 Respostas: ${answeredCount}/${totalStudents} alunos responderam`);

    // Se todos os alunos responderam, encerrar pergunta automaticamente
    if (answeredCount === totalStudents && totalStudents > 0) {
      console.log(`✅ Todos os alunos responderam! Encerrando pergunta automaticamente...`);
      endQuestion(room);
    }
  });

  // Finalizar pergunta
  function endQuestion(room) {
    if (room.timer) {
      clearTimeout(room.timer);
      room.timer = null;
    }

    const correctAnswer = room.currentQuestion.correctAnswer;
    const results = [];

    room.students.forEach(student => {
      const userAnswers = room.answers.get(student.id) || [];
      const answer = userAnswers.find(a => a.questionIndex === room.questionIndex);
      const isCorrect = answer && answer.answerIndex === correctAnswer;
      
      if (isCorrect) {
        student.score += 1;
      }

      results.push({
        studentId: student.id,
        studentName: student.name,
        isCorrect: isCorrect,
        answerIndex: answer ? answer.answerIndex : null
      });
    });

    room.status = 'results';
    
    io.to(room.id).emit('question-ended', {
      correctAnswer: correctAnswer,
      results: results
    });

    // Após 3 segundos, ir para próxima pergunta
    setTimeout(() => {
      room.questionIndex++;
      if (room.questionIndex < room.questions.length) {
        startNextQuestion(room);
      } else {
        endQuiz(room);
      }
    }, 3000);
  }

  // Finalizar quiz
  function endQuiz(room) {
    room.status = 'finished';
    
    const ranking = room.students
      .map(s => ({ name: s.name, score: s.score, total: room.questions.length }))
      .sort((a, b) => b.score - a.score);

    // Salvar ranking final com data
    room.finalRanking = ranking;
    room.rankingDate = new Date().toISOString();

    io.to(room.id).emit('quiz-ended', {
      ranking: ranking,
      date: room.rankingDate
    });
    
    saveRooms(); // Salvar após quiz terminar
    console.log(`📊 Ranking final salvo para sala ${room.id} em ${room.rankingDate}`);
  }

  // Desconectar
  socket.on('disconnect', () => {
    const user = users.get(socket.id);
    
    if (user) {
      const room = rooms.get(user.roomId);
      
      if (room) {
        if (user.isTeacher) {
          // Professor desconectou - NÃO deletar a sala, apenas limpar teacherId
          // A sala será mantida para reconexão
          console.log(`Professor desconectou da sala ${user.roomId}, mas sala será mantida`);
          room.teacherId = null; // Limpar teacherId mas manter sala
          // Não emitir room-closed, permitir reconexão
          saveRooms(); // Salvar estado atualizado
        } else {
          // Aluno saiu
          room.students = room.students.filter(s => s.id !== socket.id);
          io.to(user.roomId).emit('students-updated', {
            students: room.students
          });
          saveRooms(); // Salvar após aluno sair
        }
      }
      
      users.delete(socket.id);
    }
    
    console.log('Usuário desconectado:', socket.id);
  });
});

// Servir arquivos estáticos do frontend (em produção) - DEVE VIR NO FINAL
if (process.env.NODE_ENV === 'production') {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  const distPath = join(__dirname, '../dist');
  
  app.use(express.static(distPath));
  
  // Rota catch-all para SPA - deve vir depois de todas as outras rotas
  app.get('*', (req, res) => {
    res.sendFile(join(distPath, 'index.html'));
  });
}

const PORT = process.env.PORT || 3001;

// Tratar erros do servidor HTTP
httpServer.on('error', (error) => {
  console.error('❌ Erro no servidor HTTP:', error);
  if (error.code === 'EADDRINUSE') {
    console.error(`   Porta ${PORT} já está em uso!`);
  }
});

httpServer.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
  console.log(`Socket.IO path: /socket.io/`);
  if (process.env.NODE_ENV === 'production') {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    console.log(`Frontend servido de: ${join(__dirname, '../dist')}`);
  }
});

