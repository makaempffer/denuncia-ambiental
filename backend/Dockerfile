# Stage 1: Build the Go binary
FROM golang:1.23-alpine AS builder

WORKDIR /app

# Copy the go.mod and go.sum files first (for caching dependencies)
COPY go.mod go.sum ./
RUN go mod download

# Copy the rest of the backend source code
COPY . .

# Build the application
# CGO_ENABLED=0 ensures the binary can run on the minimal Alpine image
RUN CGO_ENABLED=0 GOOS=linux go build -o server ./cmd/api/main.go

# Stage 2: Create the production image
FROM alpine:latest

WORKDIR /root/

# Copy only the compiled binary from the builder stage
COPY --from=builder /app/server .

# Expose the port your API runs on
EXPOSE 3000

# Start the server
CMD ["./server"]
