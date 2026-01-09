package main

import (
	"embed"
	"io/fs"
	"log"
	"os"
	"strconv"
	"strings"

	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/apis"
	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/plugins/jsvm"
	"github.com/pocketbase/pocketbase/plugins/migratecmd"
)

//go:embed all:web/dist
var frontendDist embed.FS

func main() {
	// Extract the inner dist content
	// Try "web/dist" first as it is the standard structure
	distFS, err := fs.Sub(frontendDist, "web/dist")
	if err != nil {
		// Fallback to "dist"
		distFS, _ = fs.Sub(frontendDist, "dist")
	}

	app := pocketbase.New()

	// -------------------------------------------------------------------------
	// 1. Register JSVM (for JS Migrations & Hooks)
	// -------------------------------------------------------------------------
	jsvm.MustRegister(app, jsvm.Config{
		// Default: pb_hooks
		// Migrations are autoloaded from pb_migrations if present
	})

	// -------------------------------------------------------------------------
	// 2. Register Migrations (Go)
	// -------------------------------------------------------------------------
	isGoRun := strings.HasPrefix(os.Args[0], "/tmp/go-build")
	migratecmd.MustRegister(app, app.RootCmd, migratecmd.Config{
		Automigrate: isGoRun,
	})

	// -------------------------------------------------------------------------
	// 2. Configure SMTP from Environment Variables
	// -------------------------------------------------------------------------
	app.OnBeforeBootstrap().Add(func(e *core.BootstrapEvent) error {
		smtpEnabled := os.Getenv("SMTP_ENABLED")
		if smtpEnabled == "true" {
			settings := app.Settings()

			settings.Smtp.Enabled = true
			settings.Smtp.Host = os.Getenv("SMTP_HOST")

			port, _ := strconv.Atoi(os.Getenv("SMTP_PORT"))
			if port == 0 {
				port = 587
			}
			settings.Smtp.Port = port

			settings.Smtp.Username = os.Getenv("SMTP_USER")
			settings.Smtp.Password = os.Getenv("SMTP_PASSWORD")

			settings.Meta.SenderName = os.Getenv("SMTP_SENDER_NAME")
			settings.Meta.SenderAddress = os.Getenv("SMTP_SENDER_ADDRESS")

			// Use TLS if port is 465, otherwise STARTTLS
			if port == 465 {
				settings.Smtp.Tls = true
			}

			log.Println("SMTP configured via environment variables")
		}
		return nil
	})

	// -------------------------------------------------------------------------
	// 3. Custom Business Logic (Hooks)
	// -------------------------------------------------------------------------
	app.OnRecordBeforeCreateRequest("shopping_lists").Add(func(e *core.RecordCreateEvent) error {
		log.Println("Creating new shopping list:", e.Record.Id)
		return nil
	})

	// -------------------------------------------------------------------------
	// 4. Serve Frontend (SPA Fallback)
	// -------------------------------------------------------------------------
	app.OnBeforeServe().Add(func(e *core.ServeEvent) error {
		e.Router.GET("/*", apis.StaticDirectoryHandler(distFS, true))
		return nil
	})

	if err := app.Start(); err != nil {
		log.Fatal(err)
	}
}
