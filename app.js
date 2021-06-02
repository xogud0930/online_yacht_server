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
var roomList = [];

const findItem = (arr, item, type = false, num) => {
    console.log('type:', type)
    var isState = arr !== '' &&
        arr.find((list, idx) => {
            if(type === 'room') {
                    console.log('id:',list.id,item.id)
                    console.log('room:',list.room, num)
                    if(list.room === item.room && list.id === item.id ) {
                        return true;
                    }
            } else if(list.id === item.id) {
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


const countItem = (arr, num) => {
    if(arr) {
        var count = arr.reduce((acc, cur, i) => {
            return cur.room === num ? acc + 1 : acc
        }, 0)
    }

    return count ? count : 0;
}

io.on('connection', (socket) => {
    console.log(`${socket.client.id} connected`)
    
    socket.on('lobby-join', (msg) => {
        console.log(`${msg.name} ${msg.room}-lobbyjoin`)

        msg = {
            type: findItem(playerList, msg) ? 'JOIN' : 'NONE',
            name: msg.name,
            message: `${msg.name}님이 Lobby에 입장하였습니다.`,
            room: msg.room,
            id: socket.client.id,
        }

        socket.join('lobby');
        io.to('lobby').emit('player-join', msg)
        io.to('lobby').emit('room-list', roomList)
    })

    socket.on('room-join', (msg) => {
        console.log(`${msg.name} ${msg.room}-roomjoin`)

        msg = {
            type: 'ROOM-JOIN',
            name: msg.name,
            message: `${msg.name}님이 Room ` + (Number(msg.room) + 1)
            + `에 입장하였습니다.`,
            room: msg.room,
            id: socket.client.id,
        }

        if(findItem(playerList, {...msg, id: socket.client.id})) {
            console.log('Msgroom', msg.room)
            playerList.push({name: msg.name, room: msg.room, id: socket.client.id, state: 'off'})

            if(roomList[msg.room]) {
                roomList[msg.room].player = roomList[msg.room].player < 8 ? countItem(playerList, msg.room) : 8;
            }

            socket.join('lobby');
            io.to('lobby').emit('player-list', playerList)
            io.to('lobby').emit('room-list', roomList)
            socket.join(msg.room);
            io.to(msg.room).emit('chat-upload', msg)
            io.to(msg.room).emit('player-list', playerList)
            io.to(msg.room).emit('room-list', roomList)
        }
    })

    socket.on('chat-msg', (msg) => {
        console.log(`<${msg.room}>[${msg.time}]${msg.name} : ${msg.message}`)

        socket.join(msg.room);
        io.to(msg.room).emit('chat-upload', msg)
    })

    socket.on('player-list', (data) => {
        if(findItem(playerList, {...data, id: socket.client.id})) {
            playerList.push({name: data.name, room: data.room, id: socket.client.id, state: 'on'})    
        }

        socket.join(data.room);
        io.to(data.room).emit('player-list', playerList)
    })

    socket.on('room-add', () => {
        console.log('room-add')

        var roomId = roomList.reduce((arr, cur, idx) => {
            if(cur.id !== idx) return arr ? arr : idx
            return arr
        }, 0)
        if(!roomId) roomId = roomList.length
        console.log('roomId',roomId)
        roomList.splice(roomId,0,{id: roomId, player: 0, state: 'on'})
        
        socket.join('lobby');
        io.to('lobby').emit('room-list', roomList)
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
            io.to(msg.room).emit('player-list', playerList)
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
        if(roomList[msg.room]) {
            var roomId = roomList.reduce((arr, cur, idx) => {
                if(cur.id === msg.room) return idx
                return arr
            }, msg.room)

            roomList[roomId].player = roomList[roomId].player > 1 ? roomList[roomId].player - 1 : roomList.splice(roomId,1);
        }

        socket.join(msg.room);
        io.to('lobby').emit('player-list', playerList)
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


        findItem(playerList, {id : socket.client.id}, 'sub')

        socket.join('lobby');
        io.to('lobby').emit('player-list', playerList)
        io.to('lobby').emit('chat-upload', msg)
        io.to(msg.room).emit('chat-upload', msg)

        console.log(`${socket.client.id} disconnected`)
    })
})