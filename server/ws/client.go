package ws

import (
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"log"

	"github.com/gorilla/websocket"
)

// TODO: maybe make the websocket and chat message structs more generic to be able to be used in both places
type Message struct {
	Data   SignalMessage
	Sender *WebSocketClient
}

type TextMessage struct {
	Type     string `json:"type"`
	Message  string `json:"message"`
	PfpNum   int    `json:"pfpNum"`
	Username string `json:"username"`
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
	PfpNum   int
	Username string
	Conn     *websocket.Conn
	ChatIds  []string
	VoiceIds []string
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

func (client *ChatClient) LeaveAll() {
	client.Conn.Close()
	for _, roomId := range client.ChatIds {
		room, found := TextChatRooms.Load(roomId)
		if !found {
			log.Println("Could not find chatRoom to leave")
			continue
		}
		chatRoom := room.(*ChatRoom)
		chatRoom.RemoveChatParticipant(client)
	}

	for _, roomId := range client.VoiceIds {
		room, found := Rooms.Load(roomId)
		if !found {
			log.Println("Could not find voice chat room to leave")
			continue
		}
		voiceRoom := room.(*WebSocketsRoom)
		voiceRoom.RemoveSubscriber(client)
	}
}

func (client *ChatClient) SendMessage(roomId string, message string) {
	cr, found := TextChatRooms.Load(roomId)
	room := cr.(*ChatRoom)
	if !found {
		log.Println("Couldnt find room to send message to")
	}
	room.RLock()
	defer room.RUnlock()

	chatMessage := TextMessage{}
	chatMessage.Message = message
	chatMessage.PfpNum = client.PfpNum
	chatMessage.Username = client.Username
	chatMessage.Type = "text"

	messageBytes, err := json.Marshal(chatMessage)
	if err != nil {
		log.Println("Chat message could not be converted into byte !!!!!")
		return
	}

	for _, conn := range room.Connections {
		if conn != client {
			conn.Conn.WriteMessage(websocket.TextMessage, messageBytes)
		}
	}

	return
}

// TODO: make exit and enter channels of WebSocketsRoom give signals to the subscribers
func (client *ChatClient) ListenForIncomingData() {
	go func() {
		for {
			messageType, data, err := client.Conn.ReadMessage()
			if err != nil {
				client.LeaveAll()
				return
			}
			if messageType == 8 {
				client.LeaveAll()
				return
			}

			var textMessageToSend string
			json.Unmarshal(data, &textMessageToSend)
			for _, roomId := range client.ChatIds {
				client.SendMessage(roomId, textMessageToSend)
			}
		}
	}()
}

func (client *WebSocketClient) ListenForIncomingData(room *WebSocketsRoom) {
	//listens for messages from the socket
	go func() {
		for {
			messageType, data, err := client.Conn.ReadMessage()
			if err != nil {
				room.ExitChannel <- client
				client.Conn.Close()
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
