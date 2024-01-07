const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const mongoose = require('mongoose');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Conéctate a MongoDB (asegúrate de tener un servidor MongoDB en ejecución)
mongoose.connect('mongodb://localhost:27017/chatApp');
const db = mongoose.connection;
db.on('error', console.error.bind(console, 'Error de conexión a MongoDB:'));
db.once('open', () => {
  console.log('Conexión exitosa a MongoDB');
});

// Define el esquema del usuario
const userSchema = new mongoose.Schema({
  username: { type: String, unique: true, required: true },
  password: { type: String, required: true },
});

// Crea el modelo de usuario
const User = mongoose.model('User', userSchema);

// Define el esquema del mensaje
const messageSchema = new mongoose.Schema({
  username: String,
  message: String,
  timestamp: { type: Date, default: Date.now },
});

// Crea el modelo del mensaje
const Message = mongoose.model('Message', messageSchema);

// Agrega esta sección después de definir el modelo de mensajes
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Ruta para la página de inicio de sesión y registro
app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'login.html'));
});

// Manejar registro de usuarios
app.post('/register', async (req, res) => {
  const { username, password } = req.body;

  try {
    const newUser = new User({ username, password });
    await newUser.save();
    res.send('Registro exitoso');
  } catch (error) {
    res.status(500).send('Error en el registro');
  }
});

// Manejar inicio de sesión
app.post('/login', async (req, res) => {
  const { username, password } = req.body;

  try {
    const user = await User.findOne({ username, password });
    if (user) {
      //res.send('Inicio de sesión exitoso');
      res.redirect(`/chat?username=${username}`);

    } else {
      res.status(401).send('Credenciales incorrectas');
    }
  } catch (error) {
    res.status(500).send('Error en el inicio de sesión');
  }
});

app.get('/chat', (req, res) => {
  const username = req.query.username;

  // Verificar si el usuario ha iniciado sesión
  if (username) {
    // Si el usuario ha iniciado sesión, enviar la página de chat
    res.sendFile(path.join(__dirname, 'index.html'));
  } else {
    // Si el usuario no ha iniciado sesión, redirigir al login
    res.redirect('/login');
  }
});

app.get('/', (req, res) => {
  res.redirect('/login');
});

// Manejar conexiones de clientes
io.on('connection', (socket) => {
  console.log(`Usuario conectado: ${socket.id}`);

  // Obtener los últimos mensajes y enviarlos al nuevo usuario
  Message.find().sort({ timestamp: -1 }).exec()
  .then(messages => {
    // Enviar los mensajes al nuevo usuario
    socket.emit('load old messages', messages.reverse());
  })
  .catch(err => {
    console.error('Error al cargar mensajes:', err);
  });

  // Manejar eventos de chat
  socket.on('chat message', (msg) => {
    // Guardar el mensaje en la base de datos
    const message = new Message({
      username: msg.username,
      message: msg.message,
    });
    message.save()
      .then(savedMessage => {
        console.log("Fecha enviada al cliente:", savedMessage.timestamp); // Agrega este log
        // Emitir el mensaje a todos los clientes
        io.emit('chat message', { 
          username: savedMessage.username,
          message: savedMessage.message,
          timestamp: savedMessage.timestamp,
        });
      })
      .catch(err => {
        throw err;
      });
  });

  // Manejar eventos de desconexión
  socket.on('disconnect', () => {
    console.log(`Usuario desconectado: ${socket.id}`);
  });
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log(`Servidor escuchando en el puerto ${PORT}`);
});

