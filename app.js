const express = require('express')
const cors = require('cors');
const app = express()
const port = process.env.PORT || 6050;
const bodyParser = require('body-parser')

app.use(cors());
app.use(bodyParser.urlencoded({extended: true}))
app.use(bodyParser.json());

const server = require('http').createServer(app).listen(port, () => {
    console.log("Express server listening on port " + port)
})

app.use('/public', express.static('./public'))
app.get('/', (req, res) => {
    res.redirect(302, '/public')
})

const socketio = require('socket.io')
const io = socketio(server, {
    cors: {
        origin: '*',
    }
});

io.on('connection', (socket) => {
    console.log(`${socket.client.id} connected`)

    socket.on('room-join', (msg) => {
        console.log(`${msg.name} ${msg.room}-join`)

        msg = {
            type: 'SYSTEM',
            name: msg.name,
            message: `${msg.name} 님이 접속하였습니다.`,
            room: msg.room,
            id: socket.client.id,
        }
        
        socket.join(msg.room);
        io.to(msg.room).emit('chat-join', msg)
    })

    socket.on('chat-msg', (msg) => {
        console.log(`<${msg.room}>[${msg.time}]${msg.name} : ${msg.message}`)

        socket.join(msg.room);
        io.to(msg.room).emit('chat-upload', msg)
    })

    socket.on('chat-list', (data) => {
        socket.join(data.room);
        io.to(data.room).emit('chat-list', data.list)
    })

    socket.on('chat-leave', (msg) => {
        console.log(`${msg.name} ${msg.room}-leave`)

        msg = {
            type: 'SYSTEM',
            name: msg.name,
            message: `${msg.name} 님이 퇴장하였습니다.`,
            room: msg.room,
            id: socket.client.id,
        }

        socket.join(msg.room);
        io.to(msg.room).emit('chat-upload', msg)
    })

    socket.on('disconnect', () => {
        console.log(`${socket.client.id} disconnected`)

    })
})