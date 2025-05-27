package ws

import (
	"log"
	"sync"
	"time"
)

type WebSocketsRoom struct {
	sync.RWMutex
	RoomId         string
	HasInitialized bool
	Connections    map[string]*WebSocketClient
	MessageChannel chan Message
	ExitChannel    chan *WebSocketClient
	EnterChannel   chan *WebSocketClient
}

var Rooms sync.Map

func (room *WebSocketsRoom) Run() {
	defer func() {
		room.Lock()
		for _, client := range room.Connections {
			close(client.Send)
			client.Conn.Close()
		}
		room.Unlock()
	}()
	room.HasInitialized = true
	for {
		select {
		case message, ok := <-room.MessageChannel:
			if !ok {
				return
			}
			go room.SendMessage(message)

		case client, ok := <-room.EnterChannel:
			if !ok {
				return
			}
			go room.AddClient(client)

		case clientId, ok := <-room.ExitChannel:
			if !ok {
				return
			}
			go room.RemoveClient(clientId)

		case <-time.After(5 * time.Minute):
			if len(room.Connections) <= 0 {
				return
			}
		}
	}

}
func (room *WebSocketsRoom) RemoveClient(client *WebSocketClient) {
	room.Lock()
	defer room.Unlock()

	close(room.Connections[client.ClientId].Send)
	room.Connections[client.ClientId].Conn.Close()
	delete(room.Connections, client.ClientId)

	//moze da ima problem kato zatvorq send channel i sled tova pratq suobshtenie prez MessageChannel
	idMessage := SignalMessage{}
	idMessage.Type = "leave"
	idMessage.From = client.ClientId
	leaveMessage := Message{}
	leaveMessage.Sender = client
	leaveMessage.Data = idMessage
	log.Println("removed a user with id : ", client.ClientId)

	room.MessageChannel <- leaveMessage

	//remove the room if there arent any participants
	if len(room.Connections) <= 0 {
		close(room.MessageChannel)
		close(room.EnterChannel)
		close(room.ExitChannel)
		Rooms.Delete(room.RoomId)
	}

	return
}

func (room *WebSocketsRoom) SendMessage(message Message) {
	room.RLock()
	defer room.RUnlock()

	if message.Data.To != "" {
    if connection, ok := room.Connections[message.Data.To];ok{
      client.Send <- message
    }else{
      log.Println("Client %s not found, cannot send message.",
    message.Data.To)
    }
		return
	}

	for _, v := range room.Connections {
		v.Send <- message
	}

	return
}

func (room *WebSocketsRoom) AddClient(client *WebSocketClient) {
	room.Lock()
	defer room.Unlock()

	room.Connections[client.ClientId] = client

	return
}

func CreateRoom(roomId string) {
	room := new(WebSocketsRoom)
	room.RoomId = roomId
	room.MessageChannel = make(chan Message)
	room.ExitChannel = make(chan *WebSocketClient, 100)
	room.EnterChannel = make(chan *WebSocketClient, 100)
	room.Connections = make(map[string]*WebSocketClient)
	room.HasInitialized = false

	Rooms.Store(roomId, room)
	log.Println("Created a room called ", roomId)

	go room.Run()

	return
}
