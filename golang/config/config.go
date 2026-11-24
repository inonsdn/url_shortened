package config

import (
	"fmt"
	"os"

	"github.com/joho/godotenv"
)

type Config struct {
	Host        string
	Port        string
	DatabaseUrl string
	RedisUrl    string
}

func (c *Config) Addr() string {
	return fmt.Sprintf("%s:%s", c.Host, c.Port)
}

func getHost() string {
	host := os.Getenv("HOST")
	// if host == "" {
	// 	host = "localhost"
	// }
	return host
}

func getPort() string {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8081"
	}
	return port
}

func getDatabaseUrl() string {
	return os.Getenv("DATABASE_URL")
}

func getRedisUrl() string {
	return os.Getenv("REDIS_URL")
}

func LoadConfig() *Config {
	godotenv.Load()
	conf := &Config{
		Host:        getHost(),
		Port:        getPort(),
		DatabaseUrl: getDatabaseUrl(),
		RedisUrl:    getRedisUrl(),
	}
	return conf
}
