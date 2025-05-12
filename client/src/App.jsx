import { useEffect, useRef, useState } from 'react'
import './App.css'
import { createPeerOffer, setupWebSocket, creatPeerConnection, setupIceCandidateHandler, addStreamToPeer, setupRemoteStreamHandler, initializePeerConnection } from './utils/webrtcUtils';

const roomId = 1;
const wsUrl = "http://localhost:8080/ws"

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
          min="0"
          max="2"
          value={voiceChatVolume}
          onChange={(e) => setVoiceChatVolume(parseFloat(e.target.value))}
        />
      )}
    </>

  )
}

function App() {
  const [count, setCount] = useState(0)
  const [mute, setMute] = useState(true)

  const audioContextRef = useRef()

  const gainRef = useRef()

  const webSocketRoom = useRef()
  const userId = useRef()
  const peerRef = useRef()
  const [peerRoom, setPeerRoom] = useState()
  const [remoteStreams, setRemoteStreams] = useState()
  const [idAwaiter, setIdAwaiter] = useState()

  const microphoneStreamRef = useRef()
  const micNodeRef = useRef()

  const [microphoneDevices, setMicrophoneDevices] = useState([])
  const [currentMic, setCurrentMic] = useState()

  //updating peerRef when a new peer is added
  useEffect(() => {
    peerRef.current = peerRoom
  }, [peerRoom])

  //when adding a user
  useEffect(() => {
    if (!idAwaiter) return
    initializePeerConnection(setRemoteStreams, idAwaiter, peerRef, setPeerRoom, webSocketRoom.current, microphoneStreamRef)

  }, [idAwaiter])

  //initilizatoin function that makes peers for each of the ids given back and also gets the websocket
  useEffect(() => {
    const [webSocket, userIds] = setupWebSocket(wsUrl, roomId, setIdAwaiter, peerRef, setRemoteStreams, setPeerRoom, microphoneStreamRef)
    webSocketRoom.current = webSocket
    userId.current = userIds[0]

    for (let i = 1; i < userIds.length; i++) {
      initializePeerConnection(setRemoteStreams, userIds[i], peerRef, setPeerRoom, webSocketRoom.current, microphoneStreamRef)
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
      Object.values(peerRef.current).forEach(pc => pc.close())
      microphoneStreamRef.current?.getTracks().forEach(t => t.stop())
    }
  }, [])

  useEffect(() => {
    let mic = microphoneDevices[currentMic];
    if (!mic) return

    if (microphoneStreamRef.current) {
      microphoneStreamRef.current.getTracks().forEach(track => track.stop());
    }

    navigator.mediaDevices.getUserMedia({ audio: { deviceId: { ideal: mic.deviceId } }, video: false })
      .then((mediaStream) => {
        microphoneStreamRef.current = mediaStream
        gainRef.current = audioContextRef.current.createGain(); // Create a volume control node
        gainRef.current.gain.value = 1; // Set volume to 50%
        micNodeRef.current = audioContextRef.current.createMediaStreamSource(microphoneStreamRef.current)

        micNodeRef.current.connect(gainRef.current)
        gainRef.current.connect(audioContextRef.current.destination)

        if (!mute) audioContextRef.current.resume()



      })
      .catch((err) => {
        console.log("Got an error :", err)
      })

    Object.values(peerRoom).forEach(peerConnection => {
      const sender = peerConnection.getSenders.find(s => s.track.kind == 'audio')
      if (sender) {
        sender.replaceTrack(microphoneStreamRef.current.getAudioTracks()[0])
      }

    })
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
      <div>
      </div>
      <h1>Voice chat demo</h1>
      <div className="card">
        <button onClick={() => setCount((count) => count + 1)}>
          count is {count}
        </button>
        <button onClick={() => setMute((mute) => !mute)}>
          {mute
            ? (<div style={{ background: "#EE6C4D" }}>Disabled</div>)
            : (<div style={{ background: "#E0FBFC" }}>Enabled</div>)}
        </button>
        <p>
          Edit <code>src/App.jsx</code> and save to test HMR
        </p>
        <div>
          <VolumeSlider gainRef={gainRef} />
          <select className='w-full h-10 ' value={currentMic} onChange={(event) => setCurrentMic(event.target.value)}>
            {
              microphoneDevices.map((mic, index) => {
                return (
                  <option className='text-[#293241] bg-[#E0FBFC]' value={index}>{mic.label}</option>
                )
              })}
          </select>
        </div>
      </div>
      <p className="read-the-docs">
        Click on the Vite and React logos to learn more
      </p>
    </>
  )
}

export default App
