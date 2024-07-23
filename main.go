package main

import (
	"database/sql"
	"flag"
	"fmt"
	_ "github.com/mattn/go-sqlite3"
	"net/http"
	"os"
	"strconv"
)

type Plant struct {
	ID                int
	Name              string
	WateringFrequency int
}

func start_server(db *sql.DB, port int) {
	http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		http.ServeFile(w, r, "index.html")
	})

	http.HandleFunc("/script.js", func(w http.ResponseWriter, r *http.Request) {
		http.ServeFile(w, r, "script.js")
	})

	http.HandleFunc("/get-plants", func(w http.ResponseWriter, r *http.Request) {
		rows, err := db.Query("SELECT * FROM plants")
		if err != nil {
			panic(err)
		}
		defer rows.Close()

		var plants []Plant
		for rows.Next() {
			var plant Plant
			err = rows.Scan(&plant.ID, &plant.Name, &plant.WateringFrequency)
			if err != nil {
				panic(err)
			}
			plants = append(plants, plant)
		}

		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte("["))
		for i, plant := range plants {
			w.Write([]byte("{\"id\":"))
			w.Write([]byte(strconv.Itoa(plant.ID)))
			w.Write([]byte(",\"name\":\""))
			w.Write([]byte(plant.Name))
			w.Write([]byte("\",\"wateringFrequency\":"))
			w.Write([]byte(strconv.Itoa(plant.WateringFrequency)))
			w.Write([]byte("}"))
			if i < len(plants)-1 {
				w.Write([]byte(","))
			}
		}
		w.Write([]byte("]"))
	})

	http.HandleFunc("/add-plant", func(w http.ResponseWriter, r *http.Request) {
		name := r.FormValue("name")
		wateringFrequency, err := strconv.Atoi(r.FormValue("wateringFrequency"))
		if err != nil {
			panic(err)
		}

		_, err = db.Exec("INSERT INTO plants (name, watering_frequency) VALUES (?, ?)", name, wateringFrequency)
		if err != nil {
			panic(err)
		}

		http.Redirect(w, r, "/", http.StatusSeeOther)
	})

	http.HandleFunc("/delete-plant", func(w http.ResponseWriter, r *http.Request) {
		id, err := strconv.Atoi(r.FormValue("id"))
		if err != nil {
			panic(err)
		}

		_, err = db.Exec("DELETE FROM plants WHERE id = ?", id)
		if err != nil {
			panic(err)
		}
	})

	http.HandleFunc("/water-plant", func(w http.ResponseWriter, r *http.Request) {
		id, err := strconv.Atoi(r.FormValue("id"))
		if err != nil {
			panic(err)
		}

		fmt.Println("Watering plant with ID", id)
	})

	fmt.Println("Listening on port " + strconv.Itoa(port))
	portString := fmt.Sprintf(":%d", port)
	http.ListenAndServe(portString, nil)
}

func main() {
	filename := "plants.sqlite"

	port, err := strconv.Atoi(os.Getenv("PORT"))
	if err != nil {
		port = 8000
	}

	flag.IntVar(&port, "port", 8000, "Port to listen on (default 8000)")
	flag.StringVar(&filename, "filename", "plants.sqlite", "Filename of SQLite database (default plants.sqlite)")
	flag.Parse()

	db, err := sql.Open("sqlite3", filename)
	if err != nil {
		panic(err)
	}

	_, err = db.Exec("CREATE TABLE IF NOT EXISTS plants (id INTEGER PRIMARY KEY, name TEXT, watering_frequency INTEGER)")
	if err != nil {
		panic(err)
	}

	start_server(db, port)
}
