package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"sync"
	"syscall"
	"time"

	"github.com/gorilla/websocket"
)

type webSocketClient struct {
	conn *websocket.Conn
	send chan []byte
}

type webSocketsRoom struct {
	sync.RWMutex
	roomId         string
	connections    []*webSocketClient
	messageChannel chan []byte
	exitChannel    chan *webSocketClient
	enterChannel   chan *webSocketClient
}

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		return true
	},
}

func (client *webSocketClient) listenForIncomingData(room *webSocketsRoom) {
	//listens for messages from the socket
	go func() {
		for {
			messageType, data, err := client.conn.ReadMessage()
			if err != nil {
				room.exitChannel <- client
				log.Println("There has been an error : ", err)
				return
			}

			if messageType == 8 {
				room.exitChannel <- client
				client.conn.Close()
				return
			}

			room.messageChannel <- data
		}
	}()

	//listens for messages from the room and distributes them
	go func() {
		for {
			select {
			case message, isClosed := <-client.send:
				if isClosed {
					return
				}
				client.conn.WriteMessage(websocket.TextMessage, message)
			}
		}
	}()

}

func (room *webSocketsRoom) run() {
	defer func() {
		room.Lock()
		for _, client := range room.connections {
			close(client.send)
			client.conn.Close()
		}
		room.Unlock()
	}()
	for {
		select {
		case message, isClosed := <-room.messageChannel:
			if isClosed {
				return
			}
			go room.sendMessage(message)

		case client, isClosed := <-room.enterChannel:
			if isClosed {
				return
			}
			go room.addClient(client)

		case client, isClosed := <-room.exitChannel:
			if isClosed {
				return
			}
			go room.removeClient(client)

		case <-time.After(5 * time.Minute):
			if len(room.connections) <= 0 {
				return
			}
		}
	}

}
func (room *webSocketsRoom) removeClient(client *webSocketClient) {
	room.Lock()
	defer room.Unlock()

	for i, webSocketClient := range room.connections {
		if webSocketClient == client {
			room.connections = append(room.connections[:i], room.connections[i+1:]...)

			close(webSocketClient.send)
			break
		}
	}

	//remove the room if there arent any participants
	if len(room.connections) <= 0 {
		close(room.messageChannel)
		close(room.enterChannel)
		close(room.exitChannel)
		rooms.Delete(room.roomId)
	}

	return
}

func (room *webSocketsRoom) sendMessage(message []byte) {
	room.RLock()

	for _, v := range room.connections {
		v.send <- message
	}
	room.RUnlock()

	return
}

func (room *webSocketsRoom) addClient(client *webSocketClient) {
	room.Lock()
	defer room.Unlock()

	room.connections = append(room.connections, client)

	return
}

var rooms sync.Map

func handleConnection(w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)

	if err != nil {
		log.Println("There has been an error :", err)
		return
	}
	_, roomId, err := conn.ReadMessage()
	if err != nil {
		log.Println("There has been an error :", err)
		return
	}
	_, found := rooms.Load(roomId)
	if !found {
		//initiate the func for creating a room with room id and the specific user
		createRoom(string(roomId))
	}
	value, _ := rooms.Load(roomId)

	client := new(webSocketClient)
	client.send = make(chan []byte, 100)
	client.conn = conn

	wsRoom := value.(*webSocketsRoom)
	wsRoom.enterChannel <- client

	client.listenForIncomingData(wsRoom)
}
func createRoom(roomId string) {
	room := new(webSocketsRoom)
	room.roomId = roomId
	room.messageChannel = make(chan []byte)
	room.exitChannel = make(chan *webSocketClient, 100)
	room.enterChannel = make(chan *webSocketClient, 100)
	room.connections = make([]*webSocketClient, 0)

	rooms.Store(roomId, room)

	go room.run()

	return
}

func main() {
	server := &http.Server{
		Addr:         ":8080",
		Handler:      nil,
		ReadTimeout:  10 * time.Second,
		WriteTimeout: 10 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	http.HandleFunc("/ws", handleConnection)

	shutdown := make(chan os.Signal, 1)
	signal.Notify(shutdown, syscall.SIGINT, syscall.SIGTERM)

	go func() {
		log.Printf("Server starting on %s", server.Addr)
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Server error: %v", err)
		}
	}()

	<-shutdown
	log.Println("Shutting down server...")

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	server.Shutdown(ctx) // Uses the timeout context
	log.Println("Server shut down")
}
