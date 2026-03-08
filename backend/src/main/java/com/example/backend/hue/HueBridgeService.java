package com.example.backend.hue;

import com.example.backend.config.HueProperties;
import com.fasterxml.jackson.databind.JsonNode;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.http.HttpHeaders;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

@Service
public class HueBridgeService {

    private static final Logger log = LoggerFactory.getLogger(HueBridgeService.class);

    private final RestClient restClient;
    private final HueProperties hueProperties;

    public HueBridgeService(@Qualifier("hueRestClient") RestClient hueRestClient, HueProperties hueProperties) {
        this.restClient = hueRestClient;
        this.hueProperties = hueProperties;
    }

    public JsonNode getDevices() {
        return fetchResource("device");
    }

    public JsonNode getRooms() {
        return fetchResource("room");
    }

    public JsonNode getLights() {
        return fetchResource("light");
    }

    public JsonNode renameRoom(String roomId, String roomName) {
        if (roomId == null || roomId.isBlank()) {
            throw new IllegalStateException("Room id is required");
        }
        if (roomName == null || roomName.isBlank()) {
            throw new IllegalStateException("Room name is required");
        }

        String baseUrl = requireValue(hueProperties.baseUrl(), "hue.base-url");
        String apiKey = requireValue(hueProperties.apiKey(), "hue.api-key");
        String url = baseUrl.replaceAll("/+$", "") + "/clip/v2/resource/room/" + roomId;
        log.info("Renaming room {} to '{}'", roomId, roomName);

        return restClient.put()
                .uri(url)
                .header(HttpHeaders.ACCEPT, "application/json")
                .header("hue-application-key", apiKey)
                .body(Map.of("metadata", Map.of("name", roomName)))
                .retrieve()
                .body(JsonNode.class);
    }

    public Map<String, Object> getInventory() {
        log.info("Building Hue inventory view");
        JsonNode devices = fetchResource("device").path("data");
        JsonNode lights = fetchResource("light").path("data");
        JsonNode rooms = fetchResource("room").path("data");
        JsonNode zones = fetchResource("zone").path("data");
        JsonNode connectivityItems = fetchResource("zigbee_connectivity").path("data");

        Map<String, JsonNode> lightsById = new HashMap<>();
        if (lights.isArray()) {
            for (JsonNode light : lights) {
                lightsById.put(light.path("id").asText(""), light);
            }
        }

        Map<String, String> roomNameByRid = new HashMap<>();
        Map<String, String> roomIdByRid = new HashMap<>();
        addAreaMappings(rooms, roomNameByRid, roomIdByRid);
        addAreaMappings(zones, roomNameByRid, roomIdByRid);

        Map<String, JsonNode> connectivityByDeviceId = new HashMap<>();
        if (connectivityItems.isArray()) {
            for (JsonNode connectivity : connectivityItems) {
                String ownerRid = connectivity.path("owner").path("rid").asText("");
                if (!ownerRid.isBlank()) {
                    connectivityByDeviceId.put(ownerRid, connectivity);
                }
            }
        }

        List<Map<String, Object>> rows = new ArrayList<>();
        int missingLightCount = 0;
        if (devices.isArray()) {
            for (JsonNode device : devices) {
                String deviceId = device.path("id").asText("");
                String lightRid = findServiceRid(device, "light");
                JsonNode linkedLight = lightRid == null ? null : lightsById.get(lightRid);
                JsonNode connectivity = connectivityByDeviceId.get(deviceId);
                String roomName = firstNonBlank(
                        roomNameByRid.get(deviceId),
                        roomNameByRid.get(lightRid),
                        linkedLight == null ? null : roomNameByRid.get(linkedLight.path("owner").path("rid").asText(""))
                );
                String roomId = firstNonBlank(
                        roomIdByRid.get(deviceId),
                        roomIdByRid.get(lightRid),
                        linkedLight == null ? null : roomIdByRid.get(linkedLight.path("owner").path("rid").asText(""))
                );

                boolean missingLightResource = lightRid != null && linkedLight == null;
                if (missingLightResource) {
                    missingLightCount++;
                }

                Map<String, Object> row = new HashMap<>();
                row.put("deviceId", deviceId);
                row.put("deviceName", device.path("metadata").path("name").asText(""));
                row.put("productName", device.path("product_data").path("product_name").asText(""));
                row.put("lightRid", lightRid);
                row.put("lightName", linkedLight == null ? null : linkedLight.path("metadata").path("name").asText(""));
                row.put("roomId", roomId);
                row.put("roomName", roomName);
                row.put("zigbeeStatus", connectivity == null ? null : connectivity.path("status").asText(""));
                row.put("missingLightResource", missingLightResource);
                rows.add(row);
            }
        }

        Map<String, Object> summary = new HashMap<>();
        summary.put("deviceCount", rows.size());
        summary.put("lightCount", lights.isArray() ? lights.size() : 0);
        summary.put("missingLightResourceCount", missingLightCount);
        log.info(
                "Inventory summary: devices={}, lights={}, missingLightResource={}",
                summary.get("deviceCount"),
                summary.get("lightCount"),
                summary.get("missingLightResourceCount")
        );

        Map<String, Object> response = new HashMap<>();
        response.put("data", rows);
        response.put("summary", summary);
        return response;
    }

    public Map<String, Object> ping() {
        JsonNode bridgeResponse = fetchResource("bridge");
        JsonNode firstBridge = bridgeResponse.path("data").isArray() && bridgeResponse.path("data").size() > 0
                ? bridgeResponse.path("data").get(0)
                : null;
        String bridgeId = firstBridge != null ? firstBridge.path("id").asText("") : "";
        return Map.of(
                "status", "ok",
                "bridgeId", bridgeId,
                "baseUrl", requireValue(hueProperties.baseUrl(), "hue.base-url")
        );
    }

    private JsonNode fetchResource(String resourceType) {
        String baseUrl = requireValue(hueProperties.baseUrl(), "hue.base-url");
        String apiKey = requireValue(hueProperties.apiKey(), "hue.api-key");
        String url = baseUrl.replaceAll("/+$", "") + "/clip/v2/resource/" + resourceType;
        log.debug("Fetching Hue resource '{}' from {}", resourceType, url);

        return restClient.get()
                .uri(url)
                .header(HttpHeaders.ACCEPT, "application/json")
                .header("hue-application-key", apiKey)
                .retrieve()
                .body(JsonNode.class);
    }

    private String findServiceRid(JsonNode device, String rtype) {
        JsonNode services = device.path("services");
        if (!services.isArray()) {
            return null;
        }

        for (JsonNode service : services) {
            if (rtype.equals(service.path("rtype").asText(""))) {
                String rid = service.path("rid").asText("");
                return rid.isBlank() ? null : rid;
            }
        }
        return null;
    }

    private void addAreaMappings(JsonNode areas, Map<String, String> nameByRid, Map<String, String> idByRid) {
        if (!areas.isArray()) {
            return;
        }

        for (JsonNode area : areas) {
            String areaId = area.path("id").asText("");
            String areaName = area.path("metadata").path("name").asText("");
            if (areaName.isBlank()) {
                continue;
            }

            JsonNode children = area.path("children");
            if (children.isArray()) {
                for (JsonNode child : children) {
                    String childRid = child.path("rid").asText("");
                    if (!childRid.isBlank()) {
                        nameByRid.putIfAbsent(childRid, areaName);
                        idByRid.putIfAbsent(childRid, areaId);
                    }
                }
            }

            JsonNode services = area.path("services");
            if (services.isArray()) {
                for (JsonNode service : services) {
                    String serviceRid = service.path("rid").asText("");
                    if (!serviceRid.isBlank()) {
                        nameByRid.putIfAbsent(serviceRid, areaName);
                        idByRid.putIfAbsent(serviceRid, areaId);
                    }
                }
            }
        }
    }

    private String firstNonBlank(String... values) {
        for (String value : values) {
            if (value != null && !value.isBlank()) {
                return value;
            }
        }
        return null;
    }

    private String requireValue(String value, String propertyName) {
        if (value == null || value.isBlank()) {
            throw new IllegalStateException("Missing required config: " + propertyName);
        }
        return value;
    }
}
