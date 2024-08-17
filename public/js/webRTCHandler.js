import * as wss from "./wss.js";
import * as constants from "./constants.js";
import * as ui from "./ui.js";
import * as store from "./store.js";


let connectedUserDetails;

let peerConnection;

let dataChannel;

const defaultConstraints = {
    audio: true,
    video: true
};

export const getLocalPreview = () => {
    navigator.mediaDevices
    .getUserMedia(defaultConstraints)
    .then((stream) => {
        ui.updateLocalVideo(stream);
        ui.showVideoCallButtons();
        store.setCallState(constants.callState.CALL_AVAILABLE);   
        store.setLocalStream(stream);
    })
    .catch((err) => {
        console.log("error occurred when trying to get an access to camera");
        console.log(err);
    });
};


export const sendPreOffer = (callType, calleePersonalCode) => {
    connectedUserDetails = {
        callType,
        socketId: calleePersonalCode
    }

    if(callType === constants.callType.CHAT_PERSONAL_CODE || callType === constants.callType.VIDEO_PERSONAL_CODE) {
        const data = {
            callType,
            calleePersonalCode
        }
        
        ui.showCallingDialog(callingDialogRejectCallHandler);
        // sendPreOffer 说明Caller开始打电话了，不能再打了
        store.setCallState(constants.callState.CALL_UNAVAILABLE);
        wss.sendPreOffer(data);    
    }

    if(callType === constants.callType.CHAT_STRANGER || callType === constants.callType.VIDEO_STRANGER) {
        const data = {
            callType,
            calleePersonalCode,
        }

        store.setCallState(constants.callState.CALL_UNAVAILABLE);
        wss.sendPreOffer(data);
    }
  
}


// Callee handlePreOffer的时候，看下自己能不能打电话
export const handlePreOffer = (data) => {
    const {callType, callerSocketId} = data;

    if(!checkCallPossibility(callType)) {
        return sendPreOfferAnswer(constants.preOfferAnswer.CALL_UNAVAILABLE, callerSocketId)
    }

    // 当callee Handle了pre-offer之后，就是接通之后，他也是CALL_UNAVAILABLE状态
    store.setCallState(constants.callState.CALL_UNAVAILABLE);

    connectedUserDetails = {
        socketId: callerSocketId,
        callType
    };

    if(callType === constants.callType.CHAT_PERSONAL_CODE || callType === constants.callType.VIDEO_PERSONAL_CODE) {
        ui.showIncomingCallDialog(callType, acceptCallHandler, rejectCallHandler);
    }

    if(callType === constants.callType.CHAT_STRANGER || callType === constants.callType.VIDEO_STRANGER) {
        createPeerConnection();
        sendPreOfferAnswer(constants.preOfferAnswer.CALL_ACCEPTED);
        ui.showCallElements(connectedUserDetails.callType);
    }

}

export const handlePreOfferAnswer = (data) => {
    const {preOfferAnswer} = data;
    console.log("pre offer answer came client==");
    console.log(data);

    // Caller接收到handlePreOfferAnswer之后，需要移除掉dialogs
    ui.removeAllDialogs();

    if(preOfferAnswer === constants.preOfferAnswer.CALLEE_NOT_FOUND) {
        ui.showInfoDialog(preOfferAnswer);
        //  caller这边，handlePreOfferAnswer, CALLEE_NOT_FOUND之后，就可以接通下一通电话
        setIncomingCallAvailable();
    }

    if(preOfferAnswer === constants.preOfferAnswer.CALL_UNAVAILABLE) {
        ui.showInfoDialog(preOfferAnswer);
        // 对方UNAVAILABLE之后，我们也可以接通下一通电话，还可以给别人打
        setIncomingCallAvailable();
    }
    
    if(preOfferAnswer === constants.preOfferAnswer.CALL_REJECTED) {
        // 被别人reject掉之后，也可以接着给别的人打
        store.setCallState(constants.callState.CALL_AVAILABLE);
        setIncomingCallAvailable();
    }

    if(preOfferAnswer === constants.preOfferAnswer.CALL_ACCEPTED) {
        ui.showCallElements(connectedUserDetails.callType);
        // Caller的call被对方accept之后，需要创建PeerConnection
        createPeerConnection();
        // Caller的Call被accepted之后，我们就sendWebRTCOffer
        // TODO: send得有数据
        sendWebRTCOffer();
    }

}


export const handleWebRTCOffer = async (data) => {
    console.log('webRTC Offer came');
    console.log(data);

    await peerConnection.setRemoteDescription(data.offer);
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);
    wss.sendDataUsingWebRTCSignaling({
        connectedUserSocketId: connectedUserDetails.socketId,
        type: constants.webRTCSignaling.ANSWER,
        answer: answer,
    });
};

export const handleWebRTCAnswer = async (data) => {
    await peerConnection.setRemoteDescription(data.answer);
};

export const handleWebRTCCandidate = async (data) => {
    try {
        await peerConnection.addIceCandidate(data.candidate);
    } catch(err) {
        console.log('error occured when trying to add received ice candidate', err);
    }
};


export const switchBetweenCameraAndScreenSharing = async (screenSharingActive) => {
    if(screenSharingActive) {
        // 当前正在screensharing, 切换回LocalStream
        const localStream = store.getState().localStream;
        const senders = peerConnection.getSenders();

        const sender = senders.find((sender) => {
            return sender.track.kind === localStream.getVideoTracks()[0].kind
        });

        if(sender) {
            sender.replaceTrack(localStream.getVideoTracks()[0]);
        }

        // 以避免浏览器出现Stop Sharing字样
        // 现在ScreenSharing之后, goback to camera Stream， 那个消息没有了
        // Stop screen sharing stream
        store.getState()
            .screenSharingStream.getTracks()
            .forEach((track) => track.stop());

        store.setScreenSharingActive(!screenSharingActive);

        ui.updateLocalVideo(localStream);
    } else {
        try {
            // 开始做screenSharing
            const screenSharingStream = await navigator.mediaDevices.getDisplayMedia({
                video: true,
            });
            store.setScreenSharingStream(screenSharingStream);

            // replace track which sender is sending
            const senders = peerConnection.getSenders();
            const sender = senders.find((sender) => {
                return sender.track.kind === screenSharingStream.getVideoTracks()[0].kind;
            });

            if(sender) {
                sender.replaceTrack(screenSharingStream.getVideoTracks()[0]);
            }

            store.setScreenSharingActive(!screenSharingActive);
            ui.updateLocalVideo(screenSharingStream);

        } catch(err) {
            console.log('error occurred when trying to get screen sharing stream', err);
        }
    }
};

export const sendMessageUsingDataChannel = (message) => {
    const stringifiedMessage = JSON.stringify(message);
    dataChannel.send(stringifiedMessage);
};


export const handleHangup = () => {
    console.log('hanging up the call');
    const data = {
        connectedUserSocketId: connectedUserDetails.socketId,
    }
    wss.sendUserHangedUp(data);
    closePeerConnectionAndResetState();
};

export const handleConnectedUserHangedUp = () => {
    console.log('connected peer hanged up');
    closePeerConnectionAndResetState();
};

const closePeerConnectionAndResetState = () => {
    if(peerConnection) {
        peerConnection.close();
        peerConnection = null;
    }

    if(connectedUserDetails.callType === constants.callType.VIDEO_PERSONAL_CODE || connectedUserDetails.callType === constants.callType.VIDEO_STRANGER) {
        store.getState().localStream.getVideoTracks()[0].enabled = true;
        store.getState().localStream.getAudioTracks()[0].enabled = true;
    }

    ui.updateUIAfterHangUp(connectedUserDetails.callType);
    // 9. 通话结束以后，也要重新设置setIncommingCallsAvailable
    setIncomingCallAvailable();
    connectedUserDetails = null;
};

const configuration = {
    iceServers: [
        {
            urls: "stun:stun.l.google.com:19302"
        }
    ]
} 

const createPeerConnection = () => {
    peerConnection = new RTCPeerConnection(configuration);

    dataChannel = peerConnection.createDataChannel("chat");

    peerConnection.ondatachannel = (event) => {
        const dataChannel = event.channel;
        dataChannel.onopen = () => {
            console.log('Peer connection is ready to receive data channel messages');
        };

        dataChannel.onmessage = (event) => {
            console.log('message came from data channel');
            const message = JSON.parse(event.data);
            ui.appendMessage(message, false);
        };
    };

    peerConnection.onicecandidate = (event) => {
        console.log('getting ice candidates from stun server');
        if(event.candidate) {
            // Send out ice candidates to other peer
            wss.sendDataUsingWebRTCSignaling({
                connectedUserSocketId: connectedUserDetails.socketId,
                type: constants.webRTCSignaling.ICE_CANDIDATE,
                candidate: event.candidate,
            })
        }
    };

    peerConnection.onconnectionstatechange = (event) => {
        if(peerConnection.connectionState === 'connected') {
            console.log('successfully connected with other peer');
        }
    };

    // 接收对方发过来的track
    const remoteStream = new MediaStream();
    store.setRemoteStream(remoteStream);
    ui.updateRemoteVideo(remoteStream);

    // 接收到远端流的响应函数
    peerConnection.ontrack = (event) => {
        remoteStream.addTrack(event.track);
    };

    // 把我们的localStream加到track里面去，发送给对方
    if(connectedUserDetails.callType === constants.callType.VIDEO_PERSONAL_CODE ||
        connectedUserDetails.callType === constants.callType.VIDEO_STRANGER
    ) {
        const localStream = store.getState().localStream;
        for(const track of localStream.getTracks()) {
            peerConnection.addTrack(track, localStream);
        }
    }

};



const sendWebRTCOffer = async () => {
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);    
    wss.sendDataUsingWebRTCSignaling({
        connectedUserSocketId: connectedUserDetails.socketId,
        type: constants.webRTCSignaling.OFFER,
        offer: offer,
    })
};

const acceptCallHandler = () => {
    console.log("call accepted");
    sendPreOfferAnswer(constants.preOfferAnswer.CALL_ACCEPTED);
    ui.showCallElements(connectedUserDetails.callType);
    // Callee accepted 之后，也需要创建PeerConnection
    createPeerConnection();
};

const rejectCallHandler = () => {
    console.log("call rejected");
    sendPreOfferAnswer(constants.preOfferAnswer.CALL_REJECTED);
    setIncomingCallAvailable();
};

const sendPreOfferAnswer = (preOfferAnswer, socketId=null) => {
    const callerSocketId = socketId ? socketId : connectedUserDetails.socketId;
    const data = {
        callerSocketId: callerSocketId,
        preOfferAnswer
    }
    // Callee send preoffer-answer之前，需要removeAllDialogs()
    ui.removeAllDialogs();
    wss.sendPreOfferAnswer(data);
};

// Caller这边拨出去之后，自己reject
const callingDialogRejectCallHandler = () => {
    console.log("rejecting the call");
    const data = {
        connectedUserSocketId: connectedUserDetails.socketId,
    };

    closePeerConnectionAndResetState();
    wss.sendUserHangedUp(data);
};

const checkCallPossibility = (callType) => {
    const callState = store.getState().callState;
    if(callState === constants.callState.CALL_AVAILABLE) {
        return true;
    }

    // 想打视频电话，但是没拿到local视频流
    if((callType === constants.callType.VIDEO_PERSONAL_CODE || callType === constants.callType.VIDEO_STRANGER) && callState === constants.callState.CALL_AVAILABLE_ONLY_CHAT) {
        return false;
    }

    return false;
};


const setIncomingCallAvailable = () => {
    const localStream = store.getState().localStream;
    if(localStream) {
        store.setCallState(constants.callState.CALL_AVAILABLE);
    }
};