import { useEffect, useRef, useState } from 'react'
import './App.css'
import { setupWebSocket, initializePeerConnection } from './utils/webrtcUtils';
import { useSetUpAudioMic } from './utils/userControls';
import { UserControls } from './components/userControls';
import { MessageChannelGroup, VoiceChannelGroup } from './components/messageChannels';
import { usePfpUrls } from './utils/usePfpUrls';
import { useSetUpWebrtc } from './utils/webRtcInitilization';

const channelInfo = [
  {
    name: "General Chat 1",
    id: 1
  },
  {
    name: "Gaming chat",
    id: 2
  },
  {
    name: "Random chat",
    id: 3
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

export function WebrtcChat({ userInfo }) {
  const [currentChat, setCurrentChat] = useState("General Chat 1")
  const [currentVoiceChat, setVoiceChat] = useState(null)

  const imageUrls = usePfpUrls()
  const [audioContextRef, microphoneStreamRef, gainRef, [setCurrentMic, currentMic, microphoneDevices]] = useSetUpAudioMic()
  const [remoteStream] = useSetUpWebrtc(voiceChannelInfo.find(channel => channel.name === currentVoiceChat)?.id, userInfo, audioContextRef, microphoneStreamRef)

  return (
    <>
      <div className='w-screen h-screen flex flex-row'>
        {/* sidebar */}
        <div className='h-full w-96 ' aria-hidden="true"></div>
        <div className='fixed h-full w-96 bg-[#F4F6F7] flex flex-col'>
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
        <div className='flex flex-col justify-between grow '>
          {/* the actual chat log */}
          <div className='flex flex-col '>
            {/* chat lable */}
            <div>
              <div className='mt-4 mb-2 mx-6 flex flex-row items-center gap-3 select-none'>
                <span className="material-symbols-outlined" style={{ color: "#7AB8C7", fontSize: 28 }}>chat</span>
                <p className='text-[16px] pt-[1px]'>{currentChat}</p>
              </div>
              <div className='w-full h-[1px] mt-[14px] bg-[#E5E5E5]'></div>
            </div>
          </div>
          {/* chat text box */}
          <div className='fixed bottom-0 left-96 right-0 pb-4 px-3'>
            <textarea
              placeholder='Message #general_chat_1'
              className='w-full bg-[#E7EFF0] border border-[#c7c7c7] shadow-md rounded-lg resize-none overflow-hidden p-4 placeholder:mb-1'
              rows={1}
              maxLength={700}
              onInput={(e) => {
                e.target.style.height = 'auto';
                e.target.style.height = `${e.target.scrollHeight}px`;
              }}
              style={{ minHeight: '56px' }}
            />
          </div>
        </div>
      </div>
    </>
  )
}

