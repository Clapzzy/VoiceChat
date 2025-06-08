import { useEffect, useRef, useState } from 'react'
import './App.css'
import { setupWebSocket, initializePeerConnection } from './utils/webrtcUtils';
import { useSetUpAudioMic } from './utils/userControls';
import { UserControls } from './components/userControls';
import { MessageChannelGroup, VoiceChannelGroup } from './components/messageChannels';
import { usePfpUrls } from './utils/usePfpUrls';
import { useSetUpWebrtc } from './utils/webRtcInitilization';
import { useUpdateSocket } from './utils/useUpdateSocket';
import { TextChat } from './components/chat';

const channelInfo = [
  {
    name: "General Chat 1",
    id: "hello"
  },
  {
    name: "Gaming chat",
    id: "hello2"
  },
  {
    name: "Random chat",
    id: "hello3"
  }
]

const voiceChannelInfo = [
  {
    name: "Voice Chat 1",
    id: "voice1",
    icon: "call"
  },
  {
    name: "Gaming voice",
    id: "voice2",
    icon: "home_speaker"
  },
  {
    name: "Neshto drugo",
    id: "voice3",
    icon: "mobile_speaker"
  },
]

const chatIds = channelInfo.map(value => value.id)
const voiceChatIds = voiceChannelInfo.map(value => value.id)

export function WebrtcChat({ userInfo }) {
  const [currentChat, setCurrentChat] = useState("General Chat 1")
  const [currentVoiceChat, setVoiceChat] = useState(null)

  const imageUrls = usePfpUrls()
  const [audioContextRef, microphoneStreamRef, gainRef, [setCurrentMic, currentMic, microphoneDevices]] = useSetUpAudioMic()
  const [remoteStream] = useSetUpWebrtc(voiceChannelInfo.find(value => value.name === currentVoiceChat)?.id, userInfo, audioContextRef, microphoneStreamRef)
  const [chatMessages, voiceParticipants, sendMessage] = useUpdateSocket(chatIds, voiceChatIds, userInfo)
  //TODO: add sounds


  return (
    <>
      <div className='w-screen h-screen flex flex-row '>
        {/* sidebar */}
        <div className='h-full w-96  min-w-96' aria-hidden="true"></div>
        <div className='fixed left-0 top-0 h-full w-full sm:w-96 min-w-96 bg-[#F4F6F7] flex flex-col'>
          <div className='mt-3 mb-2 mx-6 flex flex-row items-center gap-3 select-none'>
            <span className="material-symbols-outlined" style={{ color: "#7AB8C7", fontSize: 38 }}>adaptive_audio_mic</span>
            <p className='text-xl pb-1'>QuickChat</p>
          </div>
          <div className='w-full h-[1px] bg-[#E5E5E5]'></div>
          <div className='px-4 py-2 flex flex-col justify-between grow basis-auto '>
            <div>
              {/* Message channels */}
              <MessageChannelGroup
                currentChannel={currentChat}
                setCurrentChannel={setCurrentChat}
                channelInfo={channelInfo}
              />
              {/* Voice channels */}

              <VoiceChannelGroup
                remoteStream={remoteStream}
                voiceParticipants={voiceParticipants}
                imageUrls={imageUrls}
                userInfo={userInfo}
                setCurrentVoice={setVoiceChat}
                currentVoice={currentVoiceChat}
                voiceChannelInfo={voiceChannelInfo}
              />
            </div>
            {/* User Controls */}
            <UserControls
              setVoiceChat={setVoiceChat}
              currentVoiceChat={currentVoiceChat}
              username={userInfo.username}
              profilePictureUrl={imageUrls[userInfo.pfpNum]}
              gainNodeRef={gainRef}
              audioContextRef={audioContextRef}
              microphoneDevices={microphoneDevices}
              currentMic={currentMic}
              setCurrentMic={setCurrentMic}
            />
          </div>
        </div>
        {/* chat function */}
        <TextChat
          imageUrls={imageUrls}
          channelInfo={channelInfo}
          currentChat={currentChat}
          chatMessages={chatMessages}
          sendMessage={sendMessage}
        />

      </div>
    </>
  )
}

