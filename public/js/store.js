import * as constants from './constants.js';

let state = {
    socketId: null,
    localStream: null,
    remoteStream: null,
    screenSharingStream: null,
    allowConnectionsFromStrangers: false,
    screenSharingActive: false,
    callState: constants.callState.CALL_AVAILABLE_ONLY_CHAT,
}

export const setSocketId = (socketId) => {
    // key和value一样可以简写, socketId: socketId
    state = {
        ...state,
        socketId
    };
    // 看下当前的state状态，socketId有没有被设置进state来
    console.log(state)
};

export const setLocalStream = (stream) => {
    state = {
        ...state,
        localStream: stream
    };
};

export const setAllowConnectionsFromStrangers = (allowConnection) => {
    state = {
        ...state,
        allowConnectionsFromStrangers: allowConnection
    };
};

export const setScreenSharingActive = (screenSharingActive) => {
    state = {
        ...state,
        screenSharingActive
    };
};

export const setScreenSharingStream = (stream) => {
    state = {
        ...state,
        screenSharingStream: stream
    };
};

export const setRemoteStream = (stream) => {
    state = {
        ...state,
        remoteStream: stream
    };
};

export const setCallState = (callState) => {
    state = {
        ...state,
        callState
    };
};


export const getState = () => {
    return state;
};

