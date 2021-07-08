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

const mySql = require('./src/dbConfig')

try {
    const data = mySql.query('DELETE FROM player_list')
    console.log('MySql connected...');
} catch (err) {
    throw err
}

// app.use('/public', express.static('./public'))
// app.get('/', (req, res) => {
//     res.redirect(302, '/public')
// })

app.get('/', (req, res) => {
    res.send('main');
});

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
    
    socket.on('name-check', async (name) => {
        try {
            const [result] = await mySql.query('SELECT * FROM player_list WHERE name = ?', name)
            if(result.length) name = false
            
            socket.emit('name-check', name)
        } catch (err) {
            console.log(err)
        }
    })

    socket.on('lobby-join', async (data) => {
        console.log(`${data.name} ${data.room}-lobbyjoin`)

        try {
            var sql = `INSERT INTO player_list (id, socket_id)
                SELECT (SELECT IFNULL(MAX(id) + 1, 0) FROM player_list $), ?
                FROM DUAL
                WHERE NOT EXISTS (SELECT * FROM player_list WHERE socket_id = ?)`;
            var param = [ socket.client.id, socket.client.id ]
            const [connection] = await mySql.query(sql, param)
        } catch (err) {
            console.log(err)
        }

        try {
            var sql = `UPDATE player_list SET name = ?, room = ?, state = ?  WHERE socket_id = ?`
            var param = [ data.name, data.room, "on", socket.client.id ]
            const [result] = await mySql.query(sql, param)

            socket.join('lobby');
            if(result.affectedRows) {
                msg = {
                    type: 'JOIN',
                    name: data.name,
                    message: `${data.name}님이 Lobby에 입장하였습니다.`,
                    room: data.room,
                    id: socket.client.id,
                }
                io.to('lobby').emit('chat-upload', msg)
            }

            const [list] = await mySql.query(`SELECT * FROM player_list WHERE NOT NAME = ''`)
            playerList = [...list]

            io.to('lobby').emit('player-list', playerList)
            io.to('lobby').emit('room-list', roomList)
        } catch (err) {
            console.log(err)
        }

        
        
        
    })

    socket.on('room-join', async (data) => {
        console.log(`${data.name} ${data.room}-roomjoin`)

        try {
            var sql = `UPDATE player_list SET name = ?, room = ?, state = ?  WHERE socket_id = ?`
            var param = [ data.name, data.room, "off", socket.client.id ]
            const [result] = await mySql.query(sql, param)

            console.log(result.insertId)
            if(result.affectedRows) {
                msg = {
                    type: 'ROOM-JOIN',
                    name: data.name,
                    message: `${data.name}님이 Room ` + (Number(data.room) + 1)
                    + `에 입장하였습니다.`,
                    room: data.room,
                    id: socket.client.id,
                }

                const [list] = await mySql.query(`SELECT * FROM player_list WHERE NOT NAME = ''`)
                playerList = [...list]

                sql = `UPDATE room_list
                SET player = (SELECT * FROM(SELECT player FROM room_list a WHERE id = ${data.room}) AS b)+1, player_${roomList[data.room] ? roomList[data.room].player : 0} = '${data.name}'
                WHERE id = 0;`  
                const [room] = await mySql.query(sql)

                sql = `SELECT * FROM room_list WHERE NOT state IS NULL;`
                const [_roomlist] = await mySql.query(sql)
                roomList = [..._roomlist]

                socket.join('lobby');
                io.to('lobby').emit('player-list', playerList)
                io.to('lobby').emit('room-list', roomList)
                socket.join(data.room);
                io.to(data.room).emit('chat-upload', msg)
                io.to(data.room).emit('player-list', playerList)
                io.to(data.room).emit('room-list', roomList)
            }
        } catch (err) {
            console.log(err)
        }
    })

    socket.on('chat-msg', (msg) => {
        console.log(`<${msg.room}>[${msg.time}]${msg.name} : ${msg.message}`)

        socket.join(msg.room);
        io.to(msg.room).emit('chat-upload', msg)
    })

    socket.on('room-add', async () => {
        console.log('room-add')

        try {
            var sql = `UPDATE room_list SET state = 'on' WHERE state IS NULL LIMIT 1`
            const [result] = await mySql.query(sql)

            if(!result.affectedRows) {
                sql = `INSERT INTO room_list (id, player, state )
                    VALUES ( (SELECT IFNULL(MAX(id) + 1, 0) FROM room_list $), 0, 'on' )`
                const [insert] = await mySql.query(sql)
            }
        } catch (err) {
            console.log(err)
        }

        try {
            const [list] = await mySql.query(`SELECT * FROM room_list WHERE NOT state IS NULL`)
            roomList = [...list]
        } catch {
            console.log(err)
        }

        socket.join('lobby');
        io.to('lobby').emit('room-list', roomList)
    })

    socket.on('lobby-leave', async (msg) => {
        console.log(`${msg.name} ${msg.room}-leave`)

        msg = {
            type: 'LEAVE',
            name: msg.name,
            message: `${msg.name}님이 퇴장하였습니다.`,
            room: msg.room,
            id: socket.client.id,
        }

        try {
            const [result] = await mySql.query(`DELETE FROM player_list WHERE socket_id = ?`, socket.client.id)
            if(result.affectedRows) {
                const [list] = await mySql.query(`SELECT * FROM player_list`)
                playerList = [...list]
            }
        } catch (err) {
            console.log(err)
        }

        socket.join('lobby');
        io.to('lobby').emit('player-list', playerList)
        io.to('lobby').emit('chat-upload', msg)
    })

    socket.on('room-leave', async (data) => {
        console.log(`${data.name} ${data.room}-leave`)

        try {
            var sql = `UPDATE player_list SET name = ?, room = ?, state = ?  WHERE socket_id = ?`
            var param = [ data.name, data.room, "on", socket.client.id ]
            const [result] = await mySql.query(sql, param)

            console.log(result.insertId)
            if(result.affectedRows) {
                msg = {
                    type: 'ROOM-LEAVE',
                    name: msg.name,
                    message: `${msg.name}님이 퇴장하였습니다.`,
                    room: msg.room,
                    id: socket.client.id,
                }

                const [list] = await mySql.query(`SELECT * FROM player_list WHERE NOT NAME = ''`)
                playerList = [...list]

                if(roomList[data.room]) {
                    var roomId = roomList.reduce((arr, cur, idx) => {
                        if(cur.id === data.room) return idx
                        return arr
                    }, data.room)
        
                    roomList[roomId].player = roomList[roomId].player > 1 ? roomList[roomId].player - 1 : roomList.splice(roomId,1);
                }

                socket.join(data.room);
                io.to(data.room).emit('chat-upload', data)
                socket.join('lobby');
                io.to('lobby').emit('player-list', playerList)
            }
        } catch (err) {
            console.log(err)
        }
    })

    socket.on('disconnect', async () => {
        var msg = {
            type: '',
            name: '',
            message: '',
            room: '',
            id: '',
        };

        try {
            const [find] = await mySql.query(`SELECT * FROM player_list WHERE socket_id = ?`, socket.client.id)
            if(find.affectedRows) {
                msg = {
                    type: 'LEAVE', 
                    name: find[0].name,
                    message: `${find[0]}님이 퇴장하였습니다.`,
                    room: find[0].room,
                    id: socket.client.id,
                }
            }

            const [result] = await mySql.query(`DELETE FROM player_list WHERE socket_id = ?`, socket.client.id)
            if(result.affectedRows) {
                const [list] = await mySql.query(`SELECT * FROM player_list`)
                playerList = [...list]
            }
        } catch (err) {
            console.log(err)
        }

        socket.join('lobby');
        io.to('lobby').emit('player-list', playerList)
        io.to('lobby').emit('chat-upload', msg)
        io.to(msg.room).emit('chat-upload', msg)

        console.log(`${socket.client.id} disconnected`)
    })
})