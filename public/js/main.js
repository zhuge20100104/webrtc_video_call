import * as store from './store.js';
import * as wss from "./wss.js";
import * as constants from "./constants.js";
import * as webRTCHandler from "./webRTCHandler.js";
import * as ui from "./ui.js";
import * as recordingUtils from "./recordingUtils.js";
import * as strangerUtils from "./strangerUtils.js";


// Initialization of socketIO connection
const socket = io('/');
wss.registerSocketEvents(socket);

webRTCHandler.getLocalPreview();

// Register event for personal code copy button
const personalCodeCopyButton = document.getElementById('personal_code_copy_button');
personalCodeCopyButton.addEventListener('click', () => {
    const personalCode = store.getState().socketId;
    navigator.clipboard.writeText(personalCode);
});


// personal code chat button and personal code video button event listeners
const personalCodeChatButton = document.getElementById('personal_code_chat_button');
const personalCodeVideoButton = document.getElementById('personal_code_video_button');

personalCodeChatButton.addEventListener('click', () => {
    console.log('chat button clicked');
    const calleePersonalCode = document.getElementById('personal_code_input').value;
    const callType = constants.callType.CHAT_PERSONAL_CODE;
    webRTCHandler.sendPreOffer(callType, calleePersonalCode);
});

personalCodeVideoButton.addEventListener('click', () => {
    console.log('video button clicked');
    const calleePersonalCode = document.getElementById('personal_code_input').value;
    const callType = constants.callType.VIDEO_PERSONAL_CODE;
    webRTCHandler.sendPreOffer(callType, calleePersonalCode);
});


const micButton = document.getElementById('mic_button');
micButton.addEventListener("click", () => {
    const localStream = store.getState().localStream;
    const micEnabled = localStream.getAudioTracks()[0].enabled;
    localStream.getAudioTracks()[0].enabled = !micEnabled;
    ui.updateMicButton(micEnabled);
});

const cameraButton = document.getElementById('camera_button');
cameraButton.addEventListener("click", () => {
    const localStream = store.getState().localStream;
    const videoEnabled = localStream.getVideoTracks()[0].enabled;
    localStream.getVideoTracks()[0].enabled = !videoEnabled;
    ui.updateCameraButton(videoEnabled);
});

const switchForScreenSharingButton = document.getElementById('screen_sharing_button');

switchForScreenSharingButton.addEventListener('click', () => {
    const screenSharingActive = store.getState().screenSharingActive;
    webRTCHandler.switchBetweenCameraAndScreenSharing(screenSharingActive);
});

const newMessageInput = document.getElementById('new_message_input');
newMessageInput.addEventListener('keydown', (event) => {
    console.log('change occurred');
    const key = event.key;

    if(key === 'Enter') {
        webRTCHandler.sendMessageUsingDataChannel(event.target.value);
        // 自己发的在右边
        ui.appendMessage(event.target.value, true);
        newMessageInput.value = '';
    }
});

const sendMessageButton = document.getElementById('send_message_button');
sendMessageButton.addEventListener('click', () => {
    const message = newMessageInput.value;
    webRTCHandler.sendMessageUsingDataChannel(message);
    // 自己发的在右边
    ui.appendMessage(message, true);
    newMessageInput.value = '';
});


const startRecordingButton = document.getElementById('start_recording_button');
startRecordingButton.addEventListener('click', () => {
    recordingUtils.startRecording();
    ui.showRecordingPanel();
});

const stopRecordingButton = document.getElementById('stop_recording_button');
stopRecordingButton.addEventListener('click', () => {
    recordingUtils.stopRecording();
    ui.resetRecordingButtons();
});


const pauseRecordingButton = document.getElementById('pause_recording_button');
pauseRecordingButton.addEventListener('click', () => {
    recordingUtils.pauseRecording();
    ui.switchRecordingButtons(true);
});

const resumeRecordingButton = document.getElementById('resume_recording_button');
resumeRecordingButton.addEventListener('click', () => {
    recordingUtils.resumeRecording();
    ui.switchRecordingButtons(false);
});


// hangup functions
const hangupButton = document.getElementById('hangup_button');
hangupButton.addEventListener('click', () => {
    webRTCHandler.handleHangup();
});

const hangupChatButton = document.getElementById('finish_chat_call_button');
hangupChatButton.addEventListener('click', () => {
    webRTCHandler.handleHangup();
});

// strangers functions
const strangerChatButton = document.getElementById('stranger_chat_button');
strangerChatButton.addEventListener('click', () => {
    strangerUtils.getStrangerSocketIdAndConnect(constants.callType.CHAT_STRANGER);
});

const strangerVideoButton = document.getElementById('stranger_video_button');
strangerVideoButton.addEventListener('click', () => {
    strangerUtils.getStrangerSocketIdAndConnect(constants.callType.VIDEO_STRANGER);
});

const checkbox = document.getElementById('allow_strangers_checkbox');
checkbox.addEventListener('click', () => {
    const checkboxState = store.getState().allowConnectionsFromStrangers;
    ui.updateStrangerCheckbox(!checkboxState);
    store.setAllowConnectionsFromStrangers(!checkboxState);
    strangerUtils.changeStrangerConnectionStatus(!checkboxState);
});

