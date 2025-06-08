import { useCallback } from "react";
import { useEffect, useState, useRef } from "react";

const wsUrl = "wss://martinkurtev.com/ws/update";

export function useUpdateSocket(chatIds, voiceIds, userInfo) {
  const [chatMessages, setChatMessages] = useState({})
  const [voiceParticipants, setVoiceParticipants] = useState({})
  const webSocketRef = useRef()

  const sendMessage = useCallback((message, roomId) => {
    if (webSocketRef?.current?.readyState === WebSocket.OPEN) {
      webSocketRef.current.send(JSON.stringify({
        textMessage: message,
        roomId: roomId
      }))

      setChatMessages((prev) => ({
        ...prev,
        [message.roomId]: [
          ...prev[message.roomId],
          { message: message.message, pfpNum: userInfo.pfpNum, username: userInfo.username }
        ]
      }))

    } else {
      console.warn("update socket still not open")
    }
  }, [])

  useEffect(() => {
    const webSocket = new WebSocket(`${wsUrl}`)
    webSocketRef.current = webSocket

    webSocket.addEventListener("open", () => {
      webSocket.send(JSON.stringify({
        chatIds: [...chatIds],
        voiceIds: [...voiceIds],
        username: userInfo.username,
        pfpNum: userInfo.pfpNum
      }))
    })

    webSocket.addEventListener("message", (event) => {
      if (webSocket.readyState !== webSocket.OPEN) return
      const voiceInitialState = JSON.parse(event.data)
      setVoiceParticipants(voiceInitialState)

      webSocket.addEventListener("message", (event) => {
        const message = JSON.parse(event.data)
        switch (message.type) {
          case 'join':
            setVoiceParticipants((prev) => ({
              ...prev,
              [message.roomId]: [
                {
                  pfpNum: message.pfpNum,
                  username: message.username,
                  userId: message.clientId
                },
                ...prev[message.roomId]
              ]
            }))
            break
          case 'leave':
            setVoiceParticipants((prev) => ({
              ...prev,
              [message.roomId]: prev[message.roomId].filter((item) => item.userId !== message.clientId)
            }))
            break
          case 'message':
            setChatMessages((prev) => ({
              ...prev,
              [message.roomId]: [
                ...prev[message.roomId],
                { message: message.message, pfpNum: message.pfpNum, username: message.username }
              ]
            }))
            break
        }
      })

    }, { once: true })

  }, [])

  return [chatMessages, voiceParticipants, sendMessage]
}
