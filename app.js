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

var playerList = [];
var roomPlayerList = [];

const findItem = (arr, item, type = false) => {
    var isState = arr !== '' &&
        arr.find((list, idx) => {
            if(type === 'id' & list.id === item.id) {
                arr.splice(idx, 1)
                return true;
            }
            else if(list.id === item.id) {
                if(type === 'on' || type === 'off' ) {
                    arr[idx].room = item.room
                    arr[idx].state = type
                }
                else if(type === 'sub') arr.splice(idx, 1)
                return true;
            }
        });
    return !isState;
}

io.on('connection', (socket) => {
    console.log(`${socket.client.id} connected`)
    
    socket.on('lobby-join', (msg) => {
        console.log(`${msg.name} ${msg.room}-join`)

        msg = {
            type: findItem(playerList, msg) ? 'JOIN' : 'NONE',
            name: msg.name,
            message: `${msg.name}님이 Lobby에 입장하였습니다.`,
            room: msg.room,
            id: socket.client.id,
        }

        socket.join(msg.room);
        io.to(msg.room).emit('chat-join', msg)
    })

    socket.on('room-join', (msg) => {
        console.log(`${msg.name} ${msg.room}-join`)

        msg = {
            type: 'ROOM-JOIN',
            name: msg.name,
            message: `${msg.name}님이 Room ` + msg.room
            + `에 입장하였습니다.`,
            room: msg.room,
            id: socket.client.id,
        }
        if(findItem(playerList, {...msg, id: socket.client.id})) {
            playerList.push({name: msg.name, room: msg.room, id: socket.client.id, state: 'off'})    
        // }
        // if(findItem(roomPlayerList, msg)) {
        //     findItem(playerList, msg, 'off')
        //     roomPlayerList.push({name: msg.name, room: msg.room, id: socket.client.id, state: 'on'})    
        
            socket.join(msg.room);
            io.to('lobby').emit('chat-upload', msg)
            io.to('lobby').emit('chat-list', playerList)
            io.to(msg.room).emit('chat-upload', msg)
        }
    })

    socket.on('chat-msg', (msg) => {
        console.log(`<${msg.room}>[${msg.time}]${msg.name} : ${msg.message}`)

        socket.join(msg.room);
        io.to(msg.room).emit('chat-upload', msg)
    })

    socket.on('chat-list', (data) => {
        if(findItem(playerList, {...data, id: socket.client.id})) {
            playerList.push({name: data.name, room: data.room, id: socket.client.id, state: 'on'})    
        }

        socket.join(data.room);
        io.to(data.room).emit('chat-list', playerList)
    })

    socket.on('lobby-leave', (msg) => {
        console.log(`${msg.name} ${msg.room}-leave`)

        msg = {
            type: 'LEAVE',
            name: msg.name,
            message: `${msg.name}님이 퇴장하였습니다.`,
            room: msg.room,
            id: socket.client.id,
        }

        socket.join(msg.room);
        io.to(msg.room).emit('chat-upload', msg)

        if(!findItem(playerList, msg, 'sub')) {
            io.to(msg.room).emit('chat-list', playerList)
        }
    })

    socket.on('room-leave', (msg) => {
        console.log(`${msg.name} ${msg.room}-leave`)

        // msg = {
        //     type: 'ROOM-LEAVE',
        //     name: msg.name,
        //     message: `${msg.name}님이 퇴장하였습니다.`,
        //     room: msg.room,
        //     id: socket.client.id,
        // }

        findItem(playerList, msg, 'on')
        findItem(roomPlayerList, msg, 'sub')

        socket.join(msg.room);
        io.to('lobby').emit('chat-list', playerList)
        // io.to(msg.room).emit('chat-upload', msg)
    })

    socket.on('disconnect', () => {
        var msg = {
            type: '',
            name: '',
            message: '',
            room: '',
            id: '',
        };
        playerList.find((list, idx) => {
            if(list.id === socket.client.id) {
                msg = {
                    type: 'LEAVE',
                    name: list.name,
                    message: `${list.name}님이 퇴장하였습니다.`,
                    room: list.room,
                    id: socket.client.id,
                }
                return true
            }
        })

        findItem(playerList, {id : socket.client.id}, 'id')
        findItem(roomPlayerList, {id : socket.client.id}, 'id')

        socket.join('lobby');
        io.to('lobby').emit('chat-list', playerList)
        io.to('lobby').emit('chat-upload', msg)
        io.to(msg.room).emit('chat-upload', msg)

        console.log(`${socket.client.id} disconnected`)
    })
})