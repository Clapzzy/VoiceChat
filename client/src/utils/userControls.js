import { useRef, useState } from "react"
import { useEffect } from "react"

export function useSetUpAudioMic() {
  //neded for webSocket set up
  const audioContextRef = useRef(null)
  const microphoneStreamRef = useRef(null)
  //needed for setting mic volume
  const gainRef = useRef(null)

  //needed to choose a mic
  const [microphoneDevices, setMicrophoneDevices] = useState(null)
  const [currentMic, setCurrentMic] = useState(null)

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

  // sets up mic and its gain node
  useEffect(() => {
    if (!microphoneDevices?.[currentMic]) return
    let mic = microphoneDevices[currentMic]
    let micNode
    if (!mic) return

    if (microphoneStreamRef.current) {
      microphoneStreamRef.current.getTracks().forEach(track => track.stop())
    }

    navigator.mediaDevices.getUserMedia({ audio: { deviceId: { ideal: mic.deviceId } }, video: false })
      .then((mediaStream) => {
        if (audioContextRef.current.state !== 'closed') {
          gainRef.current = audioContextRef.current.createGain()
        }

        const destinationNode = audioContextRef.current.createMediaStreamDestination()
        gainRef.current.gain.value = 1;
        micNode = audioContextRef.current.createMediaStreamSource(mediaStream)

        micNode.connect(gainRef.current)
        gainRef.current.connect(destinationNode)
        microphoneStreamRef.current = destinationNode.stream

      })
      .catch((err) => {
        console.log("Got an error :", err)
      })

    return () => {
      if (micNode) {
        micNode.disconnect()
      }

      if (gainRef.current) {
        gainRef.current.disconnect()
      }

      if (microphoneStreamRef.current) {
        microphoneStreamRef.current?.getTracks().forEach(t => t.stop())
      }
    }
  }, [currentMic])


  return [audioContextRef, microphoneStreamRef, gainRef, [setCurrentMic, currentMic, microphoneDevices]]
}
