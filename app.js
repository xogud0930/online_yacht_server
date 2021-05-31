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

    socket.on('room-join', (data) => {
        socket.join()
    })

    socket.on('chat-msg', (msg) => {
        console.log(`[${msg.time}]${msg.name} : ${msg.message}`)

        io.emit('chat-upload', msg)
    })

    socket.on('disconnect', () => {
        console.log(`${socket.client.id} disconnected`)
    })
})