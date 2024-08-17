const express = require('express');
const http = require('http');
const { connect } = require('http2');

// 本地的话，我们会在Localhost监听，Heroku的话，他会用Heroku给的一个端口
const PORT = process.env.PORT || 3000;

const app = express();
const server = http.createServer(app);
const io = require('socket.io')(server);

// app.use告诉服务器，让外面能访问这个public目录
app.use(express.static('public'));

// 客户端代码
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/public/index.html');
});

let connectedPeers = []
let connectedPeersStrangers = []

// 6. 有socket join或者socket移除的时候，打印一下当前的socket 列表
io.on('connection', (socket) => {
    connectedPeers.push(socket.id);
    console.log(connectedPeers);
    socket.on('pre-offer', (data) => {
        console.log('pre-offer came');
        console.log(data);

        const {callType, calleePersonalCode} = data;
        let connectedPeer = connectedPeers.find((peerSocketId) => {
            return peerSocketId === calleePersonalCode;
        });

        // 找到了callee的ID
        if(connectedPeer) {
            const data = {
                callerSocketId: socket.id,
                callType,
            };

            io.to(calleePersonalCode).emit('pre-offer', data);
        } else {
            const data = {
                preOfferAnswer: 'CALLEE_NOT_FOUND',
            };
            io.to(socket.id).emit('pre-offer-answer', data);
        }
    });

    socket.on('pre-offer-answer', (data) => {
        console.log('pre-offer-answer came');
        console.log(data);

        let {callerSocketId} = data;
        console.log("Caller socketid")
        console.log(callerSocketId);
        
        let connectedPeer = connectedPeers.find((peerSocketId) => {
            return peerSocketId === callerSocketId;
        });

        if(connectedPeer) {
            io.to(callerSocketId).emit('pre-offer-answer', data);
        }
    });

    socket.on('webRTC-signaling', (data) => {
        const {connectedUserSocketId} = data;
        const connectedPeer = connectedPeers.find((peerSocketId) => {
            return peerSocketId === connectedUserSocketId;
        });

        if(connectedPeer) {
            io.to(connectedUserSocketId).emit('webRTC-signaling', data);
        }
    });

    socket.on('user-hanged-up', (data) => {
        const {connectedUserSocketId} = data;
        const connectedPeer = connectedPeers.find((peerSocketId) => {
            return peerSocketId === connectedUserSocketId;
        });

        if(connectedPeer) {
            io.to(connectedUserSocketId).emit('user-hanged-up');
        }
    });

    socket.on('stranger-connection-status', (data) => {
        const {status} = data;
        if(status) {
            connectedPeersStrangers.push(socket.id);
        } else {
            const newConnectedPeersStrangers = connectedPeersStrangers.filter((peerSocketId) => {
                return peerSocketId !== socket.id;
            });

            connectedPeersStrangers = newConnectedPeersStrangers;
        }
        console.log(connectedPeersStrangers);
    });

    socket.on('get-stranger-socket-id', () => {
        let randomStrangerSocketId;
        // 不要当前对象，不想自己和自己通话
        const filteredConnectedPeersStrangers = connectedPeersStrangers.filter((peerSocketId) => {
            return peerSocketId !== socket.id;
        });

        if(filteredConnectedPeersStrangers.length > 0) {
            randomStrangerSocketId = filteredConnectedPeersStrangers[Math.floor(Math.random() * filteredConnectedPeersStrangers.length)];
        } else {
            randomStrangerSocketId = null;
        }

        const data = {
            randomStrangerSocketId,
        };

        io.to(socket.id).emit('stranger-socket-id', data);
    });

    socket.on('disconnect', () => {
        console.log('user disconnected');

        const newConnectedPeers = connectedPeers.filter((peerSocketId) => {
            return peerSocketId !== socket.id;
        });

        connectedPeers = newConnectedPeers;
        console.log(connectedPeers);

        const newConnectedPeersStrangers = connectedPeersStrangers.filter((peerSocketId) => {
            return peerSocketId !== socket.id;
        });

        connectedPeersStrangers = newConnectedPeersStrangers;
        console.log(connectedPeersStrangers);
    });
});


// TODO: comment these lines
// Test nodemon can work
// app.get('/hello', (req, res) => {
//     res.send('hello');
// });

// app.get('/hello-world', (req, res) => {
//     res.send('hello-world');
// });

server.listen(PORT, () => {
    console.log(`listening on ${PORT}`);
});





