import { useEffect, useState } from "react";

const wsUrl = "ws://martinkurtev.com:8080/ws/update";

export function useUpdateSocket({ }) {
  const [chatMessages, setChatMessages] = useState({})
  const [voiceParticipants, setVoiceParticipants] = useState({})
  const webSocket = useRef()

  useEffect(() => {
    const webSocket = new WebSocket(`${wsUrl}`)

  }, [])
}
