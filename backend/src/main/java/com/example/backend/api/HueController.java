package com.example.backend.api;

import com.example.backend.hue.HueBridgeService;
import com.fasterxml.jackson.databind.JsonNode;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.client.RestClientException;

@RestController
@RequestMapping("/api/hue")
public class HueController {

    private static final Logger log = LoggerFactory.getLogger(HueController.class);

    private final HueBridgeService hueBridgeService;

    public HueController(HueBridgeService hueBridgeService) {
        this.hueBridgeService = hueBridgeService;
    }

    @GetMapping("/devices")
    public JsonNode devices() {
        log.debug("GET /api/hue/devices");
        return hueBridgeService.getDevices();
    }

    @GetMapping("/rooms")
    public JsonNode rooms() {
        log.debug("GET /api/hue/rooms");
        return hueBridgeService.getRooms();
    }

    @GetMapping("/lights")
    public JsonNode lights() {
        log.debug("GET /api/hue/lights");
        return hueBridgeService.getLights();
    }

    @PutMapping("/rooms/{roomId}/name")
    public JsonNode renameRoom(@PathVariable String roomId, @RequestBody RenameRoomRequest request) {
        log.info("PUT /api/hue/rooms/{}/name", roomId);
        return hueBridgeService.renameRoom(roomId, request.name());
    }

    @GetMapping("/inventory")
    public Map<String, Object> inventory() {
        log.debug("GET /api/hue/inventory");
        return hueBridgeService.getInventory();
    }

    @GetMapping("/diagnostics")
    public Map<String, Object> diagnostics() {
        log.debug("GET /api/hue/diagnostics");
        return hueBridgeService.getDiagnostics();
    }

    @GetMapping("/status")
    public Map<String, String> status() {
        return Map.of("status", "ok");
    }

    @GetMapping("/ping")
    public Map<String, Object> ping() {
        log.debug("GET /api/hue/ping");
        return hueBridgeService.ping();
    }

    @org.springframework.web.bind.annotation.ExceptionHandler({IllegalStateException.class, RestClientException.class})
    public ResponseEntity<Map<String, String>> handleHueErrors(Exception exception) {
        HttpStatus status = exception instanceof IllegalStateException
                ? HttpStatus.SERVICE_UNAVAILABLE
                : HttpStatus.BAD_GATEWAY;
        log.warn("Hue endpoint failed with status {}: {}", status.value(), exception.getMessage());
        return ResponseEntity.status(status).body(Map.of("error", exception.getMessage()));
    }

    public record RenameRoomRequest(String name) {
    }
}
