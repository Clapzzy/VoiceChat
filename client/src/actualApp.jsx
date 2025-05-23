import { useEffect, useRef, useState } from 'react'
import './App.css'
import { setupWebSocket, initializePeerConnection } from './utils/webrtcUtils';
import { useSetUpAudioMic } from './utils/userControls';
import { UserControls } from './components/userControls';


function VolumeSlider({ gainRef }) {
  if (!gainRef.current) {
    return
  }
  const [voiceChatVolume, setVoiceChatVolume] = useState(1)
  useEffect(() => {
    gainRef.current.gain.value = voiceChatVolume
  }, [voiceChatVolume])
  return (
    <>
      {gainRef.current && (
        <input
          className="w-full bg-[#98C1D9] text rounded-md h-4"
          type='range'
          defaultValue="1"
          step="0.01"

          value={voiceChatVolume}
          onChange={(e) => setVoiceChatVolume(parseFloat(e.target.value))}
        />
      )}
    </>

  )
}

export function WebrtcChat({ userInfo }) {
  const [currentChatSelected, setCurrentChat] = useState(null)
  const [currentVoiceSelected, setVoiceSelected] = useState(null)

  const [audioContextRef, microphoneStreamRef, gainRef, [setCurrentMic, microphoneDevices]] = useSetUpAudioMic()

  return (
    <>
      <div className='w-screen h-screen flex flex-row'>
        {/* sidebar */}
        <div className='h-full w-80 ' aria-hidden="true"></div>
        <div className='fixed h-full w-80 bg-[#F4F6F7] flex flex-col'>
          <div className='mt-3 mb-2 mx-6 flex flex-row items-center gap-3'>
            <span className="material-symbols-outlined" style={{ color: "#7AB8C7", fontSize: 38 }}>adaptive_audio_mic</span>
            <p className='text-xl pb-1'>QuickChat</p>
          </div>
          <div className='w-full h-[1px] bg-[#E5E5E5]'></div>
          <div className='px-4 py-2 flex flex-col justify-between grow basis-auto '>
            <div>
              {/* Message channels */}
              <div className=' w-full flex flex-col gap-3'>
                <p className=' text-[15]'>Text Channels</p>
                <div className='px-2 flex flex-col gap-2' >
                </div>
                <div className='w-full h-[1px] bg-[#C7C7C7]' />
              </div>
              {/* Voice channels */}
              <div className=' w-full flex flex-col gap-3 mt-3'>
                <p className=' text-[15]'>Voice Channels</p>
                <div className='px-2 flex flex-col gap-2' >
                  {/* voice chat channel singular */}
                  <div className='flex flex-col'>
                    <div className='bg-[#dee8ea] w-full h-8 flex flex-row rounded-md items-center justify-between gap-2 px-3'>
                      <div className='flex flex-row items-center gap-2'>
                        <span className="material-symbols-rounded" style={{ color: "#7AB8C7", fontSize: 22 }}>chat</span>
                        <p className='text-[16px] mb-1'>Voice Chat I</p>
                      </div>
                      <div className='bg-[#284B62] rounded-full px-1'>
                        <p className='text-[12px] text-white'>2/5</p>
                      </div>
                    </div>
                    {/* voice chat participants */}
                    <div className='gap-2 pl-3 my-2'>
                      <div className='flex flex-row gap-2 items-center'>
                        <img
                          src='./assets/pfp 1.png'
                          alt='profile picture'
                          className='w-[24px] h-[24px]'
                        />
                        <p className='text-[16px]'>!Clapzzy █▬█</p>
                      </div>
                    </div>

                  </div>
                </div>
              </div>
            </div>
            {/* User Controls */}
            <UserControls profilePictureUrl={"./assets/pfp 1.png"} gainNodeRef={gainRef} audioContextRef={audioContextRef} />
          </div>
        </div>
        {/* chat function */}
        <div className='flex flex-col justify-between grow '>
          {/* the actual chat log */}
          <div className='flex flex-col '>
            {/* chat lable */}
            <div>
              <div className='mt-4 mb-2 mx-6 flex flex-row items-center gap-3'>
                <span className="material-symbols-outlined" style={{ color: "#7AB8C7", fontSize: 28 }}>event</span>
                <p className='text-[16px] pt-[1px]'>General Chat</p>
              </div>
              <div className='w-full h-[1px] mt-[14px] bg-[#E5E5E5]'></div>
            </div>
          </div>
          {/* chat text box */}
          <div className='fixed bottom-0 left-80 right-0 pb-3 px-3'>
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

