import { useEffect, useRef, useState } from 'react'
import './App.css'
import { setupWebSocket, initializePeerConnection } from './utils/webrtcUtils';

const roomId = 1;
const wsUrl = "http://martinkurtev.com:8080/ws"

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
  const [currentChatSelected, setCurrentChat] = useState()
  const [mute, setMute] = useState(true)

  const audioContextRef = useRef()

  const gainRef = useRef()

  const webSocketRoom = useRef()
  const isInitilizing = useRef(false)
  const userId = useRef()
  const peerRef = useRef({})
  const [peerRoom, setPeerRoom] = useState()
  const [remoteStreams, setRemoteStreams] = useState()

  const [idAwaiter, setIdAwaiter] = useState([])
  const processingRef = useRef(false)

  const microphoneStreamRef = useRef()
  const micNodeRef = useRef()

  const [microphoneDevices, setMicrophoneDevices] = useState([])
  const [currentMic, setCurrentMic] = useState()

  useEffect(() => {
    peerRef.current = peerRoom
  }, [peerRoom])

  //when adding a user
  useEffect(() => {
    if (!idAwaiter || idAwaiter.length === 0 || processingRef.current) return
    const processNextId = async () => {
      processingRef.current = true
      const successfullyProcessed = []

      const queuedIds = [...idAwaiter]
      while (queuedIds.length > 0) {
        const currentId = queuedIds[0]
        try {
          initializePeerConnection(setRemoteStreams, currentId, peerRef, setPeerRoom, webSocketRoom.current, microphoneStreamRef, audioContextRef)
          successfullyProcessed.push(currentId)
        } catch (error) {
          console.error(`Failed to initialize a peer : ${currentId} : `, error)
        }
      }
      setIdAwaiter(prev => prev.filter(id => !successfullyProcessed.includes(id)))
    }

  }, [idAwaiter])

  useEffect(() => {
    const initFunc = async () => {
      if (webSocketRoom.current?.readyState === WebSocket.OPEN) return

      if (isInitilizing.current) return;
      isInitilizing.current = true

      try {
        if (webSocketRoom.current) {
          webSocketRoom.current.close()
          await new Promise(resolve => {
            webSocketRoom.current.onclose = resolve
            setTimeout(resolve, 100)
          })
        }
        const [webSocket, userIdGiven] = await setupWebSocket(wsUrl, roomId, setIdAwaiter, peerRef, setRemoteStreams, setPeerRoom, microphoneStreamRef, audioContextRef)
        webSocketRoom.current = webSocket
        userId.current = userIdGiven


        if (webSocket.readyState !== WebSocket.OPEN) {
          throw new Error("Connection failed")
        }

      } finally {
        isInitilizing.current = false
      }


    }

    initFunc()
    return () => {
      webSocketRoom.current?.close()
      if (peerRef.current) {
        Object.values(peerRef.current).forEach(peer => {
          peer.close()
          setPeerRoom(prev => {
            const newPeers = { ...prev };
            delete newPeers[userId];
            return newPeers;
          });
        })
      }

    }
  }, [setIdAwaiter, setPeerRoom, setRemoteStreams])

  useEffect(() => {
    audioContextRef.current = new AudioContext()

    audioContextRef.current.suspend()

    navigator.mediaDevices.enumerateDevices()
      .then((devices) => {
        const audioDevices = devices.filter((device) => device.kind === "audioinput")
        setMicrophoneDevices(audioDevices)
        if (!currentMic) {
          setCurrentMic(0)
        }
      })

    return () => {
      audioContextRef.current.close()
      microphoneStreamRef.current?.getTracks().forEach(t => t.stop())
    }
  }, [peerRef])

  useEffect(() => {
    let mic = microphoneDevices[currentMic];
    if (!mic) return

    if (microphoneStreamRef.current) {
      microphoneStreamRef.current.getTracks().forEach(track => track.stop());
    }

    navigator.mediaDevices.getUserMedia({ audio: { deviceId: { ideal: mic.deviceId } }, video: false })
      .then((mediaStream) => {
        microphoneStreamRef.current = mediaStream
        if (audioContextRef.current.state !== 'closed') {
          gainRef.current = audioContextRef.current.createGain();
        }

        gainRef.current.gain.value = 1;
        micNodeRef.current = audioContextRef.current.createMediaStreamSource(microphoneStreamRef.current)

        micNodeRef.current.connect(gainRef.current)
        gainRef.current.connect(audioContextRef.current.destination)

        if (!mute) audioContextRef.current.resume()



      })
      .catch((err) => {
        console.log("Got an error :", err)
      })

    if (peerRoom) {
      Object.values(peerRoom).forEach(peerConnection => {
        const sender = peerConnection.getSenders().find(s => s.track.kind == 'audio')
        if (sender) {
          sender.replaceTrack(microphoneStreamRef.current.getAudioTracks()[0])
        }

      })
    }
  }, [currentMic])

  useEffect(() => {
    if (mute == true) {
      audioContextRef.current.suspend()
    } else {
      audioContextRef.current.resume()
    }
  }, [mute])

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
                  <div className='bg-[#dee8ea] w-full h-8 flex flex-row rounded-md items-center gap-2 px-3'>
                    <span className="material-symbols-rounded" style={{ color: "#7AB8C7", fontSize: 22 }}>chat</span>
                    <p className='text-[16px] mb-1'>General Chat I</p>
                  </div>
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
            <div className='relative bottom-3 w-full h-14 bg-[#E7EFF0] border border-[#c7c7c7] shadow-md rounded-lg flex flex-row items-center justify-between pl-3 pr-6 '>
              <div className='flex flex-row gap-2 items-center'>
                <img
                  src='./assets/pfp 1.png'
                  alt='profile picture'
                  className='w-[40px] h-[40px]'
                />
                <p className='text-[16px]'>!Clapzzy █▬█</p>
              </div>
              <div className='flex flex-row gap-3 items-center'>
                <span className="material-symbols-rounded" style={{ color: "#284B62", fontSize: 24 }}>mic</span>
                <span className="material-symbols-rounded" style={{ color: "#284B62", fontSize: 24 }}>headset_mic</span>
              </div>
            </div>
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
                // Reset height first to get correct scrollHeight
                e.target.style.height = 'auto';
                // Set new height including padding
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

