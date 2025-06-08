package ws

import (
	"encoding/json"
	"log"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

type WebSocketsRoom struct {
	sync.RWMutex
	RoomId         string
	HasInitialized bool
	Connections    map[string]*WebSocketClient
	MessageChannel chan Message
	ExitChannel    chan *WebSocketClient
	EnterChannel   chan *WebSocketClient
	Subscribers    []*ChatClient
}

type ChatRoom struct {
	sync.RWMutex
	RoomId      string
	Connections []*ChatClient
}

var Rooms sync.Map
var TextChatRooms sync.Map

func (room *WebSocketsRoom) Run() {
	defer func() {
		room.Lock()
		room.Subscribers = []*ChatClient{}
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

func (room *ChatRoom) RemoveChatParticipant(client *ChatClient) {
	room.Lock()
	defer room.Unlock()

	for i, c := range room.Connections {
		if c != client {
			log.Println(room.Connections)
			log.Println(i)
			room.Connections[i] = room.Connections[len(room.Connections)-1]
			room.Connections = room.Connections[:len(room.Connections)-1]
		}
	}

	if len(room.Connections) <= 0 {
		Rooms.Delete(room.RoomId)
	}

	return
}

func (room *WebSocketsRoom) RemoveSubscriber(subscriber *ChatClient) {
	room.Lock()
	defer room.Unlock()

	for i, c := range room.Subscribers {
		if c != subscriber {
			room.Subscribers[i] = room.Subscribers[len(room.Subscribers)-1]
			room.Subscribers = room.Subscribers[:len(room.Subscribers)-1]
		}
	}

	return
}

func (room *WebSocketsRoom) AlertSubscribers(leaveMessage *UpdateMessage) {
	leaveMessageBytes, _ := json.Marshal(leaveMessage)
	for _, client := range room.Subscribers {
		client.Conn.WriteMessage(websocket.TextMessage, leaveMessageBytes)
	}
}

func (room *WebSocketsRoom) RemoveClient(client *WebSocketClient) {
	room.Lock()
	defer room.Unlock()

	close(client.Send)
	client.Conn.Close()
	delete(room.Connections, client.ClientId)

	subscriberMessage := UpdateMessage{}
	subscriberMessage.Type = "leave"
	subscriberMessage.ClientId = client.ClientId
	subscriberMessage.PfpNum = client.PfpNum
	subscriberMessage.Username = client.Username
	subscriberMessage.RoomId = room.RoomId

	room.AlertSubscribers(&subscriberMessage)

	//moze da ima problem kato zatvorq send channel i sled tova pratq suobshtenie prez MessageChannel
	idMessage := SignalMessage{}
	idMessage.Type = "leave"
	idMessage.From = client.ClientId
	leaveMessage := Message{}
	leaveMessage.Sender = client
	leaveMessage.Data = idMessage
	log.Println("removed a user with id : ", client.ClientId)

	room.MessageChannel <- leaveMessage

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
		if connection, ok := room.Connections[message.Data.To]; ok {
			connection.Send <- message
		} else {
			log.Printf("Client %s not found, cannot send message.", message.Data.To)
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

	subscriberMessage := UpdateMessage{}
	subscriberMessage.Type = "join"
	subscriberMessage.ClientId = client.ClientId
	subscriberMessage.PfpNum = client.PfpNum
	subscriberMessage.Username = client.Username
	subscriberMessage.RoomId = room.RoomId

	room.AlertSubscribers(&subscriberMessage)

	room.Connections[client.ClientId] = client

	return
}

func (room *ChatRoom) AddClient(client *ChatClient) {
	room.Lock()
	defer room.Unlock()

	room.Connections = append(room.Connections, client)

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

func CreateChatRoom(roomId string) {
	room := new(ChatRoom)
	room.RoomId = roomId
	room.Connections = make([]*ChatClient, 0)

	TextChatRooms.Store(roomId, room)

	return
}
