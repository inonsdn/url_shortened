package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"url_shorten/config"
)

func getResponse(message string) ([]byte, error) {
	response := make(map[string]string)
	response["response"] = message
	encoded, err := json.Marshal(response)
	if err != nil {
		fmt.Println("Error", err)
		return []byte{}, err
	}

	return encoded, nil
}

func writeJson(w http.ResponseWriter, status int, value any) error {
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(value); err != nil {
		return err
	}
	return nil
}

func myhealth(w http.ResponseWriter, r *http.Request) {
	fmt.Println("Received myhealth")
	err := writeJson(w, http.StatusOK, "Good!")
	if err != nil {
		fmt.Println("Error", err)
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
}

func registerHandler(mux *http.ServeMux) {
	mux.HandleFunc("GET /myhealth", myhealth)
}

func main() {

	conf := config.LoadConfig()

	mux := http.NewServeMux()
	registerHandler(mux)

	fmt.Println(fmt.Sprintf("Running on %s", conf.Addr()))
	err := http.ListenAndServe(conf.Addr(), mux)
	if err != nil {
		fmt.Println(err)
	}
}
