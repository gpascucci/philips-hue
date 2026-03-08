package com.example.backend.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "hue")
public record HueProperties(
        String baseUrl,
        String apiKey,
        boolean allowSelfSignedCert
) {
}
