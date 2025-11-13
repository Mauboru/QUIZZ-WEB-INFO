import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

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
  }
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

// Servir arquivos estáticos do frontend será configurado no final, após Socket.io

// Armazenamento em memória (em produção, use um banco de dados)
const rooms = new Map();
const users = new Map();

io.on('connection', (socket) => {
  console.log('Usuário conectado:', socket.id);

  // Criar sala (professor)
  socket.on('create-room', ({ roomId, teacherName, reconnect = false }) => {
    const existingRoom = rooms.get(roomId);
    
    if (existingRoom && reconnect) {
      // Reconexão: atualizar teacherId mas manter estado da sala
      existingRoom.teacherId = socket.id;
      socket.join(roomId);
      
      // Enviar estado atual da sala
      socket.emit('room-reconnected', {
        roomId,
        students: existingRoom.students,
        questions: existingRoom.questions,
        status: existingRoom.status,
        currentQuestion: existingRoom.currentQuestion,
        questionIndex: existingRoom.questionIndex,
        questionNumber: existingRoom.questionIndex + 1
      });
      
      console.log(`Professor reconectado: ${roomId} por ${teacherName}`);
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
      
      socket.join(roomId);
      socket.emit('room-created', { roomId });
      console.log(`Sala criada: ${roomId} por ${teacherName}`);
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
    const room = rooms.get(roomId);
    
    if (!room) {
      socket.emit('room-error', { message: 'Sala não encontrada' });
      return;
    }

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
    socket.emit('joined-room', { roomId, studentName });
    
    // Notificar professor sobre novo aluno
    io.to(room.teacherId).emit('student-joined', {
      students: room.students
    });
    
    // Atualizar lista de alunos para todos
    io.to(roomId).emit('students-updated', {
      students: room.students
    });
    
    console.log(`${studentName} entrou na sala ${roomId}`);
  });

  // Professor inicia o quiz
  socket.on('start-quiz', ({ roomId, questions }) => {
    const room = rooms.get(roomId);
    
    if (!room || room.teacherId !== socket.id) {
      return;
    }

    room.questions = questions;
    room.status = 'countdown';
    room.questionIndex = 0;
    room.answers.clear();

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
    io.to(room.teacherId).emit('answer-received', {
      studentId: socket.id,
      studentName: room.students.find(s => s.id === socket.id)?.name || 'Desconhecido'
    });
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

    io.to(room.id).emit('quiz-ended', {
      ranking: ranking
    });
  }

  // Desconectar
  socket.on('disconnect', () => {
    const user = users.get(socket.id);
    
    if (user) {
      const room = rooms.get(user.roomId);
      
      if (room) {
        if (user.isTeacher) {
          // Professor saiu, encerrar sala
          io.to(user.roomId).emit('room-closed');
          rooms.delete(user.roomId);
        } else {
          // Aluno saiu
          room.students = room.students.filter(s => s.id !== socket.id);
          io.to(user.roomId).emit('students-updated', {
            students: room.students
          });
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
httpServer.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
  if (process.env.NODE_ENV === 'production') {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    console.log(`Frontend servido de: ${join(__dirname, '../dist')}`);
  }
});

