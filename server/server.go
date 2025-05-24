package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"
	"voiceChatServer/ws"

	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		return true
	},
}

func handleConnection(w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)

	if err != nil {
		log.Println("There has been an error :", err)
		return
	}
	_, roomIdByte, err := conn.ReadMessage()
	roomId := string(roomIdByte)

	if err != nil {
		log.Println("There has been an error :", err)
		return
	}
	_, found := ws.Rooms.Load(roomId)
	if !found {
		//initiate the func for creating a room with room id and the specific user
		ws.CreateRoom(string(roomId))
	}

	value, _ := ws.Rooms.Load(roomId)

	wsRoom := value.(*ws.WebSocketsRoom)

	client := new(ws.WebSocketClient)
	client.Send = make(chan ws.Message, 100)
	client.GenerateClientId(wsRoom)
	client.Conn = conn

	//informs all of the client of the id of the client that has just joined.
	idMessage := ws.SignalMessage{}
	idMessage.Type = "id"
	idMessage.Id = client.ClientId
	idSignalmessage := ws.Message{}
	idSignalmessage.Sender = client
	idSignalmessage.Data = idMessage
	fmt.Println("created a user with id :", client.ClientId)

	wsRoom.MessageChannel <- idSignalmessage

	var userIdsInRoom []string
	userIdsInRoom = append(userIdsInRoom, client.ClientId)

	//give all of the ids to the user that has just joined
	//could be bad if 2 ppl join at the same time
	wsRoom.RLock()

	for userId := range wsRoom.Connections {
		userIdsInRoom = append(userIdsInRoom, userId)
	}

	idBytes, err := json.Marshal(userIdsInRoom)
	if err != nil {
		log.Panic(err)
	}

	wsRoom.RUnlock()

	conn.WriteMessage(websocket.TextMessage, idBytes)

	//TODO : should figure out a better way to do this

	for !wsRoom.HasInitialized {
		time.Sleep(30 * time.Millisecond)
	}
	wsRoom.EnterChannel <- client

	client.ListenForIncomingData(wsRoom)
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
