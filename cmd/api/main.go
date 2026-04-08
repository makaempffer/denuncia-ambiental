package main

import (
	"crypto/sha256"
	"fmt"
	"log"
	"os"
	"strings"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/gofiber/fiber/v2/middleware/logger"
	"github.com/jmoiron/sqlx"
	_ "github.com/lib/pq"
)

// Data structure for incoming/outgoing reports
type Report struct {
	ID          int     `db:"id" json:"id"`
	TargetName  string  `db:"target_name" json:"target_name"`
	TargetRUT   string  `db:"target_rut" json:"target_rut"`
	Category    string  `db:"category" json:"category"`
	Description string  `db:"description" json:"description"`
	Lat         float64 `json:"lat"`
	Lon         float64 `json:"lon"`
	Votes       int     `db:"vote_count" json:"vote_count"`
}

func main() {
	// 1. Load Config
	dbURL := os.Getenv("DATABASE_URL")
	salt := os.Getenv("HASH_SALT")
	if dbURL == "" || salt == "" {
		log.Fatal("Missing environment variables. Check your .env file.")
	}

	// 2. Connect to Database
	db, err := sqlx.Connect("postgres", dbURL)
	if err != nil {
		log.Fatalf("Database connection failed: %v", err)
	}

	// 3. Setup Fiber
	app := fiber.New(fiber.Config{
		AppName: "Denuncia Ambiental Chile",
	})

	// Middlewares
	app.Use(logger.New())
	app.Use(cors.New())

	// --- API ROUTES ---

	// Health Check
	app.Get("/health", func(c *fiber.Ctx) error {
		return c.SendStatus(200)
	})

	// FETCH ALL REPORTS (For the Map)
	app.Get("/api/reports", func(c *fiber.Ctx) error {
		var reports []Report
		query := `
			SELECT id, target_name, target_rut, category, description,
			ST_Y(location::geometry) as lat, ST_X(location::geometry) as lon,
			(SELECT COUNT(*) FROM votes WHERE report_id = reports.id) as vote_count
			FROM reports
			ORDER BY created_at DESC`

		err := db.Select(&reports, query)
		if err != nil {
			return c.Status(500).SendString(err.Error())
		}
		return c.JSON(reports)
	})

	// CREATE NEW REPORT
	app.Post("/api/reports", func(c *fiber.Ctx) error {
		r := new(Report)
		if err := c.BodyParser(r); err != nil {
			return c.Status(400).SendString("Invalid data format")
		}

		// Sanitization (Chile Specific)
		r.TargetName = strings.TrimSpace(r.TargetName)
		r.TargetRUT = strings.ToUpper(strings.ReplaceAll(r.TargetRUT, ".", ""))

		query := `
			INSERT INTO reports (target_name, target_rut, category, description, location)
			VALUES ($1, $2, $3, $4, ST_SetSRID(ST_Point($5, $6), 4326))`

		_, err := db.Exec(query, r.TargetName, r.TargetRUT, r.Category, r.Description, r.Lon, r.Lat)
		if err != nil {
			return c.Status(500).SendString("Error saving to database")
		}

		return c.Status(201).SendString("Report created successfully")
	})

	// VOTE/CONFIRM A REPORT (Anti-Spam)
	app.Post("/api/reports/:id/vote", func(c *fiber.Ctx) error {
		id := c.Params("id")

		// Create a unique fingerprint hash for the user
		fingerprint := c.IP() + c.Get("User-Agent") + salt
		hash := sha256.Sum256([]byte(fingerprint))
		voterHash := fmt.Sprintf("%x", hash)

		query := `INSERT INTO votes (report_id, voter_hash) VALUES ($1, $2)`
		_, err := db.Exec(query, id, voterHash)
		if err != nil {
			// Database UNIQUE constraint handles duplicate checks
			return c.Status(403).JSON(fiber.Map{"error": "Ya has confirmado esta denuncia anteriormente."})
		}

		return c.SendStatus(200)
	})

	// 4. Start
	port := os.Getenv("PORT")
	if port == "" {
		port = "3000"
	}
	log.Fatal(app.Listen(":" + port))
}
