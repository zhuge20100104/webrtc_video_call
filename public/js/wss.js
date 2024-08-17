import * as ui from "./ui.js";
import * as store from "./store.js";
import * as webRTCHandler from "./webRTCHandler.js";
import * as constants from "./constants.js";
import * as strangerUtils from "./strangerUtils.js";


// 同一个目录下的两个服务，可以互相发现
// io('/') 里面不用写死成localhost:3000

// 6. 客户端和服务端的socket.id是一样的，每个客户端socket拥有唯一的id
// 7. 客户端和服务端的不同点，客户端只有一个socket，服务端在监听，可以有多个socket


let socketIO = null;

export const registerSocketEvents = (socket) => {
    socket.on('connect', () => {
        socketIO = socket;
        console.log('successfully connected to socket.io server');
        store.setSocketId(socket.id);
        ui.updatePersonalCode(socket.id);
    });

    socket.on('pre-offer', (data) => {
        webRTCHandler.handlePreOffer(data);
    });

    socket.on('pre-offer-answer', (data) => {
        webRTCHandler.handlePreOfferAnswer(data);
    });

    socket.on('webRTC-signaling', (data) => {
        switch(data.type) {
            case constants.webRTCSignaling.OFFER:
                webRTCHandler.handleWebRTCOffer(data);
                break;
            case constants.webRTCSignaling.ANSWER:
                webRTCHandler.handleWebRTCAnswer(data);
            case constants.webRTCSignaling.ICE_CANDIDATE:
                webRTCHandler.handleWebRTCCandidate(data);
            default:
                break;
        }
    });

    socket.on('user-hanged-up', () => {
        webRTCHandler.handleConnectedUserHangedUp();
    });

    socket.on('stranger-socket-id', (data) => {
        strangerUtils.connectWithStranger(data);
    });
};

export const sendPreOffer = (data) => {
    socketIO.emit('pre-offer', data);
};

export const sendPreOfferAnswer = (data) => {
    socketIO.emit('pre-offer-answer', data);
};


export const sendDataUsingWebRTCSignaling = (data) => {
    socketIO.emit('webRTC-signaling', data);
};

export const sendUserHangedUp = (data) => {
    socketIO.emit('user-hanged-up', data);
};

export const changeStrangerConnectionStatus = (data) => {
    socketIO.emit('stranger-connection-status', data);
};

export const getStrangerSocketId = () => {
    socketIO.emit('get-stranger-socket-id');
};