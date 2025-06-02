package ws

import (
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"log"

	"github.com/gorilla/websocket"
)

//TODO: maybe make the websocket and chat message structs more generic to be able to be used in both places
type Message struct {
	Data   SignalMessage
	Sender *WebSocketClient
}

type ChatMessage struct{
  Data TextMessage
  Sender *ChatClient
}

type TextMessage struct{
  Type string `json:"type"`
  Message string `json:"message"`
}

type SignalMessage struct {
	To        string `json:"to,omitempty"`
	From      string `json:"from,omitempty"`
	Type      string `json:"type,omitepmty"`
	Candidate string `json:"candidate,omitempty"`
	Sdp       string `json:"sdp,omitepmty"`
	Id        string `json:"id,omitempty"`
	InitData  []any  `json:"initDate,omitepmty"`
}

type WebSocketClient struct {
	PfpNum   int
	Username string
	Conn     *websocket.Conn
	Send     chan Message
	ClientId string
}
 type ChatClient struct {
   PfpNum int
   Username string
   Conn *websocket.Conn
 }

func (client *WebSocketClient) GenerateClientId(room *WebSocketsRoom) {
	room.RLock()
	defer room.RUnlock()
outer:
	for {
		bytesBuffer := make([]byte, 4)
		rand.Read(bytesBuffer)
		clientId := base64.RawStdEncoding.EncodeToString(bytesBuffer)

		for _, v := range room.Connections {
			if v.ClientId == clientId {
				continue outer
			}
		}

		client.ClientId = clientId
		break
	}
	return
}

func (client *WebSocketClient) ListenForIncomingData(room *WebSocketsRoom) {
	//listens for messages from the socket
	go func() {
		for {
			messageType, data, err := client.Conn.ReadMessage()
			if err != nil {
				room.ExitChannel <- client
				log.Println("There has been an error : ", err)
				return
			}

			if messageType == 8 {
				room.ExitChannel <- client
				client.Conn.Close()
				return
			}

			signalMessage := SignalMessage{}
			json.Unmarshal(data, &signalMessage)
			signalMessage.From = client.ClientId

			message := &Message{
				Data:   signalMessage,
				Sender: client,
			}

			room.MessageChannel <- *message
		}
	}()

	//listens for messages from the room and distributes them
	go func() {
		for {
			select {
			case message, ok := <-client.Send:
				if !ok {
					return
				}

				if client != message.Sender {
					data, err := json.Marshal(message.Data)
					//TODO: Make this have a better way to handle errors
					if err != nil {
						log.Println("There has been an error")
						continue
					}
					client.Conn.WriteMessage(websocket.TextMessage, data)
				}
			}
		}
	}()

}
