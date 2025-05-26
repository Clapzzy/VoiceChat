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

type ConnectionInitResponse struct {
	RoomId   string `json:"roomId"`
	PfpNum   int    `json:"pfpNum"`
	Username string `json:"username"`
}

type UserInfoInRoom struct {
	PfpNum   int    `json:"pfpNum"`
	Username string `json:"username,omitempty"`
	UserId   string `json:"userId,omitempty"`
}

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		return true
	},
}

func giveChannelsParticipants(w http.ResponseWriter, r *http.Request) {
	type userInfo struct {
		Username string `json:"username"`
		PfpNum   int    `json:"pfpNum"`
	}
	log.Println(r.URL)
	channelIds := r.URL.Query()["channel_ids"]
	log.Println(channelIds)

	response := map[string][]userInfo{}
	for _, v := range channelIds {
		log.Println(v)
		userInfos := []userInfo{}
		value, found := ws.Rooms.Load(v)
		if !found {
			continue
		}

		roomData := value.(*ws.WebSocketsRoom)

		for _, connection := range roomData.Connections {
			log.Println(connection.Username, connection.PfpNum)
			userInfoToAdd := userInfo{Username: connection.Username, PfpNum: connection.PfpNum}
			log.Println(userInfoToAdd)
			userInfos = append(userInfos, userInfo{Username: connection.Username, PfpNum: connection.PfpNum})
		}

		response[v] = userInfos
		log.Println(response[v])
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(response)

}

func handleConnection(w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)

	if err != nil {
		log.Println("There has been an error :", err)
		return
	}
	_, roomIdByte, err := conn.ReadMessage()
	//TODO: throw an error if roomIdByte doesnt contain some of its elements
	connectionInitMessage := ConnectionInitResponse{}
	json.Unmarshal(roomIdByte, &connectionInitMessage)
	roomId := connectionInitMessage.RoomId

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
	client.PfpNum = connectionInitMessage.PfpNum
	client.Username = connectionInitMessage.Username
	client.Send = make(chan ws.Message, 100)
	client.GenerateClientId(wsRoom)
	client.Conn = conn

	//informs all of the client of the id of the client that has just joined.
	idMessage := ws.SignalMessage{}
	idMessage.Type = "id"
	idMessage.Id = client.ClientId
	idMessage.InitData = []any{connectionInitMessage.Username, connectionInitMessage.PfpNum}
	idSignalmessage := ws.Message{}
	idSignalmessage.Sender = client
	idSignalmessage.Data = idMessage
	fmt.Println("created a user with id :", client.ClientId)

	//TODO: pass pointers and not copies of the structs to MessageChannel and Send
	wsRoom.MessageChannel <- idSignalmessage

	var userInfoInRoom []UserInfoInRoom
	userInfoInRoom = append(userInfoInRoom, UserInfoInRoom{
		UserId: client.ClientId,
	})

	//give all of the ids to the user that has just joined
	//could be bad if 2 ppl join at the same time
	wsRoom.RLock()

	for userId, connection := range wsRoom.Connections {
		userInfoInRoom = append(userInfoInRoom, UserInfoInRoom{
			UserId:   userId,
			PfpNum:   connection.PfpNum,
			Username: connection.Username,
		})
	}

	idBytes, err := json.Marshal(userInfoInRoom)
	if err != nil {
		log.Panic(err)
	}

	wsRoom.RUnlock()

	conn.WriteMessage(websocket.TextMessage, idBytes)

	//maybe not the best way to do this
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
	http.HandleFunc("/channel", giveChannelsParticipants)

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
