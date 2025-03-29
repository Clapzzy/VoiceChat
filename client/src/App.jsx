import { useEffect, useRef, useState } from 'react'
import './App.css'

function App() {
  const [count, setCount] = useState(0)
  const [mute, setMute] = useState(true)

  const audioContextRef = useRef()

  const gainRef = useRef()

  const microphoneStreamRef = useRef()
  const micNodeRef = useRef()
  const [microphoneDevices, setMicrophoneDevices] = useState([])
  const [currentMic, setCurrentMic] = useState()

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
        console.log("currently using mic :", mic.label)
        microphoneStreamRef.current = mediaStream
        gainRef.current = audioContextRef.current.createGain(); // Create a volume control node
        gainRef.current.gain.value = 3; // Set volume to 50%
        micNodeRef.current = audioContextRef.current.createMediaStreamSource(microphoneStreamRef.current)

        micNodeRef.current.connect(gainRef.current)
        gainRef.current.connect(audioContextRef.current.destination)

        if (!mute) audioContextRef.current.resume()

      })
      .catch((err) => {
        console.log("Got an error :", err)
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
