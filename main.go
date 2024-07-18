package main

import (
	"fmt"
	_ "github.com/mattn/go-sqlite3"
	"net/http"
)

func start_server(db *sql.DB) {
	http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		http.ServeFile(w, r, "index.html")
	})

	fmt.Println("Listening on port 8000")
	http.ListenAndServe(":8000", nil)
}

func main() {
	start_server(db)
}
